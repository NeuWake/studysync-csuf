CREATE TABLE public.whiteboard_strokes (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  whiteboard_id uuid NOT NULL REFERENCES public.whiteboards(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  tool text NOT NULL DEFAULT 'pen',
  points jsonb DEFAULT '[]'::jsonb,
  color text DEFAULT '#000000',
  stroke_width integer DEFAULT 2,
  start_x numeric DEFAULT 0,
  start_y numeric DEFAULT 0,
  end_x numeric DEFAULT 0,
  end_y numeric DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.whiteboard_strokes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "whiteboard_strokes_select"
ON public.whiteboard_strokes
FOR SELECT
TO authenticated
USING (public.is_whiteboard_member(auth.uid(), whiteboard_id));

CREATE POLICY "whiteboard_strokes_insert"
ON public.whiteboard_strokes
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id AND public.is_whiteboard_member(auth.uid(), whiteboard_id));

CREATE POLICY "whiteboard_strokes_delete"
ON public.whiteboard_strokes
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

ALTER PUBLICATION supabase_realtime ADD TABLE public.whiteboard_strokes;