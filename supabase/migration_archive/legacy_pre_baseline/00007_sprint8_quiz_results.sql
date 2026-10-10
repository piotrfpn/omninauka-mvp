-- Sprint 8: Real Progress Tracking - Quiz Results
-- Run this in Supabase Dashboard → SQL Editor

ALTER TABLE public.study_sessions
  ADD COLUMN IF NOT EXISTS quiz_result jsonb;

COMMENT ON COLUMN public.study_sessions.quiz_result IS 'Stores the latest quiz result for the session: {score, total, percentage, completed_at}';
