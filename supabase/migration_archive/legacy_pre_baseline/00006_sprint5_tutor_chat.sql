-- Sprint 5: Osobisty Korepetytor (Personal Tutor) Foundation

-- 1. Add updated_at to study_sessions for context freshness tracking
ALTER TABLE public.study_sessions 
ADD COLUMN IF NOT EXISTS updated_at timestamp with time zone DEFAULT timezone('utc'::text, now());

-- Function to handle timestamp updates
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = timezone('utc'::text, now());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for study_sessions
DROP TRIGGER IF EXISTS trg_study_sessions_updated_at ON public.study_sessions;
CREATE TRIGGER trg_study_sessions_updated_at
  BEFORE UPDATE ON public.study_sessions
  FOR EACH ROW EXECUTE PROCEDURE public.handle_updated_at();

-- 2. Create tutor_threads table
CREATE TABLE IF NOT EXISTS public.tutor_threads (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id uuid REFERENCES public.study_sessions(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  context_snapshot jsonb DEFAULT '{}'::jsonb NOT NULL,
  snapshot_updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  last_message_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  CONSTRAINT unique_session_thread UNIQUE (session_id)
);

-- 3. Create tutor_messages table
CREATE TABLE IF NOT EXISTS public.tutor_messages (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  thread_id uuid REFERENCES public.tutor_threads(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  role text NOT NULL CHECK (role IN ('user', 'assistant')),
  content text NOT NULL,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 4. Indexes for performance
CREATE INDEX IF NOT EXISTS idx_tutor_messages_thread_date 
  ON public.tutor_messages (thread_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_tutor_threads_user 
  ON public.tutor_threads (user_id, last_message_at DESC);

-- 5. Row Level Security (RLS)
ALTER TABLE public.tutor_threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tutor_messages ENABLE ROW LEVEL SECURITY;

-- Threads: User can only see/modify their own threads
CREATE POLICY "Users can view own tutor threads"
  ON public.tutor_threads FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own tutor threads"
  ON public.tutor_threads FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own tutor threads"
  ON public.tutor_threads FOR UPDATE
  USING (auth.uid() = user_id);

-- Messages: User can only see/modify messages in their threads
CREATE POLICY "Users can view own tutor messages"
  ON public.tutor_messages FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own tutor messages"
  ON public.tutor_messages FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- 6. Trigger to update last_message_at in tutor_threads
CREATE OR REPLACE FUNCTION public.handle_thread_last_message()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.tutor_threads 
  SET last_message_at = NEW.created_at
  WHERE id = NEW.thread_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_tutor_messages_update_thread
  AFTER INSERT ON public.tutor_messages
  FOR EACH ROW EXECUTE PROCEDURE public.handle_thread_last_message();
