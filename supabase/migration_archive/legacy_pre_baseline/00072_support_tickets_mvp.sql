-- 00072_support_tickets_mvp.sql

CREATE TABLE IF NOT EXISTS public.support_tickets (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  user_email_snapshot text NOT NULL,
  user_role_snapshot text,
  plan_snapshot text,
  plan_expires_at_snapshot timestamptz,
  category text NOT NULL,
  subject text NOT NULL,
  message text NOT NULL,
  status text NOT NULL DEFAULT 'new',
  admin_note text,
  handled_by text,
  handled_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  
  CONSTRAINT valid_category CHECK (category IN ('payment_premium', 'technical_problem', 'ai_tutor_analysis', 'account_login', 'parent_consent', 'other')),
  CONSTRAINT valid_status CHECK (status IN ('new', 'in_progress', 'resolved', 'closed')),
  CONSTRAINT valid_subject_length CHECK (char_length(trim(subject)) BETWEEN 5 AND 120),
  CONSTRAINT valid_message_length CHECK (char_length(trim(message)) BETWEEN 10 AND 2000)
);

-- Indeksy do wyszukiwania
CREATE INDEX IF NOT EXISTS idx_support_tickets_user_id_created_at ON public.support_tickets(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_support_tickets_status_created_at ON public.support_tickets(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_support_tickets_created_at ON public.support_tickets(created_at DESC);

-- Trigger dla updated_at, używamy istniejącego set_updated_at jeśli to standardowe,
-- ale jako że wytyczne podają żeby upewnić się o istnieniu:
CREATE OR REPLACE FUNCTION public.set_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_support_tickets_updated_at ON public.support_tickets;
CREATE TRIGGER trg_support_tickets_updated_at
  BEFORE UPDATE ON public.support_tickets
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at_column();

-- RLS
ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;

-- Użytkownik może INSERT tylko do własnego ID (zabezpieczenie dodatkowe)
CREATE POLICY "Users can insert their own support tickets"
  ON public.support_tickets
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Użytkownik nie może SELECT, UPDATE, DELETE (zablokowane domyślnie przez brak polityk)
-- Zgłoszenia obsługuje Edge Function poprzez klucz service_role.
