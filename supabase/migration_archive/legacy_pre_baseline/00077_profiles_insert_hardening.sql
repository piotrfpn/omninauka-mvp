-- Sprint 29D.1C. Local artifact only; execute this file separately after review.
-- Auth's postgres-owned handle_new_user() remains the profile creation path.
-- No profile/Auth data, SELECT/UPDATE permissions, triggers or RPCs are changed.
BEGIN;

DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;

REVOKE INSERT ON TABLE public.profiles FROM anon, authenticated;

-- Use the live column inventory, including any columns absent from repo history.
DO $insert_acl$
DECLARE
  v_columns text;
BEGIN
  SELECT string_agg(format('%I', attname), ', ' ORDER BY attnum) INTO v_columns
  FROM pg_attribute
  WHERE attrelid = 'public.profiles'::regclass
    AND attnum > 0 AND NOT attisdropped;

  EXECUTE format(
    'REVOKE INSERT (%s) ON TABLE public.profiles FROM anon, authenticated',
    v_columns
  );

  -- Do not silently remove an unexpected ALL policy: it may also protect reads
  -- and updates. Fail closed if the reviewed live policy contract has drifted.
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'profiles'
      AND cmd IN ('INSERT', 'ALL')
      AND roles && ARRAY['public', 'anon', 'authenticated']::name[]
  ) OR has_table_privilege('anon', 'public.profiles', 'INSERT')
    OR has_table_privilege('authenticated', 'public.profiles', 'INSERT')
    OR has_any_column_privilege('anon', 'public.profiles', 'INSERT')
    OR has_any_column_privilege('authenticated', 'public.profiles', 'INSERT') THEN
    RAISE EXCEPTION 'Unexpected profile creation permissions';
  END IF;
END;
$insert_acl$;

COMMIT;
