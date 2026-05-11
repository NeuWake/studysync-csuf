-- 1. Update validate_profile_username: keep format check only, drop name-match checks
CREATE OR REPLACE FUNCTION public.validate_profile_username()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
DECLARE
  uname text;
BEGIN
  IF NEW.username IS NULL THEN
    RETURN NEW;
  END IF;
  uname := trim(NEW.username);
  IF length(uname) < 3 OR length(uname) > 20 THEN
    RAISE EXCEPTION 'Username must be between 3 and 20 characters';
  END IF;
  IF NOT (uname ~ '^[A-Za-z0-9_]+$') THEN
    RAISE EXCEPTION 'Username can only contain letters, numbers, and underscores';
  END IF;
  RETURN NEW;
END;
$$;

-- Ensure trigger is attached
DROP TRIGGER IF EXISTS validate_profile_username_trigger ON public.profiles;
CREATE TRIGGER validate_profile_username_trigger
  BEFORE INSERT OR UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_profile_username();

-- 2. Update handle_new_user: remove name-match checks, keep uniqueness loop
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  base_uname text;
  candidate text;
  i int := 0;
BEGIN
  base_uname := lower(regexp_replace(split_part(NEW.email, '@', 1), '[^a-z0-9_]', '', 'g'));
  IF base_uname IS NULL OR length(base_uname) < 3 THEN
    base_uname := 'user' || substr(replace(NEW.id::text, '-', ''), 1, 8);
  END IF;
  base_uname := substr(base_uname, 1, 16);
  candidate := base_uname;
  WHILE EXISTS (SELECT 1 FROM public.profiles WHERE lower(username) = lower(candidate)) LOOP
    i := i + 1;
    candidate := substr(base_uname, 1, 14) || '_' || i::text;
  END LOOP;
  INSERT INTO public.profiles (user_id, full_name, avatar_url, username)
  VALUES (NEW.id, NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'avatar_url', candidate);
  RETURN NEW;
END;
$$;

-- Ensure trigger is attached
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- 3. Fix case-insensitive unique constraint: drop old constraint, create partial unique index
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_username_lower_uniq;
DROP INDEX IF EXISTS idx_profiles_username_lower_uniq;
CREATE UNIQUE INDEX idx_profiles_username_lower_uniq ON public.profiles (lower(username)) WHERE username IS NOT NULL;

-- 4. Add check constraint for format (redundant safety)
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_username_format;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_username_format
  CHECK (username IS NULL OR (length(username) >= 3 AND length(username) <= 20 AND username ~ '^[A-Za-z0-9_]+$'));

-- 5. Deduplicate existing usernames (keep earliest created)
DO $$
DECLARE
  rec RECORD;
  suffix INT := 1;
BEGIN
  FOR rec IN
    SELECT keep.id AS keep_id, dup.id AS dup_id, dup.username AS dup_uname
    FROM public.profiles keep
    JOIN public.profiles dup
      ON lower(keep.username) = lower(dup.username)
     AND keep.id <> dup.id
     AND keep.created_at <= dup.created_at
    WHERE keep.username IS NOT NULL
  LOOP
    UPDATE public.profiles
    SET username = rec.dup_uname || '_' || suffix::text
    WHERE id = rec.dup_id;
    suffix := suffix + 1;
  END LOOP;
END $$;

-- 6. Add helper index for fast case-insensitive lookups
CREATE INDEX IF NOT EXISTS idx_profiles_username_lower ON public.profiles (lower(username));

-- 7. Recreate view with username column
DROP VIEW IF EXISTS public.public_profiles;
CREATE VIEW public.public_profiles AS
SELECT user_id, full_name, avatar_url, university, username
FROM public.profiles;

-- 8. Grant select on view
GRANT SELECT ON public.public_profiles TO authenticated;
GRANT SELECT ON public.public_profiles TO anon;

-- 9. Add function to check username availability
CREATE OR REPLACE FUNCTION public.is_username_available(check_username TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT NOT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE lower(username) = lower(check_username)
  );
$$;

-- 10. Update column comment
COMMENT ON COLUMN public.profiles.username IS 'Unique username for chat features. Can contain parts of first/last name. Must be 3-20 chars, letters/numbers/underscores. Case-insensitive uniqueness enforced.';

-- 11. Add helpful index for user_id lookups
CREATE INDEX IF NOT EXISTS idx_profiles_user_id ON public.profiles (user_id);