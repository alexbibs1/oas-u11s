DROP POLICY IF EXISTS "skill_ratings insert coach or admin" ON public.skill_ratings;
DROP POLICY IF EXISTS "skill_ratings update coach or admin" ON public.skill_ratings;

CREATE POLICY "skill_ratings insert assigned coach or admin"
  ON public.skill_ratings FOR INSERT TO authenticated
  WITH CHECK (
    public.is_coach_for_group(auth.uid(), group_id)
    OR public.has_role(auth.uid(), 'block_builder')
  );

CREATE POLICY "skill_ratings update assigned coach or admin"
  ON public.skill_ratings FOR UPDATE TO authenticated
  USING (
    public.is_coach_for_group(auth.uid(), group_id)
    OR public.has_role(auth.uid(), 'block_builder')
  )
  WITH CHECK (
    public.is_coach_for_group(auth.uid(), group_id)
    OR public.has_role(auth.uid(), 'block_builder')
  );

DROP POLICY IF EXISTS "Authenticated can insert overrides" ON public.session_player_overrides;
DROP POLICY IF EXISTS "Creator or block_builder can update overrides" ON public.session_player_overrides;

CREATE POLICY "Assigned coach can insert overrides"
  ON public.session_player_overrides FOR INSERT TO authenticated
  WITH CHECK (
    public.is_coach_for_session_block(auth.uid(), session_id)
    OR public.has_role(auth.uid(), 'block_builder')
  );

CREATE POLICY "Assigned coach or builder can update overrides"
  ON public.session_player_overrides FOR UPDATE TO authenticated
  USING (
    public.is_coach_for_session_block(auth.uid(), session_id)
    OR public.has_role(auth.uid(), 'block_builder')
  )
  WITH CHECK (
    public.is_coach_for_session_block(auth.uid(), session_id)
    OR public.has_role(auth.uid(), 'block_builder')
  );