-- Sprint 14A: Parental Consent MVP

-- 1. Update profiles table
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS age_band text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS account_status text DEFAULT 'active';

-- 2. Update handle_new_user trigger function
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
DECLARE
  v_age_band text;
  v_account_status text;
BEGIN
  -- Extract ageBand from raw_user_meta_data
  v_age_band := new.raw_user_meta_data->>'ageBand';
  
  -- Initial status based on age band
  IF v_age_band = '13_15' THEN
    v_account_status := 'pending_parent_consent';
  ELSE
    v_account_status := 'active';
  END IF;

  INSERT INTO public.profiles (id, email, name, age_band, account_status)
  VALUES (
    new.id, 
    new.email, 
    COALESCE(new.raw_user_meta_data->>'name', 'User'), 
    v_age_band,
    v_account_status
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Create parental_consents table
CREATE TABLE IF NOT EXISTS public.parental_consents (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  child_user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  parent_email text NOT NULL,
  age_band text NOT NULL,
  consent_status text DEFAULT 'pending' NOT NULL, -- pending, approved, withdrawn
  consent_scope jsonb DEFAULT '{"ai_tutor": true, "ocr_analyze": true, "study_history": true}'::jsonb,
  terms_version text DEFAULT 'REGULAMIN_v01',
  privacy_version text DEFAULT 'POLITYKA_PRYWATNOSCI_RODO_v01',
  ai_disclaimer_version text DEFAULT 'AI_DISCLAIMER_v01',
  token_hash text NOT NULL,
  token_expires_at timestamp with time zone NOT NULL,
  consent_created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  consent_approved_at timestamp with time zone,
  consent_withdrawn_at timestamp with time zone,
  ip_address text,
  user_agent text,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 4. Set up RLS for parental_consents
ALTER TABLE public.parental_consents ENABLE ROW LEVEL SECURITY;

-- Child can see their own consent record
CREATE POLICY "Users can view their own parental consent" ON public.parental_consents
  FOR SELECT USING (auth.uid() = child_user_id);

-- Allow public select for verification page (restricted by token_hash in query)
CREATE POLICY "Public can view consent status for verification" ON public.parental_consents
  FOR SELECT USING (true);

-- 5. Secure Function to approve consent
-- This function runs as SECURITY DEFINER to allow updating profiles and consents 
-- without requiring the parent to be logged in.
CREATE OR REPLACE FUNCTION public.approve_parental_consent(p_token_hash text, p_ip text, p_user_agent text)
RETURNS boolean AS $$
DECLARE
  v_consent_id uuid;
  v_child_id uuid;
BEGIN
  -- Find valid pending consent
  SELECT id, child_user_id INTO v_consent_id, v_child_id
  FROM public.parental_consents
  WHERE token_hash = p_token_hash 
    AND consent_status = 'pending' 
    AND token_expires_at > now()
  LIMIT 1;

  IF v_consent_id IS NULL THEN
    RETURN false;
  END IF;

  -- Update consent record
  UPDATE public.parental_consents
  SET 
    consent_status = 'approved',
    consent_approved_at = now(),
    ip_address = p_ip,
    user_agent = p_user_agent,
    updated_at = now()
  WHERE id = v_consent_id;

  -- Update child profile status
  UPDATE public.profiles
  SET account_status = 'parent_approved'
  WHERE id = v_child_id;

  RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
