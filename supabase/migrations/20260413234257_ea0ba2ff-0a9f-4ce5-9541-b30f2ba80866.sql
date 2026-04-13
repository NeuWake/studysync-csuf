CREATE POLICY "whiteboard_strokes_update"
ON public.whiteboard_strokes
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id);