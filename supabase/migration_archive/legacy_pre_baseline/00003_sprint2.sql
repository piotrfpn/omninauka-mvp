-- Sprint 2: session_images child table for multi-image support
-- Run this in Supabase Dashboard → SQL Editor

CREATE TABLE IF NOT EXISTS public.session_images (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id uuid REFERENCES public.study_sessions(id) ON DELETE CASCADE NOT NULL,
  image_url text NOT NULL,
  position integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now() NOT NULL
);

-- Fast lookup by session
CREATE INDEX IF NOT EXISTS idx_session_images_session_id
  ON public.session_images(session_id);
