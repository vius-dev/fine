-- Enable uuid-ossp extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create custom types
CREATE TYPE user_state AS ENUM ('ACTIVE', 'GRACE', 'ESCALATED', 'RESOLVED');
CREATE TYPE contact_channel AS ENUM ('PUSH', 'EMAIL', 'SMS');

-- Create Tables
CREATE TABLE public.users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    auth_user_id UUID REFERENCES auth.users(id) NOT NULL UNIQUE,
    email TEXT,
    phone TEXT,
    last_fine_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    checkin_interval_hours INTEGER NOT NULL DEFAULT 24,
    grace_period_hours INTEGER NOT NULL DEFAULT 12,
    state user_state NOT NULL DEFAULT 'ACTIVE',
    verification_level TEXT DEFAULT 'NONE',
    ringtone_enabled BOOLEAN DEFAULT TRUE,
    ringtone_selection TEXT DEFAULT 'default',
    ringtone_volume INTEGER DEFAULT 100,
    expo_push_token TEXT,
    vacation_mode BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE public.contacts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
    name TEXT NOT NULL,
    channel contact_channel NOT NULL DEFAULT 'PUSH',
    destination TEXT NOT NULL,
    consented_at TIMESTAMP WITH TIME ZONE,
    status TEXT DEFAULT 'PENDING',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE public.user_state_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
    from_state user_state,
    to_state user_state NOT NULL,
    reason TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE public.notification_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
    type TEXT NOT NULL, -- 'REMINDER', 'ESCALATION_USER', 'ESCALATION_CONTACT'
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE public.notification_deliveries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID REFERENCES public.notification_events(id) ON DELETE CASCADE NOT NULL,
    channel contact_channel NOT NULL,
    destination TEXT NOT NULL,
    payload JSONB,
    delivered_at TIMESTAMP WITH TIME ZONE,
    error TEXT,
    retry_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- RLS Policies

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_state_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_deliveries ENABLE ROW LEVEL SECURITY;

-- Users: Read/Update own profile
CREATE POLICY "Users can read own profile" ON public.users
    FOR SELECT USING (auth.uid() = auth_user_id);

CREATE POLICY "Users can update own profile" ON public.users
    FOR UPDATE USING (auth.uid() = auth_user_id);

-- Contacts: Read/Insert/Update/Delete own contacts
CREATE POLICY "Users can read own contacts" ON public.contacts
    FOR SELECT USING (EXISTS (
        SELECT 1 FROM public.users WHERE id = public.contacts.user_id AND auth_user_id = auth.uid()
    ));

CREATE POLICY "Users can insert own contacts" ON public.contacts
    FOR INSERT WITH CHECK (EXISTS (
        SELECT 1 FROM public.users WHERE id = user_id AND auth_user_id = auth.uid()
    ));

CREATE POLICY "Users can update own contacts" ON public.contacts
    FOR UPDATE USING (EXISTS (
        SELECT 1 FROM public.users WHERE id = user_id AND auth_user_id = auth.uid()
    ));

CREATE POLICY "Users can delete own contacts" ON public.contacts
    FOR DELETE USING (EXISTS (
        SELECT 1 FROM public.users WHERE id = user_id AND auth_user_id = auth.uid()
    ));

-- Events: Read own events
CREATE POLICY "Users can read own state events" ON public.user_state_events
    FOR SELECT USING (EXISTS (
        SELECT 1 FROM public.users WHERE id = user_id AND auth_user_id = auth.uid()
    ));

CREATE POLICY "Users can read own notification events" ON public.notification_events
    FOR SELECT USING (EXISTS (
        SELECT 1 FROM public.users WHERE id = user_id AND auth_user_id = auth.uid()
    ));

CREATE POLICY "Users can read own notification deliveries" ON public.notification_deliveries
    FOR SELECT USING (EXISTS (
        SELECT 1 FROM public.notification_events ne
        JOIN public.users u ON ne.user_id = u.id
        WHERE ne.id = event_id AND u.auth_user_id = auth.uid()
    ));

-- Grant access to authenticated users
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- Automatically create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.users (auth_user_id, email)
    VALUES (NEW.id, NEW.email);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Log state transitions automatically
CREATE OR REPLACE FUNCTION public.log_user_state_change()
RETURNS TRIGGER AS $$
BEGIN
    IF (OLD.state IS DISTINCT FROM NEW.state) THEN
        INSERT INTO public.user_state_events (user_id, from_state, to_state, reason)
        VALUES (NEW.id, OLD.state, NEW.state, 'System monitor transition');
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_user_state_changed
    AFTER UPDATE OF state ON public.users
    FOR EACH ROW EXECUTE FUNCTION public.log_user_state_change();

-- Function to be called by cron/edge function to monitor checkins
CREATE OR REPLACE FUNCTION public.monitor_checkins()
RETURNS TABLE (id UUID, state user_state) AS $$
BEGIN
    -- ACTIVE -> GRACE
    RETURN QUERY
    UPDATE public.users u
    SET state = 'GRACE',
        updated_at = NOW()
    WHERE u.state = 'ACTIVE'
      AND u.vacation_mode = FALSE
      AND u.last_fine_at < NOW() - (u.checkin_interval_hours * INTERVAL '1 hour')
    RETURNING u.id, u.state;

    -- GRACE -> ESCALATED
    RETURN QUERY
    UPDATE public.users u
    SET state = 'ESCALATED',
        updated_at = NOW()
    WHERE u.state = 'GRACE'
      AND u.vacation_mode = FALSE
      AND u.last_fine_at < NOW() - ((u.checkin_interval_hours + u.grace_period_hours) * INTERVAL '1 hour')
    RETURNING u.id, u.state;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
