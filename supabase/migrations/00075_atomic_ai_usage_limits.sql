-- Migration 00075: Atomic AI usage limits for non-chat AI usage.

BEGIN;

-- Add quiz_regen to valid event types
ALTER TABLE public.usage_events DROP CONSTRAINT IF EXISTS valid_event_type;
ALTER TABLE public.usage_events ADD CONSTRAINT valid_event_type CHECK (event_type IN ('lesson_analysis', 'flashcard_regen', 'tutor_message', 'quiz_regen'));

-- Create the common AI usage reservation RPC
CREATE OR REPLACE FUNCTION public.check_and_reserve_ai_usage(
  p_user_id uuid,
  p_session_id uuid,
  p_event_type text,
  p_plan text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func$
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
    SELECT user_id INTO v_session_owner FROM public.study_sessions WHERE id = p_session_id;
    IF NOT FOUND THEN
      RETURN jsonb_build_object('allowed', false, 'reason', 'session_not_found');
    END IF;
    IF v_session_owner <> p_user_id THEN
      RETURN jsonb_build_object('allowed', false, 'reason', 'session_ownership_mismatch');
    END IF;
  END IF;

  -- Additionally, even if lesson_analysis is daily, if a session is provided, validate ownership
  IF p_event_type = 'lesson_analysis' AND p_session_id IS NOT NULL THEN
    SELECT user_id INTO v_session_owner FROM public.study_sessions WHERE id = p_session_id;
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
$func$;

REVOKE ALL ON FUNCTION public.check_and_reserve_ai_usage(uuid, uuid, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.check_and_reserve_ai_usage(uuid, uuid, text, text) TO service_role;

COMMIT;
