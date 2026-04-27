# Konfiguracja Custom SMTP dla OmniNauka (Resend)

Aby rozwiązać problem błędu `Email rate limit exceeded` podczas rejestracji oraz zapewnić wysoką dostarczalność wiadomości, należy skonfigurować niestandardowy serwer SMTP w panelu Supabase Auth.

## 1. Wymagania w Resend
Zanim zaczniesz, upewnij się, że w panelu [Resend](https://resend.com):
- Masz zweryfikowaną domenę (np. `mail.omninauka.eu`).
- Skonfigurowałeś rekordy SPF i DKIM u swojego dostawcy domeny.
- Masz aktywny API Key z uprawnieniami do wysyłki.

## 2. Konfiguracja w Supabase
1. Przejdź do [Supabase Dashboard](https://supabase.com/dashboard).
2. Wybierz swój projekt: **OmniNauka**.
3. Przejdź do **Authentication** -> **Providers** -> **Email**.
4. Przewiń do sekcji **SMTP Settings**.
5. Włącz opcję **Enable Custom SMTP**.

Wypełnij pola następującymi danymi:
- **Sender email**: `zgody@mail.omninauka.eu` (musi być zweryfikowany w Resend)
- **Sender name**: `OmniNauka`
- **SMTP Host**: `smtp.resend.com`
- **SMTP Port**: `587`
- **SMTP User**: `resend`
- **SMTP Password**: [Twój Resend API Key]
- **Minimum time between emails**: `1 second` (pozwala na szybsze testy)

## 3. Konfiguracja Edge Functions (Sprint 14B)
Aby działała wysyłka linków do rodziców, musisz ustawić następujące sekrety w Supabase CLI lub Dashboard (Edge Functions -> Secrets):
- `RESEND_API_KEY`: [Twój Resend API Key]
- `RESEND_FROM_EMAIL`: `OmniNauka <zgody@mail.omninauka.eu>`
- `APP_BASE_URL`: `https://omninauka.vercel.app` (lub Twój URL produkcyjny)

Komenda CLI:
```bash
supabase secrets set RESEND_API_KEY=re_xxx RESEND_FROM_EMAIL="OmniNauka <zgody@mail.omninauka.eu>" APP_BASE_URL=https://omninauka.vercel.app
```

## 4. Testowanie
1. **Rejestracja**: Spróbuj zarejestrować nowe konto. Powinieneś otrzymać e-mail z potwierdzeniem niemal natychmiast, bez błędu rate limitu.
2. **Reset hasła**: Przetestuj funkcję „Zapomniałem hasła”.
3. **Zgoda rodzica**: Jako zalogowany użytkownik 13-15 lat wyślij prośbę na `/pending-consent` i sprawdź, czy e-mail od Resend dotarł do rodzica.

## 5. Rozwiązywanie problemów
- Jeśli nadal widnieje błąd rate limitu, sprawdź czy opcja "Enable Custom SMTP" jest na pewno zapisana.
- Jeśli maile nie dochodzą, sprawdź **Logs** w panelu Resend — tam zobaczysz dokładny powód odrzucenia (np. niezweryfikowany nadawca).
