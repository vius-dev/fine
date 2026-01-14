-- Add check-in reminder preferences to users table

-- Add reminder configuration fields
ALTER TABLE public.users 
ADD COLUMN reminder_enabled BOOLEAN DEFAULT TRUE,
ADD COLUMN reminder_offset_hours INTEGER DEFAULT 0;

-- Add comment for clarity
COMMENT ON COLUMN public.users.reminder_enabled IS 'Whether to send check-in reminder notifications';
COMMENT ON COLUMN public.users.reminder_offset_hours IS 'Hours before check-in to send reminder (0 = when due, 1 = 1hr before, etc.)';
