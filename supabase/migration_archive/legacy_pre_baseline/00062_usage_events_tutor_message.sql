-- Migration: 00062_usage_events_tutor_message.sql
-- Update valid_event_type constraint to include tutor_message.

-- Drop existing constraint
ALTER TABLE public.usage_events 
DROP CONSTRAINT IF EXISTS valid_event_type;

-- Re-add constraint with tutor_message included
ALTER TABLE public.usage_events 
ADD CONSTRAINT valid_event_type 
CHECK (event_type IN ('lesson_analysis', 'flashcard_regen', 'tutor_message'));

COMMENT ON COLUMN public.usage_events.event_type IS 'Type of the AI usage event. Valid types: lesson_analysis, flashcard_regen, tutor_message.';
