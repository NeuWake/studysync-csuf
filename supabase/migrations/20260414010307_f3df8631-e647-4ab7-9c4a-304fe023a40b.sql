
-- Drop and recreate the chatrooms select policy to also allow the creator
DROP POLICY IF EXISTS chatrooms_select ON public.chatrooms;

CREATE POLICY "chatrooms_select" ON public.chatrooms
FOR SELECT TO authenticated
USING (
  created_by = auth.uid()
  OR is_chatroom_member(auth.uid(), id)
);
