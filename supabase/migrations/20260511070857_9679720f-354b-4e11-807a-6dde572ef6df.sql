-- Persisted Google OAuth tokens (per user) for Drive integration
CREATE TABLE public.user_google_tokens (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  refresh_token TEXT NOT NULL,
  access_token TEXT,
  expires_at TIMESTAMPTZ,
  scope TEXT,
  provider TEXT NOT NULL DEFAULT 'google',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.user_google_tokens ENABLE ROW LEVEL SECURITY;

-- Users may read ONLY their own row (and only when email confirmed).
-- Sensitive fields (refresh_token) are exposed by API but protected by RLS;
-- clients should select only the safe columns. Inserts/updates are intentionally
-- NOT allowed from clients — only the service role (edge functions) writes here.
CREATE POLICY "user_google_tokens_select_own"
ON public.user_google_tokens
FOR SELECT
TO authenticated
USING (auth.uid() = user_id AND public.is_email_confirmed());

-- Auto-update updated_at
CREATE TRIGGER update_user_google_tokens_updated_at
BEFORE UPDATE ON public.user_google_tokens
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_user_google_tokens_user_id ON public.user_google_tokens(user_id);