ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS username text;

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_username_format_chk;
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_username_format_chk
  CHECK (username IS NULL OR username ~ '^[A-Za-z0-9_]{3,20}$');

DROP INDEX IF EXISTS profiles_username_lower_uniq;
CREATE UNIQUE INDEX profiles_username_lower_uniq
  ON public.profiles (lower(username))
  WHERE username IS NOT NULL;

CREATE OR REPLACE FUNCTION public.validate_profile_username()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  uname_lc text;
  fname_lc text;
  token text;
BEGIN
  IF NEW.username IS NULL THEN
    RETURN NEW;
  END IF;
  uname_lc := lower(trim(NEW.username));
  IF NEW.full_name IS NOT NULL THEN
    fname_lc := lower(trim(NEW.full_name));
    IF uname_lc = fname_lc THEN
      RAISE EXCEPTION 'Username must be different from your full name';
    END IF;
    IF uname_lc = regexp_replace(fname_lc, '\s+', '', 'g') THEN
      RAISE EXCEPTION 'Username must be different from your full name';
    END IF;
    FOREACH token IN ARRAY regexp_split_to_array(fname_lc, '\s+') LOOP
      IF length(token) > 0 AND uname_lc = token THEN
        RAISE EXCEPTION 'Username must be different from your first or last name';
      END IF;
    END LOOP;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_validate_username ON public.profiles;
CREATE TRIGGER profiles_validate_username
  BEFORE INSERT OR UPDATE OF username, full_name ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.validate_profile_username();

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  base_uname text;
  candidate text;
  i int := 0;
  fname_lc text;
  name_tokens text[];
BEGIN
  base_uname := lower(regexp_replace(split_part(NEW.email, '@', 1), '[^a-z0-9_]', '', 'g'));
  IF base_uname IS NULL OR length(base_uname) < 3 THEN
    base_uname := 'user' || substr(replace(NEW.id::text, '-', ''), 1, 8);
  END IF;
  base_uname := substr(base_uname, 1, 16);
  candidate := base_uname;
  fname_lc := lower(coalesce(NEW.raw_user_meta_data->>'full_name', ''));
  name_tokens := regexp_split_to_array(fname_lc, '\s+');
  WHILE EXISTS (SELECT 1 FROM public.profiles WHERE lower(username) = candidate)
     OR candidate = fname_lc
     OR candidate = regexp_replace(fname_lc, '\s+', '', 'g')
     OR candidate = ANY(name_tokens) LOOP
    i := i + 1;
    candidate := substr(base_uname, 1, 15) || i::text;
  END LOOP;
  INSERT INTO public.profiles (user_id, full_name, avatar_url, username)
  VALUES (NEW.id, NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'avatar_url', candidate);
  RETURN NEW;
END;
$$;

DO $$
DECLARE
  r record;
  base_uname text;
  candidate text;
  i int;
  name_lc text;
  name_tokens text[];
BEGIN
  FOR r IN SELECT p.id, p.user_id, p.full_name, u.email FROM public.profiles p
           JOIN auth.users u ON u.id = p.user_id
           WHERE p.username IS NULL LOOP
    base_uname := lower(regexp_replace(split_part(coalesce(r.email, ''), '@', 1), '[^a-z0-9_]', '', 'g'));
    IF base_uname IS NULL OR length(base_uname) < 3 THEN
      base_uname := 'user' || substr(replace(r.user_id::text, '-', ''), 1, 8);
    END IF;
    base_uname := substr(base_uname, 1, 16);
    candidate := base_uname;
    name_lc := lower(coalesce(r.full_name, ''));
    name_tokens := regexp_split_to_array(name_lc, '\s+');
    i := 0;
    WHILE EXISTS (SELECT 1 FROM public.profiles WHERE lower(username) = candidate)
       OR candidate = name_lc
       OR candidate = regexp_replace(name_lc, '\s+', '', 'g')
       OR candidate = ANY(name_tokens) LOOP
      i := i + 1;
      candidate := substr(base_uname, 1, 15) || i::text;
    END LOOP;
    UPDATE public.profiles SET username = candidate WHERE id = r.id;
  END LOOP;
END $$;