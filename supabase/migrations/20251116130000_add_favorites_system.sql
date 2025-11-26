-- Phase 2: Discovery & Engagement - Favorites/Wishlist System
-- Allow users to save favorite gear items for quick access

-- =====================================================
-- 1. CREATE FAVORITES TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS favorites (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  gear_id UUID NOT NULL REFERENCES gear_listings(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Ensure user can't favorite the same item twice
  UNIQUE(user_id, gear_id)
);

-- Add indexes for fast queries
CREATE INDEX IF NOT EXISTS favorites_user_id_idx ON favorites(user_id);
CREATE INDEX IF NOT EXISTS favorites_gear_id_idx ON favorites(gear_id);
CREATE INDEX IF NOT EXISTS favorites_created_at_idx ON favorites(created_at DESC);

-- Add favorite_count to gear_listings for quick display
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='gear_listings' AND column_name='favorite_count') THEN
    ALTER TABLE gear_listings ADD COLUMN favorite_count INTEGER DEFAULT 0;
  END IF;
END $$;

-- =====================================================
-- 2. CREATE TRIGGER TO UPDATE FAVORITE COUNT
-- =====================================================
CREATE OR REPLACE FUNCTION update_gear_favorite_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE gear_listings 
    SET favorite_count = favorite_count + 1 
    WHERE id = NEW.gear_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE gear_listings 
    SET favorite_count = GREATEST(favorite_count - 1, 0) 
    WHERE id = OLD.gear_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_favorite_count_trigger ON favorites;
CREATE TRIGGER update_favorite_count_trigger
AFTER INSERT OR DELETE ON favorites
FOR EACH ROW EXECUTE FUNCTION update_gear_favorite_count();

-- =====================================================
-- 3. ROW LEVEL SECURITY
-- =====================================================
ALTER TABLE favorites ENABLE ROW LEVEL SECURITY;

-- Users can view their own favorites
DROP POLICY IF EXISTS "Users can view their own favorites" ON favorites;
CREATE POLICY "Users can view their own favorites" ON favorites
  FOR SELECT
  USING (user_id = auth.uid());

-- Users can add favorites
DROP POLICY IF EXISTS "Users can add favorites" ON favorites;
CREATE POLICY "Users can add favorites" ON favorites
  FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- Users can remove their own favorites
DROP POLICY IF EXISTS "Users can remove their own favorites" ON favorites;
CREATE POLICY "Users can remove their own favorites" ON favorites
  FOR DELETE
  USING (user_id = auth.uid());

-- Allow viewing favorite counts on gear listings (aggregate data)
DROP POLICY IF EXISTS "Anyone can view gear favorite counts" ON gear_listings;
CREATE POLICY "Anyone can view gear favorite counts" ON gear_listings
  FOR SELECT
  USING (true);
