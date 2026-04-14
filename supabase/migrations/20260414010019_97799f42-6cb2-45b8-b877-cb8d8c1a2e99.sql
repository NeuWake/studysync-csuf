
-- Drop the old restrictive insert policy on chatroom_members
DROP POLICY IF EXISTS chatroom_members_insert ON public.chatroom_members;

-- Create a new insert policy: allow if you're adding yourself OR you're the creator of the chatroom
CREATE POLICY "chatroom_members_insert" ON public.chatroom_members
FOR INSERT TO authenticated
WITH CHECK (
  auth.uid() = user_id
  OR EXISTS (
    SELECT 1 FROM public.chatrooms
    WHERE id = chatroom_id AND created_by = auth.uid()
  )
);
