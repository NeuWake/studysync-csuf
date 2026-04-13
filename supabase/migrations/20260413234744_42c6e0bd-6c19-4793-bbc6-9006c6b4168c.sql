
DROP POLICY IF EXISTS "courses_insert" ON public.courses;
CREATE POLICY "courses_insert" ON public.courses
FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));
