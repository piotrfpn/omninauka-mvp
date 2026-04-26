# Założenia: Limity Produktowe OmniNauka (v02)

*Data: 2026-04-26*
*Status: Projekt koncepcyjny produktu / Draft planowania*
*UWAGA: Niniejszy dokument nie stanowi oferty handlowej ani ostatecznej specyfikacji technicznej.*

## 1. Cel limitów
Wprowadzenie limitów w OmniNauka ma na celu:
- Zapewnienie stabilności platformy.
- Kontrolę kosztów związanych z API AI (OpenAI, Google OCR).
- Umożliwienie sprawiedliwego dostępu dla wszystkich użytkowników (Fair Use).
- Budowę zrównoważonego modelu biznesowego.

## 2. Definicja "Lekcji AI"
1 Lekcja AI to jednostka rozliczeniowa wewnątrz aplikacji, obejmująca:
- Analizę wsadu (OCR/Vision): do 5 zdjęć (JPG/PNG) LUB 1 dokument tekstowy (PDF/DOCX).
- Wygenerowanie podsumowania, kluczowych pojęć i fiszek.
- Dostęp do AI Tutora w kontekście danego materiału.
- Możliwość wygenerowania quizu/sprawdzianu.

## 3. Plany i limity (Założenia)

### 3.1. Plan Darmowy (Free)
- **Limit dzienny:** 2 Lekcje AI.
- **Odnowienie:** Codziennie o północy.
- **Funkcje:** Podstawowy AI Tutor (tekstowy), quizy, historia nauki.
- **Dodatkowe lekcje:** Możliwość dokupienia pojedynczych lekcji.

### 3.2. Plan Premium
- **Limit dzienny:** 10 Lekcji AI (zależnie od wariantu subskrypcji).
- **Funkcje:** Zaawansowany AI Tutor, powtórki błędów, wyższa jakość odpowiedzi.
- **Pojemność:** Przechowywanie większej liczby sesji.

### 3.3. Plan Premium+ (Egzaminy)
- **Limit dzienny:** Zwiększony (np. 15 lekcji).
- **Funkcje:** Wszystko z Premium + Dostęp do modułów egzaminacyjnych (Ósmoklasista, Matura).
- **Zadania:** Dedykowane generatory zadań w stylu CKE.

### 3.4. Plan Rodzinny (Family)
- **Podział:** Wspólna pula lekcji lub dedykowane limity dla każdego z kont (do 3 kont uczniowskich).
- **Zarządzanie:** Panel rodzica do monitorowania zużycia.

### 3.5. Plan Szkoła/JST (Wkrótce)
- **Model:** Subskrypcja grupowa.
- **Zarządzanie:** Panel administratora szkoły, limity na poziomie placówki lub klasy.

## 4. Zasada Fair Use (Uczciwe Korzystanie)
Nawet w planach oznaczonych jako o wyższych limitach, obowiązuje polityka Fair Use:
- Zakaz automatyzacji zapytań przez skrypty.
- Zakaz masowego wgrywania materiałów w celu destabilizacji usługi.
- Limity techniczne na liczbę wiadomości w ramach jednego czatu AI Tutora (np. 50-100 wiadomości na sesję).

## 5. Dodatkowe Lekcje AI
Użytkownik, który wyczerpie swój limit dzienny, może:
- Poczekać do kolejnego dnia.
- Dokupić pakiet dodatkowych lekcji (np. 5, 10, 25 lekcji).
- Dodatkowe lekcje nie wygasają z końcem dnia (są kumulatywne).

## 6. Przyszłe egzekwowanie techniczne
- Wdrożenie liczników w bazie danych (Supabase).
- Blokada przycisku "Analizuj" po przekroczeniu limitu.
- Powiadomienia w aplikacji o zbliżaniu się do limitu.
