-- Enums
CREATE TYPE public.app_role AS ENUM ('admin', 'user');
CREATE TYPE public.assignment_status AS ENUM ('pending', 'in-progress', 'completed', 'missed');
CREATE TYPE public.assignment_type AS ENUM ('homework', 'quiz', 'project', 'essay', 'lab', 'exam', 'other');
CREATE TYPE public.event_type AS ENUM ('lecture', 'lab', 'office_hours', 'personal', 'study', 'exam');
CREATE TYPE public.chatroom_type AS ENUM ('dm', 'group', 'assignment_thread');
CREATE TYPE public.friendship_status AS ENUM ('pending', 'accepted', 'blocked');

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql SET search_path = public;

-- ===================== CREATE ALL TABLES FIRST =====================

CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT, avatar_url TEXT, university TEXT, major TEXT,
  grad_year INTEGER, study_interests TEXT, canvas_access_token TEXT,
  canvas_base_url TEXT DEFAULT 'https://canvas.instructure.com',
  help_points INTEGER DEFAULT 0, study_streaks INTEGER DEFAULT 0,
  dashboard_config JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  UNIQUE (user_id, role)
);

CREATE TABLE public.courses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  canvas_course_id TEXT, name TEXT NOT NULL, code TEXT,
  description TEXT, color TEXT DEFAULT '#F97316',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.user_courses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, course_id)
);

CREATE TABLE public.assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id UUID REFERENCES public.courses(id) ON DELETE SET NULL,
  canvas_assignment_id TEXT, title TEXT NOT NULL, description TEXT,
  due_date TIMESTAMPTZ, assignment_type public.assignment_type DEFAULT 'other',
  max_points NUMERIC, created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.user_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  assignment_id UUID NOT NULL REFERENCES public.assignments(id) ON DELETE CASCADE,
  status public.assignment_status DEFAULT 'pending',
  progress INTEGER DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, assignment_id)
);

CREATE TABLE public.user_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL, description TEXT,
  start_time TIMESTAMPTZ NOT NULL, end_time TIMESTAMPTZ,
  is_recurring BOOLEAN DEFAULT false, recurrence_rule TEXT,
  event_type public.event_type DEFAULT 'personal',
  course_id UUID REFERENCES public.courses(id) ON DELETE SET NULL,
  is_canvas_synced BOOLEAN DEFAULT false, color TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.task_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id UUID NOT NULL REFERENCES public.assignments(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  file_url TEXT NOT NULL, file_name TEXT NOT NULL, file_size INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.chatrooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT, type public.chatroom_type NOT NULL DEFAULT 'dm',
  course_id UUID REFERENCES public.courses(id) ON DELETE SET NULL,
  assignment_id UUID REFERENCES public.assignments(id) ON DELETE SET NULL,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.chatroom_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chatroom_id UUID NOT NULL REFERENCES public.chatrooms(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (chatroom_id, user_id)
);

CREATE TABLE public.messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chatroom_id UUID NOT NULL REFERENCES public.chatrooms(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL, sent_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  edited_at TIMESTAMPTZ
);

CREATE TABLE public.friendships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  addressee_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status public.friendship_status DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (requester_id, addressee_id)
);

CREATE TABLE public.whiteboards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL, created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  course_id UUID REFERENCES public.courses(id) ON DELETE SET NULL,
  max_users INTEGER DEFAULT 5,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.whiteboard_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  whiteboard_id UUID NOT NULL REFERENCES public.whiteboards(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (whiteboard_id, user_id)
);

CREATE TABLE public.whiteboard_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  whiteboard_id UUID NOT NULL REFERENCES public.whiteboards(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content TEXT DEFAULT '', position_x NUMERIC DEFAULT 0,
  position_y NUMERIC DEFAULT 0, color TEXT DEFAULT '#FEF3C7',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ===================== ENABLE RLS ON ALL TABLES =====================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chatrooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chatroom_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.friendships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whiteboards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whiteboard_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whiteboard_notes ENABLE ROW LEVEL SECURITY;

-- ===================== ALL POLICIES =====================

-- profiles
CREATE POLICY "profiles_select" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "profiles_insert" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "profiles_update" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = user_id);

-- user_roles
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;
CREATE POLICY "user_roles_select" ON public.user_roles FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- courses
CREATE POLICY "courses_select" ON public.courses FOR SELECT TO authenticated USING (true);
CREATE POLICY "courses_insert" ON public.courses FOR INSERT TO authenticated WITH CHECK (true);

-- user_courses
CREATE POLICY "user_courses_select" ON public.user_courses FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "user_courses_insert" ON public.user_courses FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "user_courses_delete" ON public.user_courses FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- assignments
CREATE POLICY "assignments_select" ON public.assignments FOR SELECT TO authenticated USING (true);
CREATE POLICY "assignments_insert" ON public.assignments FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "assignments_update" ON public.assignments FOR UPDATE TO authenticated USING (auth.uid() = created_by);

-- user_assignments
CREATE POLICY "user_assignments_select" ON public.user_assignments FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "user_assignments_insert" ON public.user_assignments FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "user_assignments_update" ON public.user_assignments FOR UPDATE TO authenticated USING (auth.uid() = user_id);

-- user_events
CREATE POLICY "user_events_select" ON public.user_events FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "user_events_insert" ON public.user_events FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "user_events_update" ON public.user_events FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "user_events_delete" ON public.user_events FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- task_attachments
CREATE POLICY "task_attachments_select" ON public.task_attachments FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "task_attachments_insert" ON public.task_attachments FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "task_attachments_delete" ON public.task_attachments FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- chatrooms
CREATE POLICY "chatrooms_select" ON public.chatrooms FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.chatroom_members cm WHERE cm.chatroom_id = chatrooms.id AND cm.user_id = auth.uid()));
CREATE POLICY "chatrooms_insert" ON public.chatrooms FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by);

-- chatroom_members
CREATE POLICY "chatroom_members_select" ON public.chatroom_members FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.chatroom_members cm WHERE cm.chatroom_id = chatroom_members.chatroom_id AND cm.user_id = auth.uid()));
CREATE POLICY "chatroom_members_insert" ON public.chatroom_members FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "chatroom_members_delete" ON public.chatroom_members FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- messages
CREATE POLICY "messages_select" ON public.messages FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.chatroom_members cm WHERE cm.chatroom_id = messages.chatroom_id AND cm.user_id = auth.uid()));
CREATE POLICY "messages_insert" ON public.messages FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id AND EXISTS (SELECT 1 FROM public.chatroom_members cm WHERE cm.chatroom_id = messages.chatroom_id AND cm.user_id = auth.uid()));

-- friendships
CREATE POLICY "friendships_select" ON public.friendships FOR SELECT TO authenticated USING (auth.uid() = requester_id OR auth.uid() = addressee_id);
CREATE POLICY "friendships_insert" ON public.friendships FOR INSERT TO authenticated WITH CHECK (auth.uid() = requester_id);
CREATE POLICY "friendships_update" ON public.friendships FOR UPDATE TO authenticated USING (auth.uid() = requester_id OR auth.uid() = addressee_id);

-- whiteboards
CREATE POLICY "whiteboards_select" ON public.whiteboards FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.whiteboard_members wm WHERE wm.whiteboard_id = whiteboards.id AND wm.user_id = auth.uid()));
CREATE POLICY "whiteboards_insert" ON public.whiteboards FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by);

-- whiteboard_members
CREATE POLICY "whiteboard_members_select" ON public.whiteboard_members FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.whiteboard_members wm WHERE wm.whiteboard_id = whiteboard_members.whiteboard_id AND wm.user_id = auth.uid()));
CREATE POLICY "whiteboard_members_insert" ON public.whiteboard_members FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- whiteboard_notes
CREATE POLICY "whiteboard_notes_select" ON public.whiteboard_notes FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.whiteboard_members wm WHERE wm.whiteboard_id = whiteboard_notes.whiteboard_id AND wm.user_id = auth.uid()));
CREATE POLICY "whiteboard_notes_insert" ON public.whiteboard_notes FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id AND EXISTS (SELECT 1 FROM public.whiteboard_members wm WHERE wm.whiteboard_id = whiteboard_notes.whiteboard_id AND wm.user_id = auth.uid()));
CREATE POLICY "whiteboard_notes_update" ON public.whiteboard_notes FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "whiteboard_notes_delete" ON public.whiteboard_notes FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- ===================== TRIGGERS =====================

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_assignments_updated_at BEFORE UPDATE ON public.assignments FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_user_assignments_updated_at BEFORE UPDATE ON public.user_assignments FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_user_events_updated_at BEFORE UPDATE ON public.user_events FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_friendships_updated_at BEFORE UPDATE ON public.friendships FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_whiteboard_notes_updated_at BEFORE UPDATE ON public.whiteboard_notes FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (user_id, full_name, avatar_url)
  VALUES (NEW.id, NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'avatar_url');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ===================== REALTIME =====================

ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.whiteboard_notes;
ALTER PUBLICATION supabase_realtime ADD TABLE public.chatroom_members;

-- ===================== STORAGE =====================

INSERT INTO storage.buckets (id, name, public) VALUES ('task-attachments', 'task-attachments', false);
CREATE POLICY "task_att_upload" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'task-attachments' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "task_att_view" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'task-attachments' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "task_att_delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'task-attachments' AND auth.uid()::text = (storage.foldername(name))[1]);