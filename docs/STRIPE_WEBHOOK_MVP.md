# Stripe Webhook Auto Activation MVP (Sprint 29D.2B)

## Cel
Automatyzacja aktywacji i przedłużania planu **Premium 30 dni** po dokonaniu płatności przez Stripe Checkout. Zapewnia to maksymalne bezpieczeństwo poprzez weryfikację autentyczności (backend do backend).

## Architektura i Przepływ (checkout_v1)
1.  **Frontend (`/app/payments`)**: Użytkownik klika przycisk "Kup Premium". Frontend wywołuje z autoryzacją `create-checkout` Edge Function.
2.  **Edge Function (`create-checkout`)**:
    *   Weryfikuje użytkownika przez `auth.getUser()`.
    *   Sprawdza czy użytkownik ma `account_status === 'active'`.
    *   Sprawdza czy użytkownik nie ma aktywnego planu Rodzinnego.
    *   Tworzy bezpiecznie Stripe Checkout Session z autorytatywnym Price ID.
    *   Zwraca wygenerowany link do płatności.
3.  **Stripe**: Po udanej płatności wysyła zdarzenie `checkout.session.completed` na webhook. Płatności asynchroniczne mogą wywołać również `checkout.session.async_payment_succeeded`.
4.  **Edge Function (`stripe-webhook`)**:
    *   Weryfikuje podpis Stripe (`Stripe-Signature`).
    *   Odrzuca stare Payment Linki (`payment_link == null`).
    *   Weryfikuje niezgodność pomiędzy `metadata.omninauka_user_id` a `client_reference_id`.
    *   Odpytuje Stripe API o faktycznie opłacone `line_items` by ustalić autentyczny Price ID.
    *   Wywołuje atomową operację RPC `public.fulfill_stripe_premium_payment`.

## Konfiguracja (Supabase Secrets)
Wymagane jest ustawienie następujących sekretów w Supabase:

```bash
npx supabase secrets set STRIPE_SECRET_KEY="sk_live_..."
npx supabase secrets set STRIPE_WEBHOOK_SECRET="whsec_..."
npx supabase secrets set STRIPE_PREMIUM_PRICE_ID="price_..."
npx supabase secrets set APP_URL="https://app.omninauka.pl"
```
*(Stare zmienne VITE_STRIPE_PREMIUM_PAYMENT_LINK, STRIPE_PREMIUM_AMOUNT_TOTAL są przestarzałe).*

## Baza Danych
Rozszerzenia w tabeli `public.payment_events` obsługują idempotencję. Atomowa logika jest zamknięta w funkcji PostgreSQL `fulfill_stripe_premium_payment`, która wykorzystuje mechanizm `INSERT ON CONFLICT DO NOTHING` dla idempotencji eventu, a `UNIQUE` index dla idempotencji sesji. Zapewnia `exactly_once` event processing dla webhooków i radzi sobie bezpiecznie ze współbieżnymi płatnościami (dzięki `SELECT FOR UPDATE`).

## PAID BUT UNFULFILLED (Reconciliation Queue)
Zdarzenia, które zostały opłacone, ale nie mogły zostać automatycznie zrealizowane z powodów biznesowych, wpadają do kolejki `reconciliation_required`:
*   `payment_events` status = `error`
*   `error_message` LIKE `%reconciliation_required%`

Przypadki biznesowe:
*   `active_family_reconciliation_required` (użytkownik miał plan Rodzinny w momencie płatności Premium)
*   `target_profile_missing_reconciliation_required` (profil docelowy przestał istnieć)

Procedura dla administratora/supportu:
1.  Admin weryfikuje płatność bezpośrednio w Stripe.
2.  Admin weryfikuje obecną tożsamość konta niezależnie od dawnych logów.
3.  Admin decyduje czy przedłużyć plan ręcznie, czy wykonać zwrot (refund).
4.  Admin zapisuje rezultat wsparcia używając istniejącego procesu.
*Nigdy nie należy ufać historycznym atrybutom client_reference_id jako dowodowi tożsamości.*

## Wdrożenie (Bezpieczny Cutover)
UWAGA: Zanim system ustabilizuje się na nowej architekturze, wcześniej utworzona (stara) sesja Checkout Session MOŻE zostać opłacona w trakcie trwania tego cutovera. Bezpieczeństwo jest zachowane JEDYNIE dzięki wyłączeniu (disabled) endpointu webhooka w Stripe, dopóki w systemie wciąż działa stara, podatna funkcja, i jego włączeniu (enabled) dopiero, gdy uruchomiona zostanie nowa, utwardzona (hardened) wersja webhooka.

**PHASE A — FREEZE USER PURCHASES**
1.  Tymczasowo wyłącz przycisk zakupów Premium na frontendzie (CTA) w OmniNauka.
2.  Zarchiwizuj i wyłącz (disable) stary Stripe Payment Link. Uniemożliwi to tworzenie nowych, starych sesji Payment Link. (Ważne: już utworzone stare sesje nadal mogą zostać opłacone, więc samo wyłączenie Payment Linka nie jest wystarczające).

**PHASE B — CONTAIN OLD WEBHOOK DELIVERY**
3.  Wyłącz (disable) istniejący endpoint webhooka w Stripe, który obecnie celuje w legacy `stripe-webhook` w OmniNauka.
    *   Upewnij się i potwierdź jego status jako: `status = disabled` zanim przejdziesz dalej.
    *   Jest to granica bezpieczeństwa. Od tego momentu stara, podatna funkcja nie otrzyma już nowych dostaw zdarzeń ze Stripe podczas migracji/deployu.
    *   **NIE KONTYNUUJ**, jeżeli nie możesz potwierdzić wyłączenia endpointu.

**PHASE C — BACKEND SWITCH**
4.  Zastosuj zweryfikowaną migrację ręcznie: `00080_stripe_payment_fulfillment.sql` i **tylko** tę migrację. (Nie używaj: `supabase db push`, `supabase migration up`, `supabase migration repair`, ani powtarzania historycznych migracji).
5.  Zdeployuj nową, utwardzoną (hardened) funkcję `stripe-webhook` w Edge Functions.
6.  Zweryfikuj, że na środowisku działa zdeployowana, utwardzona wersja. (NIE włączaj endpointu webhooka zanim to nie zostanie bezwzględnie potwierdzone!).

**PHASE D — RE-ENABLE WEBHOOK DELIVERY**
7.  Włącz ponownie (re-enable) TEN SAM endpoint webhooka w Stripe **dopiero po** aktywowaniu utwardzonego webhooka.
    *   Potwierdź status endpointu: `enabled` i że jego docelowy URL to nadal prawidłowy, utwardzony webhook OmniNauka.
    *   Od tego momentu wszystkie nowe zdarzenia oraz ręcznie ponowione dostawy ze Stripe muszą trafiać do nowej logiki. Nigdy nie kieruj eventów z powrotem do starego, podatnego webhooka.
    *   **UWAGA NA ZDARZENIA Z OKRESU CONTAINMENT:** Nie zakładaj, że wszystkie zdarzenia zaistniałe w czasie wyłączonego webhooka zostaną automatycznie wysłane (replayed). Po ponownym włączeniu endpointu, wykonaj review historii webhook delivery / Stripe Events dla okresu zablokowania webhooka (containment window).
    *   Zidentyfikuj: stare sesje Checkout zakończone sukcesem podczas wyłączonego webhooka, faile w dostarczeniu (failed deliveries), zdarzenia pending/retried, zapłacone stare sesje Payment Link oraz eventy wymagające przeglądu manualnego. Jeśli to konieczne, ponów wysyłkę brakujących eventów ze Stripe (resend), ale **tylko po to by trafiły do działającego utwardzonego webhooka**.
    *   Zdarzenia z Payment Link opłacone w legacy sesjach, odrzucone przez rygorystyczne sprawdzanie w nowym webhooku, muszą przejść MANUALNĄ REKONCYLIACJĘ.

**PHASE E — NEW CHECKOUT**
Tylko po: zainstalowaniu migracji 00080, wdrożeniu utwardzonego webhooka, ponownym włączeniu endpointu Stripe oraz zakończeniu review zdarzeń z containment window, kontynuuj:
8.  Zdeployuj funkcję `create-checkout`.
9.  Zweryfikuj poprawność/konfigurację `create-checkout`.
10. Zdeployuj bezpieczny frontend.
11. Przeprowadź wewnętrzne testy QA nowej płatności.
12. Włącz ponownie CTA Premium (dopiero po udanym teście QA).

### Reguła Wstrzymania Cutovera i Manualnej Rekoncyliacji (Failure / Rollback)
Jeżeli jakikolwiek proces deployu lub migracji zawiedzie w momencie, gdy endpoint webhooka w Stripe jest wyłączony:
*   **ZATRZYMAJ:** CTA Premium wyłączone, stary Payment Link wyłączony, endpoint webhooka w Stripe WYŁĄCZONY dopóki nie naprawisz utwardzonego deployu.
*   **NIE PRZYWRACAJ:** starego, podatnego webhooka, zaufania do starego `client_reference_id`, ani starego przepływu Payment Link.
*   Napraw "do przodu" (repair forward). Dopiero, gdy utwardzony webhook będzie poprawnie działał, włącz endpoint Stripe, wykonaj review eventów i manualną rekoncyliację.

**Manualna rekoncyliacja**: Dla jakiejkolwiek opłaconej legacy sesji z Payment Linka, Stripe stanowi jedyne źródło prawdy dla statusu płatności. **NIE UFAJ** starym wartościom `client_reference_id` jako dowodowi tożsamości. Admin/support musi niezależnie zweryfikować docelowe konto w systemie OmniNauka przed nadaniem uprawnień (entitlement) lub przekazaniem/wystawieniem zwrotu (refund). Zapisz decyzję z operacji wsparcia.
