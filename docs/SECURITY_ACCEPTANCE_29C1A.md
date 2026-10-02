# Sprint 29C.1A-FIX — Atomic AI Usage Guard — Acceptance

## Zakres lokalny

Naprawa ustaleń H1–H3, M1–M4 i L1–L3 z niezależnego review. Ten dokument opisuje kontrakt kodu i testów lokalnych. Nie potwierdza wdrożenia, aktualnego schema ani wykonania migracji na produkcji.

## Rezerwacja i limity

RPC `check_and_reserve_ai_usage(uuid, uuid, text, text)` wykonuje COUNT i pojedynczy INSERT pod transakcyjnym advisory lock, przed pierwszym płatnym provider call:

| Event | Free | Premium / Family | Bucket |
| --- | --- | --- | --- |
| lesson_analysis | 2 | 10 | użytkownik + dzień UTC + event |
| flashcard_regen | 1 | 5 | użytkownik + sesja + event |
| quiz_regen | 1 | 5 | użytkownik + sesja + event |

Nieznany plan jest normalizowany do free. Właściciel sesji jest sprawdzany w Edge oraz RPC. Unauthorized, niedozwolony account_status, brak sesji, ownership mismatch i już przeanalizowana lekcja kończą odpowiednie ścieżki przed rezerwacją. Regeneracja sprawdza również moduł i obecność OCR.

Migracja 00075 ma BEGIN/COMMIT, SECURITY DEFINER, SET search_path=public, REVOKE dla PUBLIC/anon/authenticated oraz GRANT EXECUTE dla service_role. Constraint zawiera wyłącznie lesson_analysis, flashcard_regen, tutor_message i quiz_regen. Istniejący tutor nie jest zmieniany.

## Fail closed

- Allowed: obiekt, allowed=true, reservation_id będący poprawnym UUID.
- Limit: allowed=false, error=usage_limit_reached, właściwy feature, skończony liczbowy limit i niepusty tekst message → 403.
- Błąd DB, wyjątek RPC i każdy niepoprawny/niejednoznaczny wynik → 503 usage_guard_unavailable, bez provider call i bez szczegółów DB w odpowiedzi.
- QuizPage pokazuje wiadomość limitu tylko przy dokładnym 403 + usage_limit_reached. Pozostałe błędy zachowują ogólną obsługę.

## Cleanup

Definitywne błędy po rezerwacji wykonują **best-effort release/cleanup of the exact reservation row**: DELETE ograniczony do reservation_id oraz authenticated user_id, z oczekiwaniem na wynik przed odpowiedzią. Obejmuje to bezpośrednie zwroty błędów Storage, Vision, pustego OCR, błędów OpenAI/parsowania, a także wyjątki transportowe i błędy zapisu DB. Zwrócony error i wyjątek cleanup są logowane; pierwotny błąd pozostaje odpowiedzią operacji. Sukces zachowuje naliczone użycie.

Cleanup jest osobną operacją po zatwierdzonym RPC. Nie jest transactional rollback.

**Residual MVP risk:** twardy crash Edge Function/procesu po zatwierdzeniu rezerwacji, ale przed cleanup, może zużyć jeden slot limitu. Błąd DELETE także może pozostawić rezerwację naliczoną. Nie ma automatycznego odzyskiwania slotu po takim zdarzeniu.

## Dowody lokalne i granice

`tests/ai-usage-guard.test.mjs` wykonuje rzeczywiste handlery z mockami Auth, DB i providerów oraz akcję QuizPage w izolacji. Sprawdza kolejność reserve/provider, błędy guarda, wszystkie wskazane bezpośrednie zwroty analizy, dokładne filtry i pojedyncze wywołanie DELETE, logowanie błędów cleanup, zachowanie pierwotnego błędu oraz brak cleanup przy sukcesie.

Statyczne testy SQL sprawdzają limity, normalizację planu, ACL, ownership, klucze locków i kolejność COUNT/INSERT. Nie wykonują PostgreSQL; nie dowodzą runtime ACL ani faktycznej współbieżności. Docker nie jest wymagany. Osobno należy uruchomić testy account-security ze Sprintu 29B.

## Walidacja przed wdrożeniem — nadal wymagana

1. Read-only precheck fizycznego schema, kolumn/defaults/indeksów, event types, overloads i ACL.
2. Testy RPC jako anon, authenticated i service_role na zatwierdzonym środowisku testowym.
3. Równoległe requesty dla wszystkich limitów, z kontrolą izolacji PostgREST i liczby rezerwacji/provider calls.
4. Native Deno/SDK check oraz Browser QA komunikatu quizu.
5. Uzgodniona procedura wdrożenia pojedynczej migracji z uwzględnieniem migration-history drift.

Ten sprint nie uruchamia migracji, deployu ani zapisów produkcyjnych.
