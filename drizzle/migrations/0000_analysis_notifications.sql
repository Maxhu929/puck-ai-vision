ALTER TABLE public.video_analyses ADD COLUMN IF NOT EXISTS notify_email text, ADD COLUMN IF NOT EXISTS notified_at timestamptz;
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;