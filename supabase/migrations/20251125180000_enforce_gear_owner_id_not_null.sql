-- Migration: Enforce gear_owner_id is always set on rental_requests
ALTER TABLE rental_requests ALTER COLUMN gear_owner_id SET NOT NULL;

-- Optional: Add a trigger to auto-populate gear_owner_id if missing (defensive, but should not be needed if RPC is always used)
-- CREATE OR REPLACE FUNCTION set_gear_owner_id() RETURNS TRIGGER AS $$
-- BEGIN
--   IF NEW.gear_owner_id IS NULL THEN
--     SELECT owner_id INTO NEW.gear_owner_id FROM gear_listings WHERE id = NEW.gear_id;
--   END IF;
--   RETURN NEW;
-- END;
-- $$ LANGUAGE plpgsql;
--
-- DROP TRIGGER IF EXISTS trg_set_gear_owner_id ON rental_requests;
-- CREATE TRIGGER trg_set_gear_owner_id
-- BEFORE INSERT ON rental_requests
-- FOR EACH ROW EXECUTE FUNCTION set_gear_owner_id();
