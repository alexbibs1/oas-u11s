CREATE TABLE public.session_registrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  group_id uuid NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  submitted_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  submitted_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(session_id, group_id)
);

GRANT SELECT, INSERT, UPDATE ON public.session_registrations TO authenticated;
GRANT ALL ON public.session_registrations TO service_role;

ALTER TABLE public.session_registrations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can read session_registrations"
  ON public.session_registrations FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Coaches and builders can insert session_registrations"
  ON public.session_registrations FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'coach') OR has_role(auth.uid(), 'block_builder'));

CREATE POLICY "Creators and builders can update session_registrations"
  ON public.session_registrations FOR UPDATE TO authenticated
  USING (submitted_by = auth.uid() OR has_role(auth.uid(), 'block_builder'));