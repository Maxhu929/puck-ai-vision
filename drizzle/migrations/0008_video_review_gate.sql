ALTER TABLE public.video_analyses ADD COLUMN IF NOT EXISTS review_segments jsonb NOT NULL DEFAULT '[]'::jsonb, ADD COLUMN IF NOT EXISTS review_approved boolean NOT NULL DEFAULT false;
COMMENT ON COLUMN public.video_analyses.review_segments IS 'Manual verified, uncertain, offscreen and wrong-player video ranges in original video seconds.';
CREATE OR REPLACE FUNCTION public.invalidate_video_review() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.marks IS DISTINCT FROM OLD.marks OR NEW.shifts IS DISTINCT FROM OLD.shifts OR NEW.identity_details IS DISTINCT FROM OLD.identity_details OR NEW.review_segments IS DISTINCT FROM OLD.review_segments THEN
    NEW.review_approved := false;
    IF OLD.status <> 'analyzing' THEN NEW.status := 'awaiting_review'; END IF;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER invalidate_video_review BEFORE UPDATE ON public.video_analyses FOR EACH ROW EXECUTE FUNCTION public.invalidate_video_review();