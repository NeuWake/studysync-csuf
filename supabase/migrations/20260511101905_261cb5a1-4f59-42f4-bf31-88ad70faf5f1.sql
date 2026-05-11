ALTER TABLE public.user_google_tokens
  ADD CONSTRAINT user_google_tokens_user_provider_unique UNIQUE (user_id, provider);