-- Sprint 17B+: Privacy-by-Design Guard for under_13 accounts
-- Fixes: under_13 without pre-approval was not blocked from /app/dashboard
-- Adds: pending_parent_preapproval status, retroactive link on login, cleanup candidate view

-- ────────────────────────────────────────────────────────────────────────────
-- 1. Add pending_preapproval_since column to profiles (for cleanup tracking)
-- ────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS pending_preapproval_since timestamptz;

-- ────────────────────────────────────────────────────────────────────────────
-- 2. Replace link_child_account() with privacy-by-design version:
--    - If linked: set profiles.account_status = 'active'
--    - If NOT linked: set profiles.account_status = 'pending_parent_preapproval'
--    - Only operates on age_band = 'under_13' accounts
--    - Never returns parent data or child_profiles row data
-- ────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.link_child_account()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id    uuid;
  v_user_email text;
  v_age_band   text;
  v_matched_id uuid;
BEGIN
  v_user_id    := auth.uid();
  v_user_email := auth.jwt() ->> 'email';

  IF v_user_id IS NULL OR v_user_email IS NULL THEN
    RETURN jsonb_build_object('linked', false, 'reason', 'unauthenticated');
  END IF;

  SELECT age_band INTO v_age_band
    FROM public.profiles
   WHERE id = v_user_id;

  IF v_age_band IS DISTINCT FROM 'under_13' THEN
    RETURN jsonb_build_object('linked', false, 'reason', 'not_under_13');
  END IF;

  SELECT id INTO v_matched_id
    FROM public.child_profiles
   WHERE child_email_normalized = lower(trim(v_user_email))
     AND status = 'pending_child_registration'
     AND child_user_id IS NULL
   LIMIT 1;

  IF v_matched_id IS NOT NULL THEN
    UPDATE public.child_profiles
       SET child_user_id = v_user_id,
           status        = 'linked',
           updated_at    = now()
     WHERE id = v_matched_id;

    UPDATE public.profiles
       SET account_status            = 'active',
           pending_preapproval_since = NULL
     WHERE id = v_user_id;

    RETURN jsonb_build_object('linked', true);
  END IF;

  UPDATE public.profiles
     SET account_status            = 'pending_parent_preapproval',
         pending_preapproval_since = COALESCE(pending_preapproval_since, now())
   WHERE id = v_user_id
     AND account_status != 'pending_parent_preapproval';

  RETURN jsonb_build_object('linked', false, 'reason', 'no_preapproval');
END;
$$;

REVOKE ALL ON FUNCTION public.link_child_account() FROM public;
REVOKE ALL ON FUNCTION public.link_child_account() FROM anon;
GRANT EXECUTE ON FUNCTION public.link_child_account() TO authenticated;

-- ────────────────────────────────────────────────────────────────────────────
-- 3. View: candidates for cleanup (accounts pending > 72h without pre-approval)
--    NOTE: Actual deletion from auth.users REQUIRES service_role — NOT done here.
--    Implement Sprint 17C Edge Function: cleanup-under13-pending
--    Steps:
--      1. Use service_role client
--      2. SELECT from v_under13_pending_cleanup_candidates
--      3. For each: supabase.auth.admin.deleteUser(profile_id)
--      4. Log deletion count
--      5. Schedule via pg_cron or Supabase cron
-- ────────────────────────────────────────────────────────────────────────────
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
  AND COALESCE(p.pending_preapproval_since, p.created_at) < now() - interval '72 hours'
  AND NOT EXISTS (
    SELECT 1 FROM public.child_profiles cp
    WHERE cp.child_user_id = p.id
      AND cp.status IN ('linked', 'active')
  );

REVOKE ALL ON public.v_under13_pending_cleanup_candidates FROM public;
REVOKE ALL ON public.v_under13_pending_cleanup_candidates FROM anon;
GRANT SELECT ON public.v_under13_pending_cleanup_candidates TO service_role;
