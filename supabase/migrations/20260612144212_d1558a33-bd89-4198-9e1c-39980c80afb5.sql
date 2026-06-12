
CREATE TABLE public.match_ratings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
  player_id uuid NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  group_id uuid NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  tackling integer NOT NULL CHECK (tackling BETWEEN 1 AND 5),
  rucking integer NOT NULL CHECK (rucking BETWEEN 1 AND 5),
  kicking integer NOT NULL CHECK (kicking BETWEEN 1 AND 5),
  catching integer NOT NULL CHECK (catching BETWEEN 1 AND 5),
  iq integer NOT NULL CHECK (iq BETWEEN 1 AND 5),
  rated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (session_id, player_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.match_ratings TO authenticated;
GRANT ALL ON public.match_ratings TO service_role;

ALTER TABLE public.match_ratings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read match_ratings"
  ON public.match_ratings FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated can insert match_ratings"
  ON public.match_ratings FOR INSERT TO authenticated WITH CHECK (auth.uid() = rated_by);

CREATE POLICY "Rater or block_builder can update match_ratings"
  ON public.match_ratings FOR UPDATE TO authenticated
  USING (auth.uid() = rated_by OR public.has_role(auth.uid(), 'block_builder'))
  WITH CHECK (auth.uid() = rated_by OR public.has_role(auth.uid(), 'block_builder'));

CREATE POLICY "Block_builder can delete match_ratings"
  ON public.match_ratings FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'block_builder'));


CREATE TABLE public.session_player_overrides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
  player_id uuid NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  override_group_id uuid REFERENCES public.groups(id) ON DELETE CASCADE,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (session_id, player_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.session_player_overrides TO authenticated;
GRANT ALL ON public.session_player_overrides TO service_role;

ALTER TABLE public.session_player_overrides ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read overrides"
  ON public.session_player_overrides FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated can insert overrides"
  ON public.session_player_overrides FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Creator or block_builder can update overrides"
  ON public.session_player_overrides FOR UPDATE TO authenticated
  USING (auth.uid() = created_by OR public.has_role(auth.uid(), 'block_builder'))
  WITH CHECK (auth.uid() = created_by OR public.has_role(auth.uid(), 'block_builder'));

CREATE POLICY "Creator or block_builder can delete overrides"
  ON public.session_player_overrides FOR DELETE TO authenticated
  USING (auth.uid() = created_by OR public.has_role(auth.uid(), 'block_builder'));
