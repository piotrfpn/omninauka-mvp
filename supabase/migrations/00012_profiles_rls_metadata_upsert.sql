-- Migration: 00012_profiles_rls_metadata_upsert.sql

-- Włączenie RLS na tabeli profiles (idempotentne)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DO $$ 
BEGIN
    -- 1. SELECT policy: Użytkownicy mogą czytać tylko własny profil
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'profiles' AND policyname = 'Users can view own profile'
    ) THEN
        CREATE POLICY "Users can view own profile" ON public.profiles
            FOR SELECT
            USING (auth.uid() = id);
    END IF;

    -- 2. INSERT policy: Użytkownicy mogą wstawić tylko własny profil (wymagane do upsert)
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'profiles' AND policyname = 'Users can insert own profile'
    ) THEN
        CREATE POLICY "Users can insert own profile" ON public.profiles
            FOR INSERT
            WITH CHECK (auth.uid() = id);
    END IF;

    -- 3. UPDATE policy: Użytkownicy mogą aktualizować tylko własny profil
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'profiles' AND policyname = 'Users can update own profile'
    ) THEN
        CREATE POLICY "Users can update own profile" ON public.profiles
            FOR UPDATE
            USING (auth.uid() = id)
            WITH CHECK (auth.uid() = id);
    END IF;
END $$;
