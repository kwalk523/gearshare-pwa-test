/*
  # Enhanced Pricing System Migration

  ## Overview
  Enhances the gear_listings table to support comprehensive pricing system
  with equipment detection, purchase price tracking, and model identification.

  ## Changes
  
  ### `gear_listings` table additions:
  - `purchase_price` (numeric) - Original equipment purchase price for deposit/insurance calculation
  - `equipment_model` (text) - Detected equipment model for auto-pricing
  - `price_validated` (boolean) - Whether pricing has been validated against market rates
  - `suggested_daily_rate` (numeric) - System-suggested pricing based on equipment model
  
  ### New functions:
  - Trigger to automatically suggest pricing when equipment model is detected
  - Function to calculate insurance rates based on equipment value
  - Function to calculate deposits based on purchase price and insurance selection

  ## Security
  - Maintains existing RLS policies
  - Adds validation for new pricing fields
*/

-- Add new columns to gear_listings table
ALTER TABLE gear_listings 
ADD COLUMN IF NOT EXISTS purchase_price numeric CHECK (purchase_price >= 0),
ADD COLUMN IF NOT EXISTS equipment_model text,
ADD COLUMN IF NOT EXISTS price_validated boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS suggested_daily_rate numeric CHECK (suggested_daily_rate >= 0);

-- Create function to calculate insurance cost based on purchase price and duration
CREATE OR REPLACE FUNCTION calculate_insurance_cost(
  purchase_price numeric,
  rental_days integer,
  insurance_rate numeric DEFAULT 0.025
) RETURNS numeric AS $$
BEGIN
  IF purchase_price IS NULL OR rental_days IS NULL THEN
    RETURN 0;
  END IF;
  
  -- Calculate insurance as percentage of purchase price
  -- Default rate is 2.5% for short term rentals
  RETURN ROUND((purchase_price * insurance_rate * rental_days / 365), 2);
END;
$$ LANGUAGE plpgsql;

-- Create function to calculate deposit amount based on purchase price and insurance
CREATE OR REPLACE FUNCTION calculate_deposit_amount(
  purchase_price numeric,
  has_insurance boolean DEFAULT false
) RETURNS numeric AS $$
BEGIN
  IF purchase_price IS NULL THEN
    RETURN 0;
  END IF;
  
  -- If insurance is selected, no deposit required
  -- Otherwise, deposit is 50% of purchase price
  IF has_insurance THEN
    RETURN 0;
  ELSE
    RETURN ROUND(purchase_price * 0.5, 2);
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Create function to suggest daily rate based on equipment model
CREATE OR REPLACE FUNCTION suggest_daily_rate(
  equipment_model_param text,
  purchase_price_param numeric DEFAULT NULL
) RETURNS numeric AS $$
DECLARE
  suggested_rate numeric;
BEGIN
  -- Base rate calculation: 3-5% of purchase price per day
  -- Or use equipment model specific rates
  
  IF purchase_price_param IS NOT NULL THEN
    suggested_rate := ROUND(purchase_price_param * 0.04, 2); -- 4% of purchase price
  ELSE
    suggested_rate := 50; -- Default fallback rate
  END IF;
  
  -- Equipment-specific adjustments could be added here
  -- For now, return the calculated rate
  RETURN suggested_rate;
END;
$$ LANGUAGE plpgsql;

-- Create trigger function to auto-suggest pricing when equipment model is set
CREATE OR REPLACE FUNCTION auto_suggest_pricing()
RETURNS TRIGGER AS $$
BEGIN
  -- If equipment model is provided and purchase price exists, suggest daily rate
  IF NEW.equipment_model IS NOT NULL AND NEW.purchase_price IS NOT NULL THEN
    NEW.suggested_daily_rate := suggest_daily_rate(NEW.equipment_model, NEW.purchase_price);
  END IF;
  
  -- Auto-calculate deposit based on purchase price and current deposit amount
  IF NEW.purchase_price IS NOT NULL AND NEW.deposit_amount = 0 THEN
    NEW.deposit_amount := calculate_deposit_amount(NEW.purchase_price, false);
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to auto-suggest pricing on insert/update
DROP TRIGGER IF EXISTS trigger_auto_suggest_pricing ON gear_listings;
CREATE TRIGGER trigger_auto_suggest_pricing
  BEFORE INSERT OR UPDATE ON gear_listings
  FOR EACH ROW
  EXECUTE FUNCTION auto_suggest_pricing();

-- Add indexes for better performance on new columns
CREATE INDEX IF NOT EXISTS idx_gear_listings_equipment_model ON gear_listings(equipment_model);
CREATE INDEX IF NOT EXISTS idx_gear_listings_price_validated ON gear_listings(price_validated);
CREATE INDEX IF NOT EXISTS idx_gear_listings_purchase_price ON gear_listings(purchase_price);

-- Create view for gear listings with calculated pricing information
CREATE OR REPLACE VIEW gear_listings_with_pricing AS
SELECT 
  gl.*,
  -- Calculate insurance cost for 1-day rental as example
  calculate_insurance_cost(gl.purchase_price, 1) as daily_insurance_cost,
  -- Calculate deposit with and without insurance
  calculate_deposit_amount(gl.purchase_price, true) as deposit_with_insurance,
  calculate_deposit_amount(gl.purchase_price, false) as deposit_without_insurance,
  -- Calculate price efficiency (daily rate vs purchase price)
  CASE 
    WHEN gl.purchase_price > 0 THEN ROUND((gl.daily_rate / gl.purchase_price * 100), 2)
    ELSE NULL 
  END as daily_rate_percentage
FROM gear_listings gl;

-- Grant permissions for the new view
GRANT SELECT ON gear_listings_with_pricing TO authenticated;

-- Create policy for the new view
CREATE POLICY "Anyone can view gear with pricing info"
  ON gear_listings_with_pricing FOR SELECT
  TO authenticated
  USING (true);

-- Add comment for documentation
COMMENT ON COLUMN gear_listings.purchase_price IS 'Original purchase price of the equipment used for deposit and insurance calculations';
COMMENT ON COLUMN gear_listings.equipment_model IS 'Detected equipment model for automatic pricing suggestions';
COMMENT ON COLUMN gear_listings.price_validated IS 'Whether the pricing has been validated against market rates';
COMMENT ON COLUMN gear_listings.suggested_daily_rate IS 'System-suggested daily rental rate based on equipment model and purchase price';