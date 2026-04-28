# Sprint 14B: Production Configuration & Smoke Test Guide

Ten dokument zawiera instrukcję finalnego wdrożenia i weryfikacji mechanizmu zgody rodzicielskiej na środowisku produkcyjnym.

## 1. Wdrożenie Bazy Danych
Zastosuj migrację [00010_consent_email_delivery.sql](file:///c:/Users/Dom/Documents/MOJE/firmy/omninauka/Kimi_Agent_OmniNauka%20Real%20MVP/app/supabase/migrations/00010_consent_email_delivery.sql).

**Metoda A (Dashboard):**
Kopiuj zawartość pliku i wklej do **SQL Editor** w panelu Supabase, a następnie kliknij **Run**.

**Metoda B (CLI):**
```bash
supabase db push
```

## 2. Wdrożenie Edge Function
Uruchom komendę w terminalu (wymaga zalogowanego Supabase CLI):
```bash
supabase functions deploy send-consent-email
```

## 3. Konfiguracja Sekretów (Secrets)
Ustaw wymagane zmienne środowiskowe dla Edge Functions. Możesz to zrobić w Dashboardzie (Edge Functions -> Secrets) lub przez CLI:

| Nazwa | Opis | Przykład |
| :--- | :--- | :--- |
| `RESEND_API_KEY` | Klucz API z Resend | `re_123456789...` |
| `RESEND_FROM_EMAIL` | Zweryfikowany nadawca | `OmniNauka <zgody@mail.omninauka.eu>` |
| `APP_BASE_URL` | Adres Twojej aplikacji | `https://omninauka.vercel.app` |

**Komenda CLI:**
```bash
supabase secrets set RESEND_API_KEY=xxx RESEND_FROM_EMAIL=xxx APP_BASE_URL=xxx
```

## 4. Konfiguracja Custom SMTP
Postępuj zgodnie z instrukcją [docs/SETUP_SMTP.md](file:///c:/Users/Dom/Documents/MOJE/firmy/omninauka/Kimi_Agent_OmniNauka%20Real%20MVP/app/docs/SETUP_SMTP.md), aby skonfigurować Resend jako dostawcę SMTP dla Supabase Auth. To zdejmie limity mailowe dla rejestracji.

---

## 5. Plan Smoke Testu (Vercel)

Po wykonaniu powyższych kroków i automatycznym redeployu na Vercel (po pushu do main), wykonaj następujące testy:

### Scenariusz A: Ścieżka Krytyczna (Happy Path)
1.  **Rejestracja**: Zarejestruj nowe konto z wiekiem "13-15 lat".
2.  **Redirect**: Potwierdź, że po rejestracji (i ewentualnym potwierdzeniu maila) trafiasz na `/pending-consent`.
3.  **Wysyłka**: Wpisz swój drugi e-mail (jako rodzic) i wyślij prośbę.
4.  **Odebranie**: Sprawdź skrzynkę e-mail. Potwierdź, że temat i treść są zgodne z projektem.
5.  **Zatwierdzenie**: Kliknij przycisk w e-mailu. Powinieneś trafić na stronę `/consent/:token`.
6.  **Checkboxy**: Zaznacz wszystkie zgody i kliknij "Potwierdzam".
7.  **Weryfikacja Konta**: Zaloguj się ponownie jako uczeń. Powinieneś mieć dostęp do Dashboardu i AI Tutora.

### Scenariusz B: Bezpieczeństwo i Limity
1.  **Cooldown**: Spróbuj wysłać maila ponownie przed upływem 60 sekund. Potwierdź komunikat o błędzie/odliczaniu.
2.  **Blokada AI**: Jako uczeń ze statusem `pending`, spróbuj ręcznie wejść na `/app/upload`. Powinieneś zostać przekierowany z powrotem.
3.  **Błędny Token**: Spróbuj wejść na `/consent/nieistniejacy-token`. Powinieneś zobaczyć komunikat o nieważnym linku.
4.  **Brak Linku w UI**: Upewnij się, że na Vercel (produkcja) w interfejsie `/pending-consent` **NIE** wyświetla się debugowy link zgody (powinien być widoczny tylko na localhost).

### Scenariusz C: Backend Guard
1.  Używając narzędzi deweloperskich lub Postmana, spróbuj wywołać funkcję `analyze-notes` używając tokenu JWT ucznia `pending`.
2.  Powinieneś otrzymać odpowiedź `403 Forbidden` z komunikatem o zablokowanym dostępie.
