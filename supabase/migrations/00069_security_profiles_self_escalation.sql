-- Migration: 00069_security_profiles_self_escalation.sql
-- Sprint 24A.1: Security P0 Hotfix -- profiles self-escalation
--
-- Problem: Migration 00060 created protect_plan_fields_trigger, which prevents
-- authenticated client-side users from self-updating plan/plan_expires_at/plan_updated_at.
-- However, the trigger does NOT protect:
--   - user_role     (could escalate student -> parent -> admin)
--   - account_status (could self-approve pending_parent_consent -> active)
--   - age_band      (could change age group to bypass consent requirements)
--
-- Additionally, auth-context.tsx updateProfile() includes user_role in dbUpdates
-- when the frontend calls updateProfile({ userRole: ... }), meaning a student could
-- attempt to write user_role = 'admin' or 'parent' directly to the REST API.
--
-- Fix:
--   Replace protect_plan_fields() with protect_sensitive_profile_fields() which
--   covers ALL sensitive fields:
--     user_role, account_status, age_band, plan, plan_expires_at, plan_updated_at.
--
-- Detection mechanism: current_user
-- ────────────────────────────────
-- We use current_user (a PostgreSQL built-in) to detect whether the UPDATE is
-- coming directly from a client-side API call or from a server-side trusted function.
--
-- PostgreSQL role hierarchy in Supabase:
--
--   REST client using anon key        -> current_user = 'anon'
--   REST client using authenticated   -> current_user = 'authenticated'
--   SECURITY DEFINER function owner   -> current_user = 'postgres' (or supabase_admin)
--   service_role client               -> current_user = 'service_role'
--
-- Crucially: when a SECURITY DEFINER function executes, PostgreSQL SWITCHES current_user
-- to the function owner for the duration of that function's execution. This is the
-- defining feature of SECURITY DEFINER -- it does not inherit the caller's role.
-- Therefore, any UPDATE to profiles issued INSIDE a SECURITY DEFINER function will
-- have current_user = 'postgres' (or whatever owns the function), NOT 'authenticated'.
--
-- This means blocking on current_user IN ('anon', 'authenticated') is SAFE and CORRECT:
--
--   approve_parental_consent()  SECURITY DEFINER  -> current_user = 'postgres' -> NOT blocked
--   link_child_account()        SECURITY DEFINER  -> current_user = 'postgres' -> NOT blocked
--   admin_extend_plan_30_days() SECURITY DEFINER  -> current_user = 'postgres' -> NOT blocked
--   handle_new_user (trigger)   INSERT only       -> trigger fires on UPDATE, skip
--   Stripe/service_role client  direct UPDATE     -> current_user = 'service_role' -> NOT blocked
--   Frontend direct REST UPDATE -> current_user = 'authenticated' -> BLOCKED (correct)
--   Anon direct REST UPDATE     -> current_user = 'anon' -> BLOCKED (belt-and-suspenders)
--
-- Why NOT request.jwt.claim.role?
-- ────────────────────────────────
-- request.jwt.claim.role is a GUC (Grand Unified Configuration) setting injected by
-- PostgREST at the START of each HTTP request. It does NOT change when a SECURITY
-- DEFINER function switches current_user. For example:
--
--   authenticated user calls link_child_account() via REST:
--     request.jwt.claim.role = 'authenticated'   <-- unchanged throughout the request
--     current_user = 'postgres'                  <-- switched by SECURITY DEFINER
--
-- Using request.jwt.claim.role would INCORRECTLY block link_child_account() and
-- approve_parental_consent() when called by an authenticated user, breaking
-- the consent and child-linking flows. This is the bug the original 00069 had.

-- ── 1. Drop the old narrower trigger and function ────────────────────────────
DROP TRIGGER IF EXISTS protect_plan_fields_trigger ON public.profiles;
DROP FUNCTION IF EXISTS public.protect_plan_fields();

-- ── 2. Create the wider protection trigger function ───────────────────────────
-- SECURITY INVOKER is intentional here: the trigger runs as the caller's role,
-- so current_user correctly reflects who is issuing the UPDATE.
-- (A SECURITY DEFINER trigger would always see current_user = owner, defeating the check.)
CREATE OR REPLACE FUNCTION public.protect_sensitive_profile_fields()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  -- Block direct client-side updates from the anon or authenticated roles.
  -- These are the only two roles that can issue direct REST API calls to the
  -- profiles table via the Supabase client library.
  --
  -- current_user is the PostgreSQL role currently executing this code.
  -- For direct REST/client calls: 'anon' or 'authenticated'.
  -- For SECURITY DEFINER function calls: 'postgres' or 'supabase_admin' (owner).
  -- For service_role direct calls: 'service_role'.
  --
  -- We block on both 'anon' and 'authenticated' as a belt-and-suspenders measure,
  -- even though anon should not have UPDATE access to profiles in the first place.
  IF current_user IN ('anon', 'authenticated') THEN

    -- Silently revert sensitive fields to their existing values.
    -- This approach (revert rather than ERROR) is deliberately chosen:
    --   - It does not break legitimate partial updates (e.g. updating only name).
    --   - It does not leak information about which field was blocked.
    --   - It matches the pattern used in the original protect_plan_fields (00060).
    NEW.user_role      := OLD.user_role;
    NEW.account_status := OLD.account_status;
    NEW.age_band       := OLD.age_band;
    NEW.plan           := OLD.plan;
    NEW.plan_expires_at := OLD.plan_expires_at;
    NEW.plan_updated_at := OLD.plan_updated_at;

  END IF;

  RETURN NEW;
END;
$$;

-- ── 3. Attach the trigger ─────────────────────────────────────────────────────
DROP TRIGGER IF EXISTS protect_sensitive_profile_fields_trigger ON public.profiles;
CREATE TRIGGER protect_sensitive_profile_fields_trigger
BEFORE UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.protect_sensitive_profile_fields();

-- ── 4. Documentation ─────────────────────────────────────────────────────────
COMMENT ON FUNCTION public.protect_sensitive_profile_fields() IS
  'Sprint 24A.1 Security P0 fix.
   Replaces protect_plan_fields() from Sprint 18C (migration 00060).
   Prevents direct client-side updates from changing sensitive profile fields:
     user_role, account_status, age_band, plan, plan_expires_at, plan_updated_at.
   Detection: current_user IN (''anon'', ''authenticated'').
   SECURITY INVOKER is intentional -- current_user must reflect the caller, not the owner.
   SECURITY DEFINER functions (approve_parental_consent, link_child_account,
   admin_extend_plan_30_days) run as ''postgres'' and are NOT blocked.
   service_role direct calls run as ''service_role'' and are NOT blocked.
   Blocked: direct REST UPDATE from anon or authenticated Supabase client calls.';
