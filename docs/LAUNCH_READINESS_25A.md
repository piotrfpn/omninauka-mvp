# Launch Readiness 25A - Domain Checklist

Po podpięciu domeny `omninauka.pl` w Vercel, wykonaj poniższe kroki weryfikacyjne i aktualizacyjne:

## 1. Vercel Domains
- [ ] Dodaj domenę `omninauka.pl` w panelu Vercel (Project Settings -> Domains).
- [ ] Zdecyduj i skonfiguruj przekierowanie: zazwyczaj ustawia się `www.omninauka.pl` z przekierowaniem na `omninauka.pl` (lub odwrotnie).
- [ ] Zweryfikuj DNS u rejestratora (ustawienie rekordów A / CNAME wskazanych przez Vercel).
- [ ] Upewnij się, że Vercel wygenerował poprawnie certyfikat SSL dla domeny.

## 2. Supabase
- [ ] **Auth Redirect URLs**: Zaktualizuj w panelu Supabase (Authentication -> URL Configuration) `Site URL` na `https://omninauka.pl`.
- [ ] W "Redirect URLs" upewnij się, że docelowa domena (i opcjonalnie www, jeśli ma być używane) jest na liście akceptowanych URI, m.in. dla logowania, resetu hasła i OAuth.

## 3. Google OAuth (Kolejny Sprint)
- [ ] W Google Cloud Console dla OAuth 2.0 Client IDs, zaktualizuj **Authorized JavaScript origins** oraz **Authorized redirect URIs** (muszą zawierać `https://omninauka.pl` i ścieżki zwrotne).

## 4. Stripe (Późniejszy Sprint)
- [ ] Zaktualizuj URL-e powrotne w kodzie wywołującym Stripe Checkout Session (success_url i cancel_url) lub w Dashboardzie Stripe, jeśli są zapisane na sztywno.
- [ ] Upewnij się, że webhooki wskazują na produkcyjny URL `https://omninauka.pl/api/webhook` (jeśli są obsługiwane przez Edge Functions/backend).

## 5. Dokumenty Prawne
- [ ] Regulamin, Polityka Prywatności i Cookies muszą działać poprawnie pod nową domeną.
- [ ] Linki udostępniane w mailach czy na landing page'ach muszą wskazywać docelowy adres `omninauka.pl`.
