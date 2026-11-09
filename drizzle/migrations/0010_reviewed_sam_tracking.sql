ALTER TABLE public.video_analyses ADD COLUMN IF NOT EXISTS sam_review jsonb;
COMMENT ON COLUMN public.video_analyses.sam_review IS 'Snapshot of a manually reviewed SAM 2 track used only to render an explicitly approved copy; never identity evidence.';
GRANT ALL ON public.sam_trials TO service_role;
CREATE OR REPLACE FUNCTION public.invalidate_video_review() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.marks IS DISTINCT FROM OLD.marks OR NEW.shifts IS DISTINCT FROM OLD.shifts OR NEW.identity_details IS DISTINCT FROM OLD.identity_details OR NEW.review_segments IS DISTINCT FROM OLD.review_segments OR NEW.sam_review IS DISTINCT FROM OLD.sam_review THEN
    NEW.review_approved := false;
    IF OLD.status <> 'analyzing' THEN NEW.status := 'awaiting_review'; END IF;
  END IF;
  RETURN NEW;
END;
$$;