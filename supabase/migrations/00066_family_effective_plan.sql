-- Migration: 00066_family_effective_plan.sql
-- Sprint 23A: Family Plan MVP - Effective Plan Inheritance
--
-- Wprowadza mechanizm dziedziczenia planu Family przez dzieci oraz limit 3 dzieci na rodzica.

-- 1. Funkcja wyliczająca efektywny plan bieżącego użytkownika (używana przez frontend i backend)
CREATE OR REPLACE FUNCTION public.get_my_effective_plan()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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

  -- C. Sprawdź dziedziczenie Family przez relację w child_profiles
  -- Używamy statusów 'linked' i 'active' jako potwierdzonych relacji.
  SELECT p.plan, p.plan_expires_at
    INTO v_parent_plan, v_parent_expires
    FROM public.child_profiles cp
    JOIN public.profiles p ON cp.parent_user_id = p.id
   WHERE cp.child_user_id = v_user_id
     AND cp.status IN ('linked', 'active')
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
$$;

-- 2. Uprawnienia dla RPC
REVOKE ALL ON FUNCTION public.get_my_effective_plan() FROM public;
REVOKE ALL ON FUNCTION public.get_my_effective_plan() FROM anon;
GRANT EXECUTE ON FUNCTION public.get_my_effective_plan() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_effective_plan() TO service_role;

-- 3. Trigger wymuszający limit 3 dzieci na rodzica
CREATE OR REPLACE FUNCTION public.check_child_limit()
RETURNS trigger AS $$
DECLARE
  v_count int;
BEGIN
  -- Sprawdzamy limit tylko jeśli:
  -- A. To jest INSERT i parent_user_id nie jest NULL
  -- B. To jest UPDATE i zmieniamy parent_user_id na inny (nie-NULL)
  IF (TG_OP = 'INSERT' AND NEW.parent_user_id IS NOT NULL) OR 
     (TG_OP = 'UPDATE' AND NEW.parent_user_id IS NOT NULL AND (OLD.parent_user_id IS NULL OR NEW.parent_user_id != OLD.parent_user_id)) THEN
    
    SELECT count(*) INTO v_count 
      FROM public.child_profiles 
     WHERE parent_user_id = NEW.parent_user_id;

    IF v_count >= 3 THEN
      RAISE EXCEPTION 'Osiągnięto limit 3 dzieci w planie rodzinnym.';
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS enforce_child_limit ON public.child_profiles;
CREATE TRIGGER enforce_child_limit
BEFORE INSERT OR UPDATE ON public.child_profiles
FOR EACH ROW EXECUTE FUNCTION public.check_child_limit();

-- 4. Indeks optymalizacyjny dla sprawdzania relacji dziecka
CREATE INDEX IF NOT EXISTS idx_child_profiles_child_user_id ON public.child_profiles(child_user_id) WHERE child_user_id IS NOT NULL;

-- Komentarz migracji
COMMENT ON FUNCTION public.get_my_effective_plan() IS 'Zwraca efektywny plan zalogowanego użytkownika, uwzględniając dziedziczenie z Planu Rodzinnego rodzica (Sprint 23A).';
