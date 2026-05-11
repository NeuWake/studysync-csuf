
-- Documents linked to a user's assignment
CREATE TABLE public.assignment_documents (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_assignment_id UUID NOT NULL REFERENCES public.user_assignments(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  file_name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  file_size INTEGER,
  file_type TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_assignment_documents_ua ON public.assignment_documents(user_assignment_id);
CREATE INDEX idx_assignment_documents_user ON public.assignment_documents(user_id);

ALTER TABLE public.assignment_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "assignment_documents_select"
  ON public.assignment_documents FOR SELECT TO authenticated
  USING (auth.uid() = user_id AND is_email_confirmed());

CREATE POLICY "assignment_documents_insert"
  ON public.assignment_documents FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND is_email_confirmed()
    AND EXISTS (
      SELECT 1 FROM public.user_assignments ua
      WHERE ua.id = user_assignment_id AND ua.user_id = auth.uid()
    )
  );

CREATE POLICY "assignment_documents_delete"
  ON public.assignment_documents FOR DELETE TO authenticated
  USING (auth.uid() = user_id AND is_email_confirmed());

-- Storage policies for task-attachments bucket (private). Files are stored under {user_id}/...
CREATE POLICY "task_attachments_select_own"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'task-attachments' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "task_attachments_insert_own"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'task-attachments' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "task_attachments_delete_own"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'task-attachments' AND auth.uid()::text = (storage.foldername(name))[1]);
