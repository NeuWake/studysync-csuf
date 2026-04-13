
-- Allow all authenticated users to read profiles (needed for chat names, member lists, etc.)
DROP POLICY IF EXISTS "profiles_select" ON public.profiles;
CREATE POLICY "profiles_select" ON public.profiles
FOR SELECT TO authenticated
USING (true);
