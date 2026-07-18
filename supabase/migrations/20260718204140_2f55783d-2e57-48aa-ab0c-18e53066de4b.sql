DROP POLICY IF EXISTS "Only alex can read audit log" ON public.audit_log;

CREATE POLICY "block_builder can read audit log"
ON public.audit_log
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'block_builder'));