CREATE POLICY "user_assignments_delete"
ON public.user_assignments
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);