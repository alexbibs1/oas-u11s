# OA Rugby — Stage 1 Plan

Foundation only. No block builder tool, attendance, ratings, or news feed yet.

## 1. Enable Lovable Cloud

Enable Cloud (Supabase) so we get auth, database, and RLS.

## 2. Database schema (migration)

All FKs by `uuid` (per your decision). `player_name` and `coach_name` stay unique text columns on `players`/`coaches` but are not used as foreign keys.

Tables:

- `players` — id, player_name (unique), tackling, rucking, kicking, iq, speed (int 1–5, default 2, CHECK constraints), created_at
- `coaches` — id, coach_name (unique), created_at
- `blocks` — id, block_number (unique), name, start_date, end_date, is_active (default false), created_at
- `groups` — id, block_id → blocks, group_number (1–4, CHECK), created_at
- `group_players` — id, group_id → groups, player_id → players, created_at; unique(group_id, player_id)
- `group_coaches` — id, group_id → groups, coach_id → coaches, created_at; unique(group_id, coach_id)
- `sessions` — id, block_id → blocks, session_date, session_type ('training'|'match' CHECK), week_number, created_at
- `attendance` — id, session_id → sessions, player_id → players, group_id → groups, present (default false), created_at; unique(session_id, player_id)
- `user_roles` — id, user_id → auth.users, role app_role enum ('block_builder'|'coach'), coach_id → coaches (nullable); unique(user_id, role)

Plus:

- `app_role` enum
- `public.has_role(_user_id uuid, _role app_role)` SECURITY DEFINER function
- All tables: GRANTs for `authenticated` + `service_role` per the public-schema grant rules
- RLS enabled on every table

### RLS policies

- `players`, `coaches`, `blocks`, `groups`, `group_players`, `group_coaches`, `sessions`, `attendance`: SELECT for all authenticated users. INSERT/UPDATE/DELETE only for `block_builder` (via `has_role`). Attendance INSERT/UPDATE additionally allowed for `coach`.
- `user_roles`: SELECT own row for any authenticated user; full access only for `block_builder`. No anon access anywhere.

## 3. Seed data (migration)

- Insert 52 players (all skills default 2).
- Insert 16 coaches.
- No user_roles seeded — you'll assign the first `block_builder` manually via the Cloud dashboard after signing up.

## 4. Auth setup

- Email/password via Supabase (no public signup UI — invite-only).
- `/auth` login page with OA Rugby branding (login only, no signup form visible). A hidden/dev-only signup path is fine for bootstrapping the first account; can be removed later.
- Integration-managed `_authenticated` route gate already redirects unauthenticated users to `/auth`.
- New users invited from the Admin page via a server function using the admin client (`supabaseAdmin.auth.admin.inviteUserByEmail`) — gated to `block_builder` callers.

## 5. Routes (TanStack Start)

Public:
- `/auth` — login page

Authenticated (under `_authenticated/`):
- `/` — Home: "Welcome to OA Rugby, {name}" placeholder
- `/squad` — alphabetical list of 52 players showing all 6 skill scores; each row links to profile
- `/squad/$playerId` — player profile: name, 6 skill scores, "Notes" placeholder section
- `/admin` — block_builder only (guarded by `has_role` check in loader server fn; redirect coaches to `/`). Lists coaches and players; add/remove forms for each; invite-user form

## 6. Navigation

Bottom nav bar (mobile-first, also visible on desktop):
- Home, Squad, Admin (Admin hidden unless user has `block_builder` role)

## 7. Design system

- Update `src/styles.css` tokens: background white/very light grey, dark text, `--primary` deep navy `#003087`, `--accent` gold `#FFB81C`. Single light theme (no dark mode toggle this stage).
- Typography: clean sans (system stack or Inter via `<link>` in `__root.tsx`).
- Minimal, generous spacing, large tap targets for pitchside use.

## 8. Server functions

- `listPlayers`, `getPlayer(id)` — authenticated reads
- `listCoaches`
- `addPlayer`, `removePlayer`, `addCoach`, `removeCoach` — block_builder only
- `inviteUser({ email, role, coachId? })` — block_builder only; uses admin client inside handler
- `getMyRole` — returns current user's role + linked coach for nav/route gating

## Out of scope (later stages)

Block builder tool, group assignment UI, attendance entry, match ratings, feed/news, notes editing.

## Technical notes

- Modern TanStack Start stack; `createServerFn` for all DB access; admin client only inside handlers via dynamic import.
- After migration runs, code reads/writes go through server functions (RLS-respecting `requireSupabaseAuth` middleware) except invite + admin mutations which authorize then use `supabaseAdmin`.
- To bootstrap: sign up first account via `/auth`, then in Cloud dashboard insert a row into `user_roles` with that user's id and role `block_builder`. From then on, invites happen in-app.
