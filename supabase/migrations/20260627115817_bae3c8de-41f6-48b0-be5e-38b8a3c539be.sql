
-- PART A: Audit log lockdown
DROP POLICY IF EXISTS "Authenticated can insert audit log as self" ON public.audit_log;
DROP POLICY IF EXISTS "Admins can read audit log" ON public.audit_log;

-- Only service_role may write (server-side, via supabaseAdmin)
REVOKE INSERT, UPDATE, DELETE ON public.audit_log FROM authenticated, anon;

-- Restrict SELECT to one specific account by email claim
CREATE POLICY "Only alex can read audit log"
ON public.audit_log
FOR SELECT
TO authenticated
USING ((auth.jwt() ->> 'email') = 'alexbibani@gmail.com');

-- PART B: has_role - revoke from public/anon
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated, service_role;
