
-- Create a security definer function to check chatroom membership without triggering RLS
CREATE OR REPLACE FUNCTION public.is_chatroom_member(_user_id uuid, _chatroom_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.chatroom_members
    WHERE user_id = _user_id AND chatroom_id = _chatroom_id
  );
$$;

-- Fix chatroom_members SELECT: allow users to see members of chatrooms they belong to
DROP POLICY IF EXISTS "chatroom_members_select" ON public.chatroom_members;
CREATE POLICY "chatroom_members_select" ON public.chatroom_members
FOR SELECT TO authenticated
USING (public.is_chatroom_member(auth.uid(), chatroom_id));

-- Fix chatrooms SELECT: use the same function
DROP POLICY IF EXISTS "chatrooms_select" ON public.chatrooms;
CREATE POLICY "chatrooms_select" ON public.chatrooms
FOR SELECT TO authenticated
USING (public.is_chatroom_member(auth.uid(), id));

-- Fix messages SELECT: use the function instead of subquery
DROP POLICY IF EXISTS "messages_select" ON public.messages;
CREATE POLICY "messages_select" ON public.messages
FOR SELECT TO authenticated
USING (public.is_chatroom_member(auth.uid(), chatroom_id));

-- Fix messages INSERT: use the function
DROP POLICY IF EXISTS "messages_insert" ON public.messages;
CREATE POLICY "messages_insert" ON public.messages
FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id AND public.is_chatroom_member(auth.uid(), chatroom_id));
