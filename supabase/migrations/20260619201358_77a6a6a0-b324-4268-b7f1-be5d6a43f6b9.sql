
ALTER TABLE public.players
  ADD COLUMN IF NOT EXISTS handling integer NOT NULL DEFAULT 2 CHECK (handling BETWEEN 1 AND 5),
  ADD COLUMN IF NOT EXISTS strength integer NOT NULL DEFAULT 2 CHECK (strength BETWEEN 1 AND 5),
  ADD COLUMN IF NOT EXISTS repeatability integer NOT NULL DEFAULT 2 CHECK (repeatability BETWEEN 1 AND 5);

ALTER TABLE public.match_ratings
  ADD COLUMN IF NOT EXISTS handling integer;
UPDATE public.match_ratings SET handling = 2 WHERE handling IS NULL;
UPDATE public.match_ratings SET carrying = 2 WHERE carrying IS NULL;
ALTER TABLE public.match_ratings
  ALTER COLUMN handling SET DEFAULT 2,
  ALTER COLUMN handling SET NOT NULL,
  ALTER COLUMN carrying SET DEFAULT 2,
  ALTER COLUMN carrying SET NOT NULL;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'match_ratings_handling_check') THEN
    ALTER TABLE public.match_ratings ADD CONSTRAINT match_ratings_handling_check CHECK (handling BETWEEN 1 AND 5);
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.prevent_duplicate_group_per_block()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_block_id uuid;
  v_conflict uuid;
BEGIN
  SELECT block_id INTO v_block_id FROM public.groups WHERE id = NEW.group_id;
  IF v_block_id IS NULL THEN
    RETURN NEW;
  END IF;
  SELECT gp.group_id INTO v_conflict
  FROM public.group_players gp
  JOIN public.groups g ON g.id = gp.group_id
  WHERE gp.player_id = NEW.player_id
    AND g.block_id = v_block_id
    AND gp.group_id <> NEW.group_id
  LIMIT 1;
  IF v_conflict IS NOT NULL THEN
    RAISE EXCEPTION 'Player % is already assigned to another group in this block', NEW.player_id;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_prevent_duplicate_group_per_block ON public.group_players;
CREATE TRIGGER trg_prevent_duplicate_group_per_block
  BEFORE INSERT OR UPDATE ON public.group_players
  FOR EACH ROW EXECUTE FUNCTION public.prevent_duplicate_group_per_block();
