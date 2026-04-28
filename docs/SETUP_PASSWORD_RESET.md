# Konfiguracja Resetowania Hasła (Supabase)

Aby flow resetowania hasła działał poprawnie na różnych środowiskach (lokalnie, staging, produkcja), należy skonfigurować **Redirect URLs** w panelu Supabase.

## Kroki konfiguracji

1. Zaloguj się do [Supabase Dashboard](https://supabase.com/dashboard).
2. Przejdź do swojego projektu.
3. Wybierz **Authentication** z paska bocznego.
4. Kliknij **URL Configuration**.
5. W sekcji **Redirect URLs** dodaj poniższe adresy:

### Środowisko lokalne
`http://localhost:5173/reset-password`

### Środowisko Vercel
`https://omninauka-mvp.vercel.app/reset-password`

### Środowisko Produkcyjne
`https://omninauka.eu/reset-password`

## Uwagi techniczne

- Kod aplikacji dynamicznie generuje parametr `redirectTo` na podstawie `window.location.origin`.
- Jeżeli adres nie zostanie dodany do białej listy w Supabase, użytkownik po kliknięciu w link z maila zostanie przekierowany na domyślny URL (zazwyczaj stronę główną), a flow resetu hasła nie zadziała.
- Upewnij się, że w ustawieniach **Email Templates** -> **Reset Password** link zawiera zmienną `{{ .ConfirmationURL }}`.
