-- Registers, player moves and scores are written only by the app's server functions,
-- which check the coach is assigned to that team in that match before writing with the
-- service role. Coaches can no longer write these tables directly (closes "a coach can
-- change scores for another match"). Admins keep direct access. Reads unchanged.
-- Safe to re-run.
DROP POLICY IF EXISTS "skill_ratings insert assigned coach or admin" ON public.skill_ratings;
DROP POLICY IF EXISTS "skill_ratings update assigned coach or admin" ON public.skill_ratings;
DROP POLICY IF EXISTS "skill_ratings write admin" ON public.skill_ratings;
CREATE POLICY "skill_ratings write admin" ON public.skill_ratings
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'block_builder'))
  WITH CHECK (public.has_role(auth.uid(), 'block_builder'));
DROP POLICY IF EXISTS "skill_ratings delete admin" ON public.skill_ratings;

DROP POLICY IF EXISTS "Assigned coach can insert overrides" ON public.session_player_overrides;
DROP POLICY IF EXISTS "Assigned coach or builder can update overrides" ON public.session_player_overrides;
DROP POLICY IF EXISTS "Creator or block_builder can delete overrides" ON public.session_player_overrides;
DROP POLICY IF EXISTS "overrides write admin" ON public.session_player_overrides;
CREATE POLICY "overrides write admin" ON public.session_player_overrides
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'block_builder'))
  WITH CHECK (public.has_role(auth.uid(), 'block_builder'));

DROP POLICY IF EXISTS "Coaches and builders can insert session_registrations" ON public.session_registrations;
DROP POLICY IF EXISTS "Creators and builders can update session_registrations" ON public.session_registrations;
DROP POLICY IF EXISTS "registrations write admin" ON public.session_registrations;
CREATE POLICY "registrations write admin" ON public.session_registrations
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'block_builder'))
  WITH CHECK (public.has_role(auth.uid(), 'block_builder'));
