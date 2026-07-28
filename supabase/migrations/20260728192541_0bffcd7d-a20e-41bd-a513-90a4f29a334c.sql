CREATE TABLE public.video_analyses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  player_name TEXT NOT NULL DEFAULT 'Unknown Player',
  jersey_number TEXT,
  focus_areas TEXT[] NOT NULL DEFAULT '{}',
  file_name TEXT,
  tl_index_id TEXT,
  tl_task_id TEXT,
  tl_video_id TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  error_message TEXT,
  overall_grade TEXT,
  summary TEXT,
  notes JSONB NOT NULL DEFAULT '[]'::jsonb,
  categories JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.video_analyses TO anon;
GRANT SELECT, INSERT ON public.video_analyses TO authenticated;
GRANT ALL ON public.video_analyses TO service_role;

ALTER TABLE public.video_analyses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view analyses"
  ON public.video_analyses FOR SELECT
  USING (true);

CREATE POLICY "Anyone can create analyses"
  ON public.video_analyses FOR INSERT
  WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_video_analyses_updated_at
BEFORE UPDATE ON public.video_analyses
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_video_analyses_created_at ON public.video_analyses (created_at DESC);