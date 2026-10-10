BEGIN;

DO $$ 
DECLARE 
  pol RECORD;
BEGIN 
  -- Find and drop any policy matching the prefix
  FOR pol IN 
    SELECT policyname 
    FROM pg_policies 
    WHERE schemaname = 'storage' 
      AND tablename = 'objects' 
      AND policyname LIKE 'study_materials_select_legacy_owned_reference%'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON storage.objects', pol.policyname);
  END LOOP;
END $$;

-- Fail closed postcheck
DO $policy_check$
BEGIN
  -- 1. Ensure NO legacy reference policy variant remains
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND policyname LIKE 'study_materials_select_legacy_owned_reference%'
  ) THEN
    RAISE EXCEPTION 'Unsafe legacy Storage policy variant remains';
  END IF;

  -- 2. Ensure safe policies from 00078 still exist
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND policyname = 'study_materials_select_legacy_owned'
      AND cmd = 'SELECT'
      AND roles = ARRAY['authenticated']::name[]
  ) THEN
    RAISE EXCEPTION 'Missing safe SELECT policy';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND policyname = 'study_materials_delete_legacy_owned'
      AND cmd = 'DELETE'
      AND roles = ARRAY['authenticated']::name[]
  ) THEN
    RAISE EXCEPTION 'Missing safe DELETE policy';
  END IF;

  -- 3. Ensure no data backfill/write policies were added
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND policyname LIKE 'study_materials_%legacy%'
      AND cmd IN ('INSERT', 'UPDATE', 'ALL')
  ) THEN
    RAISE EXCEPTION 'Unexpected legacy Storage write policy';
  END IF;
END;
$policy_check$;

COMMIT;
