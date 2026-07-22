ALTER TABLE public.skill_ratings
  ADD COLUMN IF NOT EXISTS player_of_the_day boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS skill_ratings_potd_idx
  ON public.skill_ratings (session_id, group_id)
  WHERE player_of_the_day = true;