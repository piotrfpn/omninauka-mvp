-- PRIV-02B.2B.2B1: local-only deletion barrier; no hard purge or cleanup.
-- Signed URLs already issued are not revoked by these policies.
BEGIN;

DO $preflight$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
                 WHERE n.nspname = 'storage' AND c.relname = 'objects' AND c.relrowsecurity)
     OR NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public'
                    AND table_name = 'study_sessions' AND column_name = 'deleted_at' AND data_type = 'timestamp with time zone')
     OR (SELECT count(*) FROM pg_catalog.pg_policies WHERE schemaname = 'public'
         AND policyname IN ('priv02_active_study_sessions', 'priv02_active_session_images',
                           'priv02_active_tutor_threads', 'priv02_active_tutor_messages')
         AND permissive = 'RESTRICTIVE' AND cmd = 'ALL' AND roles = ARRAY['authenticated']::name[]) <> 4
     OR NOT EXISTS (SELECT 1 FROM pg_catalog.pg_policies WHERE schemaname = 'storage'
                    AND tablename = 'objects' AND policyname = 'study_materials_insert_account_guard'
                    AND permissive = 'RESTRICTIVE' AND cmd = 'INSERT')
     OR NOT EXISTS (SELECT 1 FROM pg_catalog.pg_policies WHERE schemaname = 'storage'
                    AND tablename = 'objects' AND policyname = 'study_materials_update_account_guard'
                    AND permissive = 'RESTRICTIVE' AND cmd = 'UPDATE') THEN
    RAISE EXCEPTION 'PRIV02 deletion barrier requires the reviewed active-session/account policy baseline';
  END IF;
END;
$preflight$;

-- A hash collision only serializes unrelated sessions; authorization never uses the hash.
CREATE FUNCTION public.session_mutation_lock_key(p_session_id uuid)
RETURNS bigint LANGUAGE sql IMMUTABLE STRICT SECURITY INVOKER
SET search_path = pg_catalog
AS $function$
  SELECT pg_catalog.hashtextextended('omninauka:session-mutation:' || p_session_id::text, 0);
$function$;

-- Parse only canonical user/session paths; malformed input returns NULL, not a cast error.
CREATE FUNCTION public.session_material_session_id(p_name text)
RETURNS uuid LANGUAGE plpgsql STABLE SECURITY INVOKER
SET search_path = pg_catalog
AS $function$
DECLARE
  v_parts text[] := pg_catalog.string_to_array(p_name, '/');
  v_user_id uuid := auth.uid();
BEGIN
  IF v_user_id IS NULL OR p_name IS NULL OR p_name <> pg_catalog.btrim(p_name)
     OR pg_catalog.strpos(p_name, E'\\') > 0 OR pg_catalog.array_length(v_parts, 1) < 3
     OR EXISTS (SELECT 1 FROM pg_catalog.unnest(v_parts) AS part WHERE part IN ('', '.', '..'))
     OR v_parts[1] !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
     OR v_parts[2] !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
    RETURN NULL;
  END IF;
  IF v_parts[1]::uuid <> v_user_id OR v_parts[1] <> v_user_id::text
     OR v_parts[2] <> (v_parts[2]::uuid)::text THEN RETURN NULL; END IF;
  RETURN v_parts[2]::uuid;
END;
$function$;

CREATE FUNCTION public.can_write_session_material(p_name text)
RETURNS boolean LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path = pg_catalog
AS $function$
DECLARE
  v_user_id uuid := auth.uid();
  v_session_id uuid := public.session_material_session_id(p_name);
BEGIN
  IF v_session_id IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.study_sessions WHERE id = v_session_id AND user_id = v_user_id
  ) THEN RETURN false; END IF;
  -- Never lock a foreign/missing session supplied through a path.
  PERFORM pg_catalog.pg_advisory_xact_lock(public.session_mutation_lock_key(v_session_id));
  -- Separate statement after waiting. FOR SHARE also fences direct soft-delete
  -- UPDATEs and fails closed on stale higher-isolation snapshots.
  PERFORM 1 FROM public.study_sessions
    WHERE id = v_session_id AND user_id = v_user_id AND deleted_at IS NULL FOR SHARE;
  RETURN FOUND;
END;
$function$;

CREATE FUNCTION public.can_read_session_material(p_name text)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = pg_catalog
AS $function$
DECLARE
  v_user_id uuid := auth.uid();
  v_session_id uuid := public.session_material_session_id(p_name);
BEGIN
  IF v_user_id IS NULL THEN RETURN false; END IF;
  IF v_session_id IS NOT NULL THEN
    RETURN EXISTS (SELECT 1 FROM public.study_sessions
      WHERE id = v_session_id AND user_id = v_user_id AND deleted_at IS NULL);
  END IF;
  -- Existing root uploads/... and user/uploads/... documents are read-only
  -- compatibility. Existing permissive owner policies still apply (AND).
  IF NOT (p_name LIKE 'uploads/%' OR p_name LIKE v_user_id::text || '/uploads/%') THEN RETURN false; END IF;
  RETURN EXISTS (
    SELECT 1 FROM public.study_sessions s
    WHERE s.user_id = v_user_id AND s.deleted_at IS NULL
      AND (s.image_url = p_name OR EXISTS (
        SELECT 1 FROM public.session_images i WHERE i.session_id = s.id AND i.image_url = p_name
      ))
  );
END;
$function$;

CREATE FUNCTION public.begin_session_purge(p_session_id uuid, p_user_id uuid)
RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path = pg_catalog
AS $function$
DECLARE
  v_owner uuid;
  v_deleted_at timestamptz;
BEGIN
  IF p_session_id IS NULL OR p_user_id IS NULL THEN
    RETURN pg_catalog.jsonb_build_object('status', 'invalid_request');
  END IF;
  SELECT user_id INTO v_owner FROM public.study_sessions WHERE id = p_session_id;
  IF NOT FOUND THEN RETURN pg_catalog.jsonb_build_object('status', 'not_found'); END IF;
  IF v_owner <> p_user_id THEN RETURN pg_catalog.jsonb_build_object('status', 'forbidden'); END IF;
  PERFORM pg_catalog.pg_advisory_xact_lock(public.session_mutation_lock_key(p_session_id));
  SELECT user_id, deleted_at INTO v_owner, v_deleted_at FROM public.study_sessions
    WHERE id = p_session_id FOR UPDATE;
  IF NOT FOUND THEN RETURN pg_catalog.jsonb_build_object('status', 'not_found'); END IF;
  IF v_owner <> p_user_id THEN RETURN pg_catalog.jsonb_build_object('status', 'forbidden'); END IF;
  UPDATE public.study_sessions SET deleted_at = COALESCE(deleted_at, pg_catalog.now())
    WHERE id = p_session_id AND user_id = p_user_id;
  RETURN pg_catalog.jsonb_build_object('status', CASE WHEN v_deleted_at IS NULL THEN 'started' ELSE 'already_started' END);
END;
$function$;

ALTER FUNCTION public.session_mutation_lock_key(uuid) OWNER TO postgres;
ALTER FUNCTION public.session_material_session_id(text) OWNER TO postgres;
ALTER FUNCTION public.can_write_session_material(text) OWNER TO postgres;
ALTER FUNCTION public.can_read_session_material(text) OWNER TO postgres;
ALTER FUNCTION public.begin_session_purge(uuid, uuid) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.session_mutation_lock_key(uuid) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.session_material_session_id(text) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.can_write_session_material(text) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.can_read_session_material(text) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.begin_session_purge(uuid, uuid) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.session_material_session_id(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_write_session_material(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_read_session_material(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.begin_session_purge(uuid, uuid) TO service_role;

-- Restrictive conditions narrow every existing permissive variant, including
-- duplicate SELECT policies. Account guards and client DELETE grants stay intact.
CREATE POLICY priv02_session_material_read ON storage.objects AS RESTRICTIVE FOR SELECT TO authenticated
  USING (bucket_id <> 'study-materials' OR public.can_read_session_material(name));
CREATE POLICY priv02_session_material_insert ON storage.objects AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (bucket_id <> 'study-materials' OR public.can_write_session_material(name));
CREATE POLICY priv02_session_material_update ON storage.objects AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (bucket_id <> 'study-materials' OR public.can_write_session_material(name))
  WITH CHECK (bucket_id <> 'study-materials' OR public.can_write_session_material(name));

-- The upload's later DB attachment must participate too: an INSERT whose RLS
-- snapshot predates purge must not commit a new reference after the marker.
CREATE POLICY priv02_session_image_attachment ON public.session_images AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.session_material_session_id(image_url) = session_id
              AND public.can_write_session_material(image_url));

-- AI usage function replacement follows; the existing EXECUTE ACL is preserved.
CREATE OR REPLACE FUNCTION public.check_and_reserve_ai_usage(p_user_id uuid, p_session_id uuid, p_event_type text, p_plan text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_normalized_plan text;
  v_session_owner uuid;
  v_limit int;
  v_used int;
  v_lock_key bigint;
  v_reservation_id uuid;
  v_feature text;
  v_message text;
BEGIN
  -- Strict normalization of plan
  IF p_plan = 'premium' OR p_plan = 'family' THEN
    v_normalized_plan := p_plan;
  ELSE
    v_normalized_plan := 'free';
  END IF;

  -- Validate event type
  IF p_event_type NOT IN ('lesson_analysis', 'flashcard_regen', 'quiz_regen') THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'unsupported_event_type');
  END IF;

  -- Session validation for session-scoped features
  IF p_event_type IN ('flashcard_regen', 'quiz_regen') THEN
    IF p_session_id IS NULL THEN
      RETURN jsonb_build_object('allowed', false, 'reason', 'missing_session_id');
    END IF;
    SELECT user_id INTO v_session_owner FROM public.study_sessions WHERE id = p_session_id AND deleted_at IS NULL FOR SHARE;
    IF NOT FOUND THEN
      RETURN jsonb_build_object('allowed', false, 'reason', 'session_not_found');
    END IF;
    IF v_session_owner <> p_user_id THEN
      RETURN jsonb_build_object('allowed', false, 'reason', 'session_ownership_mismatch');
    END IF;
  END IF;

  -- Additionally, even if lesson_analysis is daily, if a session is provided, validate ownership
  IF p_event_type = 'lesson_analysis' AND p_session_id IS NOT NULL THEN
    SELECT user_id INTO v_session_owner FROM public.study_sessions WHERE id = p_session_id AND deleted_at IS NULL FOR SHARE;
    IF NOT FOUND THEN
      RETURN jsonb_build_object('allowed', false, 'reason', 'session_not_found');
    END IF;
    IF v_session_owner <> p_user_id THEN
      RETURN jsonb_build_object('allowed', false, 'reason', 'session_ownership_mismatch');
    END IF;
  END IF;

  -- Limits determination and lock key generation
  IF p_event_type = 'lesson_analysis' THEN
    IF v_normalized_plan = 'free' THEN v_limit := 2; ELSE v_limit := 10; END IF;
    -- Daily lock per user
    v_lock_key := hashtext(p_user_id::text || p_event_type || (timezone('utc', now())::date)::text)::bigint;
    v_feature := 'ai_lessons';
    IF v_normalized_plan = 'free' THEN
      v_message := 'Osiągnąłeś dzienny limit lekcji AI w planie Darmowym. Sprawdź Premium, aby korzystać z większego limitu.';
    ELSE
      v_message := 'Osiągnąłeś dzienny limit lekcji AI dla swojego planu (fair use).';
    END IF;
  ELSIF p_event_type = 'flashcard_regen' THEN
    IF v_normalized_plan = 'free' THEN v_limit := 1; ELSE v_limit := 5; END IF;
    -- Session lock
    v_lock_key := hashtext(p_user_id::text || p_session_id::text || p_event_type)::bigint;
    v_feature := 'flashcard_regen';
    IF v_normalized_plan = 'free' THEN
      v_message := 'W planie Darmowym możesz wygenerować jedną dodatkową serię fiszek. Sprawdź Premium, aby odblokować więcej powtórek.';
    ELSE
      v_message := 'Osiągnąłeś limit regeneracji fiszek dla tej lekcji (fair use).';
    END IF;
  ELSIF p_event_type = 'quiz_regen' THEN
    IF v_normalized_plan = 'free' THEN v_limit := 1; ELSE v_limit := 5; END IF;
    -- Session lock
    v_lock_key := hashtext(p_user_id::text || p_session_id::text || p_event_type)::bigint;
    v_feature := 'quiz_regen';
    IF v_normalized_plan = 'free' THEN
      v_message := 'W planie Darmowym możesz wygenerować jeden dodatkowy sprawdzian. Sprawdź Premium, aby odblokować więcej powtórek.';
    ELSE
      v_message := 'Osiągnąłeś limit regeneracji sprawdzianów dla tej lekcji (fair use).';
    END IF;
  END IF;

  -- Acquire transaction-level advisory lock
  PERFORM pg_advisory_xact_lock(v_lock_key);

  -- Count usage
  IF p_event_type = 'lesson_analysis' THEN
    SELECT count(*) INTO v_used
    FROM public.usage_events
    WHERE user_id = p_user_id
      AND event_type = p_event_type
      AND created_at >= (timezone('utc', now())::date)::timestamp AT TIME ZONE 'UTC';
  ELSE
    SELECT count(*) INTO v_used
    FROM public.usage_events
    WHERE user_id = p_user_id
      AND session_id = p_session_id
      AND event_type = p_event_type;
  END IF;

  IF v_used >= v_limit THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'error', 'usage_limit_reached',
      'feature', v_feature,
      'limit', v_limit,
      'used', v_used,
      'plan', v_normalized_plan,
      'message', v_message
    );
  END IF;

  -- Insert reservation
  INSERT INTO public.usage_events (user_id, session_id, event_type, metadata)
  VALUES (
    p_user_id,
    p_session_id,
    p_event_type,
    jsonb_build_object('plan', v_normalized_plan, 'status', 'reserved', 'reserved_at', now())
  ) RETURNING id INTO v_reservation_id;

  RETURN jsonb_build_object(
    'allowed', true,
    'limit', v_limit,
    'used', v_used + 1,
    'reservation_id', v_reservation_id,
    'feature', v_feature
  );
END;
$function$;

COMMIT;
