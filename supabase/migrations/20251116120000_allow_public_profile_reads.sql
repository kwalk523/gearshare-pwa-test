-- Allow reading public profile information for reviews
-- This enables displaying reviewer names and avatars

-- Drop existing policy if it exists
DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON profiles;

-- Create policy to allow anyone to read basic profile info
CREATE POLICY "Public profiles are viewable by everyone" ON profiles
  FOR SELECT
  USING (true);

-- Ensure RLS is enabled
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
