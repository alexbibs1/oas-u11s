CREATE OR REPLACE FUNCTION public.is_coach_for_group(_user_id uuid, _group_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles ur
    JOIN public.group_coaches gc ON gc.coach_id = ur.coach_id
    WHERE ur.user_id = _user_id
      AND gc.group_id = _group_id
  );
$$;

CREATE OR REPLACE FUNCTION public.is_coach_for_session_block(_user_id uuid, _session_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles ur
    JOIN public.group_coaches gc ON gc.coach_id = ur.coach_id
    JOIN public.groups g ON g.id = gc.group_id
    JOIN public.sessions s ON s.block_id = g.block_id
    WHERE ur.user_id = _user_id
      AND s.id = _session_id
  );
$$;