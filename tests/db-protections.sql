-- Database protection checks. Run against the live database: everything is rolled back.
-- Expect: A keeps teams; B to F are all "blocked".
-- Replace MATCH_ID with a match that has teams picked.
BEGIN;
SELECT set_config('request.jwt.claims', json_build_object('sub',(SELECT id FROM auth.users WHERE email='alexbibani@gmail.com'),'role','authenticated')::text, true);
CREATE TEMP TABLE _out(test text, result text);
CREATE TEMP TABLE _cur AS
SELECT jsonb_agg(jsonb_build_object('team_number', t.team_number,
  'player_ids', coalesce((SELECT jsonb_agg(player_id) FROM match_team_players WHERE match_team_id=t.id),'[]'),
  'coach_ids', coalesce((SELECT jsonb_agg(coach_id) FROM match_team_coaches WHERE match_team_id=t.id),'[]')) ORDER BY t.team_number) j
FROM match_teams t WHERE t.session_id='MATCH_ID';
SELECT save_match_teams('MATCH_ID', (SELECT j FROM _cur));
INSERT INTO _out SELECT 'A resave unchanged', (SELECT count(*) FROM match_teams WHERE session_id='MATCH_ID')||' teams';
INSERT INTO session_registrations(session_id, match_team_id, submitted_at)
  SELECT session_id, id, now() FROM match_teams WHERE session_id='MATCH_ID' ORDER BY team_number DESC LIMIT 1;
DO $$ BEGIN
  PERFORM save_match_teams('MATCH_ID', (SELECT jsonb_path_query_array(j, '$[0 to last-1]') FROM _cur));
  INSERT INTO _out VALUES ('B drop registered team','ALLOWED (bad)');
EXCEPTION WHEN others THEN INSERT INTO _out VALUES ('B drop registered team','blocked: '||SQLERRM); END $$;
DO $$ DECLARE bad jsonb; BEGIN
  bad := jsonb_set((SELECT j FROM _cur), '{1,player_ids}', ((SELECT j FROM _cur)->1->'player_ids') || jsonb_build_array((SELECT j FROM _cur)->0->'player_ids'->0));
  PERFORM save_match_teams('MATCH_ID', bad);
  INSERT INTO _out VALUES ('C duplicate player','ALLOWED (bad)');
EXCEPTION WHEN others THEN INSERT INTO _out VALUES ('C duplicate player','blocked: '||SQLERRM); END $$;
INSERT INTO skill_ratings(session_id, match_team_id, coach_names, player_id, player_name, tackling, rucking, carrying, handling, kicking, iq)
  SELECT 'MATCH_ID', NULL, '{}', id, player_name, 3,3,3,3,3,3 FROM players ORDER BY player_name LIMIT 1;
DO $$ BEGIN DELETE FROM players WHERE id=(SELECT player_id FROM skill_ratings WHERE session_id='MATCH_ID' LIMIT 1); INSERT INTO _out VALUES ('D delete scored player','ALLOWED (bad)');
EXCEPTION WHEN others THEN INSERT INTO _out VALUES ('D delete scored player','blocked'); END $$;
DO $$ BEGIN DELETE FROM sessions WHERE id='MATCH_ID'; INSERT INTO _out VALUES ('E delete scored match','ALLOWED (bad)');
EXCEPTION WHEN others THEN INSERT INTO _out VALUES ('E delete scored match','blocked'); END $$;
SELECT set_config('request.jwt.claims', json_build_object('sub',gen_random_uuid(),'role','authenticated')::text, true);
DO $$ BEGIN PERFORM save_match_teams('MATCH_ID', (SELECT j FROM _cur)); INSERT INTO _out VALUES ('F non-admin save','ALLOWED (bad)');
EXCEPTION WHEN others THEN INSERT INTO _out VALUES ('F non-admin save','blocked: '||SQLERRM); END $$;
SELECT * FROM _out;
ROLLBACK;
