-- Migration: 00067_family_effective_plan_hotfix.sql
-- Sprint 23A Hotfix: Synchronize DB with finalized trigger and RPC logic.
--
-- This migration ensures the database reflects the local changes made to 00066
-- after it was initially applied, and adds more robust trigger logic.

-- 1. Finalize get_my_effective_plan()
-- (In case the applied version differs from the current local 00066)
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

-- 2. Refined Child Limit Trigger (Hardened)
-- Handles: INSERT, UPDATE of parent_user_id, and UPDATE of status.
-- Prevents race conditions using FOR UPDATE lock on parent profile.
CREATE OR REPLACE FUNCTION public.check_child_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count int;
  v_is_taking_slot boolean;
  v_slot_added boolean;
BEGIN
  -- 1. Determine if the new state takes a slot (only non-archived count towards the limit)
  -- Safe check using COALESCE
  v_is_taking_slot := (COALESCE(NEW.status, '') <> 'archived');

  -- 2. If it doesn't take a slot, just allow it
  IF NOT v_is_taking_slot THEN
    RETURN NEW;
  END IF;

  -- 3. Safety check for parent_user_id
  IF NEW.parent_user_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- 4. Check if we are *adding* or *reactivating* a slot for this parent
  v_slot_added :=
    (TG_OP = 'INSERT')
    OR (
      TG_OP = 'UPDATE'
      AND (
        NEW.parent_user_id IS DISTINCT FROM OLD.parent_user_id
        OR COALESCE(OLD.status, '') = 'archived'
      )
    );

  IF v_slot_added THEN
    -- Prevent race condition by locking the parent profile record
    PERFORM 1
       FROM public.profiles
      WHERE id = NEW.parent_user_id
        FOR UPDATE;

    -- Count existing non-archived children for this parent
    SELECT count(*)
      INTO v_count
      FROM public.child_profiles
     WHERE parent_user_id = NEW.parent_user_id
       AND parent_user_id IS NOT NULL
       AND COALESCE(status, '') <> 'archived';

    IF v_count >= 3 THEN
      RAISE EXCEPTION 'Osiągnięto limit 3 dzieci w planie rodzinnym.';
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- 3. Trigger and Permissions
DROP TRIGGER IF EXISTS enforce_child_limit ON public.child_profiles;
CREATE TRIGGER enforce_child_limit
BEFORE INSERT OR UPDATE OF parent_user_id, status ON public.child_profiles
FOR EACH ROW EXECUTE FUNCTION public.check_child_limit();

-- Permissions for get_my_effective_plan
REVOKE ALL ON FUNCTION public.get_my_effective_plan() FROM public;
REVOKE ALL ON FUNCTION public.get_my_effective_plan() FROM anon;
GRANT EXECUTE ON FUNCTION public.get_my_effective_plan() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_effective_plan() TO service_role;

-- Permissions for check_child_limit (trigger context)
REVOKE ALL ON FUNCTION public.check_child_limit() FROM public;
REVOKE ALL ON FUNCTION public.check_child_limit() FROM anon;
REVOKE ALL ON FUNCTION public.check_child_limit() FROM authenticated;

-- Documentation update
COMMENT ON FUNCTION public.get_my_effective_plan() IS 'Zwraca efektywny plan zalogowanego użytkownika, uwzględniając dziedziczenie (Sprint 23A Hardened).';
COMMENT ON FUNCTION public.check_child_limit() IS 'Egzekwuje limit 3 aktywnych dzieci na rodzica z ochroną przed race condition (Sprint 23A Hardened).';
