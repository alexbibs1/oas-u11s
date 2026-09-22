-- ============================================================
-- Remove the training-block / group structure entirely (never used
-- in practice — squad has outgrown fixed-block groups).
--
-- Training moves to three persistent tiers per player, admin-only:
-- Developing / Intermediate / Advanced.
--
-- Match day moves to per-fixture team picking: up to 5 teams,
-- picked fresh for each calendar match.
-- ============================================================

-- Legacy tables that only ever served the block/group model.
DROP TABLE IF EXISTS public.group_players CASCADE;
DROP TABLE IF EXISTS public.group_coaches CASCADE;
DROP TABLE IF EXISTS public.attendance CASCADE;
DROP TABLE IF EXISTS public.match_ratings CASCADE; -- superseded by skill_ratings, unused
DROP TABLE IF EXISTS public.groups CASCADE;

-- Sessions no longer belong to a block.
ALTER TABLE public.sessions DROP COLUMN IF EXISTS block_id;
ALTER TABLE public.sessions DROP COLUMN IF EXISTS week_number;

DROP TABLE IF EXISTS public.blocks CASCADE;

-- ============================================================
-- TIERS: a simple column on players. Admin-only concept — regular
-- coaches never see this label, only the (still computed) quartile.
-- Nullable so newly added players start unassigned.
-- ============================================================
ALTER TABLE public.players
  ADD COLUMN tier text CHECK (tier IN ('developing', 'intermediate', 'advanced'));

-- ============================================================
-- MATCH TEAMS: up to 5 squads picked per fixture (session).
-- ============================================================
CREATE TABLE public.match_teams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
  team_number integer NOT NULL CHECK (team_number BETWEEN 1 AND 5),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (session_id, team_number)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.match_teams TO authenticated;
GRANT ALL ON public.match_teams TO service_role;
ALTER TABLE public.match_teams ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can read match_teams"
  ON public.match_teams FOR SELECT TO authenticated USING (true);
CREATE POLICY "match_teams write admin"
  ON public.match_teams FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'block_builder'))
  WITH CHECK (public.has_role(auth.uid(), 'block_builder'));

CREATE TABLE public.match_team_players (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  match_team_id uuid NOT NULL REFERENCES public.match_teams(id) ON DELETE CASCADE,
  player_id uuid NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (match_team_id, player_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.match_team_players TO authenticated;
GRANT ALL ON public.match_team_players TO service_role;
ALTER TABLE public.match_team_players ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can read match_team_players"
  ON public.match_team_players FOR SELECT TO authenticated USING (true);
CREATE POLICY "match_team_players write admin"
  ON public.match_team_players FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'block_builder'))
  WITH CHECK (public.has_role(auth.uid(), 'block_builder'));

CREATE TABLE public.match_team_coaches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  match_team_id uuid NOT NULL REFERENCES public.match_teams(id) ON DELETE CASCADE,
  coach_id uuid NOT NULL REFERENCES public.coaches(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (match_team_id, coach_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.match_team_coaches TO authenticated;
GRANT ALL ON public.match_team_coaches TO service_role;
ALTER TABLE public.match_team_coaches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can read match_team_coaches"
  ON public.match_team_coaches FOR SELECT TO authenticated USING (true);
CREATE POLICY "match_team_coaches write admin"
  ON public.match_team_coaches FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'block_builder'))
  WITH CHECK (public.has_role(auth.uid(), 'block_builder'));

-- ============================================================
-- session_player_overrides: retarget from groups to match_teams.
-- Used only on match day (mark a player absent, or move them to a
-- different team than the one they were picked into).
-- ============================================================
ALTER TABLE public.session_player_overrides RENAME COLUMN override_group_id TO override_team_id;
ALTER TABLE public.session_player_overrides
  ADD CONSTRAINT session_player_overrides_override_team_id_fkey
  FOREIGN KEY (override_team_id) REFERENCES public.match_teams(id) ON DELETE CASCADE;

-- ============================================================
-- session_registrations: retarget from groups to match_teams.
-- Training sessions register the whole squad in one go
-- (match_team_id NULL); match sessions register once per team.
-- ============================================================
ALTER TABLE public.session_registrations DROP COLUMN group_id CASCADE;
ALTER TABLE public.session_registrations
  ADD COLUMN match_team_id uuid REFERENCES public.match_teams(id) ON DELETE CASCADE;

CREATE UNIQUE INDEX session_registrations_training_uniq
  ON public.session_registrations (session_id) WHERE match_team_id IS NULL;
CREATE UNIQUE INDEX session_registrations_match_uniq
  ON public.session_registrations (session_id, match_team_id) WHERE match_team_id IS NOT NULL;

-- ============================================================
-- skill_ratings: drop block/group-week columns, retarget group_id
-- to match_team_id (nullable — null for training-session ratings).
-- ============================================================
ALTER TABLE public.skill_ratings DROP COLUMN block_id CASCADE;
ALTER TABLE public.skill_ratings DROP COLUMN group_number;
ALTER TABLE public.skill_ratings DROP COLUMN week_number;
ALTER TABLE public.skill_ratings RENAME COLUMN group_id TO match_team_id;
ALTER TABLE public.skill_ratings
  ADD CONSTRAINT skill_ratings_match_team_id_fkey
  FOREIGN KEY (match_team_id) REFERENCES public.match_teams(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS skill_ratings_match_team_idx ON public.skill_ratings (match_team_id);

-- ============================================================
-- RLS helper functions: the live policies on skill_ratings and
-- session_player_overrides call is_coach_for_group / is_coach_for_session_block,
-- both of which query groups/group_coaches/blocks — all dropped above.
-- Replace them with match_team-based equivalents and repoint the
-- policies, or every insert/update to those tables starts failing.
-- ============================================================
CREATE OR REPLACE FUNCTION public.is_coach_for_team(_user_id uuid, _team_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles ur
    JOIN public.match_team_coaches mtc ON mtc.coach_id = ur.coach_id
    WHERE ur.user_id = _user_id
      AND mtc.match_team_id = _team_id
  );
$$;

CREATE OR REPLACE FUNCTION public.is_coach_for_session(_user_id uuid, _session_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles ur
    JOIN public.match_team_coaches mtc ON mtc.coach_id = ur.coach_id
    JOIN public.match_teams mt ON mt.id = mtc.match_team_id
    WHERE ur.user_id = _user_id
      AND mt.session_id = _session_id
  );
$$;

REVOKE EXECUTE ON FUNCTION public.is_coach_for_team(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_coach_for_team(uuid, uuid) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.is_coach_for_session(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_coach_for_session(uuid, uuid) TO authenticated;

DROP POLICY IF EXISTS "skill_ratings insert assigned coach or admin" ON public.skill_ratings;
DROP POLICY IF EXISTS "skill_ratings update assigned coach or admin" ON public.skill_ratings;

CREATE POLICY "skill_ratings insert assigned coach or admin"
  ON public.skill_ratings FOR INSERT TO authenticated
  WITH CHECK (
    (match_team_id IS NOT NULL AND public.is_coach_for_team(auth.uid(), match_team_id))
    OR public.has_role(auth.uid(), 'block_builder')
  );

CREATE POLICY "skill_ratings update assigned coach or admin"
  ON public.skill_ratings FOR UPDATE TO authenticated
  USING (
    (match_team_id IS NOT NULL AND public.is_coach_for_team(auth.uid(), match_team_id))
    OR public.has_role(auth.uid(), 'block_builder')
  )
  WITH CHECK (
    (match_team_id IS NOT NULL AND public.is_coach_for_team(auth.uid(), match_team_id))
    OR public.has_role(auth.uid(), 'block_builder')
  );

DROP POLICY IF EXISTS "Assigned coach can insert overrides" ON public.session_player_overrides;
DROP POLICY IF EXISTS "Assigned coach or builder can update overrides" ON public.session_player_overrides;

CREATE POLICY "Assigned coach can insert overrides"
  ON public.session_player_overrides FOR INSERT TO authenticated
  WITH CHECK (
    public.is_coach_for_session(auth.uid(), session_id)
    OR public.has_role(auth.uid(), 'block_builder')
  );

CREATE POLICY "Assigned coach or builder can update overrides"
  ON public.session_player_overrides FOR UPDATE TO authenticated
  USING (
    public.is_coach_for_session(auth.uid(), session_id)
    OR public.has_role(auth.uid(), 'block_builder')
  )
  WITH CHECK (
    public.is_coach_for_session(auth.uid(), session_id)
    OR public.has_role(auth.uid(), 'block_builder')
  );

-- Old group/block-based helper functions are no longer callable (their
-- referenced tables are gone) and nothing above still calls them.
DROP FUNCTION IF EXISTS public.is_coach_for_group(uuid, uuid);
DROP FUNCTION IF EXISTS public.is_coach_for_session_block(uuid, uuid);
