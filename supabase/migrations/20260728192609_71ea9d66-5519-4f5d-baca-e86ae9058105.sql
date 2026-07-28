DROP POLICY "Anyone can create analyses" ON public.video_analyses;
REVOKE INSERT ON public.video_analyses FROM anon;
REVOKE INSERT ON public.video_analyses FROM authenticated;