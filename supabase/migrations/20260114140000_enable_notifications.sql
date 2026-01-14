-- Create a function to trigger the dispatch-notifications Edge Function
CREATE OR REPLACE FUNCTION public.trigger_dispatch_notifications()
RETURNS TRIGGER AS $$
DECLARE
    NET_ID text; -- Net ID for http_post, unused but required for syntax if capturing
BEGIN
    -- Only trigger when state changes TO 'ESCALATED'
    IF NEW.state = 'ESCALATED' AND (OLD.state IS DISTINCT FROM 'ESCALATED') THEN
        -- Call the Edge Function via pg_net (or http extension if available)
        -- Ideally, we use Supabase Database Webhooks (UI configured), but for code-first we can use http extension
        -- However, Supabase standardized on using Database Webhooks which are often configured in the Dashboard or via API.
        -- A robust SQL-only way in standard Supabase is using `pg_net` or `http`.
        
        -- SIMPLIFIED APPROACH: Insert into a queue table, and have the Edge Function purely triggered by Cron or Insert?
        -- user request was "sending email and sms".
        -- The Edge Function `dispatch-notifications` expects { user_id: ... }
        
        -- Let's use the standard `http` extension if available, or just log for now if we assume Dashboard Webhook setup.
        -- BUT, for a complete solution, logging an event to `notification_events` is the best "trigger" source.
        
        INSERT INTO public.notification_events (user_id, type, channel, metadata)
        SELECT 
            NEW.id, 
            'ESCALATION', 
            c.channel, 
            jsonb_build_object('destination', c.destination)
        FROM public.contacts c
        WHERE c.user_id = NEW.id AND c.status = 'CONFIRMED';
        
        -- In a real production Supabase app, we would configure a Database Webhook 
        -- to POST to https://<project>.supabase.co/functions/v1/dispatch-notifications
        -- whenever a row is inserted into `notification_events`.
        
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create Trigger on Users table
DROP TRIGGER IF EXISTS on_user_escalation ON public.users;
CREATE TRIGGER on_user_escalation
    AFTER UPDATE ON public.users
    FOR EACH ROW
    EXECUTE FUNCTION public.trigger_dispatch_notifications();
