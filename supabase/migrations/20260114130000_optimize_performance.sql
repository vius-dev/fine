-- Performance: Add indexes for foreign keys
CREATE INDEX IF NOT EXISTS contacts_user_id_idx ON public.contacts(user_id);
CREATE INDEX IF NOT EXISTS notification_events_user_id_idx ON public.notification_events(user_id);
CREATE INDEX IF NOT EXISTS notification_deliveries_event_id_idx ON public.notification_deliveries(event_id);
CREATE INDEX IF NOT EXISTS user_state_events_user_id_idx ON public.user_state_events(user_id);

-- Performance: Optimize RLS policies to avoid re-evaluating auth.uid()

-- Users
DROP POLICY IF EXISTS "Users can read own profile" ON public.users;
CREATE POLICY "Users can read own profile" ON public.users
    FOR SELECT USING ((select auth.uid()) = auth_user_id);

DROP POLICY IF EXISTS "Users can update own profile" ON public.users;
CREATE POLICY "Users can update own profile" ON public.users
    FOR UPDATE USING ((select auth.uid()) = auth_user_id);

-- Contacts
DROP POLICY IF EXISTS "Users can read own contacts" ON public.contacts;
CREATE POLICY "Users can read own contacts" ON public.contacts
    FOR SELECT USING (EXISTS (
        SELECT 1 FROM public.users WHERE id = public.contacts.user_id AND auth_user_id = (select auth.uid())
    ));

DROP POLICY IF EXISTS "Users can insert own contacts" ON public.contacts;
CREATE POLICY "Users can insert own contacts" ON public.contacts
    FOR INSERT WITH CHECK (EXISTS (
        SELECT 1 FROM public.users WHERE id = user_id AND auth_user_id = (select auth.uid())
    ));

DROP POLICY IF EXISTS "Users can update own contacts" ON public.contacts;
CREATE POLICY "Users can update own contacts" ON public.contacts
    FOR UPDATE USING (EXISTS (
        SELECT 1 FROM public.users WHERE id = user_id AND auth_user_id = (select auth.uid())
    ));

DROP POLICY IF EXISTS "Users can delete own contacts" ON public.contacts;
CREATE POLICY "Users can delete own contacts" ON public.contacts
    FOR DELETE USING (EXISTS (
        SELECT 1 FROM public.users WHERE id = user_id AND auth_user_id = (select auth.uid())
    ));

-- User State Events
DROP POLICY IF EXISTS "Users can read own state events" ON public.user_state_events;
CREATE POLICY "Users can read own state events" ON public.user_state_events
    FOR SELECT USING (EXISTS (
        SELECT 1 FROM public.users WHERE id = user_id AND auth_user_id = (select auth.uid())
    ));

-- Notification Events
DROP POLICY IF EXISTS "Users can read own notification events" ON public.notification_events;
CREATE POLICY "Users can read own notification events" ON public.notification_events
    FOR SELECT USING (EXISTS (
        SELECT 1 FROM public.users WHERE id = user_id AND auth_user_id = (select auth.uid())
    ));

-- Notification Deliveries
DROP POLICY IF EXISTS "Users can read own notification deliveries" ON public.notification_deliveries;
CREATE POLICY "Users can read own notification deliveries" ON public.notification_deliveries
    FOR SELECT USING (EXISTS (
        SELECT 1 FROM public.notification_events ne
        JOIN public.users u ON ne.user_id = u.id
        WHERE ne.id = event_id AND u.auth_user_id = (select auth.uid())
    ));
