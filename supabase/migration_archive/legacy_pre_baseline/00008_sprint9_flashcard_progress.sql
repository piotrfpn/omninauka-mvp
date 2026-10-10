-- Phase 9A: Flashcard Mastery State
-- Adds a dedicated JSONB column to track individual flashcard mastery without
-- overwriting or modifying the generated lesson content.

ALTER TABLE public.study_sessions
ADD COLUMN IF NOT EXISTS flashcard_progress JSONB DEFAULT '{}'::jsonb;

-- Typical JSONB structure expected:
-- {
--   "flashcard_id_1": {
--     "status": "know" | "dont_know",
--     "last_reviewed_at": "2026-04-18T12:00:00Z",
--     "know_count": 1,
--     "dont_know_count": 0
--   }
-- }
