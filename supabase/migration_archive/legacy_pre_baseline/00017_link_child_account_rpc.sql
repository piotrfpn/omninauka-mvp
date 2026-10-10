-- Sprint 17B: Under-13 Registration Match & Link
-- Safe RPC: links a freshly-registered child account to its pre-approved child_profiles row.
-- Security: SECURITY DEFINER, operates only on the calling user's own email.

CREATE OR REPLACE FUNCTION public.link_child_account()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_user_email text;
  v_matched_id uuid;
  v_parent_id uuid;
BEGIN
  v_user_id    := auth.uid();
  v_user_email := auth.jwt() ->> 'email';

  -- Guard: must be authenticated
  IF v_user_id IS NULL OR v_user_email IS NULL THEN
    RETURN jsonb_build_object('linked', false, 'reason', 'unauthenticated');
  END IF;

  -- Look for a pending pre-approval matching this email (case-insensitive)
  SELECT id, parent_user_id
    INTO v_matched_id, v_parent_id
    FROM public.child_profiles
   WHERE child_email_normalized = lower(trim(v_user_email))
     AND status = 'pending_child_registration'
     AND child_user_id IS NULL
   LIMIT 1;

  IF v_matched_id IS NULL THEN
    RETURN jsonb_build_object('linked', false, 'reason', 'no_preapproval');
  END IF;

  -- Link the account
  UPDATE public.child_profiles
     SET child_user_id = v_user_id,
         status        = 'linked',
         updated_at    = now()
   WHERE id = v_matched_id;

  RETURN jsonb_build_object(
    'linked',     true,
    'profile_id', v_matched_id,
    'parent_id',  v_parent_id
  );
END;
$$;

REVOKE ALL ON FUNCTION public.link_child_account() FROM public;
REVOKE ALL ON FUNCTION public.link_child_account() FROM anon;
GRANT EXECUTE ON FUNCTION public.link_child_account() TO authenticated;
