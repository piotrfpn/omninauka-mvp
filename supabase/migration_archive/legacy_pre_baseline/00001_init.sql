-- Minimal Supabase Schema for OmniNauka (Sprint 2A)

-- 1. Create a `users` profile table (extended past standard Supabase auth.users)
CREATE TABLE public.profiles (
  id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL,
  name text,
  plan text DEFAULT 'free'::text,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  PRIMARY KEY (id)
);

-- Trigger to automatically create profile on sign up
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, email, name)
  VALUES (new.id, new.email, new.raw_user_meta_data->>'name');
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- 2. Create the study_sessions table
CREATE TABLE public.study_sessions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  image_url text NOT NULL,
  raw_ocr_text text,
  subject text,
  topic text,
  confidence numeric,
  summary text,
  key_concepts jsonb DEFAULT '[]'::jsonb,
  flashcards jsonb DEFAULT '[]'::jsonb,
  quiz_questions jsonb DEFAULT '[]'::jsonb,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. Set up Storage for images
INSERT INTO storage.buckets (id, name, public) 
VALUES ('study-materials', 'study-materials', false);

-- Note: 
-- You will also need to add RLS (Row Level Security) policies to the 'study-materials' 
-- bucket and tables in the Supabase Dashboard, or explicitly turn them off for the MVP timeframe.
