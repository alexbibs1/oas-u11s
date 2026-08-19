REVOKE EXECUTE ON FUNCTION public.is_coach_for_group(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_coach_for_group(uuid, uuid) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.is_coach_for_session_block(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_coach_for_session_block(uuid, uuid) TO authenticated;