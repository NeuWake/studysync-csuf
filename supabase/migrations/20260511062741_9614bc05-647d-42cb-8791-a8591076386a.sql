
-- Helper: returns true only if the calling user's email is confirmed
-- (or they signed in via a non-email provider like Google OAuth).
CREATE OR REPLACE FUNCTION public.is_email_confirmed()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM auth.users u
    WHERE u.id = auth.uid()
      AND (
        u.email_confirmed_at IS NOT NULL
        OR u.confirmed_at IS NOT NULL
        OR COALESCE(u.raw_app_meta_data->>'provider', 'email') <> 'email'
      )
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_email_confirmed() TO authenticated;

-- ============================================================
-- profiles
-- ============================================================
DROP POLICY IF EXISTS profiles_select ON public.profiles;
DROP POLICY IF EXISTS profiles_insert ON public.profiles;
DROP POLICY IF EXISTS profiles_update ON public.profiles;

CREATE POLICY profiles_select ON public.profiles
  FOR SELECT TO authenticated
  USING (public.is_email_confirmed());

CREATE POLICY profiles_insert ON public.profiles
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id AND public.is_email_confirmed());

CREATE POLICY profiles_update ON public.profiles
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id AND public.is_email_confirmed());

-- ============================================================
-- assignments
-- ============================================================
DROP POLICY IF EXISTS assignments_select ON public.assignments;
DROP POLICY IF EXISTS assignments_insert ON public.assignments;
DROP POLICY IF EXISTS assignments_update ON public.assignments;

CREATE POLICY assignments_select ON public.assignments
  FOR SELECT TO authenticated
  USING (public.is_email_confirmed());

CREATE POLICY assignments_insert ON public.assignments
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = created_by AND public.is_email_confirmed());

CREATE POLICY assignments_update ON public.assignments
  FOR UPDATE TO authenticated
  USING (auth.uid() = created_by AND public.is_email_confirmed());

-- ============================================================
-- courses
-- ============================================================
DROP POLICY IF EXISTS courses_select ON public.courses;
DROP POLICY IF EXISTS courses_insert ON public.courses;

CREATE POLICY courses_select ON public.courses
  FOR SELECT TO authenticated
  USING (public.is_email_confirmed());

CREATE POLICY courses_insert ON public.courses
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role) AND public.is_email_confirmed());

-- ============================================================
-- user_assignments
-- ============================================================
DROP POLICY IF EXISTS user_assignments_select ON public.user_assignments;
DROP POLICY IF EXISTS user_assignments_insert ON public.user_assignments;
DROP POLICY IF EXISTS user_assignments_update ON public.user_assignments;
DROP POLICY IF EXISTS user_assignments_delete ON public.user_assignments;

CREATE POLICY user_assignments_select ON public.user_assignments
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id AND public.is_email_confirmed());
CREATE POLICY user_assignments_insert ON public.user_assignments
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id AND public.is_email_confirmed());
CREATE POLICY user_assignments_update ON public.user_assignments
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id AND public.is_email_confirmed());
CREATE POLICY user_assignments_delete ON public.user_assignments
  FOR DELETE TO authenticated
  USING (auth.uid() = user_id AND public.is_email_confirmed());

-- ============================================================
-- user_courses
-- ============================================================
DROP POLICY IF EXISTS user_courses_select ON public.user_courses;
DROP POLICY IF EXISTS user_courses_insert ON public.user_courses;
DROP POLICY IF EXISTS user_courses_delete ON public.user_courses;

CREATE POLICY user_courses_select ON public.user_courses
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id AND public.is_email_confirmed());
CREATE POLICY user_courses_insert ON public.user_courses
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id AND public.is_email_confirmed());
CREATE POLICY user_courses_delete ON public.user_courses
  FOR DELETE TO authenticated
  USING (auth.uid() = user_id AND public.is_email_confirmed());

-- ============================================================
-- user_canvas_credentials
-- ============================================================
DROP POLICY IF EXISTS "Users can view own credentials" ON public.user_canvas_credentials;
DROP POLICY IF EXISTS "Users can insert own credentials" ON public.user_canvas_credentials;
DROP POLICY IF EXISTS "Users can update own credentials" ON public.user_canvas_credentials;

CREATE POLICY "Users can view own credentials" ON public.user_canvas_credentials
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id AND public.is_email_confirmed());
CREATE POLICY "Users can insert own credentials" ON public.user_canvas_credentials
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id AND public.is_email_confirmed());
CREATE POLICY "Users can update own credentials" ON public.user_canvas_credentials
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id AND public.is_email_confirmed());

-- ============================================================
-- user_events
-- ============================================================
DROP POLICY IF EXISTS user_events_select ON public.user_events;
DROP POLICY IF EXISTS user_events_insert ON public.user_events;
DROP POLICY IF EXISTS user_events_update ON public.user_events;
DROP POLICY IF EXISTS user_events_delete ON public.user_events;

CREATE POLICY user_events_select ON public.user_events
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id AND public.is_email_confirmed());
CREATE POLICY user_events_insert ON public.user_events
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id AND public.is_email_confirmed());
CREATE POLICY user_events_update ON public.user_events
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id AND public.is_email_confirmed());
CREATE POLICY user_events_delete ON public.user_events
  FOR DELETE TO authenticated
  USING (auth.uid() = user_id AND public.is_email_confirmed());

-- ============================================================
-- user_roles
-- ============================================================
DROP POLICY IF EXISTS user_roles_select ON public.user_roles;
CREATE POLICY user_roles_select ON public.user_roles
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id AND public.is_email_confirmed());

-- ============================================================
-- task_attachments
-- ============================================================
DROP POLICY IF EXISTS task_attachments_select ON public.task_attachments;
DROP POLICY IF EXISTS task_attachments_insert ON public.task_attachments;
DROP POLICY IF EXISTS task_attachments_delete ON public.task_attachments;

CREATE POLICY task_attachments_select ON public.task_attachments
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id AND public.is_email_confirmed());
CREATE POLICY task_attachments_insert ON public.task_attachments
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id AND public.is_email_confirmed());
CREATE POLICY task_attachments_delete ON public.task_attachments
  FOR DELETE TO authenticated
  USING (auth.uid() = user_id AND public.is_email_confirmed());

-- ============================================================
-- chatrooms
-- ============================================================
DROP POLICY IF EXISTS chatrooms_select ON public.chatrooms;
DROP POLICY IF EXISTS chatrooms_insert ON public.chatrooms;

CREATE POLICY chatrooms_select ON public.chatrooms
  FOR SELECT TO authenticated
  USING (public.is_email_confirmed() AND ((created_by = auth.uid()) OR public.is_chatroom_member(auth.uid(), id)));
CREATE POLICY chatrooms_insert ON public.chatrooms
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = created_by AND public.is_email_confirmed());

-- ============================================================
-- chatroom_members
-- ============================================================
DROP POLICY IF EXISTS chatroom_members_select ON public.chatroom_members;
DROP POLICY IF EXISTS chatroom_members_insert ON public.chatroom_members;
DROP POLICY IF EXISTS chatroom_members_delete ON public.chatroom_members;

CREATE POLICY chatroom_members_select ON public.chatroom_members
  FOR SELECT TO authenticated
  USING (public.is_email_confirmed() AND public.is_chatroom_member(auth.uid(), chatroom_id));
CREATE POLICY chatroom_members_insert ON public.chatroom_members
  FOR INSERT TO authenticated
  WITH CHECK (public.is_email_confirmed() AND ((auth.uid() = user_id) OR (EXISTS (SELECT 1 FROM chatrooms WHERE chatrooms.id = chatroom_members.chatroom_id AND chatrooms.created_by = auth.uid()))));
CREATE POLICY chatroom_members_delete ON public.chatroom_members
  FOR DELETE TO authenticated
  USING (auth.uid() = user_id AND public.is_email_confirmed());

-- ============================================================
-- chatroom_invitations
-- ============================================================
DROP POLICY IF EXISTS chatroom_invitations_select ON public.chatroom_invitations;
DROP POLICY IF EXISTS chatroom_invitations_insert ON public.chatroom_invitations;
DROP POLICY IF EXISTS chatroom_invitations_update ON public.chatroom_invitations;
DROP POLICY IF EXISTS chatroom_invitations_delete ON public.chatroom_invitations;

CREATE POLICY chatroom_invitations_select ON public.chatroom_invitations
  FOR SELECT TO authenticated
  USING (public.is_email_confirmed() AND ((auth.uid() = invited_user_id) OR (auth.uid() = invited_by)));
CREATE POLICY chatroom_invitations_insert ON public.chatroom_invitations
  FOR INSERT TO authenticated
  WITH CHECK (public.is_email_confirmed() AND auth.uid() = invited_by AND EXISTS (SELECT 1 FROM chatrooms WHERE chatrooms.id = chatroom_invitations.chatroom_id AND chatrooms.created_by = auth.uid()));
CREATE POLICY chatroom_invitations_update ON public.chatroom_invitations
  FOR UPDATE TO authenticated
  USING (auth.uid() = invited_user_id AND public.is_email_confirmed());
CREATE POLICY chatroom_invitations_delete ON public.chatroom_invitations
  FOR DELETE TO authenticated
  USING (public.is_email_confirmed() AND ((auth.uid() = invited_user_id) OR (auth.uid() = invited_by)));

-- ============================================================
-- messages
-- ============================================================
DROP POLICY IF EXISTS messages_select ON public.messages;
DROP POLICY IF EXISTS messages_insert ON public.messages;

CREATE POLICY messages_select ON public.messages
  FOR SELECT TO authenticated
  USING (public.is_email_confirmed() AND public.is_chatroom_member(auth.uid(), chatroom_id));
CREATE POLICY messages_insert ON public.messages
  FOR INSERT TO authenticated
  WITH CHECK (public.is_email_confirmed() AND auth.uid() = user_id AND public.is_chatroom_member(auth.uid(), chatroom_id));

-- ============================================================
-- friendships
-- ============================================================
DROP POLICY IF EXISTS friendships_select ON public.friendships;
DROP POLICY IF EXISTS friendships_insert ON public.friendships;
DROP POLICY IF EXISTS friendships_update ON public.friendships;

CREATE POLICY friendships_select ON public.friendships
  FOR SELECT TO authenticated
  USING (public.is_email_confirmed() AND ((auth.uid() = requester_id) OR (auth.uid() = addressee_id)));
CREATE POLICY friendships_insert ON public.friendships
  FOR INSERT TO authenticated
  WITH CHECK (public.is_email_confirmed() AND auth.uid() = requester_id);
CREATE POLICY friendships_update ON public.friendships
  FOR UPDATE TO authenticated
  USING (public.is_email_confirmed() AND ((auth.uid() = requester_id) OR (auth.uid() = addressee_id)));

-- ============================================================
-- whiteboards
-- ============================================================
DROP POLICY IF EXISTS whiteboards_select ON public.whiteboards;
DROP POLICY IF EXISTS whiteboards_insert ON public.whiteboards;
DROP POLICY IF EXISTS whiteboards_delete ON public.whiteboards;

CREATE POLICY whiteboards_select ON public.whiteboards
  FOR SELECT TO authenticated
  USING (public.is_email_confirmed() AND ((auth.uid() = created_by) OR public.is_whiteboard_member(auth.uid(), id)));
CREATE POLICY whiteboards_insert ON public.whiteboards
  FOR INSERT TO authenticated
  WITH CHECK (public.is_email_confirmed() AND auth.uid() = created_by);
CREATE POLICY whiteboards_delete ON public.whiteboards
  FOR DELETE TO authenticated
  USING (public.is_email_confirmed() AND auth.uid() = created_by);

-- ============================================================
-- whiteboard_members
-- ============================================================
DROP POLICY IF EXISTS whiteboard_members_select ON public.whiteboard_members;
DROP POLICY IF EXISTS whiteboard_members_insert ON public.whiteboard_members;
DROP POLICY IF EXISTS whiteboard_members_delete ON public.whiteboard_members;

CREATE POLICY whiteboard_members_select ON public.whiteboard_members
  FOR SELECT TO authenticated
  USING (public.is_email_confirmed() AND (public.is_whiteboard_member(auth.uid(), whiteboard_id) OR EXISTS (SELECT 1 FROM whiteboards WHERE whiteboards.id = whiteboard_members.whiteboard_id AND whiteboards.created_by = auth.uid())));
CREATE POLICY whiteboard_members_insert ON public.whiteboard_members
  FOR INSERT TO authenticated
  WITH CHECK (public.is_email_confirmed() AND ((auth.uid() = user_id) OR EXISTS (SELECT 1 FROM whiteboards WHERE whiteboards.id = whiteboard_members.whiteboard_id AND whiteboards.created_by = auth.uid())));
CREATE POLICY whiteboard_members_delete ON public.whiteboard_members
  FOR DELETE TO authenticated
  USING (public.is_email_confirmed() AND ((auth.uid() = user_id) OR EXISTS (SELECT 1 FROM whiteboards WHERE whiteboards.id = whiteboard_members.whiteboard_id AND whiteboards.created_by = auth.uid())));

-- ============================================================
-- whiteboard_notes
-- ============================================================
DROP POLICY IF EXISTS whiteboard_notes_select ON public.whiteboard_notes;
DROP POLICY IF EXISTS whiteboard_notes_insert ON public.whiteboard_notes;
DROP POLICY IF EXISTS whiteboard_notes_update ON public.whiteboard_notes;
DROP POLICY IF EXISTS whiteboard_notes_delete_owner ON public.whiteboard_notes;

CREATE POLICY whiteboard_notes_select ON public.whiteboard_notes
  FOR SELECT TO authenticated
  USING (public.is_email_confirmed() AND public.is_whiteboard_member(auth.uid(), whiteboard_id));
CREATE POLICY whiteboard_notes_insert ON public.whiteboard_notes
  FOR INSERT TO authenticated
  WITH CHECK (public.is_email_confirmed() AND auth.uid() = user_id AND public.is_whiteboard_member(auth.uid(), whiteboard_id));
CREATE POLICY whiteboard_notes_update ON public.whiteboard_notes
  FOR UPDATE TO authenticated
  USING (public.is_email_confirmed() AND auth.uid() = user_id);
CREATE POLICY whiteboard_notes_delete_owner ON public.whiteboard_notes
  FOR DELETE TO authenticated
  USING (public.is_email_confirmed() AND ((auth.uid() = user_id) OR EXISTS (SELECT 1 FROM whiteboards WHERE whiteboards.id = whiteboard_notes.whiteboard_id AND whiteboards.created_by = auth.uid())));

-- ============================================================
-- whiteboard_strokes
-- ============================================================
DROP POLICY IF EXISTS whiteboard_strokes_select ON public.whiteboard_strokes;
DROP POLICY IF EXISTS whiteboard_strokes_insert ON public.whiteboard_strokes;
DROP POLICY IF EXISTS whiteboard_strokes_update ON public.whiteboard_strokes;
DROP POLICY IF EXISTS whiteboard_strokes_delete_owner ON public.whiteboard_strokes;

CREATE POLICY whiteboard_strokes_select ON public.whiteboard_strokes
  FOR SELECT TO authenticated
  USING (public.is_email_confirmed() AND public.is_whiteboard_member(auth.uid(), whiteboard_id));
CREATE POLICY whiteboard_strokes_insert ON public.whiteboard_strokes
  FOR INSERT TO authenticated
  WITH CHECK (public.is_email_confirmed() AND auth.uid() = user_id AND public.is_whiteboard_member(auth.uid(), whiteboard_id));
CREATE POLICY whiteboard_strokes_update ON public.whiteboard_strokes
  FOR UPDATE TO authenticated
  USING (public.is_email_confirmed() AND auth.uid() = user_id);
CREATE POLICY whiteboard_strokes_delete_owner ON public.whiteboard_strokes
  FOR DELETE TO authenticated
  USING (public.is_email_confirmed() AND ((auth.uid() = user_id) OR EXISTS (SELECT 1 FROM whiteboards WHERE whiteboards.id = whiteboard_strokes.whiteboard_id AND whiteboards.created_by = auth.uid())));
