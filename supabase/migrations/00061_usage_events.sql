-- Migration: 00061_usage_events.sql
-- Create usage_events table to track AI usage and enforce backend limits.

CREATE TABLE IF NOT EXISTS public.usage_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  session_id uuid NULL REFERENCES public.study_sessions(id) ON DELETE SET NULL,
  metadata jsonb NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  
  -- Constraint to ensure only valid event types are recorded in this sprint
  CONSTRAINT valid_event_type CHECK (event_type IN ('lesson_analysis', 'flashcard_regen'))
);

-- Index for counting daily usage per user
CREATE INDEX IF NOT EXISTS usage_events_user_type_created_idx ON public.usage_events (user_id, event_type, created_at DESC);

-- Index for counting usage per session (idempotency/limits per lesson)
CREATE INDEX IF NOT EXISTS usage_events_user_session_type_idx ON public.usage_events (user_id, session_id, event_type);

-- Enable RLS
ALTER TABLE public.usage_events ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only see their own usage events
CREATE POLICY "Users can view own usage events"
  ON public.usage_events
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Note: No INSERT/UPDATE/DELETE policies for authenticated users.
-- Usage events must be created from a secure server-side context (Edge Functions) using the service role.

COMMENT ON TABLE public.usage_events IS 'Tracks AI feature usage events to enforce backend limits across Free and Premium plans.';
