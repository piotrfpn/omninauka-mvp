-- Sprint 29D.3C3 / PRIV-01: seven-day preapproval EXPIRY only.
-- Local artifact for independent review and later controlled manual application.
-- No Auth, profile, Storage or residual-data deletion. Physical retention is PRIV-02.
-- Supersedes the candidate view and linker from 00076; do not replay old migrations.
BEGIN;

-- Preserve the original preapproval clock against browser profile updates.
CREATE OR REPLACE FUNCTION public.protect_under13_retention_deadline()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $deadline$
BEGIN
  IF current_user IN ('anon', 'authenticated') AND OLD.age_band = 'under_13' THEN
    NEW.pending_preapproval_since := OLD.pending_preapproval_since;
    NEW.created_at := OLD.created_at;
  END IF;
  RETURN NEW;
END;
$deadline$;
ALTER FUNCTION public.protect_under13_retention_deadline() OWNER TO postgres;
REVOKE EXECUTE ON FUNCTION public.protect_under13_retention_deadline() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS protect_under13_retention_deadline ON public.profiles;
CREATE TRIGGER protect_under13_retention_deadline
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.protect_under13_retention_deadline();

-- The existing view contract is retained; candidates now mean expiry, not deletion.
CREATE OR REPLACE VIEW public.v_under13_pending_cleanup_candidates AS
SELECT
  p.id AS profile_id,
  p.email,
  p.age_band,
  p.account_status,
  p.pending_preapproval_since,
  p.created_at,
  now() - COALESCE(p.pending_preapproval_since, p.created_at) AS time_pending
FROM public.profiles p
WHERE p.age_band = 'under_13'
  AND p.account_status = 'pending_parent_preapproval'
  AND COALESCE(p.pending_preapproval_since, p.created_at) <= now() - interval '7 days'
  AND NOT EXISTS (
    SELECT 1 FROM public.child_profiles cp
    JOIN public.profiles parent ON parent.id = cp.parent_user_id
    WHERE cp.child_user_id = p.id
      AND cp.status IN ('linked', 'active')
      AND cp.preapproval_integrity_version = 1
      AND parent.user_role = 'parent'
      AND cp.parent_user_id <> p.id
      AND cp.guardian_consent_acknowledged_at IS NOT NULL
      AND cp.guardian_consent_version = 'child_email_preapproval_v1'
  );

REVOKE ALL PRIVILEGES ON public.v_under13_pending_cleanup_candidates FROM PUBLIC, anon, authenticated;
REVOKE ALL PRIVILEGES (profile_id, email, age_band, account_status, pending_preapproval_since, created_at, time_pending)
  ON public.v_under13_pending_cleanup_candidates FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.v_under13_pending_cleanup_candidates TO service_role;


-- This RPC returns an aggregate only. Cron runs it as the migration's postgres owner.
CREATE OR REPLACE FUNCTION public.expire_pending_under13_accounts(p_batch_size integer DEFAULT 20)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $expiry$
DECLARE
  v_profile public.profiles%ROWTYPE;
  v_expired_count integer := 0;
BEGIN
  FOR v_profile IN
    SELECT p.* FROM public.profiles p
    WHERE p.age_band = 'under_13'
      AND p.account_status = 'pending_parent_preapproval'
      AND COALESCE(p.pending_preapproval_since, p.created_at) <= now() - interval '7 days'
      AND NOT EXISTS (
        SELECT 1 FROM public.child_profiles cp
        JOIN public.profiles parent ON parent.id = cp.parent_user_id
        WHERE cp.child_user_id = p.id
          AND cp.status IN ('linked', 'active')
          AND cp.preapproval_integrity_version = 1
          AND parent.user_role = 'parent' AND cp.parent_user_id <> p.id
          AND cp.guardian_consent_acknowledged_at IS NOT NULL
          AND cp.guardian_consent_version = 'child_email_preapproval_v1'
      )
    ORDER BY COALESCE(p.pending_preapproval_since, p.created_at), p.id
    LIMIT LEAST(20, GREATEST(1, COALESCE(p_batch_size, 20)))
    FOR UPDATE OF p SKIP LOCKED
  LOOP
    -- Re-read all authoritative eligibility conditions under the same row lock.
    IF v_profile.age_band IS DISTINCT FROM 'under_13'
       OR v_profile.account_status IS DISTINCT FROM 'pending_parent_preapproval'
       OR COALESCE(v_profile.pending_preapproval_since, v_profile.created_at)
            > now() - interval '7 days'
       OR EXISTS (
         SELECT 1 FROM public.child_profiles cp
         JOIN public.profiles parent ON parent.id = cp.parent_user_id
         WHERE cp.child_user_id = v_profile.id
           AND cp.status IN ('linked', 'active')
           AND cp.preapproval_integrity_version = 1
           AND parent.user_role = 'parent' AND cp.parent_user_id <> v_profile.id
           AND cp.guardian_consent_acknowledged_at IS NOT NULL
           AND cp.guardian_consent_version = 'child_email_preapproval_v1'
       ) THEN CONTINUE; END IF;

    UPDATE public.profiles SET account_status = 'expired_pending_preapproval'
    WHERE id = v_profile.id AND age_band = 'under_13'
      AND account_status = 'pending_parent_preapproval';
    IF FOUND THEN v_expired_count := v_expired_count + 1; END IF;
  END LOOP;
  RETURN v_expired_count;
END;
$expiry$;
ALTER FUNCTION public.expire_pending_under13_accounts(integer) OWNER TO postgres;
REVOKE EXECUTE ON FUNCTION public.expire_pending_under13_accounts(integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.expire_pending_under13_accounts(integer) TO service_role;

-- Preserve 00076's identity, consent, integrity and parental authorization checks.
CREATE OR REPLACE FUNCTION public.link_child_account()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $link$
DECLARE
  v_user_id uuid := auth.uid();
  v_user_email text := auth.jwt()->>'email';
  v_age_band text;
  v_status text;
  v_child_role text;
  v_pending_preapproval_since timestamptz;
  v_created_at timestamptz;
  v_matched_id uuid;
BEGIN
  IF v_user_id IS NULL OR v_user_email IS NULL OR btrim(v_user_email) = '' THEN
    RETURN jsonb_build_object('linked', false, 'reason', 'unauthenticated');
  END IF;

  SELECT p.age_band, p.account_status, p.user_role, p.pending_preapproval_since, p.created_at
  INTO v_age_band, v_status, v_child_role, v_pending_preapproval_since, v_created_at
  FROM public.profiles p WHERE p.id = v_user_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('linked', false, 'reason', 'profile_unavailable');
  END IF;
  IF v_age_band IS DISTINCT FROM 'under_13' THEN
    RETURN jsonb_build_object('linked', false, 'reason', 'not_under_13');
  END IF;
  IF v_child_role IS DISTINCT FROM 'student'
     OR v_status IS NULL OR v_status NOT IN ('pending_parent_preapproval', 'active') THEN
    RETURN jsonb_build_object('linked', false, 'reason', 'account_not_eligible');
  END IF;

  -- Deadline is checked after the profile lock, before any parental relation write.
  -- Wall-clock time prevents a transaction started before the deadline extending it.
  IF v_status = 'pending_parent_preapproval'
     AND COALESCE(v_pending_preapproval_since, v_created_at) IS NULL THEN
    RETURN jsonb_build_object('linked', false, 'reason', 'preapproval_clock_unavailable');
  END IF;
  IF v_status = 'pending_parent_preapproval'
     AND COALESCE(v_pending_preapproval_since, v_created_at) <= clock_timestamp() - interval '7 days' THEN
    UPDATE public.profiles SET account_status = 'expired_pending_preapproval'
    WHERE id = v_user_id AND age_band = 'under_13' AND user_role = 'student'
      AND account_status = 'pending_parent_preapproval';
    IF NOT FOUND THEN RAISE EXCEPTION 'Child account transition rejected'; END IF;
    RETURN jsonb_build_object('linked', false, 'reason', 'preapproval_window_expired');
  END IF;

  SELECT cp.id INTO v_matched_id
  FROM public.child_profiles cp
  JOIN public.profiles parent ON parent.id = cp.parent_user_id
  WHERE cp.child_user_id = v_user_id AND cp.status IN ('linked', 'active')
    AND cp.preapproval_integrity_version = 1
    AND parent.user_role = 'parent' AND cp.parent_user_id <> v_user_id
    AND cp.guardian_consent_acknowledged_at IS NOT NULL
    AND cp.guardian_consent_version = 'child_email_preapproval_v1'
  ORDER BY cp.id LIMIT 1 FOR UPDATE OF cp;
  IF FOUND THEN
    IF v_status = 'pending_parent_preapproval' THEN
      UPDATE public.profiles
      SET account_status = CASE
        WHEN COALESCE(pending_preapproval_since, created_at) <= clock_timestamp() - interval '7 days'
          THEN 'expired_pending_preapproval'
        ELSE 'active'
      END
      WHERE id = v_user_id AND age_band = 'under_13' AND user_role = 'student'
        AND account_status = 'pending_parent_preapproval'
      RETURNING account_status INTO v_status;
      IF NOT FOUND THEN RAISE EXCEPTION 'Child account transition rejected'; END IF;
      IF v_status = 'expired_pending_preapproval' THEN
        RETURN jsonb_build_object('linked', false, 'reason', 'preapproval_window_expired');
      END IF;
    END IF;
    RETURN jsonb_build_object('linked', true, 'reason', 'already_linked');
  END IF;

  IF v_status <> 'pending_parent_preapproval' THEN
    RETURN jsonb_build_object('linked', false, 'reason', 'account_not_eligible');
  END IF;

  SELECT cp.id INTO v_matched_id
  FROM public.child_profiles cp
  JOIN public.profiles parent ON parent.id = cp.parent_user_id
  WHERE cp.child_email_normalized = lower(btrim(v_user_email))
    AND cp.status = 'pending_child_registration' AND cp.child_user_id IS NULL
    AND cp.preapproval_integrity_version = 1
    AND parent.user_role = 'parent' AND cp.parent_user_id <> v_user_id
    AND cp.guardian_consent_acknowledged_at IS NOT NULL
    AND cp.guardian_consent_version = 'child_email_preapproval_v1'
  ORDER BY cp.created_at, cp.id LIMIT 1 FOR UPDATE OF cp;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('linked', false, 'reason', 'no_preapproval');
  END IF;

  -- The relation lock/its triggers can wait across the deadline. The nested
  -- transaction rolls back tentative binding if the final activation is too late.
  BEGIN
    UPDATE public.child_profiles cp
    SET child_user_id = v_user_id, status = 'linked', updated_at = now()
    WHERE cp.id = v_matched_id AND cp.child_user_id IS NULL
      AND cp.status = 'pending_child_registration'
      AND cp.preapproval_integrity_version = 1
      AND cp.child_email_normalized = lower(btrim(v_user_email))
      AND cp.guardian_consent_acknowledged_at IS NOT NULL
      AND cp.guardian_consent_version = 'child_email_preapproval_v1'
      AND EXISTS (
        SELECT 1 FROM public.profiles parent
        WHERE parent.id = cp.parent_user_id AND parent.user_role = 'parent'
          AND parent.id <> v_user_id
      );
    IF NOT FOUND THEN
      RETURN jsonb_build_object('linked', false, 'reason', 'no_preapproval');
    END IF;

    UPDATE public.profiles
    SET account_status = CASE
      WHEN COALESCE(pending_preapproval_since, created_at) <= clock_timestamp() - interval '7 days'
        THEN 'expired_pending_preapproval'
      ELSE 'active'
    END
    WHERE id = v_user_id AND age_band = 'under_13' AND user_role = 'student'
      AND account_status = 'pending_parent_preapproval'
    RETURNING account_status INTO v_status;
    IF NOT FOUND THEN RAISE EXCEPTION 'Child account transition rejected'; END IF;
    IF v_status = 'expired_pending_preapproval' THEN
      -- Roll back this block's tentative relation write before returning expiry.
      RAISE EXCEPTION 'Preapproval window expired' USING ERRCODE = 'P1307';
    END IF;
  EXCEPTION WHEN SQLSTATE 'P1307' THEN
    UPDATE public.profiles SET account_status = 'expired_pending_preapproval'
    WHERE id = v_user_id AND age_band = 'under_13' AND user_role = 'student'
      AND account_status = 'pending_parent_preapproval';
    IF NOT FOUND THEN RAISE EXCEPTION 'Child account transition rejected'; END IF;
    RETURN jsonb_build_object('linked', false, 'reason', 'preapproval_window_expired');
  END;
  RETURN jsonb_build_object('linked', true, 'reason', 'linked_now');
END;
$link$;
ALTER FUNCTION public.link_child_account() OWNER TO postgres;
REVOKE EXECUTE ON FUNCTION public.link_child_account() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.link_child_account() TO authenticated, service_role;

-- RLS write guard chooses its target exclusively from auth.uid(), never caller input.
-- FOR SHARE holds the profile state through the Storage metadata transaction:
-- status changes/profile deletion wait for an allowed write, and subsequent writes
-- recheck the current row. No global table locks or deletion work are performed.
CREATE OR REPLACE FUNCTION public.can_upload_study_materials()
RETURNS boolean
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $upload$
DECLARE
  v_status text;
BEGIN
  IF auth.uid() IS NULL THEN RETURN false; END IF;
  SELECT p.account_status INTO v_status FROM public.profiles p
  WHERE p.id = auth.uid()
  FOR SHARE OF p;
  IF NOT FOUND THEN RETURN false; END IF;
  -- These are the existing usable states (including consent-approved 13-15 users).
  -- Pending, expired, suspended, withdrawn, NULL and unknown states fail closed.
  RETURN COALESCE(v_status IN ('active', 'parent_approved'), false);
END;
$upload$;
ALTER FUNCTION public.can_upload_study_materials() OWNER TO postgres;
REVOKE EXECUTE ON FUNCTION public.can_upload_study_materials() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.can_upload_study_materials() TO authenticated, service_role;

-- RESTRICTIVE guards cannot be bypassed by another permissive ownership policy.
-- Existing own-folder and legacy read/delete policies remain unchanged.
-- Other buckets retain their existing rules.
DROP POLICY IF EXISTS study_materials_insert_account_guard ON storage.objects;
CREATE POLICY study_materials_insert_account_guard ON storage.objects
AS RESTRICTIVE FOR INSERT TO authenticated
WITH CHECK (
  bucket_id <> 'study-materials' OR (
    (storage.foldername(name))[1] = auth.uid()::text
    AND public.can_upload_study_materials()
  )
);
DROP POLICY IF EXISTS study_materials_update_account_guard ON storage.objects;
CREATE POLICY study_materials_update_account_guard ON storage.objects
AS RESTRICTIVE FOR UPDATE TO authenticated
USING (
  bucket_id <> 'study-materials' OR (
    (storage.foldername(name))[1] = auth.uid()::text
    AND public.can_upload_study_materials()
  )
)
WITH CHECK (
  bucket_id <> 'study-materials' OR (
    (storage.foldername(name))[1] = auth.uid()::text
    AND public.can_upload_study_materials()
  )
);

-- Internal database-only expiry: no Edge Function, HTTP call or Vault secret.
CREATE EXTENSION IF NOT EXISTS pg_cron;
DO $schedule$
DECLARE v_job bigint;
BEGIN
  -- Replace only this job deterministically on repeated manual application.
  FOR v_job IN SELECT jobid FROM cron.job WHERE jobname = 'omninauka-expire-under13-pending'
  LOOP PERFORM cron.unschedule(v_job); END LOOP;
  PERFORM cron.schedule('omninauka-expire-under13-pending', '*/15 * * * *',
    'SELECT public.expire_pending_under13_accounts(20);');
END;
$schedule$;

COMMIT;
