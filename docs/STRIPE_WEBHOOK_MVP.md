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
Rozszerzenia w tabeli `public.payment_events` obsługują idempotencję. Atomowa logika jest zamknięta w funkcji PostgreSQL `fulfill_stripe_premium_payment`, która wykorzystuje mechanizm `INSERT ON CONFLICT DO NOTHING` dla idempotencji eventu, a `UNIQUE` index dla idempotencji sesji. Architektura wykorzystuje `SELECT FOR UPDATE` do serializacji zmian uprawnienia dla jednego profilu. Zakres potwierdzenia runtime i niewykonany test współbieżnych, odrębnych płatności opisuje sekcja akceptacji F-03 poniżej.

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

## F-03 Runtime Acceptance — Sprint 29D.2B

**Status: `F03_STATUS=COMPLETED`** — checkpoint akceptacji z 2026-10-07, faza `R7C1H_F03_RUNTIME_ACCEPTANCE_CLOSURE`.

Akceptowany checkpoint kodu: `main`, HEAD i `origin/main` przed zmianą dokumentacji: `21b0e0cefc73a84016d50faf09236f2b8ef12533`. Podstawą zamknięcia są zakończone kontrole statyczne oraz trzy poniższe dowody runtime. Wyniki A i B oraz wersje wdrożenia pochodzą z zatwierdzonego checkpointu runtime; wynik C został potwierdzony testem CLI w fazie `R7C1G_2_DISTINCT_EVENT_SAME_SESSION_CLI_TRANSACTION`. Ta faza zamknięcia jest wyłącznie dokumentacyjna i nie powtarza operacji płatniczych ani wdrożeń.

Checkpoint środowiska: `stripe-webhook` wersja **10**, `create-checkout` wersja **2**, Stripe **TEST MODE**, stare Payment Links **DISABLED**, endpoint webhooka **ACTIVE**. Obsługiwane zdarzenia: `checkout.session.completed` i `checkout.session.async_payment_succeeded`. Nie jest to dowód płatności w Stripe LIVE MODE.

### A. Real Stripe Sandbox E2E

**Wynik: `PASS_FIRST_REAL_STRIPE_E2E`.** Kontrolowane konto QA **DzieckoTest2**, początkowo `plan=free`, wykonało udaną, jednorazową płatność Sandbox za **Premium 30 dni — 29,99 PLN**.

| Obserwacja | Przed | Po |
| --- | --- | --- |
| `payment_events` | 9 | 10 |
| `admin_plan_actions` | 26 | 27 |
| Profile `free` | 16 | 15 |
| Profile `premium` | 5 | 6 |
| Profile `family` | 3 | 3 |
| Plan DzieckoTest2 | `free` | `premium` |

Termin uprawnienia wyniósł około +30 dni. Zdarzenie płatności zostało przetworzone (`processed=true`; status rekordu `processed`), z `payment_status=paid`, `amount_total=2999`, `currency=pln` i `event_type=checkout.session.completed`. Zmieniło się wyłącznie zamierzone konto QA; żadne uprawnienie Family nie zostało nadpisane.

### B. Same event replay idempotency

**Wynik: `PASS_SAME_EVENT_REPLAY_IDEMPOTENCY_RUNTIME`.** Oryginalne zdarzenie `checkout.session.completed` zostało ręcznie dostarczone ponownie dwa razy; obie dostawy zwróciły **HTTP 200**.

Stan trwały pozostał dokładnie taki sam: `payment_events=10`, `admin_plan_actions=27`, rozkład planów `free=15`, `premium=6`, `family=3`. Oba znaczniki czasu uprawnienia QA pozostały dokładnie bez zmian: `plan_expires_at=2026-11-05 14:26:29.922858+00`, `plan_updated_at=2026-10-06 14:26:29.922858+00`. Nie powstał dodatkowy rekord płatności ani audytu administracyjnego i nie nastąpiło kolejne przedłużenie o 30 dni.

### C. Distinct event / same session idempotency

**Wynik: `PASS_DISTINCT_EVENT_SAME_SESSION_RUNTIME`.** Kontrolowany test PostgreSQL przez lokalny Supabase CLI wykonał dwa RPC w jednym batchu i jednej jawnej transakcji. Identyfikatory były syntetyczne: dwa różne eventy korzystały z dokładnie tej samej sesji Checkout. Nie wykonano kolejnej płatności ani nie utworzono sesji w Stripe.

| Obserwacja transakcyjna | Po pierwszym RPC | Po drugim RPC |
| --- | --- | --- |
| Wynik RPC | `processed` | `duplicate_checkout_session` |
| `payment_events` | 11 | 11 |
| `admin_plan_actions` | 28 | 28 |
| Plan QA | `premium` | `premium` |
| Odczytany `plan_expires_at` | `2026-12-05 14:26:29.922858+00` | `2026-12-05 14:26:29.922858+00` |
| Rekordy dla syntetycznej sesji | 1 | 1 |

Pierwsze RPC dodało dokładnie jeden rekord płatności, jeden rekord audytu i 30 dni do bazowego terminu uprawnienia. Drugie RPC dodało **0** rekordów płatności, **0** rekordów audytu i **0** dodatkowego czasu uprawnienia; `plan_updated_at` również pozostał bez zmian względem pierwszego RPC.

Batch zakończył transakcję jawnym **`ROLLBACK`**. Świeże zapytanie tylko do odczytu potwierdziło przywrócenie dokładnego stanu trwałego:

- `payment_events=10`, `admin_plan_actions=27`, `profiles=24`.
- Rozkład planów: `free=15`, `premium=6`, `family=3`.
- Dokładnie jedno konto DzieckoTest2: `account_status=active`, `plan=premium`.
- `plan_expires_at=2026-11-05 14:26:29.922858+00`.
- `plan_updated_at=2026-10-06 14:26:29.922858+00`.
- `SYNTHETIC_ROWS_PERSISTED=0`; syntetyczne rekordy audytu również nie pozostały.
- Niepuste `stripe_session_id`: **10**; różne `stripe_session_id`: **10**; grupy duplikatów sesji i eventów: **0**.

Plik testowy poza repozytorium został usunięty po weryfikacji rollbacku.

### D. Zweryfikowane kontrole bezpieczeństwa

Walidacja dokumentacyjnego checkpointu: `node --test tests/stripe-payment-binding.test.mjs` — **38/38 PASS**, 0 błędów. Zestaw zawiera kontrole statyczne i testy z mockami; nie zastępuje opisanych oddzielnie dowodów runtime A–C.

Kontrole statyczne kodu i testy kontraktu potwierdzają:

- Przeglądarka nie steruje `client_reference_id`; kanoniczny cel pochodzi z uwierzytelnionego użytkownika Supabase (`auth.getUser()`).
- Serwer ustala Premium Price ID, `quantity=1`, `mode=payment` i generuje metadata wiążące użytkownika.
- Webhook wymaga poprawnego podpisu Stripe i odrzuca sesje legacy Payment Link.
- Webhook sprawdza zgodność dwóch powiązań użytkownika: `metadata.omninauka_user_id` i `client_reference_id`.
- Cena jest niezależnie weryfikowana przez pobranie Stripe line items; płatność musi mieć status `paid`.
- Profil jest blokowany przez `FOR UPDATE` przed zmianą uprawnienia; ochrona aktywnego Family pozostaje zachowana.
- Rekord płatności, zmiana uprawnienia i audyt administracyjny są atomowe w RPC.
- Udane przetworzenie nie zapisuje payloadu (`payload=NULL`).

Metadane PostgreSQL odczytane w fazie C potwierdziły aktywny, poprawny częściowy indeks UNIQUE `payment_events_stripe_session_id_unique` na `stripe_session_id WHERE stripe_session_id IS NOT NULL`, a także RPC `SECURITY DEFINER` z `search_path=public`. Spośród ról aplikacyjnych RPC ma uprawnienie EXECUTE wyłącznie dla `service_role`; `PUBLIC`, `anon` i `authenticated` nie mają tego uprawnienia. Runtime B potwierdził idempotencję `stripe_event_id`, a runtime C potwierdził idempotencję różnych eventów dla tej samej `stripe_session_id`.

### Ograniczenie współbieżności — nie blokuje akceptacji

`CONCURRENT_DISTINCT_VALID_PAYMENTS_RUNTIME_TEST=NOT_PERFORMED`.

Prawdziwy równoczesny test dwóch odrębnych, poprawnych płatności wymagałby kontrolowanych wielu sesji DB i/lub zatwierdzonego, izolowanego stanu testowego. Statyczna architektura zawiera blokadę profilu `FOR UPDATE` i atomową transakcję fulfillment; nie jest to dowód runtime takiego scenariusza współbieżności. Test C sprawdza sekwencyjne RPC wewnątrz jednej transakcji.

Klasyfikacja dodatkowego testu: **`OPTIONAL_POST_MVP_HARDENING`**. Nie blokuje on akceptacji F-03 i nie został oznaczony jako wykonany. Zamknięcie F-03 dotyczy potwierdzonego powiązania celu płatności oraz opisanych dowodów statycznych i runtime.
