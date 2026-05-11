
-- Notes table
CREATE TABLE public.notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  title TEXT NOT NULL DEFAULT 'Untitled note',
  content JSONB NOT NULL DEFAULT '{"type":"doc","content":[]}'::jsonb,
  share_token UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE,
  share_enabled BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.notes ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER notes_updated_at
BEFORE UPDATE ON public.notes
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Collaborators
CREATE TABLE public.note_collaborators (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  note_id UUID NOT NULL REFERENCES public.notes(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (note_id, user_id)
);

ALTER TABLE public.note_collaborators ENABLE ROW LEVEL SECURITY;

-- Helper: is user a collaborator (security definer to avoid recursion)
CREATE OR REPLACE FUNCTION public.is_note_collaborator(_user_id uuid, _note_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.note_collaborators
    WHERE user_id = _user_id AND note_id = _note_id
  );
$$;

-- Helper: is user owner
CREATE OR REPLACE FUNCTION public.is_note_owner(_user_id uuid, _note_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.notes WHERE id = _note_id AND user_id = _user_id);
$$;

-- Notes policies
CREATE POLICY "notes_select" ON public.notes
FOR SELECT TO authenticated
USING (is_email_confirmed() AND (auth.uid() = user_id OR is_note_collaborator(auth.uid(), id)));

CREATE POLICY "notes_insert" ON public.notes
FOR INSERT TO authenticated
WITH CHECK (is_email_confirmed() AND auth.uid() = user_id);

CREATE POLICY "notes_update" ON public.notes
FOR UPDATE TO authenticated
USING (is_email_confirmed() AND (auth.uid() = user_id OR is_note_collaborator(auth.uid(), id)));

CREATE POLICY "notes_delete" ON public.notes
FOR DELETE TO authenticated
USING (is_email_confirmed() AND auth.uid() = user_id);

-- Collaborator policies
CREATE POLICY "note_collab_select" ON public.note_collaborators
FOR SELECT TO authenticated
USING (is_email_confirmed() AND (auth.uid() = user_id OR is_note_owner(auth.uid(), note_id)));

CREATE POLICY "note_collab_insert" ON public.note_collaborators
FOR INSERT TO authenticated
WITH CHECK (is_email_confirmed() AND is_note_owner(auth.uid(), note_id));

CREATE POLICY "note_collab_delete" ON public.note_collaborators
FOR DELETE TO authenticated
USING (is_email_confirmed() AND (is_note_owner(auth.uid(), note_id) OR auth.uid() = user_id));

-- Public shared-note fetcher via token (security definer; bypasses RLS)
CREATE OR REPLACE FUNCTION public.get_shared_note(_token uuid)
RETURNS TABLE (id uuid, title text, content jsonb, updated_at timestamptz)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT n.id, n.title, n.content, n.updated_at
  FROM public.notes n
  WHERE n.share_token = _token AND n.share_enabled = true;
$$;

GRANT EXECUTE ON FUNCTION public.get_shared_note(uuid) TO anon, authenticated;

-- Realtime
ALTER TABLE public.notes REPLICA IDENTITY FULL;
ALTER TABLE public.note_collaborators REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.notes;
ALTER PUBLICATION supabase_realtime ADD TABLE public.note_collaborators;
