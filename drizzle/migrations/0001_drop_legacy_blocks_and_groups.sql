-- ============================================================
-- Finish the tiers/match-teams migration: the previous migration
-- (0000_add_match_teams_and_tiers) only added the new tables and
-- columns alongside the old ones, so blocks/groups/attendance are
-- still live and sessions.block_id is still required. This drops
-- the legacy block/group structure for real, as intended — none of
-- it was ever used in practice.
-- ============================================================

-- Drop the app-code hack this forced: sessions.block_id must stop
-- being required before the app can create sessions without a block.
ALTER TABLE public.sessions ALTER COLUMN block_id DROP NOT NULL;

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

-- session_player_overrides: the new override_team_id column is in
-- place (from 0000) and the app writes to it exclusively now; drop
-- the old group-based column.
ALTER TABLE public.session_player_overrides DROP COLUMN IF EXISTS override_group_id;

-- session_registrations: same — match_team_id is in place, drop the
-- old group_id column, and replace the plain UNIQUE(session_id,
-- match_team_id) constraint (which lets NULLs repeat) with partial
-- unique indexes so a training session (match_team_id NULL) can only
-- be registered once, same as a given match team.
ALTER TABLE public.session_registrations DROP COLUMN IF EXISTS group_id;

DROP INDEX IF EXISTS public.session_registrations_session_team_key;

CREATE UNIQUE INDEX IF NOT EXISTS session_registrations_training_uniq
  ON public.session_registrations (session_id) WHERE match_team_id IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS session_registrations_match_uniq
  ON public.session_registrations (session_id, match_team_id) WHERE match_team_id IS NOT NULL;

-- skill_ratings: drop the old block/group/week columns now that
-- match_team_id is in place and the app writes to it exclusively.
ALTER TABLE public.skill_ratings DROP COLUMN IF EXISTS block_id;
ALTER TABLE public.skill_ratings DROP COLUMN IF EXISTS group_id;
ALTER TABLE public.skill_ratings DROP COLUMN IF EXISTS group_number;
ALTER TABLE public.skill_ratings DROP COLUMN IF EXISTS week_number;

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
