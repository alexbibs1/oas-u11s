
-- Enum for roles
CREATE TYPE public.app_role AS ENUM ('block_builder', 'coach');

-- =========================
-- PLAYERS
-- =========================
CREATE TABLE public.players (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_name TEXT UNIQUE NOT NULL,
  tackling INTEGER NOT NULL DEFAULT 2 CHECK (tackling BETWEEN 1 AND 5),
  rucking  INTEGER NOT NULL DEFAULT 2 CHECK (rucking  BETWEEN 1 AND 5),
  kicking  INTEGER NOT NULL DEFAULT 2 CHECK (kicking  BETWEEN 1 AND 5),
  catching INTEGER NOT NULL DEFAULT 2 CHECK (catching BETWEEN 1 AND 5),
  iq       INTEGER NOT NULL DEFAULT 2 CHECK (iq       BETWEEN 1 AND 5),
  speed    INTEGER NOT NULL DEFAULT 2 CHECK (speed    BETWEEN 1 AND 5),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.players TO authenticated;
GRANT ALL ON public.players TO service_role;
ALTER TABLE public.players ENABLE ROW LEVEL SECURITY;

-- =========================
-- COACHES
-- =========================
CREATE TABLE public.coaches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_name TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.coaches TO authenticated;
GRANT ALL ON public.coaches TO service_role;
ALTER TABLE public.coaches ENABLE ROW LEVEL SECURITY;

-- =========================
-- BLOCKS
-- =========================
CREATE TABLE public.blocks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  block_number INTEGER UNIQUE NOT NULL,
  name TEXT,
  start_date DATE,
  end_date DATE,
  is_active BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.blocks TO authenticated;
GRANT ALL ON public.blocks TO service_role;
ALTER TABLE public.blocks ENABLE ROW LEVEL SECURITY;

-- =========================
-- GROUPS
-- =========================
CREATE TABLE public.groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  block_id UUID NOT NULL REFERENCES public.blocks(id) ON DELETE CASCADE,
  group_number INTEGER NOT NULL CHECK (group_number BETWEEN 1 AND 4),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (block_id, group_number)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.groups TO authenticated;
GRANT ALL ON public.groups TO service_role;
ALTER TABLE public.groups ENABLE ROW LEVEL SECURITY;

-- =========================
-- GROUP_PLAYERS
-- =========================
CREATE TABLE public.group_players (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  player_id UUID NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (group_id, player_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.group_players TO authenticated;
GRANT ALL ON public.group_players TO service_role;
ALTER TABLE public.group_players ENABLE ROW LEVEL SECURITY;

-- =========================
-- GROUP_COACHES
-- =========================
CREATE TABLE public.group_coaches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  coach_id UUID NOT NULL REFERENCES public.coaches(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (group_id, coach_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.group_coaches TO authenticated;
GRANT ALL ON public.group_coaches TO service_role;
ALTER TABLE public.group_coaches ENABLE ROW LEVEL SECURITY;

-- =========================
-- SESSIONS
-- =========================
CREATE TABLE public.sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  block_id UUID NOT NULL REFERENCES public.blocks(id) ON DELETE CASCADE,
  session_date DATE NOT NULL,
  session_type TEXT NOT NULL CHECK (session_type IN ('training','match')),
  week_number INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sessions TO authenticated;
GRANT ALL ON public.sessions TO service_role;
ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;

-- =========================
-- ATTENDANCE
-- =========================
CREATE TABLE public.attendance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
  player_id UUID NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  group_id UUID NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  present BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (session_id, player_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.attendance TO authenticated;
GRANT ALL ON public.attendance TO service_role;
ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;

-- =========================
-- USER_ROLES
-- =========================
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  coach_id UUID REFERENCES public.coaches(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- =========================
-- has_role security definer
-- =========================
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- =========================
-- RLS POLICIES
-- =========================

-- players
CREATE POLICY "players read all authed" ON public.players
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "players write block_builder" ON public.players
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'block_builder'))
  WITH CHECK (public.has_role(auth.uid(), 'block_builder'));

-- coaches
CREATE POLICY "coaches read all authed" ON public.coaches
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "coaches write block_builder" ON public.coaches
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'block_builder'))
  WITH CHECK (public.has_role(auth.uid(), 'block_builder'));

-- blocks
CREATE POLICY "blocks read all authed" ON public.blocks
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "blocks write block_builder" ON public.blocks
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'block_builder'))
  WITH CHECK (public.has_role(auth.uid(), 'block_builder'));

-- groups
CREATE POLICY "groups read all authed" ON public.groups
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "groups write block_builder" ON public.groups
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'block_builder'))
  WITH CHECK (public.has_role(auth.uid(), 'block_builder'));

-- group_players
CREATE POLICY "group_players read all authed" ON public.group_players
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "group_players write block_builder" ON public.group_players
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'block_builder'))
  WITH CHECK (public.has_role(auth.uid(), 'block_builder'));

-- group_coaches
CREATE POLICY "group_coaches read all authed" ON public.group_coaches
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "group_coaches write block_builder" ON public.group_coaches
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'block_builder'))
  WITH CHECK (public.has_role(auth.uid(), 'block_builder'));

-- sessions
CREATE POLICY "sessions read all authed" ON public.sessions
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "sessions write block_builder" ON public.sessions
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'block_builder'))
  WITH CHECK (public.has_role(auth.uid(), 'block_builder'));

-- attendance
CREATE POLICY "attendance read all authed" ON public.attendance
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "attendance insert coach or builder" ON public.attendance
  FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'block_builder')
    OR public.has_role(auth.uid(), 'coach')
  );
CREATE POLICY "attendance update coach or builder" ON public.attendance
  FOR UPDATE TO authenticated
  USING (
    public.has_role(auth.uid(), 'block_builder')
    OR public.has_role(auth.uid(), 'coach')
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'block_builder')
    OR public.has_role(auth.uid(), 'coach')
  );
CREATE POLICY "attendance delete block_builder" ON public.attendance
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'block_builder'));

-- user_roles
CREATE POLICY "user_roles read own" ON public.user_roles
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'block_builder'));
CREATE POLICY "user_roles write block_builder" ON public.user_roles
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'block_builder'))
  WITH CHECK (public.has_role(auth.uid(), 'block_builder'));

-- =========================
-- SEED PLAYERS
-- =========================
INSERT INTO public.players (player_name) VALUES
  ('AJ Sumner'),('Albie Jablowski'),('Alex Shepherd'),('Alex Watkins'),
  ('Alfie Haller'),('Angus Duguid'),('Austin Eichhorn-Metcalfe'),('Benji McDonnell'),
  ('Bilal Mohamed Nawab'),('Bruno Pavaday'),('Charlie Lundie-Hill'),('Coby Rosen'),
  ('Connie Cambridge'),('Connor F'),('Dexter Clarke'),('Ethan O''Boy'),
  ('Felix Middleton'),('Felix Terrell'),('Frankie Lovett'),('George Parker'),
  ('George Selway-Smith'),('Harry Boneham'),('Harry Forbes'),('Harry O''Callaghan'),
  ('Henry Pople'),('Iago Colley'),('James Crockford'),('Jasper O''Loghlen-Vidot'),
  ('Jaxson Johnson-Brooks'),('Jenson Clark'),('Joseph Latham'),('Joshua Schoeman'),
  ('Lars Mordt'),('Lorenzo O''Sullivan'),('Louis Dawson'),('Louis Symes'),
  ('Mack Hathaway'),('Matthew Shaw'),('Max Hollis'),('Max Warbrick'),
  ('Ollie Bowden'),('Oscar Whitley'),('Percy Layzell'),('Quinn O''Connor'),
  ('Ronnie Haslar'),('Rudi Jablowski'),('Ryan Bajraktari'),('Theo Bibani'),
  ('Theo Little'),('Theo Packwood'),('William Ford'),('William Lesinski');

-- =========================
-- SEED COACHES
-- =========================
INSERT INTO public.coaches (coach_name) VALUES
  ('Alex'),('Andy'),('Ben'),('Carli'),('Dan'),('Ed'),('Grant'),('Ian'),
  ('Joe'),('Jonny'),('Jonny L'),('Kieron'),('Mark'),('Mike'),('Mike T'),('Will');
