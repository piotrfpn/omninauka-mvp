-- Migration 00071: Secure 'study-materials' bucket with Row-Level Security (RLS)
-- Sprint 24A.3: Storage RLS for study-materials

-- 1. Create compound B-Tree indexes for fast RLS checks (Performance P0)
-- This avoids sequential scans on public.study_sessions and public.session_images
CREATE INDEX IF NOT EXISTS idx_study_sessions_user_id_image_url
ON public.study_sessions(user_id, image_url);

CREATE INDEX IF NOT EXISTS idx_session_images_session_id_image_url
ON public.session_images(session_id, image_url);

-- 2. Ensure bucket exists and is private (Does not wipe out existing file limits or allowed mimes)
INSERT INTO storage.buckets (id, name, public) 
VALUES ('study-materials', 'study-materials', false)
ON CONFLICT (id) DO UPDATE SET public = false;

-- 3. Enable RLS on storage.objects (Safe to execute even if already enabled)
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- 4. Clean up any potential duplicate or conflicting policies on storage.objects for study-materials
DROP POLICY IF EXISTS "study_materials_insert_own_folder" ON storage.objects;
DROP POLICY IF EXISTS "study_materials_select_own_folder" ON storage.objects;
DROP POLICY IF EXISTS "study_materials_select_legacy_owned_reference" ON storage.objects;
DROP POLICY IF EXISTS "study_materials_update_own_folder" ON storage.objects;
DROP POLICY IF EXISTS "study_materials_delete_own_folder" ON storage.objects;

-- 5. Create new study_materials storage policies

-- A. INSERT Policy: Strictly requires user-id prefix (first segment of path = auth.uid())
CREATE POLICY "study_materials_insert_own_folder" ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'study-materials'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- B. SELECT Policy: User prefix (first segment of path = auth.uid())
CREATE POLICY "study_materials_select_own_folder" ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'study-materials'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- C. SELECT Policy Fallback: Legacy uploads (uploads/*) referenced in owned DB sessions
CREATE POLICY "study_materials_select_legacy_owned_reference" ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'study-materials'
  AND name LIKE 'uploads/%'
  AND (
    EXISTS (
      SELECT 1 FROM public.study_sessions s
      WHERE s.user_id = auth.uid()
        AND (
          s.image_url = name
          OR EXISTS (
            SELECT 1 FROM public.session_images si
            WHERE si.session_id = s.id
              AND si.image_url = name
          )
        )
    )
  )
);

-- D. UPDATE Policy: Strictly requires user-id prefix (first segment of path = auth.uid())
CREATE POLICY "study_materials_update_own_folder" ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'study-materials'
  AND (storage.foldername(name))[1] = auth.uid()::text
)
WITH CHECK (
  bucket_id = 'study-materials'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- E. DELETE Policy: Strictly requires user-id prefix (first segment of path = auth.uid())
-- Note: regular users are blocked from deleting legacy uploads/*, deletion is bypassed by service_role in Edge Functions.
CREATE POLICY "study_materials_delete_own_folder" ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'study-materials'
  AND (storage.foldername(name))[1] = auth.uid()::text
);
