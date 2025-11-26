/*
  # Fix profiles table to link with auth.users

  1. Changes
    - Drop all RLS policies first
    - Drop foreign key constraints
    - Recreate id column to reference auth.users
    - Add trigger to automatically create profile when user signs up
  
  2. Security
    - Recreate RLS policies to work with auth.uid()
*/

-- Drop all existing policies first
DROP POLICY IF EXISTS "Profiles are viewable by authenticated users" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON profiles;
DROP POLICY IF EXISTS "Users can view all verified profiles" ON profiles;
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
DROP POLICY IF EXISTS "Gear listings viewable by all" ON gear_listings;
DROP POLICY IF EXISTS "Users can create listings" ON gear_listings;
DROP POLICY IF EXISTS "Owners can update own listings" ON gear_listings;
DROP POLICY IF EXISTS "Owners can delete own listings" ON gear_listings;

-- Drop foreign key constraints on related tables
ALTER TABLE gear_listings DROP CONSTRAINT IF EXISTS gear_listings_owner_id_fkey;
ALTER TABLE rentals DROP CONSTRAINT IF EXISTS rentals_owner_id_fkey;
ALTER TABLE rentals DROP CONSTRAINT IF EXISTS rentals_renter_id_fkey;

-- Drop and recreate profiles table with proper auth linkage
DROP TABLE IF EXISTS profiles CASCADE;

CREATE TABLE profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text UNIQUE NOT NULL,
  full_name text NOT NULL,
  student_id text,
  phone text,
  is_verified boolean DEFAULT false,
  rating numeric DEFAULT 0 CHECK (rating >= 0 AND rating <= 5),
  total_rentals integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view all verified profiles"
  ON profiles FOR SELECT
  TO authenticated
  USING (is_verified = true);

CREATE POLICY "Users can view own profile"
  ON profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
  ON profiles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

-- Backfill profiles for existing auth users (so FKs won’t fail)
INSERT INTO public.profiles (id, email, full_name, is_verified)
SELECT u.id, u.email, COALESCE(u.raw_user_meta_data->>'full_name', ''), false
FROM auth.users u
ON CONFLICT (id) DO NOTHING;

-- Clean up orphaned data that cannot satisfy new FKs
DELETE FROM rentals r
WHERE NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = r.owner_id)
  OR NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = r.renter_id);

DELETE FROM gear_listings g
WHERE NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = g.owner_id);

-- Recreate foreign key constraints
ALTER TABLE gear_listings 
  ADD CONSTRAINT gear_listings_owner_id_fkey 
  FOREIGN KEY (owner_id) REFERENCES profiles(id) ON DELETE CASCADE;

ALTER TABLE rentals 
  ADD CONSTRAINT rentals_owner_id_fkey 
  FOREIGN KEY (owner_id) REFERENCES profiles(id) ON DELETE CASCADE;

ALTER TABLE rentals 
  ADD CONSTRAINT rentals_renter_id_fkey 
  FOREIGN KEY (renter_id) REFERENCES profiles(id) ON DELETE CASCADE;

-- Recreate gear_listings policies
CREATE POLICY "Gear listings viewable by all"
  ON gear_listings FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can create listings"
  ON gear_listings FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Owners can update own listings"
  ON gear_listings FOR UPDATE
  TO authenticated
  USING (auth.uid() = owner_id)
  WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Owners can delete own listings"
  ON gear_listings FOR DELETE
  TO authenticated
  USING (auth.uid() = owner_id);

-- Create function to handle new user creation
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, is_verified)
  VALUES (
    new.id,
    new.email,
    COALESCE(new.raw_user_meta_data->>'full_name', ''),
    false
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for new user signup
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();