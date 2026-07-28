CREATE TABLE public.players (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  team text NOT NULL DEFAULT '',
  position text NOT NULL DEFAULT '',
  location text NOT NULL DEFAULT '',
  grade integer NOT NULL DEFAULT 0,
  radar jsonb NOT NULL DEFAULT '[]'::jsonb,
  stats jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT ON public.players TO anon;
GRANT SELECT ON public.players TO authenticated;
GRANT ALL ON public.players TO service_role;

ALTER TABLE public.players ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view players" ON public.players FOR SELECT USING (true);

CREATE TABLE public.player_games (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  player_id uuid NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  game_label text NOT NULL,
  played_on date,
  grade integer NOT NULL DEFAULT 0,
  top_speed numeric(5,1),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (player_id, game_label)
);

GRANT SELECT ON public.player_games TO anon;
GRANT SELECT ON public.player_games TO authenticated;
GRANT ALL ON public.player_games TO service_role;

ALTER TABLE public.player_games ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view player games" ON public.player_games FOR SELECT USING (true);

CREATE INDEX idx_player_games_player ON public.player_games (player_id, game_label);
CREATE INDEX idx_players_grade ON public.players (grade DESC);

CREATE TRIGGER update_players_updated_at BEFORE UPDATE ON public.players
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_player_games_updated_at BEFORE UPDATE ON public.player_games
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.players (slug, name, team, position, location, grade, radar, stats) VALUES
('you','You','Riverside Rangers','Center','Minneapolis, MN',91,
 '[{"metric":"Skating","value":88},{"metric":"Shooting","value":92},{"metric":"Passing","value":84},{"metric":"Defense","value":74},{"metric":"Compete","value":95}]'::jsonb,
 '{"Goals":"14","Assists":"21","Shots/Game":"4.2","Top Speed":"31.4 km/h","Faceoff %":"54%","Avg Shift":"48s"}'::jsonb),
('m-tremblay','M. Tremblay','Lakeside Bruins','Left Wing','Ottawa, ON',94,
 '[{"metric":"Skating","value":95},{"metric":"Shooting","value":89},{"metric":"Passing","value":90},{"metric":"Defense","value":80},{"metric":"Compete","value":88}]'::jsonb,
 '{"Goals":"18","Assists":"17","Shots/Game":"4.9","Top Speed":"33.0 km/h","Faceoff %":"41%","Avg Shift":"44s"}'::jsonb),
('j-okafor','J. Okafor','Northside Wolves','Defense','Detroit, MI',89,
 '[{"metric":"Skating","value":84},{"metric":"Shooting","value":71},{"metric":"Passing","value":88},{"metric":"Defense","value":96},{"metric":"Compete","value":90}]'::jsonb,
 '{"Goals":"5","Assists":"26","Shots/Game":"2.6","Top Speed":"30.1 km/h","Faceoff %":"—","Avg Shift":"55s"}'::jsonb),
('a-lindqvist','A. Lindqvist','Harbor Kings','Right Wing','Boston, MA',86,
 '[{"metric":"Skating","value":82},{"metric":"Shooting","value":93},{"metric":"Passing","value":76},{"metric":"Defense","value":70},{"metric":"Compete","value":91}]'::jsonb,
 '{"Goals":"20","Assists":"9","Shots/Game":"5.4","Top Speed":"29.7 km/h","Faceoff %":"38%","Avg Shift":"46s"}'::jsonb),
('r-santos','R. Santos','Summit Chiefs','Center','Denver, CO',83,
 '[{"metric":"Skating","value":80},{"metric":"Shooting","value":78},{"metric":"Passing","value":89},{"metric":"Defense","value":79},{"metric":"Compete","value":85}]'::jsonb,
 '{"Goals":"9","Assists":"24","Shots/Game":"3.1","Top Speed":"29.2 km/h","Faceoff %":"58%","Avg Shift":"50s"}'::jsonb),
('d-park','D. Park','Ironside Steel','Defense','Pittsburgh, PA',80,
 '[{"metric":"Skating","value":76},{"metric":"Shooting","value":68},{"metric":"Passing","value":82},{"metric":"Defense","value":90},{"metric":"Compete","value":84}]'::jsonb,
 '{"Goals":"3","Assists":"19","Shots/Game":"2.2","Top Speed":"28.4 km/h","Faceoff %":"—","Avg Shift":"57s"}'::jsonb);

INSERT INTO public.player_games (player_id, game_label, grade, top_speed)
SELECT p.id, g.game_label, g.grade, g.top_speed
FROM public.players p
CROSS JOIN (VALUES
  ('G1', 74, 28.1),
  ('G2', 79, 29.0),
  ('G3', 77, 28.6),
  ('G4', 84, 30.2),
  ('G5', 88, 30.9),
  ('G6', 91, 31.4)
) AS g(game_label, grade, top_speed)
WHERE p.slug = 'you';