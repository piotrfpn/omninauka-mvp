-- Migration: 00063_admin_plan_management.sql
-- Sprint 22A: Admin Plan Management Panel
--
-- Creates a secure RPC function for safe plan extension by admins.
--
-- Access control:
--   - anon        : EXECUTE revoked — cannot call this function directly
--   - authenticated: EXECUTE revoked — regular logged-in users cannot call this function
--   - PUBLIC      : EXECUTE revoked — no implicit grant to any role
--   - service_role: EXECUTE granted  — exclusively used by the admin-plan-management Edge Function
--
-- The Edge Function enforces its own admin check via the ADMIN_EMAILS secret
-- BEFORE calling this RPC. The RPC itself does NOT verify caller identity —
-- it trusts the service role caller to have already authorized the request.
--
-- SECURITY DEFINER ensures the function executes as the function owner (postgres),
-- not as the calling role, so it can always write to public.profiles.

-- ── Drop if exists (safe re-run) ───────────────────────────────────────────────
DROP FUNCTION IF EXISTS public.admin_extend_plan_30_days(uuid, text);

-- ── Create the extension function ─────────────────────────────────────────────
-- Uses GREATEST(COALESCE(...)) to never shorten an active subscription.
CREATE OR REPLACE FUNCTION public.admin_extend_plan_30_days(
  target_user_id uuid,
  target_plan    text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current_expires timestamptz;
  v_new_expires     timestamptz;
BEGIN
  -- Validate plan value — only premium and family are allowed
  IF target_plan NOT IN ('premium', 'family') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid plan value');
  END IF;

  -- Fetch current expiry date
  SELECT plan_expires_at
    INTO v_current_expires
    FROM public.profiles
   WHERE id = target_user_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'User not found');
  END IF;

  -- Calculate new expiry:
  -- Start from whichever is later: current plan_expires_at or now().
  -- This guarantees an active subscription is never shortened.
  v_new_expires := GREATEST(COALESCE(v_current_expires, now()), now()) + INTERVAL '30 days';

  -- Perform the update
  UPDATE public.profiles
     SET plan            = target_plan,
         plan_expires_at = v_new_expires,
         plan_updated_at = now()
   WHERE id = target_user_id;

  RETURN jsonb_build_object('success', true, 'new_expires_at', v_new_expires);
END;
$$;

-- ── Grant/Revoke: explicit access control ─────────────────────────────────────
-- Revoke from all broad roles so no regular user or anonymous caller can invoke this.
REVOKE EXECUTE ON FUNCTION public.admin_extend_plan_30_days(uuid, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.admin_extend_plan_30_days(uuid, text) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.admin_extend_plan_30_days(uuid, text) FROM anon;

-- Grant exclusively to service_role, which is used by the Edge Function's admin client.
GRANT EXECUTE ON FUNCTION public.admin_extend_plan_30_days(uuid, text) TO service_role;

-- ── Documentation ──────────────────────────────────────────────────────────────
COMMENT ON FUNCTION public.admin_extend_plan_30_days IS
  'Safely extends a user plan by 30 days without shortening an active subscription.
   Logic: GREATEST(COALESCE(plan_expires_at, now()), now()) + INTERVAL ''30 days''.
   Access:
     - anon, authenticated, PUBLIC: EXECUTE revoked (cannot call directly).
     - service_role: EXECUTE granted (called only by admin-plan-management Edge Function).
   The Edge Function verifies admin identity via ADMIN_EMAILS secret before calling this RPC.
   Sprint 22A — OmniNauka Admin Panel.';
