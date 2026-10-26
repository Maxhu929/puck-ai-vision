create table public.sam_trials (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid(),
  analysis_id uuid not null references public.video_analyses(id) on delete cascade,
  clip_start double precision not null,
  clip_end double precision not null,
  fps double precision not null,
  width integer not null,
  height integer not null,
  start_box jsonb not null,
  clip_path text,
  fal_request_id text,
  status text not null default 'draft',
  output_path text,
  sam_track jsonb,
  lk_track jsonb,
  labels jsonb,
  metrics jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.sam_trials enable row level security;

create policy "Users can manage their own trials"
  on public.sam_trials for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

grant select, insert, update, delete on public.sam_trials to authenticated;