-- Sprint 29D.1B. Local artifact only; execute this file separately after review.
-- Do not replay migrations 00067-00075 or repair migration history here.
-- The owner has approved grandfathering the existing controlled test relations.
BEGIN;

-- Prevent client writes between legacy validation, backfill and ACL replacement.
LOCK TABLE public.child_profiles IN ACCESS EXCLUSIVE MODE;

ALTER TABLE public.child_profiles
  ADD COLUMN IF NOT EXISTS preapproval_integrity_version integer NOT NULL DEFAULT 0;

-- No row counts or identities are hardcoded. Fail the whole migration on drift.
DO $legacy$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.child_profiles cp
    LEFT JOIN public.profiles parent ON parent.id = cp.parent_user_id
    LEFT JOIN public.profiles child ON child.id = cp.child_user_id
    LEFT JOIN auth.users au ON au.id = cp.child_user_id
    WHERE parent.id IS NULL
      OR parent.user_role IS DISTINCT FROM 'parent'
      OR cp.child_user_id = cp.parent_user_id
      OR cp.status IS NULL
      OR cp.status NOT IN ('pending_child_registration', 'linked', 'active', 'archived')
      OR cp.age_band IS NULL OR cp.age_band NOT IN ('7_9', '10_12')
      OR cp.child_email IS NULL OR btrim(cp.child_email) = ''
      OR cp.child_email_normalized IS DISTINCT FROM lower(btrim(cp.child_email))
      OR (cp.status <> 'archived' AND cp.guardian_consent_acknowledged_at IS NULL)
      OR cp.guardian_consent_acknowledged_at > now()
      OR cp.guardian_consent_version IS DISTINCT FROM 'child_email_preapproval_v1'
      OR (cp.status = 'pending_child_registration' AND cp.child_user_id IS NOT NULL)
      OR (cp.child_user_id IS NOT NULL AND child.id IS NULL)
      OR (cp.status IN ('linked', 'active') AND (
        cp.child_user_id IS NULL OR child.id IS NULL OR au.id IS NULL
        OR child.user_role IS DISTINCT FROM 'student'
        OR child.age_band IS DISTINCT FROM 'under_13'
        OR cp.child_email_normalized IS DISTINCT FROM lower(btrim(au.email))
      ))
  ) OR EXISTS (
    SELECT 1 FROM public.child_profiles
    WHERE child_user_id IS NOT NULL AND status IN ('linked', 'active')
    GROUP BY child_user_id HAVING count(*) > 1
  ) OR EXISTS (
    SELECT 1 FROM public.child_profiles
    WHERE status <> 'archived'
    GROUP BY parent_user_id HAVING count(*) > 3
  ) THEN
    RAISE EXCEPTION 'Existing child preapprovals failed security validation';
  END IF;
END;
$legacy$;

UPDATE public.child_profiles SET preapproval_integrity_version = 1;

ALTER TABLE public.child_profiles
  DROP CONSTRAINT IF EXISTS child_profiles_integrity_version_check;
ALTER TABLE public.child_profiles
  ADD CONSTRAINT child_profiles_integrity_version_check
  CHECK (preapproval_integrity_version IN (0, 1));

-- The table's complete policy/column inventory is used because live ACLs drift.
-- Quoted catalog identifiers are the only dynamic SQL input.
DO $acl$
DECLARE
  v_policy record;
  v_columns text;
BEGIN
  FOR v_policy IN
    SELECT policyname FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'child_profiles'
  LOOP
    EXECUTE format('DROP POLICY %I ON public.child_profiles', v_policy.policyname);
  END LOOP;

  SELECT string_agg(format('%I', attname), ', ' ORDER BY attnum) INTO v_columns
  FROM pg_attribute
  WHERE attrelid = 'public.child_profiles'::regclass
    AND attnum > 0 AND NOT attisdropped;
  EXECUTE format(
    'REVOKE ALL PRIVILEGES (%s) ON TABLE public.child_profiles FROM PUBLIC, anon, authenticated',
    v_columns
  );
END;
$acl$;

REVOKE ALL PRIVILEGES ON TABLE public.child_profiles FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.child_profiles TO authenticated;
GRANT ALL PRIVILEGES ON TABLE public.child_profiles TO service_role;
ALTER TABLE public.child_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Parents can select their own child profiles"
ON public.child_profiles FOR SELECT TO authenticated
USING (
  parent_user_id = auth.uid()
  AND EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.user_role = 'parent')
);

CREATE POLICY "Parents can insert their own child profiles"
ON public.child_profiles FOR INSERT TO authenticated
WITH CHECK (
  parent_user_id = auth.uid()
  AND EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.user_role = 'parent')
);

CREATE POLICY "Parents can update their own child profiles"
ON public.child_profiles FOR UPDATE TO authenticated
USING (
  parent_user_id = auth.uid()
  AND EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.user_role = 'parent')
)
WITH CHECK (
  parent_user_id = auth.uid()
  AND EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.user_role = 'parent')
);

CREATE OR REPLACE FUNCTION public.protect_child_profile_authorization()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $guard$
BEGIN
  -- SECURITY DEFINER linker runs as its explicitly pinned postgres owner.
  -- Backend writes and FK referential actions must retain CASCADE/SET NULL.
  -- JWT role stays authenticated during RPC, so it is not a bypass discriminator.
  IF current_user IN ('postgres', 'service_role') THEN
    RETURN NEW;
  END IF;

  IF current_user <> 'authenticated' OR auth.uid() IS NULL
     OR NEW.parent_user_id IS DISTINCT FROM auth.uid()
     OR NOT EXISTS (
       SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.user_role = 'parent'
     ) THEN
    RAISE EXCEPTION 'Child profile operation not permitted' USING ERRCODE = '42501';
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF NEW.child_user_id IS NOT NULL
       OR NEW.status IS DISTINCT FROM 'pending_child_registration'
       OR NEW.age_band IS NULL OR NEW.age_band NOT IN ('7_9', '10_12')
       OR NEW.child_email IS NULL OR btrim(NEW.child_email) = ''
       OR NEW.guardian_consent_acknowledged_at IS NULL THEN
      RAISE EXCEPTION 'Invalid child preapproval' USING ERRCODE = '42501';
    END IF;

    -- Timestamp presence is the existing UI's declaration, not a trusted time.
    NEW.child_email_normalized := lower(btrim(NEW.child_email));
    NEW.guardian_consent_acknowledged_at := now();
    NEW.guardian_consent_version := 'child_email_preapproval_v1';
    NEW.preapproval_integrity_version := 1;
    NEW.created_at := now();
    NEW.updated_at := now();
    RETURN NEW;
  END IF;

  -- Current UI only archives a pending record; all other fields stay immutable.
  -- Comparing the entire row also protects any additional legacy columns.
  IF OLD.parent_user_id IS DISTINCT FROM auth.uid()
     OR (to_jsonb(NEW) - ARRAY['status', 'updated_at']) IS DISTINCT FROM
        (to_jsonb(OLD) - ARRAY['status', 'updated_at']) THEN
    RAISE EXCEPTION 'Child profile fields are immutable' USING ERRCODE = '42501';
  END IF;
  IF OLD.status IS DISTINCT FROM 'pending_child_registration'
     OR OLD.child_user_id IS NOT NULL
     OR OLD.preapproval_integrity_version IS DISTINCT FROM 1
     OR NEW.status IS DISTINCT FROM 'archived' THEN
    RAISE EXCEPTION 'Child profile transition not permitted' USING ERRCODE = '42501';
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END;
$guard$;
REVOKE EXECUTE ON FUNCTION public.protect_child_profile_authorization() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.protect_child_profile_authorization() TO service_role;

DROP TRIGGER IF EXISTS protect_child_profile_authorization_trigger ON public.child_profiles;
CREATE TRIGGER protect_child_profile_authorization_trigger
BEFORE INSERT OR UPDATE ON public.child_profiles
FOR EACH ROW EXECUTE FUNCTION public.protect_child_profile_authorization();

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
  v_matched_id uuid;
BEGIN
  IF v_user_id IS NULL OR v_user_email IS NULL OR btrim(v_user_email) = '' THEN
    RETURN jsonb_build_object('linked', false, 'reason', 'unauthenticated');
  END IF;

  SELECT p.age_band, p.account_status, p.user_role INTO v_age_band, v_status, v_child_role
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
      UPDATE public.profiles SET account_status = 'active', pending_preapproval_since = NULL
      WHERE id = v_user_id AND age_band = 'under_13' AND user_role = 'student'
        AND account_status = 'pending_parent_preapproval';
      IF NOT FOUND THEN RAISE EXCEPTION 'Child account transition rejected'; END IF;
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

  UPDATE public.profiles SET account_status = 'active', pending_preapproval_since = NULL
  WHERE id = v_user_id AND age_band = 'under_13' AND user_role = 'student'
    AND account_status = 'pending_parent_preapproval';
  IF NOT FOUND THEN RAISE EXCEPTION 'Child account transition rejected'; END IF;
  RETURN jsonb_build_object('linked', true, 'reason', 'linked_now');
END;
$link$;
ALTER FUNCTION public.link_child_account() OWNER TO postgres;
REVOKE EXECUTE ON FUNCTION public.link_child_account() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.link_child_account() TO authenticated, service_role;

-- Remaining relation consumers follow below, with their existing payloads.

CREATE OR REPLACE FUNCTION public.get_my_effective_plan()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $plan$
DECLARE
  v_user_id uuid;
  v_now timestamptz := now();
  v_own_plan text;
  v_own_expires timestamptz;
  v_parent_plan text;
  v_parent_expires timestamptz;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('error', 'unauthorized');
  END IF;

  -- A. Pobierz profil własny
  SELECT plan, plan_expires_at
    INTO v_own_plan, v_own_expires
    FROM public.profiles
   WHERE id = v_user_id;

  -- B. Jeśli własny plan jest aktywnym premium/family -> zwróć go
  -- NOTE: plan_expires_at IS NULL traktujemy jako aktywny (przypadek ręcznej aktywacji przez admina bez daty).
  IF v_own_plan IN ('premium', 'family') AND (v_own_expires IS NULL OR v_own_expires > v_now) THEN
    RETURN jsonb_build_object(
      'effective_plan', v_own_plan,
      'raw_plan', v_own_plan,
      'plan_source', 'own',
      'inherited_from_parent', false,
      'plan_expires_at', v_own_expires,
      'source_plan_expires_at', v_own_expires
    );
  END IF;

  -- Family inheritance requires a trusted relation and a real parent profile.
  SELECT p.plan, p.plan_expires_at
    INTO v_parent_plan, v_parent_expires
    FROM public.child_profiles cp
    JOIN public.profiles p ON cp.parent_user_id = p.id
   WHERE cp.child_user_id = v_user_id
     AND cp.status IN ('linked', 'active')
     AND cp.preapproval_integrity_version = 1
     AND cp.parent_user_id <> v_user_id
     AND cp.guardian_consent_acknowledged_at IS NOT NULL
     AND cp.guardian_consent_version = 'child_email_preapproval_v1'
     AND p.user_role = 'parent'
     AND p.plan = 'family'
     AND (p.plan_expires_at IS NULL OR p.plan_expires_at > v_now)
   LIMIT 1;

  IF v_parent_plan IS NOT NULL THEN
    RETURN jsonb_build_object(
      'effective_plan', 'family',
      'raw_plan', v_own_plan,
      'plan_source', 'parent_family',
      'inherited_from_parent', true,
      'plan_expires_at', v_parent_expires,
      'source_plan_expires_at', v_parent_expires
    );
  END IF;

  -- D. Fallback do planu darmowego
  RETURN jsonb_build_object(
    'effective_plan', 'free',
    'raw_plan', v_own_plan,
    'plan_source', 'own',
    'inherited_from_parent', false,
    'plan_expires_at', v_own_expires,
    'source_plan_expires_at', v_own_expires
  );
END;
$plan$;

REVOKE EXECUTE ON FUNCTION public.get_my_effective_plan() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_effective_plan() TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.get_parent_children()
RETURNS TABLE (
    child_source text,
    child_profile_id uuid,
    consent_id uuid,
    consent_status text,
    consent_created_at timestamptz,
    consent_updated_at timestamptz,
    consent_approved_at timestamptz,
    child_user_id uuid,
    safe_child_name text,
    child_email_masked text,
    education_level text,
    school_type text,
    grade_level text,
    profile_completed boolean,
    last_login_at timestamptz,
    age_band text,
    status_label text
) AS $dashboard$
DECLARE
    v_parent_email text;
    v_parent_id uuid;
BEGIN
    v_parent_email := auth.jwt() ->> 'email';
    v_parent_id := auth.uid();

    IF v_parent_id IS NULL OR NOT EXISTS (
        SELECT 1 FROM public.profiles caller
        WHERE caller.id = v_parent_id AND caller.user_role = 'parent'
    ) THEN
        RETURN;
    END IF;

    RETURN QUERY
    -- Part 1: Children 13-15 via parental_consents
    SELECT
        'consent'::text AS child_source,
        NULL::uuid AS child_profile_id,
        pc.id AS consent_id,
        pc.consent_status,
        pc.consent_created_at,
        pc.updated_at AS consent_updated_at,
        pc.consent_approved_at,
        CASE WHEN pc.consent_status = 'approved' THEN pc.child_user_id ELSE NULL END AS child_user_id,
        CASE WHEN pc.consent_status = 'approved' THEN COALESCE(p.name, 'Uczeń') ELSE NULL END AS safe_child_name,
        CASE
            WHEN pc.consent_status = 'approved' AND p.email IS NOT NULL AND position('@' IN p.email) > 1 THEN
                substr(p.email, 1, 1) || '***@' || split_part(p.email, '@', 2)
            ELSE NULL
        END AS child_email_masked,
        CASE WHEN pc.consent_status = 'approved' THEN p.education_level ELSE NULL END AS education_level,
        CASE WHEN pc.consent_status = 'approved' THEN p.school_type ELSE NULL END AS school_type,
        CASE WHEN pc.consent_status = 'approved' THEN p.grade_level ELSE NULL END AS grade_level,
        CASE WHEN pc.consent_status = 'approved' THEN p.profile_completed ELSE NULL END AS profile_completed,
        NULL::timestamptz AS last_login_at,
        CASE WHEN pc.consent_status = 'approved' THEN p.age_band ELSE NULL END AS age_band,
        CASE pc.consent_status
            WHEN 'approved'  THEN 'Zgoda aktywna'
            WHEN 'pending'   THEN 'Oczekuje na potwierdzenie'
            WHEN 'withdrawn' THEN 'Zgoda cofnięta'
            ELSE pc.consent_status
        END AS status_label
    FROM public.parental_consents pc
    LEFT JOIN public.profiles p ON pc.child_user_id = p.id
    WHERE pc.parent_email IS NOT NULL
      AND lower(trim(pc.parent_email)) = lower(trim(v_parent_email))

    UNION ALL

    -- Part 2: Pre-approved children <13 via child_profiles
    SELECT
        'local_preapproved'::text AS child_source,
        cp.id AS child_profile_id,
        NULL::uuid AS consent_id,
        cp.status AS consent_status,
        cp.created_at AS consent_created_at,
        cp.updated_at AS consent_updated_at,
        cp.guardian_consent_acknowledged_at AS consent_approved_at,
        cp.child_user_id AS child_user_id,
        cp.display_name AS safe_child_name,
        CASE
            WHEN cp.child_email IS NOT NULL AND position('@' IN cp.child_email) > 1 THEN
                substr(cp.child_email, 1, 1) || '***@' || split_part(cp.child_email, '@', 2)
            ELSE NULL
        END AS child_email_masked,
        cp.education_level AS education_level,
        cp.school_type AS school_type,
        cp.grade_level AS grade_level,
        (cp.status = 'linked' OR cp.status = 'active') AS profile_completed,
        NULL::timestamptz AS last_login_at,
        cp.age_band AS age_band,
        CASE cp.status
            WHEN 'pending_child_registration' THEN 'Oczekuje na rejestrację dziecka'
            WHEN 'linked'                     THEN 'Konto dziecka połączone'
            WHEN 'active'                     THEN 'Profil dziecka aktywny'
            WHEN 'archived'                   THEN 'Profil zarchiwizowany'
            ELSE cp.status
        END AS status_label
    FROM public.child_profiles cp
    WHERE cp.parent_user_id = v_parent_id
      AND cp.preapproval_integrity_version = 1;
END;
$dashboard$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

REVOKE EXECUTE ON FUNCTION public.get_parent_children() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_parent_children() TO authenticated;

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

COMMIT;
