-- Add contact linking support for in-app notifications
-- This allows contacts who are also ImFine users to receive push notifications

-- Add linked_user_id to contacts table
ALTER TABLE public.contacts 
ADD COLUMN linked_user_id UUID REFERENCES public.users(id) ON DELETE SET NULL;

-- Add index for performance
CREATE INDEX idx_contacts_linked_user_id ON public.contacts(linked_user_id);

-- Add index on users email and phone for lookup
CREATE INDEX idx_users_email ON public.users(email);
CREATE INDEX idx_users_phone ON public.users(phone);

-- Function to automatically link contacts to existing users
CREATE OR REPLACE FUNCTION public.auto_link_contacts()
RETURNS TRIGGER AS $$
BEGIN
    -- When a contact is added, check if destination matches an existing user
    IF NEW.linked_user_id IS NULL THEN
        -- Try to find matching user by email or phone
        UPDATE public.contacts
        SET linked_user_id = (
            SELECT id FROM public.users
            WHERE email = NEW.destination OR phone = NEW.destination
            LIMIT 1
        )
        WHERE id = NEW.id;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to auto-link on contact insert
CREATE TRIGGER on_contact_insert_auto_link
    AFTER INSERT ON public.contacts
    FOR EACH ROW
    EXECUTE FUNCTION public.auto_link_contacts();

-- Function to link existing contacts when a new user signs up
CREATE OR REPLACE FUNCTION public.link_existing_contacts_on_signup()
RETURNS TRIGGER AS $$
BEGIN
    -- When a new user signs up, link any existing contacts that match their email/phone
    UPDATE public.contacts
    SET linked_user_id = NEW.id
    WHERE (destination = NEW.email OR destination = NEW.phone)
      AND linked_user_id IS NULL;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to link contacts on user signup
CREATE TRIGGER on_user_signup_link_contacts
    AFTER INSERT ON public.users
    FOR EACH ROW
    EXECUTE FUNCTION public.link_existing_contacts_on_signup();

-- Also link contacts when user updates their email/phone
CREATE TRIGGER on_user_update_link_contacts
    AFTER UPDATE OF email, phone ON public.users
    FOR EACH ROW
    WHEN (OLD.email IS DISTINCT FROM NEW.email OR OLD.phone IS DISTINCT FROM NEW.phone)
    EXECUTE FUNCTION public.link_existing_contacts_on_signup();
