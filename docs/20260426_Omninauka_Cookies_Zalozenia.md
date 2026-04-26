# Założenia do Polityki Cookies OmniNauka

*Data: 2026-04-26*
*Status: Projekt techniczny (Draft)*

## 1. Wykorzystanie plików Cookies i pamięci lokalnej
OmniNauka korzysta z mechanizmów Cookies oraz technologii przeglądarkowych takich jak `localStorage` i `sessionStorage` w celu zapewnienia prawidłowego działania aplikacji.

## 2. Pliki niezbędne (Strictly Necessary)
Te pliki są wymagane do działania serwisu i nie wymagają uprzedniej zgody użytkownika:
- **Autoryzacja:** Przechowywanie tokenów sesji (Supabase Auth) umożliwiających pozostanie zalogowanym.
- **Bezpieczeństwo:** Ochrona przed atakami CSRF i zapewnienie integralności sesji.

## 3. Pliki funkcjonalne
Umożliwiają zapamiętanie wyborów użytkownika:
- **Motyw (Theme):** Zapamiętanie preferencji Dark Mode / Light Mode (`omninauka-theme` w localStorage).
- **Stan interfejsu:** Ukrycie powiadomień lub stan menu bocznego.

## 4. Analityka i Marketing (W przyszłości)
- Obecnie OmniNauka minimalizuje użycie skryptów śledzących.
- W przypadku wdrożenia narzędzi typu Google Analytics lub Hotjar, zostanie dodany baner zgody (Consent Banner) umożliwiający użytkownikowi wybór.

## 5. Zarządzanie Cookies
Użytkownik może w każdej chwili usunąć pliki Cookies oraz dane zapisane w przeglądarce za pomocą ustawień swojej przeglądarki internetowej. Usunięcie plików niezbędnych spowoduje wylogowanie z aplikacji.
