-- Sprint 29B.1A. Repository artifact only: DO NOT execute before reconciling
-- the production migration-history drift (registry ends at 00066).
-- No existing data is rewritten. All security/ACL changes are transactional.
BEGIN;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role text := COALESCE(NEW.raw_user_meta_data->>'user_role', 'student');
  v_age_band text := NEW.raw_user_meta_data->>'ageBand';
  v_status text;
BEGIN
  -- Signup offers student and parent only. Other profile roles are not signup
  -- privileges. Invalid/mismatched metadata rejects signup instead of widening access.
  IF v_role NOT IN ('student', 'parent') THEN
    RAISE EXCEPTION 'Invalid signup role' USING ERRCODE = '22023';
  END IF;
  IF v_age_band IS NULL
     OR (v_role = 'parent' AND v_age_band <> 'parent')
     OR (v_role = 'student' AND v_age_band NOT IN ('under_13', '13_15', '16_17', '18_plus')) THEN
    RAISE EXCEPTION 'Invalid signup age band' USING ERRCODE = '22023';
  END IF;

  v_status := CASE v_age_band
    WHEN 'under_13' THEN 'pending_parent_preapproval'
    WHEN '13_15' THEN 'pending_parent_consent'
    ELSE 'active'
  END;

  -- accountStatus and plan metadata are deliberately ignored.
  INSERT INTO public.profiles
    (id, email, name, user_role, age_band, account_status, plan, pending_preapproval_since)
  VALUES
    (NEW.id, NEW.email, NEW.raw_user_meta_data->>'name', v_role, v_age_band,
     v_status, 'free', CASE WHEN v_age_band = 'under_13' THEN now() ELSE NULL END);
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO service_role;

-- Browser UI already reads account_status from its own profiles row. Parent
-- dashboard uses get_parent_children(); both keep their existing contracts.
-- Remove table grants AND any individual-column SELECT grants: row RLS alone
-- cannot hide a bearer hash or the parent's contact/request metadata.
REVOKE ALL PRIVILEGES ON TABLE public.parental_consents FROM PUBLIC, anon, authenticated;
REVOKE SELECT (
  id, child_user_id, parent_email, age_band, consent_status, consent_scope,
  terms_version, privacy_version, ai_disclaimer_version, token_hash,
  token_expires_at, consent_created_at, consent_approved_at, consent_withdrawn_at,
  ip_address, user_agent, created_at, updated_at,
  last_email_sent_at, email_send_count, email_last_status, email_last_error
) ON TABLE public.parental_consents FROM PUBLIC, anon, authenticated;
GRANT ALL PRIVILEGES ON TABLE public.parental_consents TO service_role;

CREATE OR REPLACE FUNCTION public.approve_parental_consent(
  p_token_hash text, p_ip text, p_user_agent text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_consent_id uuid;
  v_child_id uuid;
  v_locked_child_id uuid;
BEGIN
  IF p_token_hash IS NULL OR p_token_hash !~ '^[0-9a-f]{64}$' THEN
    RETURN false;
  END IF;

  SELECT pc.id, pc.child_user_id INTO v_consent_id, v_child_id
  FROM public.parental_consents pc
  WHERE pc.token_hash = p_token_hash
    AND pc.consent_status = 'pending'
    AND pc.token_expires_at > clock_timestamp()
  LIMIT 1;
  IF NOT FOUND THEN RETURN false; END IF;

  -- Lock profile first. A concurrent suspension or another approval must be
  -- observed before changing consent. Only the existing 13_15 pending flow qualifies.
  SELECT p.id INTO v_locked_child_id FROM public.profiles p
  WHERE p.id = v_child_id
    AND p.age_band = '13_15'
    AND p.account_status = 'pending_parent_consent'
  FOR UPDATE;
  IF NOT FOUND THEN RETURN false; END IF;

  -- Lock the consent explicitly before testing expiry. UPDATE's initial WHERE
  -- can otherwise be evaluated before waiting on a row held by another transaction.
  PERFORM 1 FROM public.parental_consents pc
  WHERE pc.id = v_consent_id AND pc.child_user_id = v_child_id FOR UPDATE;
  IF NOT FOUND THEN RETURN false; END IF;

  -- Conditional UPDATE serializes consumption, rechecks expiry AFTER waits,
  -- and rejects token rotation, withdrawal and replay. Both updates commit together.
  UPDATE public.parental_consents
  SET consent_status = 'approved', consent_approved_at = clock_timestamp(),
      ip_address = p_ip, user_agent = left(p_user_agent, 512), updated_at = now()
  WHERE id = v_consent_id AND child_user_id = v_child_id
    AND token_hash = p_token_hash AND consent_status = 'pending'
    AND token_expires_at > clock_timestamp();
  IF NOT FOUND THEN RETURN false; END IF;

  UPDATE public.profiles SET account_status = 'parent_approved'
  WHERE id = v_locked_child_id AND age_band = '13_15'
    AND account_status = 'pending_parent_consent';
  IF NOT FOUND THEN
    -- Defensive rollback: never commit an approval without its legal profile transition.
    RAISE EXCEPTION 'Consent account transition rejected';
  END IF;
  RETURN true;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.approve_parental_consent(text, text, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.approve_parental_consent(text, text, text) TO service_role;

CREATE OR REPLACE FUNCTION public.verify_consent_token(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_status text;
  v_expires_at timestamptz;
  v_child_name text;
  v_account_status text;
  v_age_band text;
  v_result text := 'invalid';
BEGIN
  IF p_token IS NULL OR p_token !~ '^([0-9a-f]{64}|[0-9a-f]{72})$' THEN
    RETURN jsonb_build_object('status', 'invalid', 'can_approve', false, 'child_name', NULL);
  END IF;

  SELECT pc.consent_status, pc.token_expires_at, COALESCE(p.name, 'Uczeń'),
         p.account_status, p.age_band
  INTO v_status, v_expires_at, v_child_name, v_account_status, v_age_band
  FROM public.parental_consents pc
  JOIN public.profiles p ON p.id = pc.child_user_id
  WHERE pc.token_hash = encode(extensions.digest(p_token, 'sha256'), 'hex')
  LIMIT 1;

  IF v_status = 'approved' THEN
    v_result := 'already_approved';
  ELSIF v_status = 'pending' THEN
    IF v_expires_at <= clock_timestamp() THEN
      v_result := 'expired';
    ELSIF v_expires_at > clock_timestamp()
          AND v_account_status = 'pending_parent_consent' AND v_age_band = '13_15' THEN
      v_result := 'valid';
    END IF;
  END IF;

  RETURN jsonb_build_object('status', v_result, 'can_approve', v_result = 'valid',
    'child_name', CASE WHEN v_result = 'valid' THEN v_child_name ELSE NULL END);
END;
$$;
REVOKE EXECUTE ON FUNCTION public.verify_consent_token(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.verify_consent_token(text) TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.link_child_account()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_user_email text := auth.jwt()->>'email';
  v_age_band text;
  v_status text;
  v_matched_id uuid;
BEGIN
  IF v_user_id IS NULL OR v_user_email IS NULL OR trim(v_user_email) = '' THEN
    RETURN jsonb_build_object('linked', false, 'reason', 'unauthenticated');
  END IF;

  SELECT p.age_band, p.account_status INTO v_age_band, v_status
  FROM public.profiles p WHERE p.id = v_user_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('linked', false, 'reason', 'profile_unavailable');
  END IF;
  IF v_age_band IS DISTINCT FROM 'under_13' THEN
    RETURN jsonb_build_object('linked', false, 'reason', 'not_under_13');
  END IF;

  -- Only pending preapproval can activate. Active is idempotent only when linked.
  -- NULL/unknown, expired, suspended, withdrawn and all other states fail closed.
  IF v_status IS NULL OR v_status NOT IN ('pending_parent_preapproval', 'active') THEN
    RETURN jsonb_build_object('linked', false, 'reason', 'account_not_eligible');
  END IF;

  SELECT cp.id INTO v_matched_id FROM public.child_profiles cp
  WHERE cp.child_user_id = v_user_id AND cp.status IN ('linked', 'active')
    AND cp.parent_user_id <> v_user_id
  ORDER BY cp.id LIMIT 1 FOR UPDATE;
  IF FOUND THEN
    IF v_status = 'pending_parent_preapproval' THEN
      UPDATE public.profiles SET account_status = 'active', pending_preapproval_since = NULL
      WHERE id = v_user_id AND age_band = 'under_13'
        AND account_status = 'pending_parent_preapproval';
      IF NOT FOUND THEN
        RETURN jsonb_build_object('linked', false, 'reason', 'account_not_eligible');
      END IF;
    END IF;
    RETURN jsonb_build_object('linked', true, 'reason', 'already_linked');
  END IF;

  IF v_status <> 'pending_parent_preapproval' THEN
    RETURN jsonb_build_object('linked', false, 'reason', 'account_not_eligible');
  END IF;

  SELECT cp.id INTO v_matched_id FROM public.child_profiles cp
  WHERE cp.child_email_normalized = lower(trim(v_user_email))
    AND cp.status = 'pending_child_registration' AND cp.child_user_id IS NULL
    AND cp.parent_user_id <> v_user_id AND cp.guardian_consent_acknowledged_at IS NOT NULL
  ORDER BY cp.created_at, cp.id LIMIT 1 FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('linked', false, 'reason', 'no_preapproval');
  END IF;

  UPDATE public.child_profiles SET child_user_id = v_user_id, status = 'linked', updated_at = now()
  WHERE id = v_matched_id AND child_user_id IS NULL
    AND status = 'pending_child_registration'
    AND child_email_normalized = lower(trim(v_user_email));
  IF NOT FOUND THEN
    RETURN jsonb_build_object('linked', false, 'reason', 'no_preapproval');
  END IF;

  UPDATE public.profiles SET account_status = 'active', pending_preapproval_since = NULL
  WHERE id = v_user_id AND age_band = 'under_13'
    AND account_status = 'pending_parent_preapproval';
  IF NOT FOUND THEN RAISE EXCEPTION 'Child account transition rejected'; END IF;
  RETURN jsonb_build_object('linked', true, 'reason', 'linked_now');
END;
$$;
REVOKE EXECUTE ON FUNCTION public.link_child_account() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.link_child_account() TO authenticated, service_role;

COMMIT;
