alter table public.video_analyses
  add column if not exists jersey_color text,
  add column if not exists team_name text,
  add column if not exists position text,
  add column if not exists handedness text,
  add column if not exists player_identified boolean;