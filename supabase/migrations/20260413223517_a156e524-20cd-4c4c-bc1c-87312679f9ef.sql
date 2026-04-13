ALTER TABLE public.profiles 
  ADD COLUMN theme_mode text DEFAULT 'light',
  ADD COLUMN accent_color text DEFAULT 'Orange';