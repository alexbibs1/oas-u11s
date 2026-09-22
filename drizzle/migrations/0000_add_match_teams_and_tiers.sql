-- Player training tier
ALTER TABLE public.players ADD COLUMN IF NOT EXISTS tier text
  CHECK (tier IS NULL OR tier IN ('developing','intermediate','advanced'));

-- Match teams
CREATE TABLE IF NOT EXISTS public.match_teams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
  team_number integer NOT NULL CHECK (team_number BETWEEN 1 AND 5),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (session_id, team_number)
);

CREATE TABLE IF NOT EXISTS public.match_team_players (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  match_team_id uuid NOT NULL REFERENCES public.match_teams(id) ON DELETE CASCADE,
  player_id uuid NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (match_team_id, player_id)
);

CREATE TABLE IF NOT EXISTS public.match_team_coaches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  match_team_id uuid NOT NULL REFERENCES public.match_teams(id) ON DELETE CASCADE,
  coach_id uuid NOT NULL REFERENCES public.coaches(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (match_team_id, coach_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.match_teams TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.match_team_players TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.match_team_coaches TO authenticated;
GRANT ALL ON public.match_teams TO service_role;
GRANT ALL ON public.match_team_players TO service_role;
GRANT ALL ON public.match_team_coaches TO service_role;

ALTER TABLE public.match_teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.match_team_players ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.match_team_coaches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "match_teams_select" ON public.match_teams FOR SELECT TO authenticated USING (true);
CREATE POLICY "match_teams_write" ON public.match_teams FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'block_builder')) WITH CHECK (public.has_role(auth.uid(),'block_builder'));

CREATE POLICY "match_team_players_select" ON public.match_team_players FOR SELECT TO authenticated USING (true);
CREATE POLICY "match_team_players_write" ON public.match_team_players FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'block_builder')) WITH CHECK (public.has_role(auth.uid(),'block_builder'));

CREATE POLICY "match_team_coaches_select" ON public.match_team_coaches FOR SELECT TO authenticated USING (true);
CREATE POLICY "match_team_coaches_write" ON public.match_team_coaches FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'block_builder')) WITH CHECK (public.has_role(auth.uid(),'block_builder'));

-- Team references on existing tables
ALTER TABLE public.session_player_overrides
  ADD COLUMN IF NOT EXISTS override_team_id uuid REFERENCES public.match_teams(id) ON DELETE SET NULL;

ALTER TABLE public.session_registrations
  ADD COLUMN IF NOT EXISTS match_team_id uuid REFERENCES public.match_teams(id) ON DELETE CASCADE;
ALTER TABLE public.session_registrations ALTER COLUMN group_id DROP NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS session_registrations_session_team_key
  ON public.session_registrations (session_id, match_team_id);

ALTER TABLE public.skill_ratings
  ADD COLUMN IF NOT EXISTS match_team_id uuid REFERENCES public.match_teams(id) ON DELETE SET NULL;
ALTER TABLE public.skill_ratings ALTER COLUMN group_number DROP NOT NULL;
ALTER TABLE public.skill_ratings ALTER COLUMN block_id DROP NOT NULL;
