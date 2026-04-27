-- Sprint 14B: Real Email Delivery & Parental Consent Operationalisation

-- 1. Extend parental_consents table with delivery tracking
ALTER TABLE public.parental_consents ADD COLUMN IF NOT EXISTS last_email_sent_at timestamp with time zone;
ALTER TABLE public.parental_consents ADD COLUMN IF NOT EXISTS email_send_count int DEFAULT 0;
ALTER TABLE public.parental_consents ADD COLUMN IF NOT EXISTS email_last_status text;
ALTER TABLE public.parental_consents ADD COLUMN IF NOT EXISTS email_last_error text;

-- 2. Ensure one record per child user
-- This allows us to use UPSERT logic in the Edge Function to maintain a single active token.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'parental_consents_child_user_id_key'
    ) THEN
        ALTER TABLE public.parental_consents ADD CONSTRAINT parental_consents_child_user_id_key UNIQUE (child_user_id);
    END IF;
END $$;
