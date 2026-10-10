-- Migration: 00068_security_parental_consents_rls.sql
-- Sprint 24A.1: Security P0 Hotfix — parental_consents public SELECT
--
-- Problem: Migration 00009 created two SELECT policies on parental_consents:
--   1. "Users can view their own parental consent" USING (auth.uid() = child_user_id)  -- OK
--   2. "Public can view consent status for verification" USING (true)  -- P0 VULNERABILITY
--
-- The second policy allowed ANY caller (anon or authenticated) to list ALL consent
-- records via the Supabase Data API, leaking:
--   parent_email, token_hash, child_user_id, consent_status, ip_address, user_agent.
--
-- Fix applied in this migration:
--   1. DROP the public USING(true) policy.
--   2. Ensure pgcrypto extension is available (Supabase enables it in the extensions schema).
--   3. Create SECURITY DEFINER RPC verify_consent_token(p_token text):
--      - Accepts the raw URL token.
--      - Hashes it server-side with pgcrypto SHA-256 (extensions.digest).
--      - Returns a minimal payload: status, can_approve, child_name only.
--      - NEVER returns token_hash, parent_email, ip_address, or full record.
--   4. Grant EXECUTE to anon, authenticated, service_role.
--      anon is required because the consent link is a public URL (unauthenticated parent).

-- ── 1. Remove the vulnerable public SELECT policy ─────────────────────────────
DROP POLICY IF EXISTS "Public can view consent status for verification" ON public.parental_consents;

-- ── 2. Ensure pgcrypto is available ───────────────────────────────────────────
-- Supabase projects have pgcrypto installed in the extensions schema by default.
-- This is idempotent; it is safe to run even if already installed.
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

-- ── 3. Create secure RPC for consent token verification ───────────────────────
-- search_path is intentionally limited to public.
-- pgcrypto functions are called with the explicit extensions. prefix to avoid
-- search_path injection and to work correctly when search_path = public.
--
-- Returned fields (minimal payload for UI):
--   status      text    -- 'valid' | 'invalid' | 'expired' | 'already_approved'
--   can_approve boolean -- true only when status = 'valid'
--   child_name  text    -- display name of the child for the consent form
--
-- NOT returned (never reaches the frontend):
--   token_hash, parent_email, ip_address, user_agent,
--   child_user_id, age_band, consent_scope, terms_version,
--   any internal timestamps, any full record fields.

CREATE OR REPLACE FUNCTION public.verify_consent_token(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_token_hash       text;
  v_consent_status   text;
  v_token_expires_at timestamptz;
  v_child_name       text;
BEGIN
  -- Basic input validation.
  -- The token is a 72-char hex string (36 random bytes * 2) from send-consent-email.
  -- We accept anything >= 16 chars to be permissive of future token format changes,
  -- but reject NULL and obvious junk early.
  IF p_token IS NULL OR length(trim(p_token)) < 16 THEN
    RETURN jsonb_build_object(
      'status',      'invalid',
      'can_approve', false,
      'child_name',  null
    );
  END IF;

  -- Hash the raw token server-side using pgcrypto SHA-256.
  -- extensions.digest is used explicitly to avoid search_path issues.
  -- This is equivalent to the SubtleCrypto SHA-256 used in send-consent-email/index.ts
  -- and in src/lib/consent.ts (hashConsentToken).
  v_token_hash := encode(extensions.digest(p_token, 'sha256'), 'hex');

  -- Fetch the minimal set of fields needed for status determination.
  -- We do NOT select parent_email, ip_address, user_agent, token_hash, or consent_scope.
  SELECT
    pc.consent_status,
    pc.token_expires_at,
    COALESCE(p.name, 'Uczen')
  INTO
    v_consent_status,
    v_token_expires_at,
    v_child_name
  FROM public.parental_consents pc
  LEFT JOIN public.profiles p ON pc.child_user_id = p.id
  WHERE pc.token_hash = v_token_hash
  LIMIT 1;

  -- No record found for this token hash.
  IF v_consent_status IS NULL THEN
    RETURN jsonb_build_object(
      'status',      'invalid',
      'can_approve', false,
      'child_name',  null
    );
  END IF;

  -- Consent was already approved — do not reveal child data again.
  IF v_consent_status = 'approved' THEN
    RETURN jsonb_build_object(
      'status',      'already_approved',
      'can_approve', false,
      'child_name',  null
    );
  END IF;

  -- Token exists but has expired (still pending, past expiry timestamp).
  IF v_token_expires_at < now() THEN
    RETURN jsonb_build_object(
      'status',      'expired',
      'can_approve', false,
      'child_name',  null
    );
  END IF;

  -- Token is valid and pending: return minimal payload for the consent form.
  RETURN jsonb_build_object(
    'status',      'valid',
    'can_approve', true,
    'child_name',  v_child_name
  );
END;
$$;

-- ── 4. Access control ─────────────────────────────────────────────────────────
-- Revoke implicit PUBLIC grant first (defensive), then grant explicitly.
REVOKE EXECUTE ON FUNCTION public.verify_consent_token(text) FROM PUBLIC;

-- anon: required — the consent page is a public URL, parent is not logged in.
GRANT EXECUTE ON FUNCTION public.verify_consent_token(text) TO anon;

-- authenticated: allowed — parent may be logged in when clicking their own link.
GRANT EXECUTE ON FUNCTION public.verify_consent_token(text) TO authenticated;

-- service_role: allowed — Edge Functions and admin tooling may need to verify tokens.
GRANT EXECUTE ON FUNCTION public.verify_consent_token(text) TO service_role;

-- ── 5. Documentation ──────────────────────────────────────────────────────────
COMMENT ON FUNCTION public.verify_consent_token(text) IS
  'Sprint 24A.1 Security P0 fix.
   Accepts the raw consent URL token, hashes it server-side via extensions.digest (pgcrypto SHA-256),
   and returns a minimal UI payload: status, can_approve, child_name.
   Never returns: token_hash, parent_email, ip_address, full consent record, child_user_id.
   Replaces direct SELECT on parental_consents which had a USING(true) public SELECT policy.
   Callable by: anon (public consent link), authenticated (logged-in parent), service_role.';
