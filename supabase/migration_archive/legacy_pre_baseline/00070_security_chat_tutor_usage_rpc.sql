-- Migration: 00070_security_chat_tutor_usage_rpc.sql
-- Create check_and_reserve_tutor_usage RPC strictly for service_role with advisory lock and ownership guard.

CREATE OR REPLACE FUNCTION public.check_and_reserve_tutor_usage(
  p_user_id uuid,
  p_session_id uuid,
  p_plan text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_session_owner uuid;
  v_session_limit int;
  v_daily_limit int;
  v_session_count int;
  v_daily_count int;
  v_normalized_plan text;
BEGIN
  -- 1. Acquire transactional advisory lock on user_id to serialize checks
  PERFORM pg_advisory_xact_lock(hashtext(p_user_id::text)::bigint);

  -- 2. Defense-in-depth: Verify session existence and active status (not soft-deleted)
  SELECT user_id INTO v_session_owner
    FROM public.study_sessions
   WHERE id = p_session_id AND deleted_at IS NULL;

  IF v_session_owner IS NULL THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'reason', 'session_not_found'
    );
  END IF;

  IF v_session_owner <> p_user_id THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'reason', 'session_not_owned'
    );
  END IF;

  -- 3. Normalize plan strictly
  IF p_plan = 'premium' OR p_plan = 'family' THEN
    v_normalized_plan := p_plan;
    v_session_limit := 50;
    v_daily_limit := 100;
  ELSE
    v_normalized_plan := 'free';
    v_session_limit := 10;
    v_daily_limit := 20;
  END IF;

  -- 4. Count session messages (event_type = 'tutor_message')
  SELECT count(*) INTO v_session_count
    FROM public.usage_events
   WHERE user_id = p_user_id
     AND session_id = p_session_id
     AND event_type = 'tutor_message';

  IF v_session_count >= v_session_limit THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'reason', 'session_limit_reached',
      'limit', v_session_limit,
      'count', v_session_count
    );
  END IF;

  -- 5. Count daily messages using explicit UTC start of day
  SELECT count(*) INTO v_daily_count
    FROM public.usage_events
   WHERE user_id = p_user_id
     AND event_type = 'tutor_message'
     AND created_at >= ((timezone('utc', now())::date)::timestamp AT TIME ZONE 'UTC');

  IF v_daily_count >= v_daily_limit THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'reason', 'daily_limit_reached',
      'limit', v_daily_limit,
      'count', v_daily_count
    );
  END IF;

  -- 6. Atomic Reservation Insert
  INSERT INTO public.usage_events (
    user_id,
    session_id,
    event_type,
    metadata
  ) VALUES (
    p_user_id,
    p_session_id,
    'tutor_message',
    jsonb_build_object(
      'effectivePlan', v_normalized_plan,
      'mode', CASE WHEN v_normalized_plan = 'free' THEN 'basic' ELSE 'advanced' END,
      'reserved_at', now()
    )
  );

  RETURN jsonb_build_object(
    'allowed', true,
    'reason', 'reserved',
    'session_count', v_session_count + 1,
    'daily_count', v_daily_count + 1
  );
END;
$$;

-- 7. Secure execution strictly to service_role (Using PUBLIC group revoke)
REVOKE ALL ON FUNCTION public.check_and_reserve_tutor_usage(uuid, uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.check_and_reserve_tutor_usage(uuid, uuid, text) FROM anon;
REVOKE ALL ON FUNCTION public.check_and_reserve_tutor_usage(uuid, uuid, text) FROM authenticated;

GRANT EXECUTE ON FUNCTION public.check_and_reserve_tutor_usage(uuid, uuid, text) TO service_role;

COMMENT ON FUNCTION public.check_and_reserve_tutor_usage(uuid, uuid, text) IS 'Checks and reserves usage limits for AI Tutor within a secure locked transaction (service_role only).';
