-- 1. Add group_id column
ALTER TABLE public.skill_ratings
  ADD COLUMN IF NOT EXISTS group_id uuid REFERENCES public.groups(id) ON DELETE SET NULL;

-- 2. Backfill group_id from (block_id, group_number)
UPDATE public.skill_ratings sr
SET group_id = g.id
FROM public.groups g
WHERE sr.group_id IS NULL
  AND g.block_id = sr.block_id
  AND g.group_number = sr.group_number;

-- 3. Copy match_ratings rows into skill_ratings
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

-- 4. Drop match_ratings
DROP TABLE IF EXISTS public.match_ratings;

-- Index for match-summary queries
CREATE INDEX IF NOT EXISTS skill_ratings_session_group_idx
  ON public.skill_ratings (session_id, group_id);