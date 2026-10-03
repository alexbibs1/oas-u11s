# OA Rugby Hub database (live schema, 3 Oct 2026)

Supabase (Lovable Cloud) project `qgscvxbbrurfbtwelfnx`. RLS is on for every table.
`block_builder` = admin (Alex, Carli, Kieron, Grant). `coach` = coach role, linked to a `coaches` row.

## Tables
| Table | Purpose |
|---|---|
| players | Squad. Baseline skills (carrying, handling, tackling, rucking, kicking, iq) and attributes (speed, strength, repeatability), 1 to 5. `player_grouping` is 1+, 1, 2+, 2, 3+, 3, 4. Deactivate (`is_active`) rather than delete. |
| coaches | Coach names. `user_roles.coach_id` links a login to a coach. |
| user_roles | Login to role (block_builder / coach) and coach. |
| sessions | Calendar: training or match (opponent, venue). |
| match_teams | Up to 5 teams per match session. |
| match_team_players / match_team_coaches | Team sheet and coaches per team. Written only via `save_match_teams()`. |
| session_registrations | One row per team once its register is confirmed. Unique (session_id, match_team_id). |
| session_player_overrides | Register changes: `override_team_id` null = absent, another team = moved, own team = moved in and accepted. Unique (session_id, player_id). |
| skill_ratings | Match scores, one per player per match (unique session_id, player_id), tagged with the team that scored them. |
| player_notes, feed_posts | Coach notes and the feed. |
| audit_log | Admin changes, written server-side only. |

## Protections
- Deleting a player with scores or notes, or a match with scores, is blocked (`ON DELETE RESTRICT`).
- `save_match_teams(_session_id, _teams jsonb)` saves all teams in one transaction, admin only, rejects a player on two teams, and refuses to remove a team with a register, scores or moved players.
- Register and score writes are checked server-side (`src/lib/match/match.functions.ts`) then written with the service client.

## Roster logic
`src/lib/match/roster.ts` is the single source for who plays for which team; register, scoring, summary and completion all use it. Tests: `npm test`.

## Migrations
Lovable's migration folders lag the live schema. `supabase/migrations/2026100309*` and later describe the current protections and are safe to re-run.
