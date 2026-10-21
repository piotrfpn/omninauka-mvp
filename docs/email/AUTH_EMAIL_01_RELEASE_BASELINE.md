# OmniNauka AUTH-EMAIL-01 — release baseline

**Historyczny checkpoint B2 (2026-10-21): SOURCE ARTIFACTS PREPARED — NOT COMMITTED — NOT DEPLOYED FROM THIS WORKTREE**

## A. Tożsamość wydania

- Wydanie: OmniNauka AUTH-EMAIL-01; sprint utrwalenia: AUTH-EMAIL-01.3.
- Repozytorium docelowe: `piotrfpn/omninauka-mvp`.
- Gałąź: `release/auth-email-01-3b-persistence`.
- Baza B: `8be6234277633a529c06aa2459ab643bb9bee9ec`.
- Rodzic R: `f0ce3aa5136782496003ff86cb3822697c50aa1c`.
- Tree B: `fbc8cf37c638e42963f857a271cf1f3e16232178`.
- B jest lokalnie zweryfikowanym kandydatem bazy; nie stanowi certyfikacji pełnej zgodności źródeł z produkcją.

## B. Manifest artefaktów

Ścieżki są względne wobec repozytorium. Źródła to chronione worktree rodzeństwa: `worktree-auth-email-01` (EMAIL) i `worktree-auth-email-asset-release` (PUBLICATION).

| Ścieżka | SHA-256 | Bajty | Źródło | Cel |
| --- | --- | ---: | --- | --- |
| `public/email/omninauka-confirm-signup-hero.jpg` | `96f928d81e09519c120bb2caf5dcc166f240c0fc7cb5f9d6817451475c81ace4` | 181683 | EMAIL; identyczna kopia PUBLICATION | Publiczny baner JPEG, 1200 × 600 px |
| `supabase/email-templates/confirm-signup.html` | `37f92c1d0d6e34cadeb40cd0f9ceb539b83d38781ff314b720bac80bf1313f69` | 11802 | EMAIL | Branded confirmation email |
| `supabase/email-templates/confirm-signup.subject.txt` | `1da0b495737614ad0568f2e16afe3271b74855b461452e1b80340cbf1bd210fa` | 36 | EMAIL | Polski temat, UTF-8 bez BOM, końcowy LF |
| `vite.config.ts` | `827ce95ff4e36dc2623f4123f85b39734cf5fd6e94ba768b2b912f55a9315d6c` | 1656 | PUBLICATION | Wykluczenie /email/ z nawigacyjnego fallbacku SPA |

Lokalny HTML o rozmiarze 11802 bajtów i powyższym hashu jest kontrolującym artefaktem transferu. Historycznie raportowane 11753 bajty nie są podstawą do jego modyfikacji.

## C. Cel funkcjonalny

HTML zachowuje polską komunikację marki, CTA potwierdzenia i zapasowy link używające `{{ .ConfirmationURL }}`, responsywny układ oraz baner `https://omninauka-mvp.vercel.app/email/omninauka-confirm-signup-hero.jpg`.

Jedyna zmiana konfiguracji B to `navigateFallbackDenylist: [/^\/email\//],` w `VitePWA → workbox`, pomiędzy `globPatterns` a `runtimeCaching`. Wyklucza nawigację /email/ z fallbacku SPA; nie zmienia manifestu, polityki precache ani runtime caching.

## D. Istniejące dowody akceptacji

**Raporty historyczne:** wcześniejsze ręczne testy zaakceptowały dostarczenie e-maila, prezentację mobilną, potwierdzenie adresu oraz późniejsze logowanie. Raportowano również akceptację wyświetlania produkcyjnego banera i obecności denylisty Service Workera. Ten zapis nie dodaje dat, identyfikatorów testów ani screenshotów.

**Niezależna wcześniejsza weryfikacja AUTH-EMAIL-01.3A:** publiczna odpowiedź banera miała zgodny hash, rozmiar i wymiary; serwowany sw.js zawierał denylistę /email/. Była to pasywna kontrola HTTP, a nie dowód stanu cache każdej przeglądarki ani pełnej zgodności źródeł.

**Lokalna weryfikacja B1/B2:** sprawdzono bazę i integralność artefaktów. B2 nie powtarza testu rejestracji, logowania ani publikacji szablonu; nie uruchamia builda ani testów aplikacji.

## E. Ograniczenia pochodzenia produkcji

- Ostatni historycznie raportowany deployment: `dpl_HTHviqw2LBvr6koa5N8QFhRYFEgt`.
- Przypisanie aktualnie aktywnego deploymentu: **UNKNOWN**.
- Pełna zgodność źródła z produkcją: **NOT PROVEN**.
- Tożsamość bajtowa aktywnego HTML Supabase: **UNKNOWN**.
- Tożsamość bajtowa aktywnego tematu Supabase: **UNKNOWN**.
- Konfiguracja automatycznych wdrożeń Git–Vercel: **NOT INDEPENDENTLY VERIFIED**.
- Zgodność lokalnego pliku z manifestem nie dowodzi zgodności z aktywną konfiguracją Supabase.

## F. Polityka wdrożeń

Według deklaracji właściciela wdrożenia są obecnie wykonywane ręcznie z PowerShell przez Vercel CLI. Deklaracja nie dowodzi wyłączenia platformowych lub zewnętrznych triggerów. Commit ani push nie udziela zgody na produkcyjne wdrożenie; rzeczywista konfiguracja platformy nadal obowiązuje. To zadanie przygotowawcze nie autoryzuje żadnego wdrożenia.

## G. Wyłączenia

Zakres wyklucza AUTH-U13.3A, PF-04, historię lokalnego main po rozgałęzieniu, osobne repozytorium `omninauka-web`, prywatne backupy Supabase, podglądowe HTML e-maila, screenshoty, scratch i inne pliki tymczasowe, sekrety oraz pliki środowiskowe.

## H. Rozbieżność historii Git

B jest bezpośrednio jeden commit po ostatnio zweryfikowanym remote main R. Względem R zawiera 16 zmienionych plików prezentacji marketingowej. To znana różnica historii wydania.

Pięcioplikowy zakres B2 jest liczony względem B. Nie oznacza pięcioplikowego przyszłego PR względem main R: przy niezmienionej bazie PR obejmowałby także 16 plików prezentacji. Ten etap nie synchronizuje remote main ani nie zatwierdza szerszego PR.

## I. Wskazówki odtworzenia i wycofania

Hashe manifestu służą do wykrywania driftu zatwierdzonych artefaktów. Nie certyfikują pełnej odtwarzalności deploymentu, konfiguracji czasu budowania ani aktywnego szablonu Supabase.

Każdy przyszły rollback wymaga osobnej zgody. Przed zmianą aliasu lub uruchomieniem rollbacku trzeba ustalić dokładny aktywny deployment Vercel. Backup poprzedniego szablonu Supabase Auth jest przechowywany poza repozytorium; prywatnych backupów nigdy nie należy dodawać do Git.

## J. Stan dokumentu

**Historyczny checkpoint B2 (2026-10-21): SOURCE ARTIFACTS PREPARED — NOT COMMITTED — NOT DEPLOYED FROM THIS WORKTREE**

Pliki przygotowano lokalnie w B2. W punkcie kontrolnym B2 (2026-10-21) nie były jeszcze zatwierdzone ani wdrożone z tego worktree. Build, testy i niezależny przegląd były proponowanym osobnym Task B3; nie wykonano ich w B2. To zapis historyczny, nie wskaźnik bieżącego statusu. Późniejsze utrwalenie w Git samo w sobie nie oznacza wdrożenia produkcyjnego. W ramach zadań B1–B4.1 nie wykonano wdrożenia z tego worktree.
