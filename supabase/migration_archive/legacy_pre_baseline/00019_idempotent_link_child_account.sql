-- Sprint 17D+: Idempotent link_child_account
-- Fixes: under_13 account linked in child_profiles but blocked by profiles.account_status

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
  -- A. Get context
  v_user_id    := auth.uid();
  v_user_email := auth.jwt() ->> 'email';

  IF v_user_id IS NULL OR v_user_email IS NULL THEN
    RETURN jsonb_build_object('linked', false, 'reason', 'unauthenticated');
  END IF;

  SELECT age_band INTO v_age_band
    FROM public.profiles
   WHERE id = v_user_id;

  -- B. Check age band
  IF v_age_band IS DISTINCT FROM 'under_13' THEN
    RETURN jsonb_build_object('linked', false, 'reason', 'not_under_13');
  END IF;

  -- C. Check if already linked (Idempotency)
  IF EXISTS (
    SELECT 1 FROM public.child_profiles
     WHERE child_user_id = v_user_id
       AND status IN ('linked', 'active')
  ) THEN
    UPDATE public.profiles
       SET account_status            = 'active',
           pending_preapproval_since = NULL
     WHERE id = v_user_id;

    RETURN jsonb_build_object('linked', true, 'reason', 'already_linked');
  END IF;

  -- D. Search for pending pre-approval
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

    RETURN jsonb_build_object('linked', true, 'reason', 'linked_now');
  END IF;

  -- E. No match found
  UPDATE public.profiles
     SET account_status            = 'pending_parent_preapproval',
         pending_preapproval_since = COALESCE(pending_preapproval_since, now())
   WHERE id = v_user_id
     AND account_status != 'pending_parent_preapproval';

  RETURN jsonb_build_object('linked', false, 'reason', 'no_preapproval');
END;
$$;

-- Permissions
REVOKE ALL ON FUNCTION public.link_child_account() FROM public;
REVOKE ALL ON FUNCTION public.link_child_account() FROM anon;
GRANT EXECUTE ON FUNCTION public.link_child_account() TO authenticated;
