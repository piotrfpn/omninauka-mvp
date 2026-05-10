-- Migration: 00065_payment_events.sql
-- Sprint 22B: Stripe Webhook Auto Activation MVP
--
-- Tworzy tabelę payment_events dla idempotencji i śledzenia statusu płatności Stripe.

CREATE TABLE IF NOT EXISTS public.payment_events (
  id                    uuid        PRIMARY KEY DEFAULT gen_random_uuid(),

  stripe_event_id       text        NOT NULL UNIQUE,
  stripe_session_id     text        NULL,
  stripe_payment_link_id text       NULL,

  user_id               uuid        NULL REFERENCES public.profiles(id) ON DELETE SET NULL,

  event_type            text        NOT NULL,
  status                text        NOT NULL, -- 'processing', 'processed', 'ignored', 'error'

  target_plan           text        NULL,

  amount_total          bigint      NULL,
  currency              text        NULL,
  payment_status        text        NULL,

  error_message         text        NULL,
  payload               jsonb       NULL,

  created_at            timestamptz NOT NULL DEFAULT now(),
  processed_at          timestamptz NULL,
  updated_at            timestamptz NULL,

  -- Constraints
  CONSTRAINT payment_events_status_check CHECK (status IN ('processing', 'processed', 'ignored', 'error')),
  CONSTRAINT payment_events_target_plan_check CHECK (target_plan IS NULL OR target_plan IN ('premium', 'family', 'free'))
);

-- Indeksy
CREATE INDEX IF NOT EXISTS payment_events_stripe_event_id_idx ON public.payment_events(stripe_event_id);
CREATE INDEX IF NOT EXISTS payment_events_user_id_created_at_idx ON public.payment_events(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS payment_events_status_created_at_idx ON public.payment_events(status, created_at DESC);
CREATE INDEX IF NOT EXISTS payment_events_stripe_session_id_idx ON public.payment_events(stripe_session_id);
CREATE INDEX IF NOT EXISTS payment_events_stripe_payment_link_id_idx ON public.payment_events(stripe_payment_link_id);

-- Row Level Security
ALTER TABLE public.payment_events ENABLE ROW LEVEL SECURITY;

-- Uprawnienia
REVOKE ALL ON TABLE public.payment_events FROM PUBLIC;
REVOKE ALL ON TABLE public.payment_events FROM anon;
REVOKE ALL ON TABLE public.payment_events FROM authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.payment_events TO service_role;

-- Komentarze
COMMENT ON TABLE public.payment_events IS 
  'Tabela służąca do idempotencji webhooków Stripe i śledzenia statusu aktywacji planów. 
   Używana wyłącznie przez Edge Function stripe-webhook. Idempotencja zapewniona przez stripe_event_id.';

COMMENT ON COLUMN public.payment_events.stripe_event_id IS 'Unikalny identyfikator zdarzenia ze Stripe (evt_...).';
COMMENT ON COLUMN public.payment_events.status IS 'Status przetwarzania: processing, processed, ignored, error.';
COMMENT ON COLUMN public.payment_events.payload IS 'Ograniczony i zanonimizowany payload zdarzenia Stripe dla celów debugowania.';
