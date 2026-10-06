-- Migration: 00080_stripe_payment_fulfillment.sql
-- Sprint 29D.2B: Stripe Payment Target Binding Security Audit - R6A
--
-- Creates a secure, atomic RPC function for Stripe payment fulfillment.

BEGIN;

-- 1. Payment Level Idempotency (H1)
CREATE UNIQUE INDEX IF NOT EXISTS payment_events_stripe_session_id_unique
ON public.payment_events(stripe_session_id)
WHERE stripe_session_id IS NOT NULL;

-- 2. Atomic Fulfillment RPC
CREATE OR REPLACE FUNCTION public.fulfill_stripe_premium_payment(
  p_stripe_event_id text,
  p_stripe_session_id text,
  p_target_user_id uuid,
  p_event_type text,
  p_amount_total bigint,
  p_currency text,
  p_payment_status text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile RECORD;
  v_new_expires timestamptz;
BEGIN
  -- We first verify if the event ID was already processed.
  IF EXISTS (SELECT 1 FROM public.payment_events WHERE stripe_event_id = p_stripe_event_id) THEN
    RETURN jsonb_build_object('outcome', 'already_processed_event');
  END IF;

  -- Verify if session ID was already fulfilled by a DIFFERENT event.
  IF EXISTS (SELECT 1 FROM public.payment_events WHERE stripe_session_id = p_stripe_session_id) THEN
    -- R6-M1: DO NOT insert a secondary duplicate row. Just return the outcome safely.
    RETURN jsonb_build_object('outcome', 'duplicate_checkout_session');
  END IF;

  -- 1. Profile Lock (M2 Lock Order)
  SELECT id, email, plan, plan_expires_at, account_status
    INTO v_profile
    FROM public.profiles
   WHERE id = p_target_user_id
     FOR UPDATE;

  -- R6-M2: atomic claim without narrow stripe_event_id conflict target.
  -- This allows DO NOTHING to absorb BOTH stripe_event_id and stripe_session_id unique conflicts safely.
  IF NOT FOUND THEN
    INSERT INTO public.payment_events (
      stripe_event_id,
      stripe_session_id,
      user_id,
      event_type,
      status,
      amount_total,
      currency,
      payment_status,
      error_message,
      payload
    ) VALUES (
      p_stripe_event_id,
      p_stripe_session_id,
      NULL,
      p_event_type,
      'error',
      p_amount_total,
      p_currency,
      p_payment_status,
      'target_profile_missing_reconciliation_required',
      NULL
    )
    ON CONFLICT DO NOTHING;

    IF NOT FOUND THEN
      -- Determine which conflict occurred
      IF EXISTS (SELECT 1 FROM public.payment_events WHERE stripe_event_id = p_stripe_event_id) THEN
        RETURN jsonb_build_object('outcome', 'already_processed_event');
      ELSIF EXISTS (SELECT 1 FROM public.payment_events WHERE stripe_session_id = p_stripe_session_id) THEN
        RETURN jsonb_build_object('outcome', 'duplicate_checkout_session');
      ELSE
        RAISE EXCEPTION 'Unexpected conflict inserting missing profile reconciliation';
      END IF;
    END IF;

    RETURN jsonb_build_object('outcome', 'reconciliation_required');
  END IF;

  -- 2. Family Protection / Reconciliation (M3)
  IF v_profile.plan = 'family' AND (v_profile.plan_expires_at IS NULL OR v_profile.plan_expires_at > now()) THEN
    INSERT INTO public.payment_events (
      stripe_event_id,
      stripe_session_id,
      user_id,
      event_type,
      status,
      amount_total,
      currency,
      payment_status,
      error_message,
      payload
    ) VALUES (
      p_stripe_event_id,
      p_stripe_session_id,
      p_target_user_id,
      p_event_type,
      'error',
      p_amount_total,
      p_currency,
      p_payment_status,
      'active_family_reconciliation_required',
      NULL
    )
    ON CONFLICT DO NOTHING;

    IF NOT FOUND THEN
      IF EXISTS (SELECT 1 FROM public.payment_events WHERE stripe_event_id = p_stripe_event_id) THEN
        RETURN jsonb_build_object('outcome', 'already_processed_event');
      ELSIF EXISTS (SELECT 1 FROM public.payment_events WHERE stripe_session_id = p_stripe_session_id) THEN
        RETURN jsonb_build_object('outcome', 'duplicate_checkout_session');
      ELSE
        RAISE EXCEPTION 'Unexpected conflict inserting family reconciliation';
      END IF;
    END IF;

    RETURN jsonb_build_object('outcome', 'reconciliation_required');
  END IF;

  -- 3. Atomic Event Claim
  INSERT INTO public.payment_events (
    stripe_event_id,
    stripe_session_id,
    user_id,
    event_type,
    status,
    target_plan,
    amount_total,
    currency,
    payment_status,
    payload,
    processed_at
  ) VALUES (
    p_stripe_event_id,
    p_stripe_session_id,
    p_target_user_id,
    p_event_type,
    'processed',
    'premium',
    p_amount_total,
    p_currency,
    p_payment_status,
    NULL,
    now()
  )
  ON CONFLICT DO NOTHING;

  IF NOT FOUND THEN
    IF EXISTS (SELECT 1 FROM public.payment_events WHERE stripe_event_id = p_stripe_event_id) THEN
      RETURN jsonb_build_object('outcome', 'already_processed_event');
    ELSIF EXISTS (SELECT 1 FROM public.payment_events WHERE stripe_session_id = p_stripe_session_id) THEN
      RETURN jsonb_build_object('outcome', 'duplicate_checkout_session');
    ELSE
      RAISE EXCEPTION 'Unexpected conflict during atomic claim';
    END IF;
  END IF;

  -- 4. Calculate New Expiry
  v_new_expires := GREATEST(COALESCE(v_profile.plan_expires_at, now()), now()) + INTERVAL '30 days';

  -- 5. Atomic Entitlement Extension
  UPDATE public.profiles
     SET plan = 'premium',
         plan_expires_at = v_new_expires,
         plan_updated_at = now()
   WHERE id = p_target_user_id;

  -- 6. Atomic Audit Entry
  INSERT INTO public.admin_plan_actions (
    admin_email,
    target_user_id,
    target_email,
    action_type,
    old_plan,
    new_plan,
    old_plan_expires_at,
    new_plan_expires_at,
    reason
  ) VALUES (
    'stripe-webhook',
    p_target_user_id,
    v_profile.email,
    'extend_premium_30',
    v_profile.plan,
    'premium',
    v_profile.plan_expires_at,
    v_new_expires,
    'Stripe Checkout checkout_v1 automatic fulfillment: ' || p_stripe_event_id
  );

  RETURN jsonb_build_object('outcome', 'processed');
END;
$$;

-- Access Control
REVOKE EXECUTE ON FUNCTION public.fulfill_stripe_premium_payment(text, text, uuid, text, bigint, text, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.fulfill_stripe_premium_payment(text, text, uuid, text, bigint, text, text) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.fulfill_stripe_premium_payment(text, text, uuid, text, bigint, text, text) FROM anon;

GRANT EXECUTE ON FUNCTION public.fulfill_stripe_premium_payment(text, text, uuid, text, bigint, text, text) TO service_role;

COMMENT ON FUNCTION public.fulfill_stripe_premium_payment IS
  'Securely and atomically fulfills Stripe Premium 30 days payments via Checkout checkout_v1.
   Enforces idempotency, safe concurrent distinct payments (FOR UPDATE lock), prevents Family downgrade,
   and writes atomic audit log. Callable only by service_role.';

COMMIT;
