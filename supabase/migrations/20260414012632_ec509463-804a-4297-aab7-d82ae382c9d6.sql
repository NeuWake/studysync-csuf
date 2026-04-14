-- Drop existing policies
DROP POLICY IF EXISTS "whiteboard_members_insert" ON public.whiteboard_members;
DROP POLICY IF EXISTS "whiteboard_members_select" ON public.whiteboard_members;
DROP POLICY IF EXISTS "whiteboard_members_delete" ON public.whiteboard_members;

-- SELECT: any member can see all members of their whiteboards
CREATE POLICY "whiteboard_members_select" ON public.whiteboard_members
FOR SELECT TO authenticated
USING (
  is_whiteboard_member(auth.uid(), whiteboard_id)
  OR EXISTS (
    SELECT 1 FROM public.whiteboards
    WHERE whiteboards.id = whiteboard_members.whiteboard_id
    AND whiteboards.created_by = auth.uid()
  )
);

-- INSERT: creator can add anyone, users can add themselves
CREATE POLICY "whiteboard_members_insert" ON public.whiteboard_members
FOR INSERT TO authenticated
WITH CHECK (
  auth.uid() = user_id
  OR EXISTS (
    SELECT 1 FROM public.whiteboards
    WHERE whiteboards.id = whiteboard_members.whiteboard_id
    AND whiteboards.created_by = auth.uid()
  )
);

-- DELETE: creator can remove anyone, members can remove themselves
CREATE POLICY "whiteboard_members_delete" ON public.whiteboard_members
FOR DELETE TO authenticated
USING (
  auth.uid() = user_id
  OR EXISTS (
    SELECT 1 FROM public.whiteboards
    WHERE whiteboards.id = whiteboard_members.whiteboard_id
    AND whiteboards.created_by = auth.uid()
  )
);