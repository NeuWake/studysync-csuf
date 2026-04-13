
-- Create separate credentials table
CREATE TABLE public.user_canvas_credentials (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  canvas_access_token TEXT,
  canvas_base_url TEXT DEFAULT 'https://csufullerton.instructure.com',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.user_canvas_credentials ENABLE ROW LEVEL SECURITY;

-- Only owner can access their own credentials
CREATE POLICY "Users can view own credentials"
ON public.user_canvas_credentials FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own credentials"
ON public.user_canvas_credentials FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own credentials"
ON public.user_canvas_credentials FOR UPDATE
USING (auth.uid() = user_id);

-- Migrate existing data
INSERT INTO public.user_canvas_credentials (user_id, canvas_access_token, canvas_base_url)
SELECT user_id, canvas_access_token, canvas_base_url
FROM public.profiles
WHERE canvas_access_token IS NOT NULL
ON CONFLICT (user_id) DO NOTHING;

-- Remove token columns from profiles
ALTER TABLE public.profiles DROP COLUMN IF EXISTS canvas_access_token;
ALTER TABLE public.profiles DROP COLUMN IF EXISTS canvas_base_url;

-- Fix profiles SELECT policy to owner-only (was 'true')
DROP POLICY IF EXISTS "profiles_select" ON public.profiles;
CREATE POLICY "profiles_select" ON public.profiles FOR SELECT
TO authenticated USING (auth.uid() = user_id);

-- Trigger for updated_at
CREATE TRIGGER update_canvas_credentials_updated_at
BEFORE UPDATE ON public.user_canvas_credentials
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
