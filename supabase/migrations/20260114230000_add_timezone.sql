-- Add timezone column to users table
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS timezone TEXT;

-- Set default to UTC for existing users
UPDATE public.users SET timezone = 'UTC' WHERE timezone IS NULL;
