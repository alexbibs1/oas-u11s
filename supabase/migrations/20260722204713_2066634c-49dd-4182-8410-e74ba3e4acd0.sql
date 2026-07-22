ALTER TABLE public.groups DROP CONSTRAINT IF EXISTS groups_group_number_check;
ALTER TABLE public.groups ADD CONSTRAINT groups_group_number_check CHECK (group_number BETWEEN 1 AND 5);