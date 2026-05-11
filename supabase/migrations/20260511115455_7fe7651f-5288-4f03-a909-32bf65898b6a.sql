CREATE OR REPLACE FUNCTION public.clamp_user_assignment_progress()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.progress IS NULL THEN
    NEW.progress := 0;
  END IF;
  IF NEW.progress < 0 THEN
    NEW.progress := 0;
  ELSIF NEW.progress > 100 THEN
    NEW.progress := 100;
  END IF;
  -- Snap to nearest 10
  NEW.progress := (round(NEW.progress::numeric / 10) * 10)::int;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS clamp_user_assignment_progress_ins ON public.user_assignments;
CREATE TRIGGER clamp_user_assignment_progress_ins
BEFORE INSERT ON public.user_assignments
FOR EACH ROW EXECUTE FUNCTION public.clamp_user_assignment_progress();

DROP TRIGGER IF EXISTS clamp_user_assignment_progress_upd ON public.user_assignments;
CREATE TRIGGER clamp_user_assignment_progress_upd
BEFORE UPDATE OF progress ON public.user_assignments
FOR EACH ROW EXECUTE FUNCTION public.clamp_user_assignment_progress();