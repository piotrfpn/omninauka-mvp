# Backend Usage Limits MVP (Sprint 29C.1A)

Ten dokument opisuje kontrakt ograniczeń użycia funkcji AI w lokalnym kodzie backendu (Edge Functions) projektu OmniNauka. Wdrożenie i zgodność produkcyjnej bazy wymagają osobnej walidacji.

## Architektura śledzenia użycia

Użycie jest śledzone za pomocą tabeli `public.usage_events`. RPC `check_and_reserve_ai_usage` wykonuje COUNT i INSERT rezerwacji pod `pg_advisory_xact_lock` w jednej transakcji, przed wywołaniem Google Vision/OpenAI. Klucz blokady obejmuje użytkownika, typ operacji oraz dzień UTC lub sesję. Współbieżność tego kontraktu wymaga testów PostgreSQL; lokalne testy statyczne nie potwierdzają jej wykonania.

Po zatwierdzeniu RPC definitywne błędy Storage, OCR, odpowiedzi providera, parsowania lub zapisu wyników uruchamiają **best-effort release/cleanup of the exact reservation row**: osobny DELETE po `id` rezerwacji i `user_id`. To nie jest rollback zatwierdzonej transakcji RPC. Handler czeka na próbę cleanup, jawnie sprawdza zwrócony błąd DB i loguje niepowodzenie bez zastępowania pierwotnego błędu. Sukces pozostawia użycie naliczone.

**Residual MVP risk:** twardy crash Edge Function/procesu po zatwierdzeniu rezerwacji, ale przed cleanup, może zużyć jeden slot limitu. Nieudany DELETE również może pozostawić naliczoną rezerwację; release jest best-effort.

### Rodzaje zdarzeń:
- `lesson_analysis`: Zapisywane atomowo przed właściwym wywołaniem AI dla OCR i analizy w `analyze-notes`.
- `flashcard_regen`: Zapisywane atomowo w trakcie generacji nowych fiszek.
- `quiz_regen`: Zapisywane atomowo w trakcie generacji nowych sprawdzianów.
- `tutor_message`: Zapisywane przez `chat-tutor`.

## Zasady wyliczania planu

Backend wylicza **efektywny plan** użytkownika na podstawie danych z tabeli `profiles`:
- `premium` / `family`: Aktywne tylko, jeśli `plan_expires_at` jest w przyszłości (lub jest puste w przypadku ręcznego zarządzania).
- `free`: Jeśli plan to `free`, plan wygasł, lub brak informacji o planie.

Niezależnie od żądań klienta, do mechanizmu limitów używany jest zawsze plan serwerowy (normalized fallback -> free).

## Limity Funkcji

### 1. Analiza Lekcji (`analyze-notes`)
Limit liczony jest na podstawie liczby eventów `lesson_analysis` z dzisiejszego dnia (UTC).

| Plan | Limit dzienny |
| :--- | :--- |
| **Free** | 2 lekcje / dobę |
| **Premium / Family** | 10 lekcji / dobę (fair use) |

### 2. Regeneracja Fiszek (`regenerate-module`)
Limit liczony jest na podstawie liczby eventów `flashcard_regen` w ramach konkretnej sesji nauki (`session_id`).

| Plan | Limit regeneracji na sesję | Max liczba fiszek |
| :--- | :--- | :--- |
| **Free** | 1 dodatkowa seria | 5 fiszek |
| **Premium / Family** | 5 dodatkowych serii | 20 fiszek |

*Uwaga: Backend wymusza limit liczby fiszek twardym obcięciem listy wygenerowanej przez AI.*

### 3. Regeneracja Sprawdzianu (Quiz) (`regenerate-module`)
Limit liczony jest na podstawie eventów `quiz_regen` w ramach sesji nauki (`session_id`).

| Plan | Limit regeneracji na sesję |
| :--- | :--- |
| **Free** | 1 dodatkowy sprawdzian |
| **Premium / Family** | 5 dodatkowych sprawdzianów |

### 4. AI Tutor (`chat-tutor`)
Limit liczony jest na podstawie liczby eventów `tutor_message`.

| Plan | Limit na lekcję | Limit dzienny | Wersja |
| :--- | :--- | :--- | :--- |
| **Free** | 10 wiadomości | 20 wiadomości | Podstawowy (krótki kontekst) |
| **Premium/Family**| 50 wiadomości | 100 wiadomości | Zaawansowany (długi kontekst) |

## Obsługa błędów

W przypadku osiągnięcia limitu Edge Function odrzuca operację przed wywołaniem płatnego AI. Dla analizy i regeneracji tylko jawne `allowed=false`, `error=usage_limit_reached`, właściwy `feature`, skończony liczbowy `limit` i niepusty tekst `message` pozwalają zwrócić **403 Forbidden**:

```json
{
  "error": "usage_limit_reached",
  "feature": "ai_lessons" | "flashcard_regen" | "quiz_regen" | "ai_tutor",
  "limit": number,
  "plan": "free" | "premium" | "family",
  "message": "Czytelny komunikat dla użytkownika"
}
```

Zgoda guarda wymaga obiektu z `allowed=true` i poprawnym UUID `reservation_id`. Błąd DB, wyjątek RPC albo niepoprawny/niejednoznaczny wynik zwracają **503** z `{ "error": "usage_guard_unavailable" }`, bez wywołania providera i bez ujawniania szczegółów DB. QuizPage pokazuje tekst `message` wyłącznie dla 403 z `error=usage_limit_reached`; pozostałe błędy zachowują ogólną obsługę.

Migracja 00075 obejmuje zmianę constraintu, RPC i ACL w `BEGIN/COMMIT`. Nie należy jej wykonywać bez read-only precheck fizycznego schema, istniejących event types i overloads; migration-history drift nie jest rozwiązany przez tę zmianę.

## Fair Use Policy i Zasady Prawne
Plany Premium i Family nie są określane jako "nielimitowane" ani "nieograniczone". Wyższe limity są dobrane tak, aby zapewniały komfortową naukę, jednocześnie chroniąc projekt przed nadużyciami i niekontrolowanymi kosztami API.
