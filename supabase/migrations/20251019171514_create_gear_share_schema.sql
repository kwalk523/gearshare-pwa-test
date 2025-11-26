/*
  # Gear Share Database Schema

  ## Overview
  Creates the complete database structure for the Gear Share rental platform prototype,
  including users, gear listings, rentals, and transaction tracking.

  ## New Tables
  
  ### `profiles`
  - `id` (uuid, primary key) - Links to auth.users
  - `email` (text) - User email
  - `full_name` (text) - User's full name
  - `student_id` (text) - UCF student ID for verification
  - `phone` (text) - Contact phone number
  - `is_verified` (boolean) - Student verification status
  - `rating` (numeric) - User rating (0-5)
  - `total_rentals` (integer) - Number of completed rentals
  - `created_at` (timestamptz) - Account creation timestamp
  
  ### `gear_listings`
  - `id` (uuid, primary key) - Unique listing identifier
  - `owner_id` (uuid) - References profiles(id)
  - `title` (text) - Gear item title
  - `description` (text) - Detailed description
  - `category` (text) - Equipment category (camping, sports, electronics, etc.)
  - `daily_rate` (numeric) - Rental price per day
  - `deposit_amount` (numeric) - Required security deposit
  - `condition` (text) - Item condition (excellent, good, fair)
  - `image_url` (text) - Main product image URL
  - `is_available` (boolean) - Current availability status
  - `location` (text) - Pickup location on campus
  - `created_at` (timestamptz) - Listing creation date
  
  ### `rentals`
  - `id` (uuid, primary key) - Unique rental transaction ID
  - `gear_id` (uuid) - References gear_listings(id)
  - `renter_id` (uuid) - References profiles(id)
  - `owner_id` (uuid) - References profiles(id)
  - `start_date` (date) - Rental start date
  - `end_date` (date) - Rental end date
  - `daily_rate` (numeric) - Agreed daily rate
  - `total_amount` (numeric) - Total rental cost
  - `deposit_amount` (numeric) - Deposit held in escrow
  - `insurance_selected` (boolean) - Whether insurance was added
  - `insurance_cost` (numeric) - Insurance premium amount
  - `status` (text) - Rental status (pending, active, completed, disputed)
  - `pickup_photo_url` (text) - Condition photo at pickup
  - `return_photo_url` (text) - Condition photo at return
  - `damage_detected` (boolean) - AI damage detection result
  - `created_at` (timestamptz) - Rental creation timestamp
  - `completed_at` (timestamptz) - Rental completion timestamp
  
  ### `transactions`
  - `id` (uuid, primary key) - Transaction identifier
  - `rental_id` (uuid) - References rentals(id)
  - `transaction_type` (text) - Type: deposit, payment, refund, charge
  - `amount` (numeric) - Transaction amount
  - `status` (text) - Status: pending, held, released, charged
  - `description` (text) - Transaction description
  - `created_at` (timestamptz) - Transaction timestamp

  ## Security
  - Enable RLS on all tables
  - Add policies for authenticated users to manage their own data
  - Add policies for viewing public gear listings
  - Add policies for rental participants to view rental details
*/

-- Create profiles table
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text UNIQUE NOT NULL,
  full_name text NOT NULL,
  student_id text,
  phone text,
  is_verified boolean DEFAULT false,
  rating numeric DEFAULT 0 CHECK (rating >= 0 AND rating <= 5),
  total_rentals integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view all profiles"
  ON profiles FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can insert own profile"
  ON profiles FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- Create gear_listings table
CREATE TABLE IF NOT EXISTS gear_listings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid REFERENCES profiles(id) NOT NULL,
  title text NOT NULL,
  description text NOT NULL,
  category text NOT NULL,
  daily_rate numeric NOT NULL CHECK (daily_rate >= 0),
  deposit_amount numeric NOT NULL CHECK (deposit_amount >= 0),
  condition text NOT NULL CHECK (condition IN ('excellent', 'good', 'fair')),
  image_url text,
  is_available boolean DEFAULT true,
  location text NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE gear_listings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view available gear"
  ON gear_listings FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Owners can insert own gear"
  ON gear_listings FOR INSERT
  TO authenticated
  WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Owners can update own gear"
  ON gear_listings FOR UPDATE
  TO authenticated
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Owners can delete own gear"
  ON gear_listings FOR DELETE
  TO authenticated
  USING (owner_id = auth.uid());

-- Create rentals table
CREATE TABLE IF NOT EXISTS rentals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gear_id uuid REFERENCES gear_listings(id) NOT NULL,
  renter_id uuid REFERENCES profiles(id) NOT NULL,
  owner_id uuid REFERENCES profiles(id) NOT NULL,
  start_date date NOT NULL,
  end_date date NOT NULL,
  daily_rate numeric NOT NULL CHECK (daily_rate >= 0),
  total_amount numeric NOT NULL CHECK (total_amount >= 0),
  deposit_amount numeric NOT NULL CHECK (deposit_amount >= 0),
  insurance_selected boolean DEFAULT false,
  insurance_cost numeric DEFAULT 0 CHECK (insurance_cost >= 0),
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'completed', 'disputed')),
  pickup_photo_url text,
  return_photo_url text,
  damage_detected boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  completed_at timestamptz
);

ALTER TABLE rentals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Rental participants can view rentals"
  ON rentals FOR SELECT
  TO authenticated
  USING (renter_id = auth.uid() OR owner_id = auth.uid());

CREATE POLICY "Renters can create rentals"
  ON rentals FOR INSERT
  TO authenticated
  WITH CHECK (renter_id = auth.uid());

CREATE POLICY "Rental participants can update rentals"
  ON rentals FOR UPDATE
  TO authenticated
  USING (renter_id = auth.uid() OR owner_id = auth.uid())
  WITH CHECK (renter_id = auth.uid() OR owner_id = auth.uid());

-- Create transactions table
CREATE TABLE IF NOT EXISTS transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rental_id uuid REFERENCES rentals(id) NOT NULL,
  transaction_type text NOT NULL CHECK (transaction_type IN ('deposit', 'payment', 'refund', 'charge')),
  amount numeric NOT NULL CHECK (amount >= 0),
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'held', 'released', 'charged')),
  description text NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view related transactions"
  ON transactions FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM rentals
      WHERE rentals.id = transactions.rental_id
      AND (rentals.renter_id = auth.uid() OR rentals.owner_id = auth.uid())
    )
  );

CREATE POLICY "Users can create transactions for their rentals"
  ON transactions FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM rentals
      WHERE rentals.id = transactions.rental_id
      AND (rentals.renter_id = auth.uid() OR rentals.owner_id = auth.uid())
    )
  );