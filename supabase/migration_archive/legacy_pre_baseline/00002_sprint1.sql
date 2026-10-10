-- Sprint 1: lesson_title grouping + soft delete
-- Run this in Supabase Dashboard → SQL Editor

-- 1. Add lesson title column for grouping sessions under a named lesson
ALTER TABLE public.study_sessions
  ADD COLUMN IF NOT EXISTS lesson_title text;

-- 2. Add soft-delete column (deleted_at IS NULL = active, IS NOT NULL = deleted)
ALTER TABLE public.study_sessions
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
