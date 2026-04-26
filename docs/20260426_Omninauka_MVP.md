# OmniNauka MVP — Sprint 13 Beta-Ready Checkpoint

**Data:** 2026-04-26  
**Status:** ✅ Beta-Ready  
**Tag:** `mvp-sprint-13-beta-ready-20260426`

---

## Opis projektu

OmniNauka to platforma do nauki wspomagana przez AI, która pozwala użytkownikom:
- Wgrywać zdjęcia notatek (OCR + AI analiza)
- Uczyć się z fiszek (Flashcards)
- Sprawdzać wiedzę quizem (Quiz)
- Rozmawiać z AI Tutorem (Lekcja z AI / chat-tutor)
- Organizować sesje nauki w folderach hierarchicznych

---

## Stack technologiczny

| Warstwa | Technologia |
|---|---|
| Frontend | React 18 + Vite + TypeScript |
| Styling | Tailwind CSS + shadcn/ui + Vanilla CSS vars |
| Backend | Supabase (PostgreSQL + Auth + Storage) |
| AI | OpenAI GPT-4o (Edge Functions) |
| Edge Functions | Supabase Deno runtime |
| Hosting — Frontend | Vercel (CI/CD z GitHub) |
| Hosting — Backend | Supabase Cloud (`uskalizgrpjqhujzzydh`) |

---

## Ukończone sprinty

### Sprint 1–2: Fundament i Multi-Image Upload
- Upload zdjęć notatek (kompresja, kadrowanie)
- Sesje wielozdjęciowe (`session_images`)
- OCR + analiza AI (Edge Function: `analyze-notes`)

### Sprint 3–4: Analiza i Flashcards
- Strona analizy (`AnalysisPage`) z kluczowymi pojęciami
- Fiszki z animacją flip, sesjami nauki
- Drawer szczegółów pojęcia (`ConceptDetailSheet`)

### Sprint 5–6: Quiz i AI Tutor
- Quiz z randomizacją opcji, trybem single_choice / true_false
- Persystencja postępu quizu w localStorage
- Regeneracja quizu / modułów (Edge Function: `regenerate-module`)
- AI Tutor — chat z GPT-4o (Edge Function: `chat-tutor`)
- Streaming odpowiedzi, kontekst sesji

### Sprint 7–8: Historia, Foldery, Routing
- Hierarchiczny eksplorator folderów (`HistoryPage`)
- Przenoszenie sesji między folderami
- Context-aware routing (`/app/lesson/:id`, `/app/quiz/:id`, `/app/flashcards/:id`)
- SPA routing + Vercel rewrite

### Sprint 9–10: Sidebar, Kontekst, Nawigacja
- Dynamiczny sidebar z aktywnym ID sesji
- Przejście Tutor → Quiz → Flashcards z zachowaniem kontekstu
- Chip nawigacyjny "🎯 Przejdź do quizu" w AI Tutorze

### Sprint 11–12: Settings, Dark Mode, UX Polish
- Ciemny motyw (dark mode toggle, `localStorage`, CSS class `dark`)
- Dark mode dla: sidebar, nagłówki, karty, inputy, fiszki, quiz, analiza, lekcja, profil, ustawienia
- Responsywność mobile — stabilny layout, brak overflow

### Sprint 13: Security Hardening + Beta Polish

#### 13A — Security: `chat-tutor` Edge Function
- Walidacja tablicy `messages` (max 30 wiadomości, max 4000 znaków)
- Okno kontekstu: tylko ostatnie 8 wiadomości do OpenAI
- Sanityzacja `context` (topic, summary, key_concepts)
- System Prompt Guard — ochrona przed prompt injection
- Limit rozmiaru payloadu: 20 000 znaków łącznie
- Deploy: `chat-tutor` v25 ACTIVE ✅

#### 13B — Dark Mode Contrast Polish
- `SettingsPage` — "Zakończ sesję", "Usuń konto" — czytelne w dark mode
- `FlashcardsPage` — badge "Pojęcie"/"Definicja", przyciski nawigacji, "Nie wiem"/"Znam"
- `AnalysisPage` — stats footer (Pojęć/Fiszek/Pytań), separator
- `LessonPage` — header, bańki AI, composer, chipy akcji, quiz chip
- `QuizPage` — opcje A/B/C/D, badge literowe, stany correct/wrong, feedback panel
- `ProfilePage` — wiersze "Ostatnie logowanie", "Status konta", badge "Aktywne"

---

## Aktywne Edge Functions (Supabase)

| Nazwa | Status | Wersja | Opis |
|---|---|---|---|
| `analyze-notes` | ACTIVE | — | OCR + AI analiza notatek |
| `chat-tutor` | ACTIVE | v25 | AI Tutor chat z prompt injection guard |
| `delete-session` | ACTIVE | — | Usuwanie sesji + plików ze storage |
| `regenerate-module` | ACTIVE | — | Regeneracja quizu / fiszek przez AI |

---

## Baza danych Supabase

Kluczowe tabele w schemacie `public`:

| Tabela | Opis |
|---|---|
| `study_sessions` | Główna tabela sesji nauki |
| `session_images` | Zdjęcia powiązane z sesją |
| `tutor_threads` | Wątki czatu AI Tutora |
| `tutor_messages` | Wiadomości czatu AI Tutora |
| `folders` | Hierarchiczne foldery organizacyjne |

RLS (Row Level Security) aktywny na wszystkich tabelach.

---

## Konfiguracja środowiska

### Vercel (frontend)
- Auto-deploy z GitHub `main`
- SPA routing via `vercel.json` rewrite (`/*` → `/index.html`)
- Zmienne środowiskowe: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`

### Supabase (backend)
- Projekt: `uskalizgrpjqhujzzydh`
- Auth: email/password (Supabase Auth)
- Storage: bucket `session-images`
- Edge Functions: zmienne `OPENAI_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY`

---

## Znane ograniczenia (poza zakresem beta)

| # | Ograniczenie | Priorytet |
|---|---|---|
| 1 | Brak logowania przez Google/OAuth | Wysoki — Sprint 14 |
| 2 | Duże chunki JS (UploadPage ~1 MB) | Średni — `manualChunks` |
| 3 | Supabase CLI `v2.89.1` (dostępne `v2.90.0`) | Niski |
| 4 | Demo mode ograniczony do lokalnego sessionStorage | Niski |

---

## Wyniki ostatniego buildu

```
✓ built in ~11s
Exit code: 0
```

Wszystkie chunki skompilowane bez błędów TypeScript.  
Ostrzeżenie o rozmiarze chunka (UploadPage > 500 kB) — nieblokujące.

---

## Linki

- **GitHub:** `https://github.com/piotrfpn/omninauka-mvp`
- **Produkcja (Vercel):** deploy z `main` branch
- **Supabase Dashboard:** `https://supabase.com/dashboard/project/uskalizgrpjqhujzzydh`

---

*Dokument wygenerowany automatycznie jako część checkpointu Sprint 13.*
