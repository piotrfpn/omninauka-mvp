-- Sprint 15A: Panel Rodzica MVP
-- Bezpieczna funkcja RPC pobierająca powiązane dzieci dla zalogowanego rodzica (bazująca na adresie e-mail).

DROP FUNCTION IF EXISTS public.get_parent_children();

CREATE OR REPLACE FUNCTION public.get_parent_children()
RETURNS TABLE (
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
    last_login_at timestamptz
) AS $$
DECLARE
    v_parent_email text;
BEGIN
    -- Pobierz adres e-mail aktualnie zalogowanego użytkownika
    v_parent_email := auth.jwt() ->> 'email';

    -- Jeżeli użytkownik nie ma adresu e-mail w tokenie JWT (lub nie jest zalogowany), zwróć pusty wynik.
    IF v_parent_email IS NULL OR trim(v_parent_email) = '' THEN
        RETURN;
    END IF;

    RETURN QUERY
    SELECT 
        pc.id AS consent_id,
        pc.consent_status,
        pc.consent_created_at,
        pc.updated_at AS consent_updated_at,
        pc.consent_approved_at,
        
        -- Zwróć dane dziecka TYLKO jeśli consent_status jest 'approved'.
        -- Dla 'pending', 'withdrawn', 'revoked', 'suspended', 'rejected' itp., zwracaj NULL.
        CASE WHEN pc.consent_status = 'approved' THEN pc.child_user_id ELSE NULL END AS child_user_id,
        CASE WHEN pc.consent_status = 'approved' THEN COALESCE(p.name, 'Uczeń') ELSE NULL END AS safe_child_name,
        
        -- Maskowanie adresu e-mail dziecka (np. j***@email.com) dla podwyższonej prywatności.
        CASE 
            WHEN pc.consent_status = 'approved' AND p.email IS NOT NULL AND position('@' IN p.email) > 1 THEN 
                substr(p.email, 1, 1) || '***@' || split_part(p.email, '@', 2)
            ELSE NULL 
        END AS child_email_masked,

        CASE WHEN pc.consent_status = 'approved' THEN p.education_level ELSE NULL END AS education_level,
        CASE WHEN pc.consent_status = 'approved' THEN p.school_type ELSE NULL END AS school_type,
        CASE WHEN pc.consent_status = 'approved' THEN p.grade_level ELSE NULL END AS grade_level,
        CASE WHEN pc.consent_status = 'approved' THEN p.profile_completed ELSE NULL END AS profile_completed,
        
        -- Zwracanie statycznego NULL jako że kolumna last_login_at chwilowo nie występuje lub nie powinna być użyta
        NULL::timestamptz AS last_login_at

    FROM public.parental_consents pc
    LEFT JOIN public.profiles p ON pc.child_user_id = p.id
    WHERE lower(trim(pc.parent_email)) = lower(trim(v_parent_email));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Upewnijmy się, że revoke zostało wykonane aby uniknąć publicznego wywoływania
REVOKE ALL ON FUNCTION public.get_parent_children() FROM public;
REVOKE ALL ON FUNCTION public.get_parent_children() FROM anon;

-- Nadać uprawnienia jedynie uwierzytelnionym
GRANT EXECUTE ON FUNCTION public.get_parent_children() TO authenticated;

-- Aktualizacja triggera do obsługi user_role i innych nowych pól z metadata
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, email, name, user_role, age_band, account_status)
  VALUES (
    new.id, 
    new.email, 
    new.raw_user_meta_data->>'name',
    new.raw_user_meta_data->>'user_role',
    new.raw_user_meta_data->>'ageBand',
    new.raw_user_meta_data->>'accountStatus'
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

