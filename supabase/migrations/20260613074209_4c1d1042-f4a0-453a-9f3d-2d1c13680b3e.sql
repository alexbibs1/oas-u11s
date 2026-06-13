ALTER TABLE public.players ADD COLUMN carrying integer NOT NULL DEFAULT 2 CHECK (carrying BETWEEN 1 AND 5);
ALTER TABLE public.match_ratings ADD COLUMN carrying integer CHECK (carrying BETWEEN 1 AND 5);
UPDATE public.players SET carrying = 2 WHERE carrying IS NULL;