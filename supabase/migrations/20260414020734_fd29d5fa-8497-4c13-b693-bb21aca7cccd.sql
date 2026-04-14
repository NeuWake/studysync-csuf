-- Allow whiteboard owners to delete their boards
CREATE POLICY "whiteboards_delete"
ON public.whiteboards
FOR DELETE
TO authenticated
USING (auth.uid() = created_by);

-- Allow board owners to delete any notes on their boards
CREATE POLICY "whiteboard_notes_delete_owner"
ON public.whiteboard_notes
FOR DELETE
TO authenticated
USING (
  auth.uid() = user_id
  OR EXISTS (
    SELECT 1 FROM whiteboards
    WHERE whiteboards.id = whiteboard_notes.whiteboard_id
    AND whiteboards.created_by = auth.uid()
  )
);

-- Allow board owners to delete any strokes on their boards
CREATE POLICY "whiteboard_strokes_delete_owner"
ON public.whiteboard_strokes
FOR DELETE
TO authenticated
USING (
  auth.uid() = user_id
  OR EXISTS (
    SELECT 1 FROM whiteboards
    WHERE whiteboards.id = whiteboard_strokes.whiteboard_id
    AND whiteboards.created_by = auth.uid()
  )
);

-- Drop the old narrow delete policies and replace with the owner-inclusive ones
DROP POLICY IF EXISTS "whiteboard_notes_delete" ON public.whiteboard_notes;
DROP POLICY IF EXISTS "whiteboard_strokes_delete" ON public.whiteboard_strokes;