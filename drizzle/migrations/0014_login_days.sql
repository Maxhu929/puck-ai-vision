CREATE TABLE public.login_days (
  user_id uuid NOT NULL DEFAULT auth.uid(),
  day date NOT NULL DEFAULT (now() AT TIME ZONE 'utc')::date,
  display_name text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, day)
);
GRANT SELECT, INSERT ON public.login_days TO authenticated;
GRANT ALL ON public.login_days TO service_role;
ALTER TABLE public.login_days ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can record their own login days" ON public.login_days FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can view their own login days" ON public.login_days FOR SELECT TO authenticated USING (auth.uid() = user_id);