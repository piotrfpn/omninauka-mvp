-- Migration: 00064_admin_plan_actions.sql
-- Sprint 22A.1: Admin Action Audit Log
--
-- Tworzy tabelę audit log dla operacji wykonywanych przez panel administratora.
-- WAŻNE: Ta tabela NIE jest dostępna z frontendu ani przez API anonimowe/uwierzytelnione.
-- Zapisy są dokonywane wyłącznie przez Edge Function `admin-plan-management`
-- z wykorzystaniem service_role po pozytywnej weryfikacji admina przez ADMIN_EMAILS.
--
-- Zabezpieczenia:
--   - RLS jest włączone.
--   - anon/authenticated/PUBLIC mają odebrane wszystkie uprawnienia (REVOKE ALL).
--   - service_role ma jawnie nadane SELECT i INSERT (GRANT).
--   - Tabela jest obsługiwana wyłącznie przez Edge Function po autoryzacji.

-- ── Tabela audit log ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.admin_plan_actions (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id       uuid        NULL,
  admin_email         text        NOT NULL,
  target_user_id      uuid        NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
  target_email        text        NOT NULL,
  action_type         text        NOT NULL,
  old_plan            text        NULL,
  new_plan            text        NULL,
  old_plan_expires_at timestamptz NULL,
  new_plan_expires_at timestamptz NULL,
  reason              text        NULL,
  created_at          timestamptz NOT NULL DEFAULT now(),

  -- Dopuszczalne typy akcji
  CONSTRAINT valid_action_type CHECK (
    action_type IN (
      'activate_premium_30',
      'extend_premium_30',
      'activate_family_30',
      'set_free'
    )
  ),

  -- Dopuszczalne wartości planu (NULL jest OK — np. przed pierwszą aktywacją)
  CONSTRAINT valid_old_plan CHECK (
    old_plan IS NULL OR old_plan IN ('free', 'premium', 'family')
  ),
  CONSTRAINT valid_new_plan CHECK (
    new_plan IS NULL OR new_plan IN ('free', 'premium', 'family')
  ),

  -- Ogranicz długość powodu zmiany
  CONSTRAINT reason_max_length CHECK (
    reason IS NULL OR char_length(reason) <= 500
  )
);

-- ── Indeksy ────────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS admin_plan_actions_target_user_id_created_at_idx
  ON public.admin_plan_actions(target_user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS admin_plan_actions_admin_email_created_at_idx
  ON public.admin_plan_actions(admin_email, created_at DESC);

CREATE INDEX IF NOT EXISTS admin_plan_actions_action_type_created_at_idx
  ON public.admin_plan_actions(action_type, created_at DESC);

-- ── Row Level Security ─────────────────────────────────────────────────────────
ALTER TABLE public.admin_plan_actions ENABLE ROW LEVEL SECURITY;

-- ── Jawne uprawnienia tabeli ───────────────────────────────────────────────────
-- Odebranie wszystkich uprawnień od ról publicznych i domyślnych
REVOKE ALL ON TABLE public.admin_plan_actions FROM PUBLIC;
REVOKE ALL ON TABLE public.admin_plan_actions FROM anon;
REVOKE ALL ON TABLE public.admin_plan_actions FROM authenticated;

-- Nadanie uprawnień wyłącznie dla service_role (używanej przez Edge Function)
GRANT SELECT, INSERT ON TABLE public.admin_plan_actions TO service_role;

-- ── Dokumentacja tabeli ────────────────────────────────────────────────────────
COMMENT ON TABLE public.admin_plan_actions IS
  'Audit log operacji admina na planach użytkowników (Sprint 22A.1).
   Zabezpieczenia: RLS włączone, anon/authenticated/PUBLIC bez dostępu.
   Dostęp wyłącznie dla service_role przez Edge Function admin-plan-management.
   Każdy rekord rejestruje: kto (admin), co (action_type), komu (target),
   stary i nowy plan oraz opcjonalny powód zmiany.';

COMMENT ON COLUMN public.admin_plan_actions.admin_user_id     IS 'UUID admina z Supabase Auth (może być NULL jeśli nie uda się pobrać).';
COMMENT ON COLUMN public.admin_plan_actions.admin_email       IS 'E-mail admina — weryfikowany przez ADMIN_EMAILS secret.';
COMMENT ON COLUMN public.admin_plan_actions.target_user_id   IS 'UUID użytkownika, którego plan zmieniono. ON DELETE SET NULL.';
COMMENT ON COLUMN public.admin_plan_actions.target_email     IS 'E-mail użytkownika docelowego — archiwizowany w logu.';
COMMENT ON COLUMN public.admin_plan_actions.action_type      IS 'Typ operacji: activate_premium_30 | extend_premium_30 | activate_family_30 | set_free.';
COMMENT ON COLUMN public.admin_plan_actions.old_plan         IS 'Plan przed zmianą: free | premium | family.';
COMMENT ON COLUMN public.admin_plan_actions.new_plan         IS 'Plan po zmianie: free | premium | family.';
COMMENT ON COLUMN public.admin_plan_actions.old_plan_expires_at IS 'Data ważności planu przed zmianą.';
COMMENT ON COLUMN public.admin_plan_actions.new_plan_expires_at IS 'Data ważności planu po zmianie.';
COMMENT ON COLUMN public.admin_plan_actions.reason           IS 'Opcjonalny powód zmiany podany przez admina (max 500 znaków).';
