BEGIN;

-- Mutable application references are not proof of Storage ownership.
DROP POLICY IF EXISTS "study_materials_select_legacy_owned_reference"
ON storage.objects;

CREATE POLICY "study_materials_select_legacy_owned"
ON storage.objects
FOR SELECT TO authenticated
USING (
  bucket_id = 'study-materials'
  AND name LIKE 'uploads/%'
  AND owner_id = auth.uid()::text
);

CREATE POLICY "study_materials_delete_legacy_owned"
ON storage.objects
FOR DELETE TO authenticated
USING (
  bucket_id = 'study-materials'
  AND name LIKE 'uploads/%'
  AND owner_id = auth.uid()::text
);

-- Fail closed on unexpected final catalog state; no data is changed.
DO $policy_check$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND policyname = 'study_materials_select_legacy_owned_reference'
  ) THEN
    RAISE EXCEPTION 'Unsafe legacy Storage policy remains';
  END IF;

  IF (
    SELECT count(*) FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND (
        (policyname = 'study_materials_select_legacy_owned' AND cmd = 'SELECT')
        OR (policyname = 'study_materials_delete_legacy_owned' AND cmd = 'DELETE')
      )
      AND roles = ARRAY['authenticated']::name[]
      AND permissive = 'PERMISSIVE'
      AND with_check IS NULL
      AND position('bucket_id' IN qual) > 0
      AND position('study-materials' IN qual) > 0
      AND position('name' IN qual) > 0
      AND position('uploads/%' IN qual) > 0
      AND position('owner_id' IN qual) > 0
      AND position('auth.uid()' IN qual) > 0
  ) <> 2 THEN
    RAISE EXCEPTION 'Legacy Storage ownership policies do not match contract';
  END IF;

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
