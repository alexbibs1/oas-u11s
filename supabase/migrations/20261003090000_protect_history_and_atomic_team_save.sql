-- Protect season data and make team saving all-or-nothing.
-- Safe to re-run.

-- 1 & 2. A player or match with scores (or a player with coach notes) can no longer be
-- deleted; deactivate the player instead. Previously these deletes cascaded silently.
ALTER TABLE public.skill_ratings DROP CONSTRAINT IF EXISTS skill_ratings_player_id_fkey;
ALTER TABLE public.skill_ratings ADD CONSTRAINT skill_ratings_player_id_fkey
  FOREIGN KEY (player_id) REFERENCES public.players(id) ON DELETE RESTRICT;

ALTER TABLE public.skill_ratings DROP CONSTRAINT IF EXISTS skill_ratings_session_id_fkey;
ALTER TABLE public.skill_ratings ADD CONSTRAINT skill_ratings_session_id_fkey
  FOREIGN KEY (session_id) REFERENCES public.sessions(id) ON DELETE RESTRICT;

ALTER TABLE public.player_notes DROP CONSTRAINT IF EXISTS player_notes_player_id_fkey;
ALTER TABLE public.player_notes ADD CONSTRAINT player_notes_player_id_fkey
  FOREIGN KEY (player_id) REFERENCES public.players(id) ON DELETE RESTRICT;

-- 3 & 4. Save all teams for a match in one transaction. Admin only (RLS still applies).
-- A team that already has a register, scores or moved players can't be removed.
CREATE OR REPLACE FUNCTION public.save_match_teams(_session_id uuid, _teams jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  t jsonb;
  tid uuid;
  keep int[];
  locked_team int;
  dup_count int;
BEGIN
  IF NOT public.has_role(auth.uid(), 'block_builder') THEN
    RAISE EXCEPTION 'Only admins can pick teams';
  END IF;

  SELECT count(*) - count(DISTINCT p) INTO dup_count
    FROM jsonb_array_elements(_teams) x, jsonb_array_elements_text(x->'player_ids') p;
  IF dup_count > 0 THEN
    RAISE EXCEPTION 'A player is on more than one team';
  END IF;

  SELECT coalesce(array_agg((x->>'team_number')::int), '{}') INTO keep
    FROM jsonb_array_elements(_teams) x;

  SELECT mt.team_number INTO locked_team
    FROM public.match_teams mt
   WHERE mt.session_id = _session_id
     AND NOT (mt.team_number = ANY (keep))
     AND (EXISTS (SELECT 1 FROM public.session_registrations r WHERE r.match_team_id = mt.id)
       OR EXISTS (SELECT 1 FROM public.skill_ratings s WHERE s.match_team_id = mt.id)
       OR EXISTS (SELECT 1 FROM public.session_player_overrides o WHERE o.override_team_id = mt.id))
   ORDER BY mt.team_number
   LIMIT 1;
  IF locked_team IS NOT NULL THEN
    RAISE EXCEPTION 'Team % already has a register or scores, so it can''t be removed', locked_team;
  END IF;

  DELETE FROM public.match_teams
   WHERE session_id = _session_id AND NOT (team_number = ANY (keep));

  FOR t IN SELECT * FROM jsonb_array_elements(_teams) LOOP
    INSERT INTO public.match_teams (session_id, team_number)
    VALUES (_session_id, (t->>'team_number')::int)
    ON CONFLICT (session_id, team_number) DO UPDATE SET team_number = EXCLUDED.team_number
    RETURNING id INTO tid;

    DELETE FROM public.match_team_players WHERE match_team_id = tid;
    DELETE FROM public.match_team_coaches WHERE match_team_id = tid;
    INSERT INTO public.match_team_players (match_team_id, player_id)
      SELECT tid, p::uuid FROM jsonb_array_elements_text(t->'player_ids') p;
    INSERT INTO public.match_team_coaches (match_team_id, coach_id)
      SELECT tid, c::uuid FROM jsonb_array_elements_text(t->'coach_ids') c;
  END LOOP;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.save_match_teams(uuid, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_match_teams(uuid, jsonb) TO authenticated;
