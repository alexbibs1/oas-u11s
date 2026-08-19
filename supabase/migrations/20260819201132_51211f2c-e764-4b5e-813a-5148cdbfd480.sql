CREATE OR REPLACE FUNCTION public.test_hello()
RETURNS text
LANGUAGE sql
STABLE
AS $$
  SELECT 'hello'::text;
$$;