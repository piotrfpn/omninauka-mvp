-- Sprint 2 Hotfix: RLS policies for session_images table
-- Run this in Supabase Dashboard → SQL Editor

-- Enable RLS on session_images (safe to run even if already enabled)
ALTER TABLE public.session_images ENABLE ROW LEVEL SECURITY;

-- Policy: users can INSERT their own session images
-- (session must belong to the authenticated user)
CREATE POLICY "Users can insert own session images"
  ON public.session_images
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.study_sessions
      WHERE study_sessions.id = session_images.session_id
        AND study_sessions.user_id = auth.uid()
    )
  );

-- Policy: users can SELECT their own session images
CREATE POLICY "Users can select own session images"
  ON public.session_images
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.study_sessions
      WHERE study_sessions.id = session_images.session_id
        AND study_sessions.user_id = auth.uid()
    )
  );

-- Policy: users can DELETE their own session images
-- (also handled by ON DELETE CASCADE from study_sessions, but explicit is safer)
CREATE POLICY "Users can delete own session images"
  ON public.session_images
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.study_sessions
      WHERE study_sessions.id = session_images.session_id
        AND study_sessions.user_id = auth.uid()
    )
  );

-- Also ensure RLS + policies exist on study_sessions itself
-- (needed for the subquery above to work)
ALTER TABLE public.study_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "Users can insert own sessions"
  ON public.study_sessions
  FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY IF NOT EXISTS "Users can select own sessions"
  ON public.study_sessions
  FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY IF NOT EXISTS "Users can update own sessions"
  ON public.study_sessions
  FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY IF NOT EXISTS "Users can delete own sessions"
  ON public.study_sessions
  FOR DELETE
  USING (user_id = auth.uid());
