# OmniNauka — Scenariusze i procedury testów z użytkownikami (User Test Scenario Pack)

Dokument zawiera kompletny pakiet materiałów niezbędnych do przeprowadzenia i podsumowania pierwszych testów OmniNauka z użytkownikami (uczniami oraz rodzicami).

---

## 1. Wprowadzenie i zasady bezpieczeństwa

### Cel testów
1. Sprawdzenie, czy użytkownicy intuicyjnie rozumieją wartość edukacyjną OmniNauki.
2. Weryfikacja łatwości nawigacji (ze szczególnym uwzględnieniem wersji mobilnej).
3. Ocena kluczowych flow: rejestracji, dodawania notatek (upload), interakcji z AI Tutorem, rozwiązywania quizów oraz interpretacji raportów i cennika.

### Zasady ochrony danych (RODO) i bezpieczeństwa
* **BEZ DANYCH WRAŻLIWYCH**: Nie wolno pytać o stan zdrowia, trudności rozwojowe, diagnozy psychologiczno-pedagogiczne ani o szczegółową sytuację rodzinną uczestników.
* **MASKOWANIE DANYCH**: W raportach i notatkach nie mogą pojawiać się imiona, nazwiska ani prywatne dane dzieci. Należy stosować identyfikatory, np. `Uczestnik_01_Student` lub `Uczestnik_02_Parent`.
* **BEZPIECZEŃSTWO KONT**: Nie wpisuj ani nie zapisuj haseł kont testowych w raportach ani w plikach tekstowych.

---

## 2. Instrukcja dla moderatora testu

Rola moderatora polega na obserwowaniu naturalnego zachowania użytkownika. Należy przestrzegać poniższych reguł:

1. **Brak szkolenia wstępnego**: Nie tłumaczyć, jak działa aplikacja, przed rozpoczęciem testu. Aplikacja musi bronić się sama.
2. **Technika głośnego myślenia**: Poproś użytkownika: *„Proszę, mów na głos wszystko, co myślisz, co planujesz zrobić, co widzisz na ekranie i co Cię zaskakuje”*.
3. **Nie sugeruj rozwiązań**: Na pytania użytkownika typu *„Czy mam to kliknąć?”*, odpowiadaj: *„A jak myślisz? Czego się spodziewasz po tym przycisku?”*.
4. **Pomoc w ostateczności**: Pomóż dopiero wtedy, gdy użytkownik utknie na dłużej niż 1-2 minuty lub poczuje narastającą frustrację. Zapisz ten fakt jako błąd krytyczny (Blocker / High).
5. **Czas sesji**: Całość powinna zamknąć się w czasie **20–30 minut**, aby nie przemęczyć uczestnika.

---

## 3. Pytania przed testem (Pre-Test Interview)

### Dla ucznia
* Ile masz lat i do której klasy chodzisz?
* Z jakich materiałów najczęściej się uczysz? (podręczniki, notatki w zeszycie, PDF-y, materiały z internetu?)
* Czy korzystasz ze smartfona lub tabletu do nauki?
* Czy używałeś/używałaś wcześniej ChatGPT, Gemini lub innego AI? Jeśli tak, do czego?
* Co sprawia Ci największą trudność w codziennej nauce do sprawdzianów?

### Dla rodzica
* W jakiej klasie jest Twoje dziecko?
* Z jakimi wyzwaniami w nauce najczęściej mierzy się Twoje dziecko?
* Czy dziecko korzysta z korepetycji?
* Czy używacie lub kupujecie jakieś aplikacje edukacyjne?
* Co musiałoby zostać spełnione, abyś zaufał(a) aplikacji edukacyjnej opartej o sztuczną inteligencję (AI) przeznaczonej dla Twojego dziecka?

---

## 4. Scenariusze zadań (Task Scenarios)

### Scenariusz A: Uczeń 12–15 lat (Test podstawowy)
*Zalecany viewport: mobilny (smartfon / tablet)*

* **Zadanie A1 (Landing Page)**: Wejdź na stronę [https://omninauka-mvp.vercel.app](https://omninauka-mvp.vercel.app). Przeczytaj stronę i powiedz własnymi słowami, do czego według Ciebie służy ta aplikacja.
* **Zadanie A2 (Rejestracja/Logowanie)**: Załóż nowe konto testowe lub zaloguj się przy użyciu przekazanych danych testowych.
* **Zadanie A3 (Dashboard)**: Rozejrzyj się po panelu głównym (Dashboard). Co widzisz? Gdzie według Ciebie należy kliknąć, aby rozpocząć naukę?
* **Zadanie A4 (Upload materiałów)**: Znajdź przycisk do dodania materiałów. Wgraj przygotowany plik testowy lub zrób zdjęcie notatki (moderator udostępnia przykładowy dokument/zdjęcie).
* **Zadanie A5 (Podsumowanie lekcji)**: Poczekaj na przeanalizowanie pliku przez AI. Otwórz wygenerowaną lekcję i powiedz, co się w niej znajduje oraz czy te informacje są dla Ciebie jasne.
* **Zadanie A6 (AI Tutor)**: Przejdź do sekcji rozmowy z AI Tutorem. Zadaj mu jedno pytanie dotyczące Twojej notatki.
* **Zadanie A7 (Trening / Quiz)**: Znajdź i uruchom quiz powiązany z Twoim materiałem. Odpowiedz na 2-3 pytania.
* **Zadanie A8 (Historia nauki)**: Wróć do panelu głównego i spróbuj odnaleźć historię swoich sesji nauki. Grawerowane są tam poprzednio dodane materiały.

### Scenariusz B: Uczeń starszy (Licealista / Student)
*Zalecany viewport: dowolny (smartfon lub desktop)*

* **Zadanie B1 (Wizerunek)**: Przyjrzyj się interfejsowi i grafice aplikacji. Czy wygląda ona dla Ciebie jak poważne narzędzie do nauki, czy wydaje się zbyt dziecięca?
* **Zadanie B2 (Przygotowanie do sprawdzianu)**: Wyobraź sobie, że jutro masz ważny sprawdzian. Korzystając z aplikacji, spróbuj znaleźć funkcje, które pomogłyby Ci najszybciej powtórzyć materiał.
* **Zadanie B3 (AI Tutor)**: Przetestuj AI Tutora pod kątem głębszego wytłumaczenia skomplikowanego tematu. Czy odpowiedzi AI wydają się przydatne i rzetelne?
* **Zadanie B4 (Analiza quizu i sprawdzianu)**: Przejdź przez quiz i zobacz raport błędów. Czy szczegółowe wyjaśnienia błędnych odpowiedzi są dla Ciebie pomocne?
* **Zadanie B5 (Feedback produktowy)**: Czego najbardziej brakuje Ci w tej aplikacji, abyś chciał(a) korzystać z niej regularnie przed każdą klasówką?

### Scenariusz C: Rodzic
*Zalecany viewport: desktop*

* **Zadanie C1 (Pierwsze wrażenie)**: Otwórz stronę główną OmniNauki. Powiedz, co według Ciebie oferuje ta aplikacja i w jaki sposób miałaby pomóc Twojemu dziecku.
* **Zadanie C2 (Cennik i oferty)**: Znajdź cennik na stronie. Przeczytaj go i wyjaśnij własnymi słowami różnice pomiędzy dostępem darmowym (Free) a płatnym (Premium).
* **Zadanie C3 (Nadzór / Zgoda rodzicielska)**: Zaloguj się na konto rodzica (dostarczone przez moderatora). Znajdź sekcję powiązaną z nadzorem nad kontem dziecka. Czy jest dla Ciebie jasne, w jaki sposób zatwierdza się zgody dla młodszych uczniów?
* **Zadanie C4 (Ocena zaufania)**: Zapoznaj się z komunikatami dotyczącymi ochrony prywatności i bezpieczeństwa AI w aplikacji. Czy masz jakieś obawy dotyczące korzystania przez Twoje dziecko z tego narzędzia? Co budzi Twoje największe wątpliwości?

### Scenariusz D: Moderator (Obserwacja i wskaźniki behawioralne)
Podczas wykonywania zadań przez uczestnika, moderator uważnie obserwuje i odnotowuje:
1. **Czas reakcji**: Czy użytkownik waha się przed kliknięciem w główne przyciski (CTA)?
2. **Spostrzegawczość menu mobilnego**: Czy w wersji mobilnej użytkownik bez problemu odnajduje ikonę menu (hamburger menu) i potrafi z niego skorzystać?
3. **Czytelność komunikatów**: Czy użytkownik czyta instrukcje, czy od razu próbuje klikać intuicyjnie?
4. **Zrozumienie planu darmowego i Premium**: Czy po wejściu w sekcję `/app/payments` użytkownik rozumie, dlaczego niektóre opcje są zablokowane i jak działa aktywacja Premium?
5. **Punkty frustracji (Frustration points)**: W jakich momentach użytkownik marszczy brwi, wzdycha lub mówi *„nie wiem, co teraz zrobić”*?

---

## 5. Pytania po teście (Post-Test Interview)

### Dla ucznia
* Co w całej aplikacji było dla Ciebie najłatwiejsze i najbardziej intuicyjne?
* Czy był taki moment, w którym nie wiedziałeś/wiedziałaś, co kliknąć dalej?
* Czy AI Tutor wydaje się pomocny? Czy rozmawiałbyś/rozmawiałabyś z nim podczas nauki?
* Czy skorzystałbyś/skorzystałabyś z tej aplikacji przed prawdziwym sprawdzianem w szkole? Dlaczego tak / dlaczego nie?
* Gdybyś mógł/mogła zmienić jedną rzecz w tej aplikacji, co by to było?

### Dla rodzica
* Czy aplikacja wzbudziła Twoje zaufanie pod kątem bezpieczeństwa dziecka?
* Czy Panel Rodzica i informacje o postępach dziecka są dla Ciebie wystarczająco jasne?
* Czy cennik oraz różnice Free vs Premium są w pełni zrozumiałe?
* Czy cena Premium (29,99 zł za 30 dni, bez automatycznego odnawiania) wydaje się adekwatna do oferowanej wartości?
* Co musiałoby się zmienić lub pojawić w aplikacji, abyś zdecydował(a) się kupić dziecku Premium?
* Jakie są Twoje główne obawy lub zastrzeżenia po zapoznaniu się z OmniNauką?

---

## 6. Checklista oceny ilościowej (Scoring Checklist)

Dla każdego uczestnika moderator wypełnia poniższą tabelę, oceniając stopień trudności wykonania poszczególnych zadań:

### Skala oceniania:
* **3** — Zadanie wykonane samodzielnie, szybko i bez wahania.
* **2** — Zadanie wykonane z małą pomocą (wskazówka słowna moderatora) lub po dłuższym szukaniu.
* **1** — Zadanie wykonane tylko z bezpośrednią i dużą pomocą moderatora.
* **0** — Użytkownik nie był w stanie wykonać zadania lub całkowicie go nie zrozumiał.

| Obszar oceny | Uczestnik (ID) | Wynik (0–3) | Uwagi / Zachowanie użytkownika |
| :--- | :--- | :--- | :--- |
| **Zrozumienie wartości ze strony głównej** | | | |
| **Rejestracja i logowanie (obsługa form)** | | | |
| **Orientacja w Dashboardzie** | | | |
| **Proces dodawania notatek (Upload)** | | | |
| **Zrozumienie wygenerowanej lekcji AI** | | | |
| **Interakcja z AI Tutorem** | | | |
| **Rozwiązanie quizu / sprawdzianu** | | | |
| **Zrozumienie historii sesji i powrót** | | | |
| **Zrozumienie różnic Free/Premium** | | | |
| **Ogólny wskaźnik zaufania i satysfakcji** | | | |

---

## 7. Format raportu z testów (UX Test Report Format)

Po przeprowadzeniu wszystkich sesji moderator sporządza raport końcowy na podstawie poniższego szablonu:

```markdown
# User Test Report — OmniNauka (Sesja ID: [np. 2026-06-XX])

## Uczestnik
- **Identyfikator**: [np. Uczestnik_01_Student]
- **Rola**: [uczeń / rodzic / licealista]
- **Wiek / Klasa** (jeśli uczeń): 
- **Urządzenie testowe**: [np. iPhone 15, laptop Windows]
- **Czas trwania sesji**: [np. 25 minut]

## Wyniki zadań
| Zadanie | Wynik (0–3) | Czy wymagał pomocy? | Szczegóły i kluczowe obserwacje |
| :--- | :---: | :---: | :--- |
| A1 / C1 (Strona główna) | | Tak/Nie | |
| A2 / C2 (Logowanie) | | Tak/Nie | |
| A3 / C3 (Dashboard) | | Tak/Nie | |
| A4 (Upload) | | Tak/Nie | |
| A5 (Lekcja AI) | | Tak/Nie | |
| A6 (AI Tutor) | | Tak/Nie | |
| A7 (Quiz) | | Tak/Nie | |
| A8 (Historia/Payments) | | Tak/Nie | |

## Największe problemy (UX Pain Points)
1. **[Problem 1 - np. Zbyt mały przycisk Upload na telefonie]**: Opis zachowania, cytat użytkownika, stopień trudności.
2. **[Problem 2]**: ...
3. **[Problem 3]**: ...

## Najbardziej pozytywne reakcje (Delighters)
1. **[Reakcja 1 - np. Szybkość generowania lekcji]**: Co wywołało uśmiech lub komentarz typu "wow".
2. **[Reakcja 2]**: ...

## Wybrane cytaty użytkownika
* *„...”*
* *„...”*

## Rekomendacje wdrożeniowe (Product Backlog Decisions)
* 🛑 **BLOCKER** (Naprawić natychmiast, uniemożliwia korzystanie):
  * ...
* 🔴 **HIGH** (Duży problem UX, utrudnia korzystanie):
  * ...
* 🟡 **MEDIUM** (Umiarkowany problem, warto poprawić):
  * ...
* 🟢 **LOW / LATER** (Kosmetyka lub sugestie na przyszłość):
  * ...

## Rekomendowany następny krok / sprint
[np. Sprint 26B.6 — Poprawki wykrytych błędów UX]
```
