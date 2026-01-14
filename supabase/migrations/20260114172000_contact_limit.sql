-- Add contact limit constraint to prevent spam
-- This ensures one email/phone can only be added by a limited number of users

-- Add a function to check contact limit before insertion
CREATE OR REPLACE FUNCTION public.check_contact_limit()
RETURNS TRIGGER AS $$
DECLARE
    contact_count INTEGER;
    max_contacts_per_destination INTEGER := 10; -- Configurable limit
BEGIN
    -- Count how many times this destination has been added across all users
    SELECT COUNT(*)
    INTO contact_count
    FROM public.contacts
    WHERE destination = NEW.destination
      AND status = 'CONFIRMED'; -- Only count confirmed contacts
    
    -- If limit exceeded, prevent insertion
    IF contact_count >= max_contacts_per_destination THEN
        RAISE EXCEPTION 'This contact has reached the maximum limit of % users. Please choose a different contact.', max_contacts_per_destination;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger to enforce limit on contact insertion
DROP TRIGGER IF EXISTS enforce_contact_limit ON public.contacts;
CREATE TRIGGER enforce_contact_limit
    BEFORE INSERT ON public.contacts
    FOR EACH ROW
    EXECUTE FUNCTION public.check_contact_limit();

-- Also check on status update to CONFIRMED
DROP TRIGGER IF EXISTS enforce_contact_limit_on_confirm ON public.contacts;
CREATE TRIGGER enforce_contact_limit_on_confirm
    BEFORE UPDATE OF status ON public.contacts
    FOR EACH ROW
    WHEN (NEW.status = 'CONFIRMED' AND OLD.status != 'CONFIRMED')
    EXECUTE FUNCTION public.check_contact_limit();

-- Add helper function to check remaining slots for a destination
CREATE OR REPLACE FUNCTION public.get_contact_availability(destination_email TEXT)
RETURNS JSON AS $$
DECLARE
    contact_count INTEGER;
    max_contacts INTEGER := 10;
    remaining INTEGER;
BEGIN
    SELECT COUNT(*)
    INTO contact_count
    FROM public.contacts
    WHERE destination = destination_email
      AND status = 'CONFIRMED';
    
    remaining := max_contacts - contact_count;
    
    RETURN json_build_object(
        'destination', destination_email,
        'current_count', contact_count,
        'max_allowed', max_contacts,
        'remaining_slots', GREATEST(0, remaining),
        'is_available', remaining > 0
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
