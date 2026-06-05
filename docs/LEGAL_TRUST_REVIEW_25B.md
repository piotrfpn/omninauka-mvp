# Legal & Trust Review - Sprint 25B

## Zakres Audytu
Przeprowadzono przegląd publicznych dokumentów prawnych, komunikatów zaufania oraz ścieżek płatności przed uruchomieniem integracji Google Login i Stripe Live. Audyt obejmował:
- Wyszukiwanie problematycznych fraz: sugerujących nieskończone zasoby („bez limitu”, „nielimitowany”), abonamenty cykliczne („subskrypcja”, „recurring”) oraz brakujących wdrożeń (placeholdery, „wkrótce”).
- Weryfikację `TermsPage.tsx`, `PrivacyPage.tsx`, `AiDisclaimerPage.tsx` oraz plików w `docs/`.
- Przegląd `PaymentsPage.tsx` i `PaymentSuccessPage.tsx` pod kątem niespójności z obecnym modelem MVP.

## Wykryte Ryzyka i Wykonane Poprawki
1. **Premium 30 dni vs Subskrypcje Cykliczne**
   - *Ryzyko*: W `PaymentsPage.tsx` widniała cała sekcja zachęcająca do miesięcznych subskrypcji automatycznie odnawialnych.
   - *Poprawka*: Tymczasowo zakomentowano ten blok (Sekcja 6). MVP obsługuje obecnie wyłącznie jednorazowe dostępy 30-dniowe.
2. **Płatności - Oczekiwania vs Rzeczywistość**
   - *Ryzyko*: `PaymentSuccessPage.tsx` zbytnio obiecywał natychmiastową aktywację w „kilka minut”, co przy braku docelowego webhooka Stripe Live mogło wprowadzać w błąd i wywoływać wczesne frustracje klientów.
   - *Poprawka*: Zmieniono komunikaty na bezpieczniejsze, informujące, że w fazie testowej aktywacja może wymagać weryfikacji i trwać do 24 godzin.
3. **Funkcje wdrożone vs "Wkrótce"**
   - *Ryzyko*: W `TermsPage.tsx` "Panel Rodzica" posiadał adnotację "wkrótce", podczas gdy funkcja ta już realnie działa.
   - *Poprawka*: Usunięto adnotację "wkrótce".
4. **Prywatność i płatności**
   - *Ryzyko*: `PrivacyPage.tsx` wspominało tylko o transakcjach subskrypcyjnych w przyszłości.
   - *Poprawka*: Doprecyzowano, że dotyczy to również płatności jednorazowych.
5. **Oświadczenia dot. AI i zgód (Limity i Fair Use)**
   - *Wynik*: Dokumenty (w tym `AiDisclaimerPage.tsx`) bardzo dobrze i bezpiecznie komunikują granice sztucznej inteligencji, zakaz obiecywania "unlimited", brak powiązań z CKE oraz warunek działania rodzica przy dokonywaniu transakcji.

## Co pozostaje do zrobienia (Nie wdrażane w tym Sprincie)
- Google Login (następne kroki weryfikacyjne).
- Stripe Live z pełnymi Webhookami. Po wdrożeniu webhooków `PaymentSuccessPage.tsx` powinien zostać przywrócony do obiecującej szybkiej aktywacji.
- RLS w bazie Supabase.
- Ewentualne formalne zatwierdzenie tych dokumentów przez kancelarię przed ostatecznym soft launch.

## Legacy docs note
Aktualnym publicznym źródłem prawdy w zakresie regulaminów, polityk prywatności i oświadczeń AI są pliki znajdujące się w katalogu `src/pages/legal/*`. Starsze dokumenty archiwalne zlokalizowane w `docs/20260426_*` oraz `docs/legal/*` mogą zawierać wcześniejsze, nieaktualne założenia (w tym o subskrypcjach odnawialnych) i nie stanowią wiążącej dokumentacji dla obecnej wersji MVP. Przed finalnym review prawnym legacy dokumenty te powinny zostać docelowo uporządkowane lub usunięte z repozytorium (albo trwale oznaczone jako archiwalne).

> **Ważne zastrzeżenie**: To nie jest porada prawna. Dokument ten jest inżynieryjnym przeglądem spójności produktu i User Trust. Dokumenty powinny zostać sprawdzone przez prawnika przed pełnym uruchomieniem płatnej usługi.
