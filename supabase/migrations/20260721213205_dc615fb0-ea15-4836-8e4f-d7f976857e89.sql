ALTER TABLE public.coaches
  ADD COLUMN IF NOT EXISTS child_player_id uuid REFERENCES public.players(id) ON DELETE SET NULL;

DELETE FROM public.coaches WHERE coach_name IN ('Ben', 'Mike T');

UPDATE public.coaches c SET child_player_id = p.id FROM public.players p WHERE p.player_name = 'Theo Bibani' AND c.coach_name = 'Alex';
UPDATE public.coaches c SET child_player_id = p.id FROM public.players p WHERE p.player_name = 'Jenson Clark' AND c.coach_name = 'Andy';
UPDATE public.coaches c SET child_player_id = p.id FROM public.players p WHERE p.player_name = 'Mack Hathaway' AND c.coach_name = 'Carli';
UPDATE public.coaches c SET child_player_id = p.id FROM public.players p WHERE p.player_name = 'Oscar Whitley' AND c.coach_name = 'Dan';
UPDATE public.coaches c SET child_player_id = p.id FROM public.players p WHERE p.player_name = 'Matthew Shaw' AND c.coach_name = 'Ed';
UPDATE public.coaches c SET child_player_id = p.id FROM public.players p WHERE p.player_name = 'Mack Hathaway' AND c.coach_name = 'Grant';
UPDATE public.coaches c SET child_player_id = p.id FROM public.players p WHERE p.player_name = 'Alex Watkins' AND c.coach_name = 'Ian';
UPDATE public.coaches c SET child_player_id = p.id FROM public.players p WHERE p.player_name = 'Max Hollis' AND c.coach_name = 'Joe';
UPDATE public.coaches c SET child_player_id = p.id FROM public.players p WHERE p.player_name = 'Benji McDonnell' AND c.coach_name = 'Jonny';
UPDATE public.coaches c SET child_player_id = p.id FROM public.players p WHERE p.player_name = 'Frankie Lovett' AND c.coach_name = 'Jonny L';
UPDATE public.coaches c SET child_player_id = p.id FROM public.players p WHERE p.player_name = 'Harry O''Callaghan' AND c.coach_name = 'Kieron';
UPDATE public.coaches c SET child_player_id = p.id FROM public.players p WHERE p.player_name = 'AJ Sumner' AND c.coach_name = 'Mark';
UPDATE public.coaches c SET child_player_id = p.id FROM public.players p WHERE p.player_name = 'Lorenzo O''Sullivan' AND c.coach_name = 'Mike';
UPDATE public.coaches c SET child_player_id = p.id FROM public.players p WHERE p.player_name = 'Austin Eichhorn-Metcalfe' AND c.coach_name = 'Will';