-- Create a security definer function to check whiteboard membership without recursion
CREATE OR REPLACE FUNCTION public.is_whiteboard_member(_user_id uuid, _whiteboard_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.whiteboard_members
    WHERE user_id = _user_id AND whiteboard_id = _whiteboard_id
  );
$$;

-- Fix whiteboards SELECT policy
DROP POLICY IF EXISTS "whiteboards_select" ON public.whiteboards;
CREATE POLICY "whiteboards_select"
ON public.whiteboards
FOR SELECT
TO authenticated
USING (public.is_whiteboard_member(auth.uid(), id));

-- Fix whiteboard_notes SELECT policy
DROP POLICY IF EXISTS "whiteboard_notes_select" ON public.whiteboard_notes;
CREATE POLICY "whiteboard_notes_select"
ON public.whiteboard_notes
FOR SELECT
TO authenticated
USING (public.is_whiteboard_member(auth.uid(), whiteboard_id));

-- Fix whiteboard_notes INSERT policy
DROP POLICY IF EXISTS "whiteboard_notes_insert" ON public.whiteboard_notes;
CREATE POLICY "whiteboard_notes_insert"
ON public.whiteboard_notes
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id AND public.is_whiteboard_member(auth.uid(), whiteboard_id));