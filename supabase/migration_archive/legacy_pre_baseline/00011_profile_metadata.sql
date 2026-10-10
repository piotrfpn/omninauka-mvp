-- Add profile metadata columns to profiles table
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS user_role text,
ADD COLUMN IF NOT EXISTS school_type text,
ADD COLUMN IF NOT EXISTS education_level text,
ADD COLUMN IF NOT EXISTS grade_level text,
ADD COLUMN IF NOT EXISTS postal_code text,
ADD COLUMN IF NOT EXISTS profile_completed boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS profile_completed_at timestamptz;

-- Ensure RLS is active (profiles usually already has RLS)
-- Verify/Add policies for metadata update
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'profiles' AND policyname = 'Users can update own metadata'
    ) THEN
        CREATE POLICY "Users can update own metadata" ON public.profiles
            FOR UPDATE
            USING (auth.uid() = id)
            WITH CHECK (auth.uid() = id);
    END IF;
END $$;

COMMENT ON COLUMN public.profiles.user_role IS 'student, parent, teacher, other, prefer_not_to_say';
COMMENT ON COLUMN public.profiles.school_type IS 'primary_school, high_school, technical_school, vocational_school_1, vocational_school_2, post_secondary, homeschooling, other, prefer_not_to_say';
COMMENT ON COLUMN public.profiles.education_level IS 'primary_1_3, primary_4_6, primary_7_8, secondary_1, secondary_2, secondary_3, secondary_4, secondary_5, other, prefer_not_to_say';
