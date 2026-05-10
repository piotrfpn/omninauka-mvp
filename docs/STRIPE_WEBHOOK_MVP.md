# Stripe Webhook Auto Activation MVP (Sprint 22B)

## Cel
Automatyzacja aktywacji i przedłużania planu **Premium 30 dni** po dokonaniu płatności przez Stripe Payment Link. Eliminuje to konieczność ręcznej interwencji administratora w większości przypadków.

## Architektura i Przepływ
1.  **Frontend (`/app/payments`)**: Do każdego Stripe Payment Link doklejany jest parametr `client_reference_id` zawierający UUID użytkownika z Supabase Auth.
2.  **Stripe**: Po udanej płatności wysyła zdarzenie `checkout.session.completed` na zarejestrowany endpoint webhooka.
3.  **Edge Function (`stripe-webhook`)**:
    *   Weryfikuje podpis Stripe (`Stripe-Signature`).
    *   Sprawdza idempotencję w tabeli `payment_events` (zabezpieczenie przed podwójnym przetworzeniem).
    *   Wyciąga `client_reference_id` i weryfikuje profil użytkownika.
    *   Wywołuje istniejącą procedurę składowaną `public.admin_extend_plan_30_days`.
    *   Rejestruje zdarzenie w `payment_events` oraz wpis audytowy w `admin_plan_actions`.

## Konfiguracja (Supabase Secrets)
Do poprawnego działania wymagane jest ustawienie następujących sekretów w Supabase:

```bash
# Wymagane
npx supabase secrets set STRIPE_SECRET_KEY="sk_live_..."
npx supabase secrets set STRIPE_WEBHOOK_SECRET="whsec_..."
npx supabase secrets set STRIPE_PREMIUM_PAYMENT_LINK_ID="plink_..."

# Opcjonalne (walidacja kwoty i waluty)
npx supabase secrets set STRIPE_PREMIUM_AMOUNT_TOTAL="2999"
npx supabase secrets set STRIPE_PREMIUM_CURRENCY="pln"
```

## Baza Danych
### Tabela `public.payment_events`
Służy do śledzenia statusu płatności i zapewnienia idempotencji.
*   `stripe_event_id`: Unikalny identyfikator zdarzenia Stripe.
*   `status`: `processing`, `processed`, `ignored`, `error`.
*   `user_id`: Powiązany użytkownik Supabase.

### Audyt
Każda automatyczna aktywacja tworzy wpis w `public.admin_plan_actions` z adresem `admin_email = 'stripe-webhook'`.

## Deploy
Funkcja musi zostać wdrożona z wyłączoną weryfikacją JWT (Stripe nie wysyła tokenów Supabase).

```bash
# Jeśli config.toml zawiera [functions.stripe-webhook] verify_jwt = false:
npx supabase functions deploy stripe-webhook

# Alternatywnie wymuszenie flagą:
npx supabase functions deploy stripe-webhook --no-verify-jwt
```

## Testowanie Lokalne
Możesz przetestować webhook lokalnie przy użyciu Stripe CLI:

1.  Uruchom nasłuchiwanie:
    ```bash
    stripe listen --forward-to https://[project-ref].functions.supabase.co/stripe-webhook
    ```
2.  Wykonaj testowy zakup na `/app/payments` (używając trybu testowego Stripe).
3.  Sprawdź logi funkcji w panelu Supabase oraz tabele `payment_events` i `admin_plan_actions`.

## Ważne Uwagi
*   **Family Plan**: Jeśli użytkownik ma aktywny plan Rodzinny, webhook **nie obniży go** do Premium. Zdarzenie zostanie oznaczone jako `ignored` z błędem `active_family_plan`.
*   **Idempotencja**: Funkcja najpierw tworzy rekord w `payment_events` ze statusem `processing`, a dopiero potem wykonuje akcję. Ponowne otrzymanie tego samego `event_id` zostanie zignorowane.
