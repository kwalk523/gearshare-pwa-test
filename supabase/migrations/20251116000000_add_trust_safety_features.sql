-- Phase 1: Trust & Safety Features
-- Enhance existing ratings table, add Messaging & Condition Checklists
-- Note: Uses existing 'ratings' table and 'rental_requests' table from Supabase

-- =====================================================
-- 1. ENHANCE EXISTING RATINGS TABLE
-- =====================================================
-- Add new columns to existing ratings table for enhanced functionality
DO $$ 
BEGIN
  -- Add review_type to distinguish between lender and renter reviews
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='ratings' AND column_name='review_type') THEN
    ALTER TABLE ratings ADD COLUMN review_type TEXT CHECK (review_type IN ('lender_to_renter', 'renter_to_lender'));
  END IF;
  
  -- Add reviewee_id to track who is being reviewed
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='ratings' AND column_name='reviewee_id') THEN
    ALTER TABLE ratings ADD COLUMN reviewee_id UUID REFERENCES profiles(id) ON DELETE CASCADE;
  END IF;
  
  -- Add helpful_count for community feedback
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='ratings' AND column_name='helpful_count') THEN
    ALTER TABLE ratings ADD COLUMN helpful_count INTEGER DEFAULT 0;
  END IF;
  
  -- Add visibility flag for moderation
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='ratings' AND column_name='is_visible') THEN
    ALTER TABLE ratings ADD COLUMN is_visible BOOLEAN DEFAULT true;
  END IF;
  
  -- Add updated_at timestamp
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='ratings' AND column_name='updated_at') THEN
    ALTER TABLE ratings ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();
  END IF;
END $$;

-- Add index for reviewee queries
CREATE INDEX IF NOT EXISTS ratings_reviewee_id_idx ON ratings(reviewee_id);

-- Ensure RLS is enabled
ALTER TABLE ratings ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist and recreate with enhanced logic
DROP POLICY IF EXISTS "Anyone can view visible ratings" ON ratings;
DROP POLICY IF EXISTS "Users can create ratings for completed rentals" ON ratings;
DROP POLICY IF EXISTS "Users can update their own ratings" ON ratings;

-- Enhanced policies for ratings
CREATE POLICY "Anyone can view visible ratings" ON ratings
  FOR SELECT USING (is_visible = true OR rater_id = auth.uid());

CREATE POLICY "Users can create ratings for their rentals" ON ratings
  FOR INSERT WITH CHECK (auth.uid() = rater_id);

CREATE POLICY "Users can update their own ratings" ON ratings
  FOR UPDATE USING (auth.uid() = rater_id);

-- =====================================================
-- 2. ENHANCE EXISTING MESSAGING TABLES
-- =====================================================
-- Your messaging system already exists from migration 20251116120000
-- Add gear_listing_id to conversations for context
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='conversations' AND column_name='gear_listing_id') THEN
    ALTER TABLE conversations ADD COLUMN gear_listing_id UUID REFERENCES gear_listings(id) ON DELETE SET NULL;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='conversations' AND column_name='last_message_at') THEN
    ALTER TABLE conversations ADD COLUMN last_message_at TIMESTAMPTZ DEFAULT NOW();
  END IF;
END $$;

-- Add index for gear listing conversations
CREATE INDEX IF NOT EXISTS idx_conversations_gear_listing ON conversations(gear_listing_id);

-- Create or replace function to update conversation last_message_at
CREATE OR REPLACE FUNCTION update_conversation_last_message()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE conversations
  SET last_message_at = NEW.created_at
  WHERE id = NEW.conversation_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop and recreate trigger for last_message_at updates
DROP TRIGGER IF EXISTS trigger_update_conversation_last_message ON messages;
CREATE TRIGGER trigger_update_conversation_last_message
  AFTER INSERT ON messages
  FOR EACH ROW
  EXECUTE FUNCTION update_conversation_last_message();

-- =====================================================
-- 3. CONDITION CHECKLISTS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS condition_checklists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rental_id UUID NOT NULL REFERENCES rental_requests(id) ON DELETE CASCADE,
  gear_listing_id UUID NOT NULL REFERENCES gear_listings(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  checklist_type TEXT NOT NULL CHECK (checklist_type IN ('pickup', 'return')),
  
  -- Condition fields
  overall_condition TEXT CHECK (overall_condition IN ('excellent', 'good', 'fair', 'poor', 'damaged')),
  physical_damage BOOLEAN DEFAULT false,
  physical_damage_notes TEXT,
  missing_parts BOOLEAN DEFAULT false,
  missing_parts_notes TEXT,
  functionality_issues BOOLEAN DEFAULT false,
  functionality_notes TEXT,
  cleanliness_rating INTEGER CHECK (cleanliness_rating >= 1 AND cleanliness_rating <= 5),
  additional_notes TEXT,
  
  -- Photo evidence
  photo_urls TEXT[], -- Array of photo URLs
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- One checklist per rental per type
  UNIQUE(rental_id, checklist_type)
);

-- Indexes for condition checklists
CREATE INDEX idx_checklists_rental ON condition_checklists(rental_id);
CREATE INDEX idx_checklists_gear ON condition_checklists(gear_listing_id);
CREATE INDEX idx_checklists_user ON condition_checklists(user_id);

-- Enable RLS for condition checklists
ALTER TABLE condition_checklists ENABLE ROW LEVEL SECURITY;

-- Condition checklist policies
CREATE POLICY "Users can view checklists for their rentals" ON condition_checklists
  FOR SELECT USING (
    auth.uid() = user_id OR
    EXISTS (
      SELECT 1 FROM rental_requests r
      JOIN gear_listings g ON g.id = r.gear_id
      WHERE r.id = rental_id
      AND (r.renter_id = auth.uid() OR g.owner_id = auth.uid())
    )
  );

CREATE POLICY "Users can create checklists for their rentals" ON condition_checklists
  FOR INSERT WITH CHECK (
    auth.uid() = user_id AND
    EXISTS (
      SELECT 1 FROM rental_requests r
      JOIN gear_listings g ON g.id = r.gear_id
      WHERE r.id = rental_id
      AND (r.renter_id = auth.uid() OR g.owner_id = auth.uid())
    )
  );

CREATE POLICY "Users can update their own checklists" ON condition_checklists
  FOR UPDATE USING (auth.uid() = user_id);

-- =====================================================
-- 4. UPDATE PROFILES TABLE FOR RATINGS
-- =====================================================
-- Add rating fields to profiles if they don't exist
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='average_rating') THEN
    ALTER TABLE profiles ADD COLUMN average_rating DECIMAL(3,2) DEFAULT 0.0;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='total_reviews') THEN
    ALTER TABLE profiles ADD COLUMN total_reviews INTEGER DEFAULT 0;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='response_time_hours') THEN
    ALTER TABLE profiles ADD COLUMN response_time_hours DECIMAL(5,2);
  END IF;
END $$;

-- Function to update user ratings after rating is added/updated
CREATE OR REPLACE FUNCTION update_user_rating()
RETURNS TRIGGER AS $$
BEGIN
  -- Update the reviewee's average rating and review count
  IF NEW.reviewee_id IS NOT NULL THEN
    UPDATE profiles
    SET 
      average_rating = (
        SELECT ROUND(AVG(rating)::numeric, 2)
        FROM ratings
        WHERE reviewee_id = NEW.reviewee_id AND is_visible = true
      ),
      total_reviews = (
        SELECT COUNT(*)
        FROM ratings
        WHERE reviewee_id = NEW.reviewee_id AND is_visible = true
      )
    WHERE id = NEW.reviewee_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_user_rating ON ratings;

CREATE TRIGGER trigger_update_user_rating
  AFTER INSERT OR UPDATE OF rating, reviewee_id, is_visible ON ratings
  FOR EACH ROW
  EXECUTE FUNCTION update_user_rating();

-- =====================================================
-- 5. ADD REVIEW STATUS TO RENTAL_REQUESTS
-- =====================================================
-- Add columns to track review completion status
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='rental_requests' AND column_name='renter_reviewed') THEN
    ALTER TABLE rental_requests ADD COLUMN renter_reviewed BOOLEAN DEFAULT false;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='rental_requests' AND column_name='lender_reviewed') THEN
    ALTER TABLE rental_requests ADD COLUMN lender_reviewed BOOLEAN DEFAULT false;
  END IF;
END $$;

-- =====================================================
-- COMMENTS
-- =====================================================
COMMENT ON TABLE ratings IS 'Enhanced user ratings and reviews for renters and lenders';
COMMENT ON TABLE conversations IS 'Private conversations between users about gear listings';
COMMENT ON TABLE messages IS 'Individual messages within conversations';
COMMENT ON TABLE condition_checklists IS 'Detailed condition assessments at pickup and return';
