# Checkpoint: Sprint PF-03 & PF-03.1

Dokument podsumowujący audyt jakościowy mobile/tablet (PF-03) oraz wdrożenie pakietu poprawek UX/UI (PF-03.1) na środowisku produkcyjnym OmniNauka.

---

## 1. Sprint PF-03: Final Mobile + Tablet QA Audit

- **Status:** `CLOSED / AUDIT PASS`
- **Typ audytu:** Kompleksowy audyt read-only UX/UI i kluczowych ścieżek użytkownika.
- **Wyniki:**
  - **0 blockerów** (zero problemów uniemożliwiających ukończenie kluczowych flow).
  - Główne flow na telefonach i tabletach (Auth, Dashboard, Upload, AI Tutor, Quiz, Flashcards, History, Parent, Legal, Settings) stabilne.
  - **Przetestowane viewporty:**
    - `390×844` (iPhone portrait)
    - `412×915` (Android standard)
    - `768×1024` (iPad portrait)
    - `1024×1366` (iPad Pro portrait)
    - `1280×800` (Tablet landscape)
  - **Motywy:** Pełna weryfikacja w trybie jasnym (Light) i ciemnym (Dark).
  - **Bramki techniczne:**
    - `npm run build`: PASS
    - `npm run lint`: PASS (baseline 179 błędów / 16 ostrzeżeń, 0 regresji)
    - `git diff --check`: PASS
    - Czyste drzewo robocze (`working tree clean`) przed rozpoczęciem PF-03.1.

---

## 2. Sprint PF-03.1: Mobile/Tablet Polish Hotfix

- **Status:** `CLOSED / PRODUCTION PASS`
- **Commit:** `392e026`
- **Commit Message:** `fix: polish mobile and tablet UX`
- **Charakterystyka:** Mały, lokalny hotfix bez zmian w architekturze, bez nowych funkcji i bez modyfikacji mechanizmów autoryzacji.

### Zrealizowany zakres:
1. **History — usunięcie poziomego overflow na 1024px:**
   - W `src/components/layout/app-shell.tsx` dodano `min-w-0` do elementu `<main>`.
   - W `src/pages/app/HistoryPage.tsx` zmieniono breakpoint 4 kolumn statystyk: `grid-cols-2 lg:grid-cols-4` $\rightarrow$ `grid-cols-2 xl:grid-cols-4`.
   - Wynik: `document.documentElement.scrollWidth <= document.documentElement.clientWidth` (overflow = 0px na 1024×1366).
2. **History — powiększenie touch targets wyszukiwarki i sortowania:**
   - Wysokość inputa wyszukiwania oraz kontrolki select sortowania zwiększona do `h-11` (~44px).
3. **History — powiększenie touch target akcji folderu:**
   - Hit-area przycisku usuwania folderu powiększona do `min-w-[40px] min-h-[40px]` (p-2.5) z zachowaniem ikony 14px i logiki potwierdzenia.
4. **Login — powiększenie przełącznika widoczności hasła:**
   - Hit-area przycisku oka w `LoginPage.tsx` powiększona do `w-11 h-11` (44×44px), ikona SVG zachowana na 20×20px, dodano `aria-label`.
5. **Upload — powiększenie przycisku usuwania miniatury:**
   - Hit-area przycisku usuwania miniatury w `UploadPage.tsx` powiększona z ~28px do minimum 40–42px (`w-10 h-10`), zachowano oryginalny rozmiar okrągłego badge'a (28px) i ikony (16px).
6. **AI Tutor — ujednolicenie terminologii:**
   - W `LessonPage.tsx` zmieniono nazwę nagłówka modułu: „Lekcja z AI” $\rightarrow$ „AI Tutor” (zarówno w `MockLessonChat`, jak i `RealLessonChat`).
   - Zachowano jednostki rozliczeniowe „lekcja AI” w cennikach (`PaymentsPage`) zgodnie z regułą nienaruszania jednostek limitu.
7. **Flashcards — pełne i18n na rewersie:**
   - W `FlashcardsPage.tsx` zastąpiono zahardkodowany ciąg „Kliknij, by odwrócić” kluczem `{t('flashcards.card.clickToFlip')}`.

### Stan produkcyjny:
- **Środowisko:** Vercel Production
- **Status deploymentu:** `READY`
- **Alias produkcyjny:** `https://omninauka-mvp.vercel.app`
- **Metoda wdrożenia:** Zaakceptowany workflow manualnego wdrożenia (`npx vercel --prod`) przeprowadzony pomyślnie.

---

## 3. Bramki Techniczne (Technical Gates)

- **`npm run build`:** `PASS` (kod 0, poprawna generacja bundle'a i Service Workera PWA).
- **`git diff --check`:** `PASS` (kod 0, brak problemów z whitespace, line endings czy konfliktami).
- **`npm run lint`:** `PASS` (baseline zachowany: 179 błędów / 16 ostrzeżeń w backendowych funkcjach Supabase, 0 regresji).
- **`LINT_REGRESSION_GATE`:** `PASS`

---

## 4. Known & Deferred Issues / Decyzje Projektowe

### 1. Tło logowania (Login Background Transition)
- **Status:** `DEFERRED`
- **Obserwacja:** Nowe tło logowania na `/login` może być widoczne przez krótką chwilę podczas ładowania, a następnie wizualnie znikać / ulegać zmianie.
- **Uwaga:** Przyczyna nie została definitywnie potwierdzona. Możliwa interakcja pomiędzy przekierowaniem sesji, inicjalizacją motywu a renderowaniem pozostaje wyłącznie hipotezą roboczą. Kwestia odłożona na późniejszy etap.

### 2. Stan sesji demo po twardym odświeżeniu (Demo Session After Hard Refresh)
- **Status:** `DEFERRED`
- **Obserwacja:** Tryb demo jest tracony po twardym odświeżeniu strony (hard refresh), ponieważ stan nie jest utrwalany w trwałym magazynie.
- **Decyzja:** Zgodnie z wytycznymi, nie modyfikowano `auth-context.tsx`.

### 3. Favicon SVG
- **Status:** `REJECTED AS ISSUE`
- **Decyzja:** Obecna konfiguracja favicon w formatach PNG/ICO (`apple-touch-icon.png`, ikony PWA, `favicon.ico`) jest w pełni zamierzona po wdrożeniu assetów PWA. Wymóg favicon SVG został formalnie odrzucony i nie będzie reintrodukowany.

### 4. Automatyczny Deploy Vercel (INFRA-01B)
- **Status:** `INFRA-01B = DEFERRED / MANUAL DEPLOY WORKFLOW ACCEPTED`
- **Zaakceptowany proces:**
  1. Commit zmian lokalnie
  2. Push do gałęzi `main` na GitHubie
  3. Weryfikacja czystego stanu drzewa roboczego (`git status` clean)
  4. Weryfikacja zgodności `HEAD == origin/main`
  5. Ręczne wywołanie produkcyjnego wdrożenia: `npx vercel --prod`
  6. Weryfikacja statusu wdrożenia Vercel: `READY` oraz przypisania aliasu produkcyjnego `omninauka-mvp.vercel.app`
- **Decyzja:** Rekonfiguracja integracji GitHub-Vercel nie była podejmowana w sprincie dokumentacyjnym.

---

## 5. Następny Krok: Sprint PF-04

- **Nazwa:** `PF-04 — First Real User Testing`
- **Rekomendowany cel sprintu:**
  Przeprowadzenie pierwszych testów z udziałem realnych użytkowników (uczniów i rodziców) oraz rejestracja:
  - Miejsc, w których użytkownicy się wahają (where they hesitate)
  - Elementów, pojęć i mechanizmów, których nie rozumieją (what they do not understand)
  - Błędnych lub niespodziewanych decyzji nawigacyjnych (wrong or unexpected navigation choices)
  - Niejasnych wezwań do działania (unclear CTA)
  - Punktów tarcia i oporu w kluczowych ścieżkach: Upload $\rightarrow$ Analiza $\rightarrow$ AI Tutor $\rightarrow$ Quiz $\rightarrow$ Historia
  - Problemów z ergonomią i użytecznością na telefonach i tabletach, które nie zostały ujawnione podczas automatycznego audytu QA.
