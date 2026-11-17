DROP POLICY IF EXISTS "Anyone can view analyses" ON public.video_analyses;
REVOKE SELECT ON public.video_analyses FROM anon;
DROP POLICY IF EXISTS "Anyone can view player games" ON public.player_games;
REVOKE SELECT ON public.player_games FROM anon;
CREATE POLICY "Signed-in users can view player games" ON public.player_games FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);