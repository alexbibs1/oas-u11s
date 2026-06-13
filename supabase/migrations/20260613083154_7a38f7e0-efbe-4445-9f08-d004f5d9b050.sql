
CREATE TABLE public.player_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id uuid NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  note text NOT NULL,
  written_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  coach_name text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.player_notes TO authenticated;
GRANT ALL ON public.player_notes TO service_role;
ALTER TABLE public.player_notes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth read notes" ON public.player_notes FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth insert notes" ON public.player_notes FOR INSERT TO authenticated WITH CHECK (auth.uid() = written_by);
CREATE POLICY "owner or admin update notes" ON public.player_notes FOR UPDATE TO authenticated USING (auth.uid() = written_by OR public.has_role(auth.uid(), 'block_builder'));
CREATE POLICY "owner or admin delete notes" ON public.player_notes FOR DELETE TO authenticated USING (auth.uid() = written_by OR public.has_role(auth.uid(), 'block_builder'));

CREATE TABLE public.feed_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  content text NOT NULL,
  written_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  coach_name text,
  player_id uuid REFERENCES public.players(id) ON DELETE CASCADE,
  is_player_note boolean NOT NULL DEFAULT false,
  source_note_id uuid REFERENCES public.player_notes(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.feed_posts TO authenticated;
GRANT ALL ON public.feed_posts TO service_role;
ALTER TABLE public.feed_posts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth read feed" ON public.feed_posts FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth insert feed" ON public.feed_posts FOR INSERT TO authenticated WITH CHECK (auth.uid() = written_by);
CREATE POLICY "owner or admin update feed" ON public.feed_posts FOR UPDATE TO authenticated USING (auth.uid() = written_by OR public.has_role(auth.uid(), 'block_builder'));
CREATE POLICY "owner or admin delete feed" ON public.feed_posts FOR DELETE TO authenticated USING (auth.uid() = written_by OR public.has_role(auth.uid(), 'block_builder'));

CREATE OR REPLACE FUNCTION public.touch_updated_at() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;
CREATE TRIGGER tg_player_notes_updated BEFORE UPDATE ON public.player_notes FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER tg_feed_posts_updated BEFORE UPDATE ON public.feed_posts FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
