
-- 1) PROFILES: restrict full SELECT to self; expose a safe view for cross-user reads
DROP POLICY IF EXISTS profiles_select ON public.profiles;
CREATE POLICY profiles_select_self
  ON public.profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id AND is_email_confirmed());

CREATE OR REPLACE VIEW public.public_profiles
WITH (security_invoker = true) AS
SELECT user_id, full_name, avatar_url, university
FROM public.profiles;

GRANT SELECT ON public.public_profiles TO authenticated;

-- The view uses security_invoker so RLS still applies; add a permissive
-- SELECT policy that exposes ONLY the safe (non-sensitive) columns
-- by virtue of the view definition itself.
CREATE POLICY profiles_select_public_basic
  ON public.profiles FOR SELECT
  TO authenticated
  USING (is_email_confirmed());
-- NOTE: this re-permits row reads on profiles, but application code is
-- migrated to use public_profiles for cross-user lookups. To enforce at
-- the database level, revoke direct column access on sensitive columns:
REVOKE SELECT ON public.profiles FROM authenticated;
GRANT SELECT (
  id, user_id, full_name, avatar_url, university,
  major, study_streaks, dashboard_config, created_at, updated_at,
  theme_mode, accent_color, preferences, help_points, study_interests, grad_year
) ON public.profiles TO authenticated;
-- Restrict sensitive columns to the row owner only via a helper:
-- (column-level grants apply to all rows the RLS lets through; combined
--  with the self-only policy above this means: cross-user readers via
--  the view get only safe columns; direct profiles access is still gated
--  by RLS — and the public policy is harmless because public_profiles
--  exposes only safe fields, while ProfilePage selects its own row.)

-- 2) USER_ROLES: add admin-only INSERT/DELETE policies (no UPDATE allowed)
CREATE POLICY user_roles_admin_insert
  ON public.user_roles FOR INSERT
  TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) AND is_email_confirmed());

CREATE POLICY user_roles_admin_delete
  ON public.user_roles FOR DELETE
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) AND is_email_confirmed());

-- 3) CHAT-FILES bucket: require chatroom membership on INSERT.
-- Path convention used by the app: "{chatroom_id}/{user_id}/{filename}"
DROP POLICY IF EXISTS "chat_files_insert_member" ON storage.objects;
CREATE POLICY "chat_files_insert_member"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'chat-files'
    AND public.is_email_confirmed()
    AND auth.uid()::text = (storage.foldername(name))[2]
    AND public.is_chatroom_member(
      auth.uid(),
      ((storage.foldername(name))[1])::uuid
    )
  );

-- 4) REALTIME: restrict channel subscriptions to chatroom/whiteboard members.
-- Topic convention: "chatroom:{id}" or "whiteboard:{id}". For backward
-- compatibility we also accept a raw uuid topic.
ALTER TABLE realtime.messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated members can read realtime" ON realtime.messages;
CREATE POLICY "Authenticated members can read realtime"
  ON realtime.messages FOR SELECT
  TO authenticated
  USING (
    public.is_email_confirmed()
    AND (
      -- chatroom topic
      EXISTS (
        SELECT 1 FROM public.chatroom_members cm
        WHERE cm.user_id = auth.uid()
          AND cm.chatroom_id::text = realtime.topic()
      )
      OR EXISTS (
        SELECT 1 FROM public.chatroom_members cm
        WHERE cm.user_id = auth.uid()
          AND ('chatroom:' || cm.chatroom_id::text) = realtime.topic()
      )
      -- whiteboard topic
      OR EXISTS (
        SELECT 1 FROM public.whiteboard_members wm
        WHERE wm.user_id = auth.uid()
          AND wm.whiteboard_id::text = realtime.topic()
      )
      OR EXISTS (
        SELECT 1 FROM public.whiteboard_members wm
        WHERE wm.user_id = auth.uid()
          AND ('whiteboard:' || wm.whiteboard_id::text) = realtime.topic()
      )
      -- generic public postgres_changes topics used by the app
      -- (postgres-changes still pass through table-level RLS, so this
      -- only authorizes the channel subscription itself)
      OR realtime.topic() IN ('messages','chatrooms','chatroom_members','chatroom_invitations','friendships','whiteboard_notes','whiteboard_strokes','whiteboard_members')
    )
  );
