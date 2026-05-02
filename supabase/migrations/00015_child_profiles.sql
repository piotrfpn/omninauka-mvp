-- Sprint 17A v2: Parent Pre-Approves Child Email
-- This file is the FULL definition of child_profiles as source-of-truth.
-- NOTE: The actual DB was already seeded with the old v1 schema.
-- Incremental changes are applied via 00016_child_profiles_email_preapproval.sql.

CREATE TABLE IF NOT EXISTS public.child_profiles (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  parent_user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  child_user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  display_name text NOT NULL,
  child_email text NOT NULL,
  child_email_normalized text NOT NULL,
  age_band text NOT NULL CHECK (age_band IN ('7_9', '10_12')),
  school_type text,
  education_level text,
  grade_level text,
  status text NOT NULL DEFAULT 'pending_child_registration'
    CHECK (status IN ('pending_child_registration', 'linked', 'active', 'archived')),
  guardian_consent_acknowledged_at timestamptz,
  guardian_consent_version text DEFAULT 'child_email_preapproval_v1',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE (parent_user_id, child_email_normalized)
);

CREATE INDEX IF NOT EXISTS idx_child_profiles_parent_user_id ON public.child_profiles(parent_user_id);
CREATE INDEX IF NOT EXISTS idx_child_profiles_child_email_normalized ON public.child_profiles(child_email_normalized);
CREATE INDEX IF NOT EXISTS idx_child_profiles_child_user_id ON public.child_profiles(child_user_id) WHERE child_user_id IS NOT NULL;

ALTER TABLE public.child_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Parents can select their own child profiles"
  ON public.child_profiles FOR SELECT
  USING (auth.uid() = parent_user_id);

CREATE POLICY "Parents can insert their own child profiles"
  ON public.child_profiles FOR INSERT
  WITH CHECK (auth.uid() = parent_user_id);

CREATE POLICY "Parents can update their own child profiles"
  ON public.child_profiles FOR UPDATE
  USING (auth.uid() = parent_user_id);

CREATE POLICY "Parents can delete their own child profiles"
  ON public.child_profiles FOR DELETE
  USING (auth.uid() = parent_user_id);

-- get_parent_children RPC (final desired state, applied via 00016)
DROP FUNCTION IF EXISTS public.get_parent_children();

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
) AS $$
DECLARE
    v_parent_email text;
    v_parent_id uuid;
BEGIN
    v_parent_email := auth.jwt() ->> 'email';
    v_parent_id := auth.uid();

    IF v_parent_id IS NULL THEN
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
            WHEN 'approved' THEN 'Zgoda aktywna'
            WHEN 'pending'  THEN 'Oczekuje na potwierdzenie'
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
            WHEN 'linked'   THEN 'Konto dziecka połączone'
            WHEN 'active'   THEN 'Profil dziecka aktywny'
            WHEN 'archived' THEN 'Profil zarchiwizowany'
            ELSE cp.status
        END AS status_label
    FROM public.child_profiles cp
    WHERE cp.parent_user_id = v_parent_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

REVOKE ALL ON FUNCTION public.get_parent_children() FROM public;
REVOKE ALL ON FUNCTION public.get_parent_children() FROM anon;
GRANT EXECUTE ON FUNCTION public.get_parent_children() TO authenticated;
