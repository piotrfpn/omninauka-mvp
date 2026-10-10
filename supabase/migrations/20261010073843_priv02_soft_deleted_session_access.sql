-- PRIV-02B.2B.1: additive Data API access closure only. No data is purged.
-- Existing permissive policies still decide which commands are supported.
-- Restrictive policies AND their conditions with those existing permissions.
-- Service-role cleanup bypasses RLS; service endpoints need their own guards.
BEGIN;

-- Match the inspected live policy semantics, not human-readable policy names.
-- Only whitespace is normalized in pg_policies expressions; changed expressions
-- require review. This is deliberately not a general SQL equivalence parser.
-- Check the whole graph so an extra permissive ALL/DELETE/true policy fails closed.
DO $preflight$
DECLARE
  drift record;
  owner_expression constant text := '(auth.uid() = user_id)';
  image_owner_expression constant text := '(EXISTS ( SELECT 1 FROM study_sessions WHERE ((study_sessions.id = session_images.session_id) AND (study_sessions.user_id = auth.uid()))))';
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles
    WHERE rolname = 'authenticated' AND NOT rolbypassrls AND NOT rolsuper) THEN
    RAISE EXCEPTION 'PRIV02 requires authenticated to remain subject to RLS';
  END IF;

  FOR drift IN
    WITH expected(table_name, command, policy_role, using_expression, check_expression) AS (
      VALUES
        ('study_sessions', 'SELECT', 'authenticated', owner_expression, NULL),
        ('study_sessions', 'INSERT', 'authenticated', NULL, owner_expression),
        ('study_sessions', 'UPDATE', 'authenticated', owner_expression, owner_expression),
        ('session_images', 'SELECT', 'public', image_owner_expression, NULL),
        ('session_images', 'INSERT', 'public', NULL, image_owner_expression),
        ('session_images', 'DELETE', 'public', image_owner_expression, NULL),
        ('tutor_threads', 'SELECT', 'public', owner_expression, NULL),
        ('tutor_threads', 'INSERT', 'public', NULL, owner_expression),
        ('tutor_threads', 'UPDATE', 'public', owner_expression, NULL),
        ('tutor_messages', 'SELECT', 'public', owner_expression, NULL),
        ('tutor_messages', 'INSERT', 'public', NULL, owner_expression)
    ), actual AS (
      SELECT p.tablename, p.cmd, p.permissive, p.roles,
        btrim(regexp_replace(p.qual, '[[:space:]]+', ' ', 'g')) AS using_expression,
        btrim(regexp_replace(p.with_check, '[[:space:]]+', ' ', 'g')) AS check_expression
      FROM pg_policies p
      WHERE p.schemaname = 'public' AND p.tablename IN (
        'study_sessions', 'session_images', 'tutor_threads', 'tutor_messages')
    )
    SELECT coalesce(e.table_name, p.tablename) AS table_name,
      coalesce(e.command, p.cmd) AS command
    FROM expected e FULL JOIN actual p
      ON p.tablename = e.table_name AND p.cmd = e.command
    LEFT JOIN pg_class c ON c.oid = to_regclass('public.' || coalesce(e.table_name, p.tablename))
    WHERE e.table_name IS NULL OR p.tablename IS NULL
      OR p.permissive IS DISTINCT FROM 'PERMISSIVE'
      OR p.roles IS DISTINCT FROM ARRAY[e.policy_role]::name[]
      OR p.using_expression IS DISTINCT FROM e.using_expression
      OR p.check_expression IS DISTINCT FROM e.check_expression
      OR c.oid IS NULL OR NOT c.relrowsecurity
      OR c.relowner = (SELECT oid FROM pg_roles WHERE rolname = 'authenticated')
      OR NOT has_table_privilege('authenticated', c.oid, e.command)
  LOOP
    RAISE EXCEPTION 'PRIV02 session policy/ACL baseline mismatch: %.%', drift.table_name, drift.command;
  END LOOP;

  -- No study_sessions DELETE/ALL permissive policy is accepted above.
  -- Existing table DELETE grants alone do not grant row access under RLS.

  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role' AND rolbypassrls) THEN
    RAISE EXCEPTION 'PRIV02 requires the existing trusted service-role RLS bypass';
  END IF;
END;
$preflight$;

CREATE POLICY priv02_active_study_sessions
  ON public.study_sessions AS RESTRICTIVE FOR ALL TO authenticated
  USING (user_id = (SELECT auth.uid()) AND deleted_at IS NULL)
  WITH CHECK (user_id = (SELECT auth.uid()) AND deleted_at IS NULL);

CREATE POLICY priv02_active_session_images
  ON public.session_images AS RESTRICTIVE FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.study_sessions s
    WHERE s.id = session_images.session_id
      AND s.user_id = (SELECT auth.uid()) AND s.deleted_at IS NULL
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.study_sessions s
    WHERE s.id = session_images.session_id
      AND s.user_id = (SELECT auth.uid()) AND s.deleted_at IS NULL
  ));

CREATE POLICY priv02_active_tutor_threads
  ON public.tutor_threads AS RESTRICTIVE FOR ALL TO authenticated
  USING (user_id = (SELECT auth.uid()) AND EXISTS (
    SELECT 1 FROM public.study_sessions s
    WHERE s.id = tutor_threads.session_id
      AND s.user_id = (SELECT auth.uid()) AND s.deleted_at IS NULL
  ))
  WITH CHECK (user_id = (SELECT auth.uid()) AND EXISTS (
    SELECT 1 FROM public.study_sessions s
    WHERE s.id = tutor_threads.session_id
      AND s.user_id = (SELECT auth.uid()) AND s.deleted_at IS NULL
  ));

CREATE POLICY priv02_active_tutor_messages
  ON public.tutor_messages AS RESTRICTIVE FOR ALL TO authenticated
  USING (user_id = (SELECT auth.uid()) AND EXISTS (
    SELECT 1 FROM public.tutor_threads t
    JOIN public.study_sessions s ON s.id = t.session_id
    WHERE t.id = tutor_messages.thread_id AND t.user_id = (SELECT auth.uid())
      AND s.user_id = (SELECT auth.uid()) AND s.deleted_at IS NULL
  ))
  WITH CHECK (user_id = (SELECT auth.uid()) AND EXISTS (
    SELECT 1 FROM public.tutor_threads t
    JOIN public.study_sessions s ON s.id = t.session_id
    WHERE t.id = tutor_messages.thread_id AND t.user_id = (SELECT auth.uid())
      AND s.user_id = (SELECT auth.uid()) AND s.deleted_at IS NULL
  ));

COMMIT;
