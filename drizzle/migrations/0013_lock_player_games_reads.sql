DROP POLICY IF EXISTS "Signed-in users can view player games" ON public.player_games;
REVOKE SELECT ON public.player_games FROM authenticated;