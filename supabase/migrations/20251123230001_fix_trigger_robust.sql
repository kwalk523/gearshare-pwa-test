-- Fix trigger to handle email conflicts and be more robust
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
DECLARE
  user_full_name text;
BEGIN
  -- Extract full_name from metadata, fallback to username or email
  user_full_name := COALESCE(
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'username',
    split_part(new.email, '@', 1)
  );
  
  -- Delete any orphaned profile with this email (from deleted auth user)
  DELETE FROM public.profiles 
  WHERE email = new.email AND id != new.id;
  
  -- Insert or update profile
  INSERT INTO public.profiles (id, email, full_name, is_verified)
  VALUES (
    new.id,
    new.email,
    user_full_name,
    false
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    full_name = EXCLUDED.full_name;
  
  RETURN new;
EXCEPTION
  WHEN OTHERS THEN
    -- Log but don't block signup
    RAISE WARNING 'Failed to create profile for user %: %', new.id, SQLERRM;
    RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Ensure trigger exists
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
