-- Secure functions by setting explicit search_path

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER 
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    INSERT INTO public.users (auth_user_id, email)
    VALUES (NEW.id, NEW.email);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.log_user_state_change()
RETURNS TRIGGER 
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF (OLD.state IS DISTINCT FROM NEW.state) THEN
        INSERT INTO public.user_state_events (user_id, from_state, to_state, reason)
        VALUES (NEW.id, OLD.state, NEW.state, 'System monitor transition');
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.monitor_checkins()
RETURNS TABLE (id UUID, state user_state) 
SECURITY DEFINER
SET search_path = public
AS $$
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
$$ LANGUAGE plpgsql;
