
-- Create enum for invitation status
CREATE TYPE public.invitation_status AS ENUM ('pending', 'accepted', 'declined');

-- Create chatroom_invitations table
CREATE TABLE public.chatroom_invitations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  chatroom_id UUID NOT NULL REFERENCES public.chatrooms(id) ON DELETE CASCADE,
  invited_by UUID NOT NULL,
  invited_user_id UUID NOT NULL,
  status public.invitation_status NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (chatroom_id, invited_user_id)
);

-- Enable RLS
ALTER TABLE public.chatroom_invitations ENABLE ROW LEVEL SECURITY;

-- Select: invited user or the inviter can see it
CREATE POLICY "chatroom_invitations_select" ON public.chatroom_invitations
FOR SELECT TO authenticated
USING (auth.uid() = invited_user_id OR auth.uid() = invited_by);

-- Insert: chatroom creator or members can invite
CREATE POLICY "chatroom_invitations_insert" ON public.chatroom_invitations
FOR INSERT TO authenticated
WITH CHECK (
  auth.uid() = invited_by
  AND EXISTS (
    SELECT 1 FROM public.chatrooms WHERE id = chatroom_id AND created_by = auth.uid()
  )
);

-- Update: only the invited user can accept/decline
CREATE POLICY "chatroom_invitations_update" ON public.chatroom_invitations
FOR UPDATE TO authenticated
USING (auth.uid() = invited_user_id);

-- Delete: inviter can cancel, invited can dismiss
CREATE POLICY "chatroom_invitations_delete" ON public.chatroom_invitations
FOR DELETE TO authenticated
USING (auth.uid() = invited_user_id OR auth.uid() = invited_by);

-- Trigger for updated_at
CREATE TRIGGER update_chatroom_invitations_updated_at
BEFORE UPDATE ON public.chatroom_invitations
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
