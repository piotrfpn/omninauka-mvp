# Legal Wording Consistency & Declarative Terms Review (Sprint 25B.2)

## Cel przeglądu
Przegląd aktywnego regulaminu i dokumentów prawnych w celu upewnienia się, że precyzyjnie opisują one aktualny stan produktu OmniNauka MVP (dostęp czasowy Premium 30 dni za jednorazową opłatą, brak subskrypcji odnawialnych) oraz usunięcie niepotrzebnego języka przypuszczającego/warunkowego tam, gdzie funkcja faktycznie działa (styl deklaratywny).

## Sprawdzone pliki
1. `src/pages/legal/TermsPage.tsx` (Regulamin)
2. `src/pages/legal/PrivacyPage.tsx` (Polityka prywatności)
3. `src/pages/legal/CookiesPage.tsx` (Polityka cookies)
4. `src/pages/legal/AiDisclaimerPage.tsx` (Oświadczenie dot. sztucznej inteligencji)
5. `src/pages/app/PaymentsPage.tsx` (Strona płatności i planów)
6. `src/pages/app/PaymentSuccessPage.tsx` (Strona sukcesu płatności)
7. `src/pages/HomePage.tsx` (Strona główna - FAQ i sekcja cennika)
8. `src/i18n/locales/pl/common.json` (Tłumaczenia PL)
9. `src/i18n/locales/en/common.json` (Tłumaczenia EN)
10. `src/i18n/locales/de/common.json` (Tłumaczenia DE)
11. `src/i18n/locales/es/common.json` (Tłumaczenia ES)
12. `src/i18n/locales/it/common.json` (Tłumaczenia IT)
13. `src/i18n/locales/uk/common.json` (Tłumaczenia UK)

---

## Analiza fraz i słów kluczowych

### 1. Frazy ryzykowne i niedozwolone w aktywnych stronach
* **„docelowo”**: Brak wyników w aktywnych publicznych stronach legal i app (usunięto).
* **„PIN”**: Brak wyników (funkcja logowania PIN-em rodzica nie istnieje w kodzie frontendowym jako twardy PIN lub nie jest opisana w ten sposób w regulaminie).
* **„subskrypc”**: Występuje wyłącznie w jasnym kontekście negatywnym w `TermsPage.tsx` (np. *"Usługodawca obecnie nie oferuje subskrypcji odnawialnych"*). Techniczne komentarze w `PaymentsPage.tsx` zostały zneutralizowane (usunięto słowo „subskrypcja”).
* **„automatyczne odnawianie” / „automatycznego odnowienia”**: Wykluczone z aktywnych stron (zastąpione informacją o braku automatycznego odnawiania i wygaśnięciu dostępu).
* **„bez limitu” / „nielimitowan”**: Wykluczone z opisu planów Premium. Regulamin w § 14 jasno wskazuje, że plan Premium zwiększa limity, ale nie oznacza nielimitowanego korzystania z usług i podlega zasadom Fair Use.

### 2. Użycia „może/mogą” zostawione celowo (uzasadnione prawnie/produktowo)
Sformułowania warunkowe pozostawiono tam, gdzie opisują one uprawnienia (nie obowiązki) użytkownika, sytuacje awaryjne lub ograniczenia odpowiedzialności:
* **AI może się mylić / generować błędne odpowiedzi**: Konieczne ze względu na specyfikę modeli LLM (halucynacje).
* **Usługodawca zastrzega prawo do przerw technicznych / zmian funkcji**: Niezbędne do rozwoju produktu i utrzymania infrastruktury.
* **Użytkownik może usunąć konto / złożyć reklamację / odwołać się**: Opisuje prawa i możliwości użytkownika.
* **Dane w kopiach zapasowych mogą pozostawać przez ograniczony czas**: Uzasadniony warunek techniczny ( backupy są nadpisywane cyklicznie).

### 3. Zmiany z języka przypuszczającego na deklaratywny (styl konkretny)
* **Zakres usług (§ 4 regulaminu)**: Zmieniono *"Usługodawca może świadczyć"* na *"Usługodawca świadczy"*.
* **Płatności i dostawcy (§ 17 regulaminu)**: Zmieniono *"płatności mogą być obsługiwane"* na *"są obsługiwane"* oraz *"Usługodawca może nie przechowywać"* na *"nie przechowuje"* (z doprecyzowaniem roli Stripe).
* **Konto dziecka i Panel Rodzica (§ 7 regulaminu)**: Usunięto adnotacje o modelach kont *"jeżeli zostaną wdrożone/udostępnione"* – funkcje te działają i są dostępne.
* **Retencja danych (§ 23 regulaminu & § 9 polityki prywatności)**: Zapisy dotyczące automatycznego usuwania niepowiązanych kont dzieci poniżej 13 roku życia po 72 godzinach zmieniono z *"mogą zostać usunięte"* na konkretne *"zostają usunięte"*.
* **FAQ na stronie głównej (HomePage & common.json)**: Usunięto odniesienia do planu `Premium+` (który nie istnieje) oraz trybu egzaminacyjnego „wkrótce”. Zastąpiono je konkretnym opisem korzyści z planu Premium 30 dni i przygotowania do sprawdzianów.

---

## Szczegółowe obszary prawne

### 1. Termin rozpatrywania reklamacji
Zgodnie z wymogami polskiego prawa konsumenckiego, w regulaminie (§ 19.4) zapisano bezwarunkowy termin:
> **„Usługodawca rozpatruje reklamacje w terminie 14 dni od dnia ich otrzymania.”**
Usunięto nieprecyzyjne klauzule dopuszczające przedłużenie terminu (np. *"chyba że sprawa wymaga dodatkowych informacji"*).

### 2. Prawo odstąpienia od umowy & status checkoutu
* **Status checkoutu**: Obecny formularz płatności (`PaymentsPage.tsx` -> Stripe checkout link) **nie zbiera** technicznego potwierdzenia wyraźnej zgody użytkownika na natychmiastowe rozpoczęcie świadczenia usługi i utratę prawa do odstąpienia.
* **Wdrożone brzmienie (§ 18 regulaminu)**: Zastosowano bezpieczne, ogólne odesłanie do przepisów prawa konsumenckiego:
  > *„Konsumentowi przysługuje prawo odstąpienia od umowy zawartej na odległość w terminie 14 dni zgodnie z obowiązującymi przepisami prawa konsumenckiego. Szczegółowe zasady odstąpienia od umowy, w tym informacje dotyczące ewentualnej utraty prawa odstąpienia w przypadku wyrażenia zgody na natychmiastowe rozpoczęcie świadczenia i dostarczania treści cyfrowych, są przedstawiane użytkownikowi w procesie zakupowym przed dokonaniem płatności.”*
* **Rekomendacja**: Do czasu wdrożenia w checkoutcie / formularzu płatności checkboxa ze zgodą na natychmiastowe świadczenie przed upływem 14 dni, konsument zachowuje pełne prawo do odstąpienia od umowy, a koszty ewentualnego zwrotu zależą od przepisów prawa.

---

## Ryzyka do weryfikacji przez Prawnika
1. **Brak zgody na utratę prawa odstąpienia w checkoutcie**: Wymaga dodania checkboxa w procesie zakupowym przed przejściem do Stripe Live, jeśli chcemy skutecznie ograniczyć to prawo po natychmiastowej aktywacji dostępu Premium.
2. **Plany i Cennik**: Uproszczono opisy planów w regulaminie, odsyłając bezpośrednio do cen prezentowanych w aplikacji. Prawnik powinien sprawdzić, czy cennik w aplikacji spełnia wymogi dyrektywy Omnibus (jeśli będą stosowane obniżki cen).
3. **Lokalizacje językowe (Aktualizacja locale)**: Zweryfikowano `src/components/LanguageSwitcher.tsx` i potwierdzono, że języki niemiecki (de), hiszpański (es), włoski (it) oraz ukraiński (uk) są bezpośrednio dostępne dla użytkownika w przełączniku. В związku z tym w tym sprincie zaktualizowano wszystkie te wersje językowe (FAQ klucze `q3` i `q4`), aby usunąć z них wszelkie wzmianki o nieistniejącym planie `Premium+`, trybie egzaminacyjnym „wkrótce” oraz sformułowania o braku limitów („unlimited”). Wszystkie wersje językowe są teraz spójne w zakresie FAQ.

---

> **Ważne zastrzeżenie**: To nie jest porada prawna. Dokumenty powinny zostać sprawdzone przez prawnika przed pełnym uruchomieniem płatnej usługi.
