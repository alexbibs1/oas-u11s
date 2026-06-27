
CREATE TABLE public.skill_ratings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
  player_id uuid NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  player_name text NOT NULL,
  block_id uuid NOT NULL REFERENCES public.blocks(id) ON DELETE CASCADE,
  group_number integer NOT NULL,
  week_number integer,
  coach_names text[] NOT NULL DEFAULT '{}',
  entered_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  entered_by_name text,
  carrying integer NOT NULL CHECK (carrying BETWEEN 1 AND 5),
  handling integer NOT NULL CHECK (handling BETWEEN 1 AND 5),
  tackling integer NOT NULL CHECK (tackling BETWEEN 1 AND 5),
  rucking integer NOT NULL CHECK (rucking BETWEEN 1 AND 5),
  kicking integer NOT NULL CHECK (kicking BETWEEN 1 AND 5),
  catching integer NOT NULL CHECK (catching BETWEEN 1 AND 5),
  iq integer NOT NULL CHECK (iq BETWEEN 1 AND 5),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (session_id, player_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.skill_ratings TO authenticated;
GRANT ALL ON public.skill_ratings TO service_role;

ALTER TABLE public.skill_ratings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "skill_ratings read all authed" ON public.skill_ratings
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "skill_ratings insert authed" ON public.skill_ratings
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "skill_ratings update authed" ON public.skill_ratings
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "skill_ratings delete admin" ON public.skill_ratings
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'block_builder'));

CREATE INDEX skill_ratings_session_idx ON public.skill_ratings(session_id);
CREATE INDEX skill_ratings_player_idx ON public.skill_ratings(player_id);
CREATE INDEX skill_ratings_block_idx ON public.skill_ratings(block_id);

CREATE TRIGGER skill_ratings_touch_updated_at
  BEFORE UPDATE ON public.skill_ratings
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
