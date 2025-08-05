/*
  # Update users table to work with Supabase Auth

  1. Changes
    - Add password column for plain text storage
    - Ensure id can be set manually to match auth.users
    - Keep all existing functionality

  2. Security
    - Maintain existing RLS policies
    - Keep admin access controls
*/

-- Add password column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'password'
  ) THEN
    ALTER TABLE users ADD COLUMN password text;
  END IF;
END $$;

-- Update the id column to allow manual setting (for Supabase auth integration)
ALTER TABLE users ALTER COLUMN id SET DEFAULT gen_random_uuid();