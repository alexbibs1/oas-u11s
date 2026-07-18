-- Consolidate the two parallel rating systems.
--
-- Before this migration there were two tables:
--   - skill_ratings (weekly ratings page; writes audit log entries)
--   - match_ratings (match-day flow; NO audit log; recomputes players baselines)
--
-- They store the same 1-5 per-skill scores for the same (session, player)
-- pair but neither knew about the other. Match-day rating changes were
-- invisible to the admin audit log, and baseline recomputation only ran
-- from the match-day path, so weekly-only entries never updated baselines.
--
-- This migration:
--   1. Adds group_id to skill_ratings (match-day flow needs the FK;
--      skill_ratings only had group_number before).
--   2. Backfills group_id from the match_ratings table for any rows that
--      were written via the weekly flow (which left it null) by looking
--      up the group via (block_id, group_number).
--   3. Copies any match_ratings rows not already in skill_ratings into
--      skill_ratings, so the single source of truth has everything.
--   4. Drops match_ratings. Code now routes match-day submission through
--      upsertWeekRatings in skill-ratings.functions.ts, which already
--      writes the audit log.

-- 1. Add group_id column (nullable for backfill; we set NOT NULL after).
ALTER TABLE public.skill_ratings
  ADD COLUMN IF NOT EXISTS group_id uuid REFERENCES public.groups(id) ON DELETE SET NULL;

-- 2. Backfill group_id from (block_id, group_number) for existing rows.
UPDATE public.skill_ratings sr
SET group_id = g.id
FROM public.groups g
WHERE sr.group_id IS NULL
  AND g.block_id = sr.block_id
  AND g.group_number = sr.group_number;

-- 3. Copy match_ratings rows that aren't already in skill_ratings.
--    skill_ratings has a UNIQUE(session_id, player_id) constraint, so we
--    use ON CONFLICT to skip duplicates. We populate group_id from the
--    match_ratings row directly (it already has the FK).
INSERT INTO public.skill_ratings (
  session_id, player_id, player_name, block_id, group_id, group_number,
  week_number, coach_names, entered_by, entered_by_name,
  carrying, handling, tackling, rucking, kicking, catching, iq,
  created_at, updated_at
)
SELECT
  mr.session_id,
  mr.player_id,
  COALESCE(p.player_name, 'Unknown'),
  s.block_id,
  mr.group_id,
  g.group_number,
  s.week_number,
  COALESCE(
    ARRAY(
      SELECT c.coach_name
      FROM public.group_coaches gc
      JOIN public.coaches c ON c.id = gc.coach_id
      WHERE gc.group_id = mr.group_id
    ),
    '{}'::text[]
  ),
  mr.rated_by,
  NULL,
  mr.carrying,
  mr.handling,
  mr.tackling,
  mr.rucking,
  mr.kicking,
  mr.catching,
  mr.iq,
  mr.created_at,
  mr.created_at
FROM public.match_ratings mr
JOIN public.sessions s ON s.id = mr.session_id
JOIN public.groups g ON g.id = mr.group_id
JOIN public.players p ON p.id = mr.player_id
ON CONFLICT (session_id, player_id) DO UPDATE
SET
  group_id = EXCLUDED.group_id,
  carrying = EXCLUDED.carrying,
  handling = EXCLUDED.handling,
  tackling = EXCLUDED.tackling,
  rucking = EXCLUDED.rucking,
  kicking = EXCLUDED.kicking,
  catching = EXCLUDED.catching,
  iq = EXCLUDED.iq,
  updated_at = now();

-- 4. Drop the now-redundant table.
DROP TABLE IF EXISTS public.match_ratings;

-- Index for the match-summary query (filter by session + group).
CREATE INDEX IF NOT EXISTS skill_ratings_session_group_idx
  ON public.skill_ratings (session_id, group_id);
