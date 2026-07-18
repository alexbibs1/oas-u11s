-- Replace hardcoded email-based audit log access with role-based access.
-- The previous policy (20260627115817) locked SELECT to a single email
-- claim, which breaks on email rotation, additional admins, or delegation.
-- Any block_builder can now read the audit log, matching how the rest of
-- the admin surface (players, sessions, blocks) gates access.

DROP POLICY IF EXISTS "Only alex can read audit log" ON public.audit_log;

CREATE POLICY "block_builder can read audit log"
ON public.audit_log
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'block_builder'));
