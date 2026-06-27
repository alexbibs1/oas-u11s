
DROP POLICY "skill_ratings insert authed" ON public.skill_ratings;
DROP POLICY "skill_ratings update authed" ON public.skill_ratings;

CREATE POLICY "skill_ratings insert coach or admin" ON public.skill_ratings
  FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'coach')
    OR public.has_role(auth.uid(), 'block_builder')
  );

CREATE POLICY "skill_ratings update coach or admin" ON public.skill_ratings
  FOR UPDATE TO authenticated
  USING (
    public.has_role(auth.uid(), 'coach')
    OR public.has_role(auth.uid(), 'block_builder')
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'coach')
    OR public.has_role(auth.uid(), 'block_builder')
  );
