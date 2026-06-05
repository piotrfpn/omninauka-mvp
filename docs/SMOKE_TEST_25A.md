# Smoke Test Checklist - Sprint 25A

Przeprowadź poniższe testy na następujących platformach/środowiskach:
- [ ] Desktop Chrome (Vercel production / omninauka.pl)
- [ ] Mobile Chrome (Vercel production / omninauka.pl)
- [ ] Safari iOS (opcjonalnie, ale mocno zalecane)

## Scenariusze Testowe (Core User Journeys):

### 1. Dostępność i Branding
- [ ] Strona startowa ładuje się poprawnie (brak błędów 404/500).
- [ ] W zakładce przeglądarki widnieje poprawny tytuł (`OmniNauka — Korepetytor AI dla uczniów`) i nowy favicon OmniNauki (nie ma śladów po Vite).

### 2. Uwierzytelnianie
- [ ] Rejestracja nowego użytkownika przechodzi poprawnie.
- [ ] Logowanie istnieje i poprawnie przekierowuje do głównego panelu.

### 3. Główne Funkcjonalności
- [ ] Załadowanie / wyświetlenie Dashboardu (Panel Główny) z poprawnymi danymi konta.
- [ ] Upload materiału (np. zdjęcie, PDF) - proces wgrywania kończy się sukcesem.
- [ ] Wyświetlanie AI Tutora / uruchomienie czatu z nauczycielem AI.
- [ ] Generowanie podsumowania lekcji.
- [ ] Quiz / Sprawdzian - poprawne załadowanie i przejście.
- [ ] Wyniki / Raport po rozwiązaniu quizu.
- [ ] Fiszki - przeglądanie i obracanie.

### 4. Konta i Ustawienia
- [ ] Historia (widok przeszłych lekcji / wgranych materiałów).
- [ ] Widok profilu użytkownika.
- [ ] Ustawienia konta.
- [ ] Panel Rodzica (weryfikacja czy strona się ładuje i zachowuje obecną logikę).

### 5. Aspekty Prawne i Płatności
- [ ] Widok Płatności ładuje się poprawnie (brak błędów frontendu).
- [ ] Zgody Prawne / Regulamin / Polityka Prywatności / Cookies ładują się bez błędów.
- [ ] Wyświetla się poprawnie AI Disclaimer.
