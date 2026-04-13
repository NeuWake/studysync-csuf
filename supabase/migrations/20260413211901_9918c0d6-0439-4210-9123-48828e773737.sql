-- Drop existing select policy
DROP POLICY IF EXISTS "whiteboards_select" ON public.whiteboards;

-- Recreate with creator OR member access
CREATE POLICY "whiteboards_select" ON public.whiteboards
FOR SELECT TO authenticated
USING (
  auth.uid() = created_by OR is_whiteboard_member(auth.uid(), id)
);