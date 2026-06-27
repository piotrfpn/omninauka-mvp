# Production Smoke Test Checklist

Ta checklista opisuje bezpieczny smoke test produkcji OmniNauka bez zapisywania hasel, tokenow ani sekretow w repozytorium.

## Zasady bezpieczenstwa

- Nie zapisuj hasel w repozytorium, dokumentacji, commitach, taskach ani raportach.
- Nie wklejaj hasel do terminala, logow ani narzedzi automatyzacji.
- Przechowuj hasla kont testowych w menedzerze hasel poza repozytorium.
- Nie zapisuj Supabase service role key, tokenow API ani sekretow Vercel/Stripe/Supabase.
- W raportach maskuj realne adresy e-mail, np. `test-p***@example.com`.
- Nie uzywaj pola `plan_type`.
- Nie zmieniaj RLS, Edge Functions, Stripe webhook, Supabase Storage ani panelu admina w ramach smoke testu.

## Konta testowe

Utrzymuj dwa osobne konta produkcyjne:

| Konto | Placeholder | Plan | Cel |
| --- | --- | --- | --- |
| Free smoke | `<TEST_FREE_EMAIL>` | `free` | Logowanie, dashboard, podstawowy dostep, payments guard |
| Premium smoke | `<TEST_PREMIUM_EMAIL>` | `premium` | Stan Premium, CTA przedluzenia, payments guard |

Hasla ustaw recznie przez publiczny flow aplikacji albo Supabase Auth UI i zapisz tylko w menedzerze hasel.

## Aktywacja Premium testowego konta

Jesli konto Premium wymaga recznej aktywacji, uzyj Supabase SQL Editor i podstaw tylko e-mail konta testowego:

```sql
UPDATE public.profiles
SET
  plan = 'premium',
  plan_expires_at = greatest(coalesce(plan_expires_at, now()), now()) + interval '30 days',
  plan_updated_at = now()
WHERE email = '<TEST_PREMIUM_EMAIL>';
```

Weryfikacja profili:

```sql
SELECT
  id,
  email,
  plan,
  plan_expires_at,
  plan_updated_at
FROM public.profiles
WHERE email IN ('<TEST_FREE_EMAIL>', '<TEST_PREMIUM_EMAIL>')
ORDER BY email;
```

Nie kopiuj wynikow z pelnymi adresami e-mail do raportu. Zamaskuj e-maile.

## Free smoke

Na `https://omninauka-mvp.vercel.app`:

- [ ] Wejdz na `/login`.
- [ ] Zaloguj sie jako `<TEST_FREE_EMAIL>`.
- [ ] Sprawdz, ze `/app/dashboard` laduje sie bez bledu.
- [ ] Odswiez `/app/dashboard` i potwierdz brak 404.
- [ ] Wejdz na `/app/payments`.
- [ ] Potwierdz, ze Premium 30 dni ma aktywne CTA zakupu/przejscia do Premium.
- [ ] Potwierdz, ze Family jest disabled / dostepne po kontakcie.
- [ ] Potwierdz, ze lesson packs sa disabled / dostepne po kontakcie.
- [ ] Sprawdz brak console/runtime errors.
- [ ] Wyloguj sie.

## Premium smoke

Na `https://omninauka-mvp.vercel.app`:

- [ ] Wejdz na `/login`.
- [ ] Zaloguj sie jako `<TEST_PREMIUM_EMAIL>`.
- [ ] Sprawdz, ze `/app/dashboard` laduje sie bez bledu.
- [ ] Odswiez `/app/dashboard` i potwierdz brak 404.
- [ ] Wejdz na `/app/payments`.
- [ ] Potwierdz, ze Premium pokazuje stan aktywny albo CTA przedluzenia Premium.
- [ ] Potwierdz, ze Family jest disabled / dostepne po kontakcie.
- [ ] Potwierdz, ze lesson packs sa disabled / dostepne po kontakcie.
- [ ] Sprawdz brak console/runtime errors.
- [ ] Wyloguj sie.

## Minimalny product sanity

Nie uruchamiaj kosztownych testow AI w smoke tescie. Sprawdz tylko, czy widoki nie crashuja:

- [ ] `/app/dashboard`
- [ ] `/app/history`
- [ ] `/app/upload`
- [ ] `/app/lesson`
- [ ] `/app/payments`

## Raportowanie

W raporcie wpisz:

- status deployu,
- status Free smoke,
- status Premium smoke,
- czy Premium ma `plan = 'premium'`,
- czy `plan_expires_at` jest ustawione,
- czy Family i lesson packs sa disabled,
- czy wystapily console/runtime/auth/routing/payments errors.

Nie wpisuj:

- hasel,
- tokenow,
- service role key,
- pelnych e-maili testowych bez maskowania,
- sekretow Vercel/Supabase/Stripe.
