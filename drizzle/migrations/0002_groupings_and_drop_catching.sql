-- ============================================================
-- 1. Replace training tiers (developing/intermediate/advanced) with
--    Grouping (1+, 1, 2+, 2, 3+, 3, 4). Old tier values are discarded.
-- 2. Drop Catching everywhere, including all historical ratings.
-- 3. Default every skill/attribute score to 3.
-- 4. Delete players who have left.
-- 5. Load the head coach's grouping sheet, adding any missing players.
-- ============================================================

-- 1. Grouping column ------------------------------------------------
ALTER TABLE public.players DROP COLUMN IF EXISTS tier CASCADE;
ALTER TABLE public.players ADD COLUMN IF NOT EXISTS player_grouping text;
ALTER TABLE public.players DROP CONSTRAINT IF EXISTS players_player_grouping_check;
ALTER TABLE public.players ADD CONSTRAINT players_player_grouping_check
  CHECK (player_grouping IS NULL OR player_grouping IN ('1+','1','2+','2','3+','3','4'));

-- 2. Catching -------------------------------------------------------
ALTER TABLE public.players DROP COLUMN IF EXISTS catching CASCADE;
ALTER TABLE public.skill_ratings DROP COLUMN IF EXISTS catching CASCADE;

-- 3. Defaults of 3 for new players -----------------------------------
ALTER TABLE public.players ALTER COLUMN carrying SET DEFAULT 3;
ALTER TABLE public.players ALTER COLUMN handling SET DEFAULT 3;
ALTER TABLE public.players ALTER COLUMN tackling SET DEFAULT 3;
ALTER TABLE public.players ALTER COLUMN rucking SET DEFAULT 3;
ALTER TABLE public.players ALTER COLUMN kicking SET DEFAULT 3;
ALTER TABLE public.players ALTER COLUMN iq SET DEFAULT 3;
ALTER TABLE public.players ALTER COLUMN speed SET DEFAULT 3;
ALTER TABLE public.players ALTER COLUMN strength SET DEFAULT 3;
ALTER TABLE public.players ALTER COLUMN repeatability SET DEFAULT 3;

-- Ratings have not been entered yet: reset every player's baseline to 3.
UPDATE public.players SET
  carrying = 3, handling = 3, tackling = 3, rucking = 3, kicking = 3, iq = 3,
  speed = 3, strength = 3, repeatability = 3;

-- 4. Players who have left: delete them and every record linked to them.
--    Ratings, notes, feed posts, overrides and team picks cascade from players;
--    audit log entries are removed explicitly.
DELETE FROM public.audit_log
 WHERE table_name = 'players'
   AND record_id::text IN (
     SELECT id::text FROM public.players
      WHERE lower(trim(player_name)) IN
        ('alex shepherd','aj sumner','felix middleton','felix terrell','oscar whitley','ronnie haslar'));
DELETE FROM public.players
 WHERE lower(trim(player_name)) IN
   ('alex shepherd','aj sumner','felix middleton','felix terrell','oscar whitley','ronnie haslar');

-- 5. Grouping sheet ---------------------------------------------------
-- aliases: other spellings the same player may already be stored under.
CREATE TEMP TABLE _grouping_sheet (name text, grp text, aliases text[]);
INSERT INTO _grouping_sheet (name, grp, aliases) VALUES
  ('Dexter Clarke','1+','{}'),
  ('Frankie Lovett','1+','{}'),
  ('Harry O''Callaghan','1+','{}'),
  ('Jaxson Johnson-Brooks','1+','{}'),
  ('Mack Hathaway','1+','{}'),
  ('Theo Packwood','1','{}'),
  ('Angus Duguid','1','{}'),
  ('Matthew Shaw','1','{}'),
  ('George Parker','1','{}'),
  ('Connie Cambridge','1','{}'),
  ('Louis Symes','1','{}'),
  ('Lars Mordt','1','{}'),
  ('Theo Bibani','1','{}'),
  ('Lorenzo O''Sullivan','1','{}'),
  ('Max Warbrick','1','{}'),
  ('Albie Jablowski','2+','{}'),
  ('Austin Eichhorn-Metcalfe','2+','{}'),
  ('Benji McDonnell','2+','{}'),
  ('Harry Boneham','2+','{}'),
  ('Jenson Clark','2+','{}'),
  ('Max Hollis','2+','{}'),
  ('Rudi Jablowski','2+','{}'),
  ('Alex Watkins','2','{}'),
  ('Ben Brierley','2','{}'),
  ('Bruno Pavaday','2','{}'),
  ('Edy','2','{}'),
  ('Harry Forbes','2','{}'),
  ('Henry Pople','2','{}'),
  ('Joshua Schoeman','2','{}'),
  ('William Ford','2','{}'),
  ('Ollie Bowden','2','{}'),
  ('Ethan O''Boy','3+','{}'),
  ('Jasper O''Loghlen-Vidot','3+','{}'),
  ('Joseph Latham','3+','{}'),
  ('Quinn O''Connor','3+','{}'),
  ('William Lesinski','3+','{}'),
  ('Louis Dawson','3+','{}'),
  ('Ryan Bajraktari','3+','{}'),
  ('Coby Rosen','3+','{}'),
  ('Alexandre','3','{}'),
  ('Alfie Haller','3','{}'),
  ('Charlie Lundie-Hill','3','{}'),
  ('Connor F','3','{}'),
  ('Eren','3','{}'),
  ('George Selway-Smith','3','{"George SS"}'),
  ('Iago Colley','3','{}'),
  ('James Crockford','3','{}'),
  ('Joey Kendall','3','{"Joe Kendall"}'),
  ('Leo Dean','3','{}'),
  ('Theo Little','3','{}'),
  ('Alby Moorat','4','{"Albie Moorat"}'),
  ('Alex Ellis','4','{}'),
  ('Bilal Mohamed Nawab','4','{}'),
  ('Percy Layzell','4','{}'),
  ('Asher Johnson','4','{}'),
  ('Charlie McNicholas','4','{"Charlie Mc","Charlie McN"}'),
  ('Nathaniel Korbus','4','{"Nat Korbus"}'),
  ('Samuel Greenhill','4','{"Sam G","Sam Greenhill"}');

DO $$
DECLARE
  r record;
  pid uuid;
  norm_names text[];
BEGIN
  FOR r IN SELECT * FROM _grouping_sheet LOOP
    -- Case-insensitive, whitespace- and apostrophe-tolerant match on name or alias.
    SELECT array_agg(lower(regexp_replace(replace(n, '’', ''''), '\s+', ' ', 'g')))
      INTO norm_names
      FROM unnest(array_append(r.aliases, r.name)) AS n;

    SELECT id INTO pid
      FROM public.players
     WHERE lower(regexp_replace(replace(trim(player_name), '’', ''''), '\s+', ' ', 'g')) = ANY (norm_names)
     ORDER BY is_active DESC, created_at
     LIMIT 1;

    IF pid IS NULL THEN
      INSERT INTO public.players (player_name, player_grouping, is_active)
      VALUES (r.name, r.grp, true);
      RAISE NOTICE 'Added player: %', r.name;
    ELSE
      UPDATE public.players SET player_grouping = r.grp, is_active = true WHERE id = pid;
    END IF;
  END LOOP;

  FOR r IN SELECT player_name FROM public.players WHERE player_grouping IS NULL AND is_active LOOP
    RAISE NOTICE 'Active player not on grouping sheet: %', r.player_name;
  END LOOP;
END $$;
DROP TABLE IF EXISTS _grouping_sheet;
