# Instrukcja Ręcznej Aktywacji Planu Premium / Rodzinnego

To rozwiązanie MVP pozwala na ręczną aktywację planów płatnych po otrzymaniu potwierdzenia płatności ze Stripe, bez konieczności wdrażania webhooków.

## Procedura

### 1. Znajdź płatność w Stripe
1. Zaloguj się do Dashboardu Stripe.
2. Przejdź do zakładki **Payments**.
3. Znajdź udaną płatność (Succeeded) za odpowiedni plan (Premium 30 dni lub Rodzinny 30 dni).

### 2. Odczytaj dane użytkownika
1. Kliknij w płatność, aby zobaczyć szczegóły.
2. Odczytaj **E-mail** klienta (zazwyczaj widoczny w sekcji Customer).

### 3. Znajdź użytkownika w Supabase
1. Wejdź do Supabase Dashboard -> Table Editor.
2. Wybierz tabelę `public.profiles`.
3. Wyszukaj użytkownika po adresie email.

### 4. Aktywuj plan (SQL)
Najlepiej wykonać to przez **SQL Editor** w Supabase, aby zachować precyzję.

#### Aktywacja Premium na 30 dni
Zastąp `<EMAIL_UZYTKOWNIKA>` adresem e-mail z kroku 2.

```sql
UPDATE public.profiles
SET
  plan = 'premium',
  plan_expires_at = now() + interval '30 days',
  plan_updated_at = now()
WHERE email = '<EMAIL_UZYTKOWNIKA>';
```

#### Aktywacja Planu Rodzinnego na 30 dni
```sql
UPDATE public.profiles
SET
  plan = 'family',
  plan_expires_at = now() + interval '30 days',
  plan_updated_at = now()
WHERE email = '<EMAIL_UZYTKOWNIKA>';
```

#### Cofnięcie do planu Darmowego
```sql
UPDATE public.profiles
SET
  plan = 'free',
  plan_expires_at = null,
  plan_updated_at = now()
WHERE email = '<EMAIL_UZYTKOWNIKA>';
```

### 5. Weryfikacja
1. Poproś użytkownika o odświeżenie aplikacji.
2. Użytkownik powinien zobaczyć swój plan w zakładce **Ustawienia -> Płatności** oraz na swoim profilu.
3. Sprawdź w `public.profiles`, czy pola zostały poprawnie zaktualizowane.

## Ważne informacje
- **Bezpieczeństwo**: Zwykły użytkownik nie może samodzielnie zmienić swojego planu przez API/konsolę — pola te są chronione przez trigger bazodanowy.
- **Wygasanie**: Aplikacja automatycznie pokaże status „Wygasł”, gdy minie data `plan_expires_at`.
- **Inne pakiety**: Pakiety lekcji AI oraz subskrypcje automatyczne są obecnie oznaczone jako „Wkrótce”.
