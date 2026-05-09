# Backend Usage Limits MVP (Sprint 20B.1)

Ten dokument opisuje techniczne ograniczenia użycia funkcji AI wdrożone na backendzie (Edge Functions) projektu OmniNauka.

## Architektura śledzenia użycia

Użycie jest śledzone za pomocą tabeli `public.usage_events`. Zdarzenia są zapisywane wyłącznie po **pomyślnym** zakończeniu operacji AI.

### Rodzaje zdarzeń:
- `lesson_analysis`: Zapisywane po udanym OCR i analizie lekcji w `analyze-notes`.
- `flashcard_regen`: Zapisywane po udanej regeneracji fiszek w `regenerate-module`.

## Zasady wyliczania planu

Backend wylicza **efektywny plan** użytkownika na podstawie danych z tabeli `profiles`:
- `premium` / `family`: Aktywne tylko, jeśli `plan_expires_at` jest w przyszłości (lub jest puste w przypadku ręcznego zarządzania).
- `free`: Jeśli plan to `free`, plan wygasł, lub brak informacji o planie.

## Limity Funkcji

### 1. Analiza Lekcji (`analyze-notes`)
Limit liczony jest na podstawie liczby eventów `lesson_analysis` z dzisiejszego dnia (UTC).

| Plan | Limit dzienny |
| :--- | :--- |
| **Free** | 2 lekcje / dobę |
| **Premium** | 10 lekcji / dobę (fair use) |
| **Family** | 10 lekcji / dobę (fair use) |

### 2. Regeneracja Fiszek (`regenerate-module`)
Limit liczony jest na podstawie liczby eventów `flashcard_regen` w ramach konkretnej sesji nauki (`session_id`).

| Plan | Limit regeneracji na sesję | Max liczba fiszek |
| :--- | :--- | :--- |
| **Free** | 1 dodatkowa seria | 5 fiszek |
| **Premium** | 5 dodatkowych serii | 20 fiszek |
| **Family** | 5 dodatkowych serii | 20 fiszek |

*Uwaga: Backend wymusza limit liczby fiszek nawet jeśli model AI wygeneruje ich więcej.*

## Obsługa błędów

W przypadku osiągnięcia limitu, Edge Function zwraca status **403 Forbidden** z następującym JSONem:

```json
{
  "error": "usage_limit_reached",
  "feature": "ai_lessons" | "flashcard_regen",
  "limit": number,
  "plan": "free" | "premium",
  "message": "Czytelny komunikat dla użytkownika"
}
```

Frontend obsługuje ten błąd, wyświetlając odpowiedni komunikat oraz przycisk przekierowujący do `/app/payments`.

## Fair Use Policy

Plany Premium i Family nie są określane jako "nielimitowane". Wyższe limity są dobrane tak, aby zapewniały komfortową naukę (10 lekcji dziennie to bardzo duża dawka materiału), jednocześnie chroniąc projekt przed nadużyciami i niekontrolowanymi kosztami API.

## Plany na Sprint 20B.2
- Wdrożenie limitów dla `chat-tutor`.
- Uszczelnienie weryfikacji profilu w `chat-tutor`.
