-- Sprint 4: Hierarchical Folders for Organization
-- This migration is additive and non-destructive.

-- 1. Create the folders table
CREATE TABLE IF NOT EXISTS public.folders (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  parent_id uuid REFERENCES public.folders(id) ON DELETE CASCADE,
  name text NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL
);

-- 2. Add folder_id to study_sessions for hierarchical organization
ALTER TABLE public.study_sessions
  ADD COLUMN IF NOT EXISTS folder_id uuid REFERENCES public.folders(id) ON DELETE SET NULL;

-- 3. Add performance indexes
CREATE INDEX IF NOT EXISTS idx_folders_user_id ON public.folders(user_id);
CREATE INDEX IF NOT EXISTS idx_folders_parent_id ON public.folders(parent_id);
CREATE INDEX IF NOT EXISTS idx_study_sessions_folder_id ON public.study_sessions(folder_id);

-- 4. Enable RLS
ALTER TABLE public.folders ENABLE ROW LEVEL SECURITY;

-- 5. Policies
CREATE POLICY "Users can manage their own folders"
  ON public.folders
  FOR ALL
  USING (auth.uid() = user_id);

-- 6. Circular Reference Protection (DB Level)
-- Prevents a folder from becoming its own ancestor
CREATE OR REPLACE FUNCTION public.check_folder_circularity() 
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.parent_id IS NOT NULL THEN
    IF EXISTS (
      WITH RECURSIVE folder_path AS (
        SELECT id, parent_id FROM public.folders WHERE id = NEW.parent_id
        UNION ALL
        SELECT f.id, f.parent_id FROM public.folders f JOIN folder_path fp ON f.id = fp.parent_id
      )
      SELECT 1 FROM folder_path WHERE id = NEW.id
    ) THEN
      RAISE EXCEPTION 'Circular folder reference detected: Folder cannot be an ancestor of itself.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop trigger if exists to allow re-runs
DROP TRIGGER IF EXISTS trg_check_folder_circularity ON public.folders;

CREATE TRIGGER trg_check_folder_circularity
  BEFORE INSERT OR UPDATE ON public.folders
  FOR EACH ROW EXECUTE PROCEDURE public.check_folder_circularity();
