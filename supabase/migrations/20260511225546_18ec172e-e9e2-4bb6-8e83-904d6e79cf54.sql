-- Allow chat creator to delete the chatroom
CREATE POLICY "chatrooms_delete_creator"
ON public.chatrooms
FOR DELETE
TO authenticated
USING (is_email_confirmed() AND auth.uid() = created_by);

-- Allow chat creator to remove other members
CREATE POLICY "chatroom_members_delete_creator"
ON public.chatroom_members
FOR DELETE
TO authenticated
USING (
  is_email_confirmed() AND EXISTS (
    SELECT 1 FROM public.chatrooms c
    WHERE c.id = chatroom_members.chatroom_id AND c.created_by = auth.uid()
  )
);

-- Cleanup function: when chatroom deleted, also delete its messages, members, invitations
CREATE OR REPLACE FUNCTION public.cleanup_chatroom_on_delete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.messages WHERE chatroom_id = OLD.id;
  DELETE FROM public.chatroom_members WHERE chatroom_id = OLD.id;
  DELETE FROM public.chatroom_invitations WHERE chatroom_id = OLD.id;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS chatroom_cleanup_trigger ON public.chatrooms;
CREATE TRIGGER chatroom_cleanup_trigger
BEFORE DELETE ON public.chatrooms
FOR EACH ROW
EXECUTE FUNCTION public.cleanup_chatroom_on_delete();