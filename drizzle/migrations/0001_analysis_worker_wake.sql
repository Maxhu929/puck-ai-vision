-- lovable-cron-fallback-reviewed: Twelve Labs offers no completion webhook for this flow; job is scheduled on enqueue and unscheduled once no analyses are pending.
CREATE OR REPLACE FUNCTION public.ensure_analysis_worker() RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, cron AS $fn$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'process-analyses') THEN
    PERFORM cron.schedule('process-analyses', '*/2 * * * *', $job$select net.http_post(url:='https://project--363fcb43-f6a2-4d0f-bd4b-c99f808888ed-dev.lovable.app/api/public/process-analyses', headers:='{"Content-Type":"application/json","apikey":"sb_publishable_rAx3PlPtros7OTo_KtDfkw_yi9USP8K"}'::jsonb, body:='{}'::jsonb)$job$);
  END IF;
END $fn$;
CREATE OR REPLACE FUNCTION public.stop_analysis_worker() RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, cron AS $fn$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'process-analyses') THEN
    PERFORM cron.unschedule('process-analyses');
  END IF;
END $fn$;
REVOKE ALL ON FUNCTION public.ensure_analysis_worker() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.stop_analysis_worker() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ensure_analysis_worker() TO service_role;
GRANT EXECUTE ON FUNCTION public.stop_analysis_worker() TO service_role;