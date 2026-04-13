DROP POLICY IF EXISTS "whiteboard_members_select" ON public.whiteboard_members;

CREATE POLICY "whiteboard_members_select"
ON public.whiteboard_members
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);