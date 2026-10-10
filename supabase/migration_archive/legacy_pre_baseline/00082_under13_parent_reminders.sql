-- PRIV-01.1: private D5 delivery state, independent from PRIV-01 expiry.
-- Local review artifact. Scheduler provisioning is a separate rollout step.
BEGIN;

CREATE TABLE public.under13_parent_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  child_user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  -- These immutable references intentionally have no cascading parent/relation FK:
  -- removing a preapproval must not remove the child's deduplication tombstone.
  -- Eligibility rechecks require the referenced rows to still exist. PRIV-02 owns purge.
  parent_user_id uuid NOT NULL,
  child_profile_id uuid NOT NULL,
  notification_kind text NOT NULL DEFAULT 'd5_preapproval_reminder'
    CHECK (notification_kind = 'd5_preapproval_reminder'),
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'claimed', 'retryable', 'accepted', 'cancelled', 'terminal_error', 'delivery_unknown')),
  attempt_count integer NOT NULL DEFAULT 0 CHECK (attempt_count BETWEEN 0 AND 3),
  claim_token uuid,
  lease_expires_at timestamptz,
  first_attempt_at timestamptz,
  last_attempt_at timestamptz,
  next_attempt_at timestamptz,
  provider_accepted_at timestamptz,
  recipient_email_hash text CHECK (recipient_email_hash ~ '^[0-9a-f]{64}$'),
  -- Freeze the complete meaningful payload without retaining its personal content.
  payload_hash text CHECK (payload_hash ~ '^[0-9a-f]{64}$'),
  retention_deadline_at timestamptz NOT NULL,
  idempotency_key text NOT NULL DEFAULT gen_random_uuid()::text UNIQUE,
  safe_error_category text CHECK (safe_error_category IN (
    'relationship_no_longer_valid', 'recipient_changed', 'payload_changed',
    'parent_email_unconfirmed', 'parent_unavailable', 'parent_lookup_failed',
    'deadline_passed', 'retry_window_exhausted', 'provider_rate_limited',
    'provider_5xx', 'provider_timeout', 'provider_conflict',
    'invalid_recipient', 'provider_auth_or_config', 'provider_rejected')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (child_user_id, notification_kind),
  CHECK ((status = 'claimed' AND claim_token IS NOT NULL AND lease_expires_at IS NOT NULL)
    OR (status <> 'claimed' AND claim_token IS NULL AND lease_expires_at IS NULL)),
  CHECK ((attempt_count = 0 AND first_attempt_at IS NULL AND last_attempt_at IS NULL)
    OR (attempt_count > 0 AND first_attempt_at IS NOT NULL AND last_attempt_at IS NOT NULL)),
  CHECK ((recipient_email_hash IS NULL) = (payload_hash IS NULL)),
  CHECK (attempt_count = 0 OR recipient_email_hash IS NOT NULL),
  CHECK (status <> 'accepted' OR (provider_accepted_at IS NOT NULL AND attempt_count > 0))
);
CREATE INDEX under13_parent_notifications_due_idx
  ON public.under13_parent_notifications (next_attempt_at, lease_expires_at)
  WHERE status IN ('pending', 'claimed', 'retryable');
ALTER TABLE public.under13_parent_notifications ENABLE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON TABLE public.under13_parent_notifications FROM PUBLIC, anon, authenticated, service_role;
-- A new table has no column ACLs; explicitly close those too for manual review.
DO $acl$
DECLARE v_columns text;
BEGIN
  SELECT string_agg(format('%I', attname), ', ' ORDER BY attnum) INTO v_columns
  FROM pg_attribute WHERE attrelid = 'public.under13_parent_notifications'::regclass
    AND attnum > 0 AND NOT attisdropped;
  EXECUTE format('REVOKE ALL PRIVILEGES (%s) ON TABLE public.under13_parent_notifications FROM PUBLIC, anon, authenticated, service_role', v_columns);
END;
$acl$;
-- Workers access state exclusively through fenced RPCs, not direct table UPDATE.

-- Same trust conditions as 00076/00081; canonical child email comes from Auth.
-- No ORDER BY / LIMIT shortcut: the window count must be exactly one.
CREATE FUNCTION public.under13_parent_reminder_context(p_child_id uuid)
RETURNS TABLE (parent_id uuid, relation_id uuid, deadline_at timestamptz)
LANGUAGE sql SECURITY DEFINER SET search_path = public
AS $context$
  SELECT q.parent_id, q.relation_id, q.deadline_at FROM (
    SELECT cp.parent_user_id AS parent_id, cp.id AS relation_id,
      COALESCE(p.pending_preapproval_since, p.created_at) + interval '7 days' AS deadline_at,
      count(*) OVER () AS qualifying_parent_count
    FROM public.profiles p
    JOIN auth.users child_auth ON child_auth.id = p.id
    JOIN public.child_profiles cp
      ON cp.child_email_normalized = lower(btrim(child_auth.email))
    JOIN public.profiles parent ON parent.id = cp.parent_user_id
    WHERE p.id = p_child_id AND p.age_band = 'under_13' AND p.user_role = 'student'
      AND p.account_status = 'pending_parent_preapproval'
      AND COALESCE(p.pending_preapproval_since, p.created_at) IS NOT NULL
      AND clock_timestamp() >= COALESCE(p.pending_preapproval_since, p.created_at) + interval '5 days'
      AND clock_timestamp() < COALESCE(p.pending_preapproval_since, p.created_at) + interval '7 days'
      AND child_auth.email IS NOT NULL AND btrim(child_auth.email) <> ''
      AND cp.status = 'pending_child_registration' AND cp.child_user_id IS NULL
      AND cp.preapproval_integrity_version = 1
      AND cp.guardian_consent_acknowledged_at IS NOT NULL
      AND cp.guardian_consent_version = 'child_email_preapproval_v1'
      AND parent.user_role = 'parent' AND parent.id <> p.id
      -- Additional sending safety: do not contact a suspended/withdrawn parent.
      AND parent.account_status = 'active'
      AND NOT EXISTS (
        SELECT 1 FROM public.child_profiles linked
        JOIN public.profiles linked_parent ON linked_parent.id = linked.parent_user_id
        WHERE linked.child_user_id = p.id AND linked.status IN ('linked', 'active')
          AND linked.preapproval_integrity_version = 1
          AND linked_parent.user_role = 'parent' AND linked.parent_user_id <> p.id
          AND linked.guardian_consent_acknowledged_at IS NOT NULL
          AND linked.guardian_consent_version = 'child_email_preapproval_v1'
      )
  ) q WHERE q.qualifying_parent_count = 1;
$context$;

CREATE FUNCTION public.claim_due_under13_parent_reminders(p_batch_size integer DEFAULT 20)
RETURNS TABLE (event_id uuid, parent_user_id uuid, claim_token uuid,
  retention_deadline_at timestamptz, idempotency_key text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $claim$
DECLARE
  v_profile public.profiles%ROWTYPE;
  v_event public.under13_parent_notifications%ROWTYPE;
  v_context record;
  v_now timestamptz;
BEGIN
  -- Lock order for claim/prepare is child profile -> notification. No relation writes.
  -- The profile lock is shared with linker/expiry only during this short SQL call.
  FOR v_profile IN
    SELECT p.* FROM public.profiles p
    WHERE (
      p.age_band = 'under_13' AND p.account_status = 'pending_parent_preapproval'
      AND clock_timestamp() >= COALESCE(p.pending_preapproval_since, p.created_at) + interval '5 days'
      AND clock_timestamp() < COALESCE(p.pending_preapproval_since, p.created_at) + interval '7 days'
      AND NOT EXISTS (SELECT 1 FROM public.under13_parent_notifications n WHERE n.child_user_id = p.id)
      AND EXISTS (SELECT 1 FROM public.under13_parent_reminder_context(p.id))
    ) OR EXISTS (
      SELECT 1 FROM public.under13_parent_notifications n WHERE n.child_user_id = p.id
        AND n.status IN ('pending', 'retryable', 'claimed')
        AND (n.status <> 'claimed' OR n.lease_expires_at <= clock_timestamp())
        AND (n.next_attempt_at IS NULL OR n.next_attempt_at <= clock_timestamp()
          OR n.retention_deadline_at <= clock_timestamp()
          OR n.first_attempt_at + interval '6 hours' <= clock_timestamp())
    )
    ORDER BY p.id
    LIMIT LEAST(20, GREATEST(1, COALESCE(p_batch_size, 20)))
    FOR UPDATE OF p SKIP LOCKED
  LOOP
    SELECT * INTO v_context FROM public.under13_parent_reminder_context(v_profile.id);
    IF FOUND THEN
      INSERT INTO public.under13_parent_notifications (child_user_id, parent_user_id, child_profile_id, retention_deadline_at)
      VALUES (v_profile.id, v_context.parent_id, v_context.relation_id, v_context.deadline_at)
      ON CONFLICT (child_user_id, notification_kind) DO NOTHING;
    END IF;
    SELECT n.* INTO v_event FROM public.under13_parent_notifications n
    WHERE n.child_user_id = v_profile.id FOR UPDATE SKIP LOCKED;
    IF NOT FOUND OR v_event.status NOT IN ('pending', 'retryable', 'claimed') THEN CONTINUE; END IF;
    v_now := clock_timestamp();
    IF v_event.status = 'claimed' AND v_event.lease_expires_at > v_now THEN CONTINUE; END IF;

    IF v_event.retention_deadline_at <= v_now THEN
      UPDATE public.under13_parent_notifications SET status = 'cancelled', safe_error_category = 'deadline_passed',
        claim_token = NULL, lease_expires_at = NULL, updated_at = v_now WHERE id = v_event.id;
      CONTINUE;
    END IF;
    IF v_context.parent_id IS NULL OR v_context.parent_id <> v_event.parent_user_id
       OR v_context.relation_id <> v_event.child_profile_id OR v_context.deadline_at <> v_event.retention_deadline_at THEN
      UPDATE public.under13_parent_notifications SET status = 'cancelled', safe_error_category = 'relationship_no_longer_valid',
        claim_token = NULL, lease_expires_at = NULL, updated_at = v_now WHERE id = v_event.id;
      CONTINUE;
    END IF;
    IF v_event.attempt_count >= 3 OR v_event.first_attempt_at + interval '6 hours' <= v_now THEN
      UPDATE public.under13_parent_notifications SET status = 'delivery_unknown', safe_error_category = 'retry_window_exhausted',
        claim_token = NULL, lease_expires_at = NULL, updated_at = v_now WHERE id = v_event.id;
      CONTINUE;
    END IF;
    IF v_event.next_attempt_at > v_now THEN CONTINUE; END IF;
    UPDATE public.under13_parent_notifications n SET status = 'claimed', claim_token = gen_random_uuid(),
      lease_expires_at = v_now + interval '10 minutes', updated_at = v_now
    WHERE n.id = v_event.id RETURNING n.* INTO v_event;
    RETURN QUERY SELECT v_event.id, v_event.parent_user_id, v_event.claim_token,
      v_event.retention_deadline_at, v_event.idempotency_key;
  END LOOP;
END;
$claim$;

-- Final eligibility gate + hash freeze + provider-attempt reservation, one transaction.
-- The lease is not a distributed HTTP lock; benign linking after this gate is possible.
CREATE FUNCTION public.prepare_under13_parent_reminder(p_event_id uuid, p_claim_token uuid,
  p_recipient_hash text, p_payload_hash text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $prepare$
DECLARE
  v_event public.under13_parent_notifications%ROWTYPE;
  v_child_id uuid;
  v_context record;
  v_now timestamptz;
  v_reason text;
BEGIN
  SELECT child_user_id INTO v_child_id FROM public.under13_parent_notifications WHERE id = p_event_id;
  PERFORM 1 FROM public.profiles WHERE id = v_child_id FOR UPDATE;
  SELECT * INTO v_event FROM public.under13_parent_notifications WHERE id = p_event_id FOR UPDATE;
  v_now := clock_timestamp();
  IF NOT FOUND OR v_event.status <> 'claimed' OR v_event.claim_token IS DISTINCT FROM p_claim_token
     OR v_event.lease_expires_at <= v_now THEN RETURN jsonb_build_object('allowed', false, 'status', 'stale_claim'); END IF;
  SELECT * INTO v_context FROM public.under13_parent_reminder_context(v_child_id);
  v_now := clock_timestamp();
  IF v_event.lease_expires_at <= v_now THEN RETURN jsonb_build_object('allowed', false, 'status', 'stale_claim'); END IF;
  IF v_event.retention_deadline_at <= v_now THEN v_reason := 'deadline_passed';
  ELSIF v_context.parent_id IS NULL OR v_context.parent_id <> v_event.parent_user_id
    OR v_context.relation_id <> v_event.child_profile_id OR v_context.deadline_at <> v_event.retention_deadline_at
    THEN v_reason := 'relationship_no_longer_valid';
  ELSIF p_recipient_hash IS NULL OR p_recipient_hash !~ '^[0-9a-f]{64}$'
    OR p_payload_hash IS NULL OR p_payload_hash !~ '^[0-9a-f]{64}$'
    THEN RETURN jsonb_build_object('allowed', false, 'status', 'invalid_hash');
  ELSIF v_event.recipient_email_hash IS NOT NULL AND v_event.recipient_email_hash <> p_recipient_hash
    THEN v_reason := 'recipient_changed';
  ELSIF v_event.payload_hash IS NOT NULL AND v_event.payload_hash <> p_payload_hash
    THEN v_reason := 'payload_changed';
  END IF;
  IF v_reason IS NOT NULL THEN
    UPDATE public.under13_parent_notifications SET status = 'cancelled', safe_error_category = v_reason,
      claim_token = NULL, lease_expires_at = NULL, updated_at = v_now WHERE id = p_event_id;
    RETURN jsonb_build_object('allowed', false, 'status', 'cancelled');
  END IF;
  IF v_event.attempt_count >= 3 OR v_event.first_attempt_at + interval '6 hours' <= v_now THEN
    UPDATE public.under13_parent_notifications SET status = 'delivery_unknown', safe_error_category = 'retry_window_exhausted',
      claim_token = NULL, lease_expires_at = NULL, updated_at = v_now WHERE id = p_event_id;
    RETURN jsonb_build_object('allowed', false, 'status', 'delivery_unknown');
  END IF;
  IF v_event.next_attempt_at > v_now THEN RETURN jsonb_build_object('allowed', false, 'status', 'not_due'); END IF;
  -- Reserve before HTTP: a crash here consumes an attempt conservatively, not an extra send.
  UPDATE public.under13_parent_notifications SET
    recipient_email_hash = COALESCE(recipient_email_hash, p_recipient_hash),
    payload_hash = COALESCE(payload_hash, p_payload_hash),
    attempt_count = attempt_count + 1, first_attempt_at = COALESCE(first_attempt_at, v_now),
    last_attempt_at = v_now,
    next_attempt_at = v_now + CASE WHEN attempt_count = 0 THEN interval '15 minutes' ELSE interval '60 minutes' END,
    updated_at = v_now WHERE id = p_event_id;
  RETURN jsonb_build_object('allowed', true, 'status', 'claimed',
    'send_before', LEAST(v_event.retention_deadline_at, COALESCE(v_event.first_attempt_at, v_now) + interval '6 hours', v_event.lease_expires_at));
END;
$prepare$;

CREATE FUNCTION public.finish_under13_parent_reminder(p_event_id uuid, p_claim_token uuid,
  p_result text, p_retry_after_seconds integer DEFAULT 0)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $finish$
DECLARE
  v_event public.under13_parent_notifications%ROWTYPE;
  v_now timestamptz := clock_timestamp();
  v_status text;
  v_next timestamptz;
BEGIN
  SELECT * INTO v_event FROM public.under13_parent_notifications WHERE id = p_event_id FOR UPDATE;
  v_now := clock_timestamp();
  IF NOT FOUND OR v_event.status <> 'claimed' OR v_event.claim_token IS DISTINCT FROM p_claim_token
    OR v_event.lease_expires_at <= v_now THEN RETURN 'stale_claim'; END IF;
  IF p_result = 'accepted' AND v_event.attempt_count > 0 THEN v_status := 'accepted';
  ELSIF p_result IN ('relationship_no_longer_valid', 'recipient_changed', 'payload_changed',
    'parent_email_unconfirmed', 'parent_unavailable', 'deadline_passed') THEN v_status := 'cancelled';
  ELSIF p_result IN ('invalid_recipient', 'provider_auth_or_config', 'provider_rejected') THEN v_status := 'terminal_error';
  ELSIF p_result IN ('provider_rate_limited', 'provider_5xx', 'provider_timeout', 'provider_conflict', 'parent_lookup_failed') THEN
    v_status := 'retryable';
    v_next := GREATEST(COALESCE(v_event.next_attempt_at, v_now + interval '15 minutes'),
      v_now + make_interval(secs => LEAST(21600, GREATEST(0, COALESCE(p_retry_after_seconds, 0)))));
    IF v_event.retention_deadline_at <= v_now THEN v_status := 'cancelled'; p_result := 'deadline_passed';
    ELSIF v_event.attempt_count >= 3 OR v_event.first_attempt_at + interval '6 hours' <= v_now
      OR v_next >= LEAST(v_event.retention_deadline_at, v_event.first_attempt_at + interval '6 hours') THEN
      v_status := 'delivery_unknown'; p_result := 'retry_window_exhausted';
    END IF;
  ELSE RETURN 'invalid_result'; END IF;
  UPDATE public.under13_parent_notifications SET status = v_status,
    provider_accepted_at = CASE WHEN v_status = 'accepted' THEN v_now ELSE provider_accepted_at END,
    safe_error_category = CASE WHEN v_status = 'accepted' THEN NULL ELSE p_result END,
    next_attempt_at = CASE WHEN v_status = 'retryable' THEN v_next ELSE NULL END,
    claim_token = NULL, lease_expires_at = NULL, updated_at = v_now WHERE id = p_event_id;
  RETURN v_status;
END;
$finish$;

ALTER FUNCTION public.under13_parent_reminder_context(uuid) OWNER TO postgres;
ALTER FUNCTION public.claim_due_under13_parent_reminders(integer) OWNER TO postgres;
ALTER FUNCTION public.prepare_under13_parent_reminder(uuid, uuid, text, text) OWNER TO postgres;
ALTER FUNCTION public.finish_under13_parent_reminder(uuid, uuid, text, integer) OWNER TO postgres;
REVOKE EXECUTE ON FUNCTION public.under13_parent_reminder_context(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.claim_due_under13_parent_reminders(integer) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.prepare_under13_parent_reminder(uuid, uuid, text, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.finish_under13_parent_reminder(uuid, uuid, text, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.under13_parent_reminder_context(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.claim_due_under13_parent_reminders(integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.prepare_under13_parent_reminder(uuid, uuid, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.finish_under13_parent_reminder(uuid, uuid, text, integer) TO service_role;

COMMIT;
