
-- Drop existing public-role policies
DROP POLICY IF EXISTS "Users can view own credentials" ON public.user_canvas_credentials;
DROP POLICY IF EXISTS "Users can insert own credentials" ON public.user_canvas_credentials;
DROP POLICY IF EXISTS "Users can update own credentials" ON public.user_canvas_credentials;

-- Recreate with authenticated role
CREATE POLICY "Users can view own credentials"
ON public.user_canvas_credentials FOR SELECT TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own credentials"
ON public.user_canvas_credentials FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own credentials"
ON public.user_canvas_credentials FOR UPDATE TO authenticated
USING (auth.uid() = user_id);
