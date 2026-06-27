# Plan gotowości PWA do publikacji w Google Play przez Trusted Web Activity (TWA)

Niniejszy dokument przedstawia kompletną checklistę techniczną, formalną i wizerunkową przygotowującą OmniNauka do spakowania i wdrożenia jako natywnej aplikacji Android w sklepie Google Play za pomocą technologii Trusted Web Activity (TWA).

---

## 1. Audyt gotowości PWA (PWA Readiness Audit)

Przed wdrożeniem TWA należy upewnić się, że wersja webowa spełnia surowe kryteria instalowalności i jakości PWA:

* **Adres URL produkcji**: `https://omninauka-mvp.vercel.app` (wymagane pełne szyfrowanie HTTPS — **PASS**).
* **Manifest aplikacji PWA**: Dostępny i poprawny pod adresem `/manifest.webmanifest` (**PASS**).
  * `start_url` jest ustawiony na `/` (**PASS**).
  * `scope` jest ustawiony na `/` (**PASS**).
  * `display` jest ustawiony na `standalone` (**PASS**).
  * `theme_color` i `background_color` są ustawione na `#0B1220` (**PASS**).
* **Service Worker**: Dostępny pod adresem `/sw.js` (**PASS**). Obsługuje zdarzenie `fetch` i prawidłowo pre-cache'uje lokalne statyczne pliki wyjściowe bez agresywnego buforowania API/auth.
* **Ikony aplikacji**: Wygenerowane automatycznie za pomocą `@vite-pwa/assets-generator` z wektorowego źródła i zadeklarowane w manifeście:
  * `pwa-192x192.png` (purpose: 'any' — **PASS**).
  * `pwa-512x512.png` (purpose: 'any' — **PASS**).
  * `maskable-icon-512x512.png` (purpose: 'maskable' — **PASS**).
* **Brak błędów 404 dla zasobów PWA**: Wszystkie zadeklarowane ikony, manifest i skrypty SW ładują się ze statusem `200 OK` (**PASS**).
* **Podstrona instalacji**: Publiczna i dostępna pod adresem `/install` (**PASS**).

---

## 2. Techniczna gotowość TWA (Technical TWA Readiness)

Poniższa checklista definiuje parametry konfiguracji paczki Android w narzędziach typu Bubblewrap / CLI:

* **Domena produkcyjna dla TWA**: `omninauka-mvp.vercel.app` (lub docelowa domena brandowa, patrz sekcja 8).
* **Propozycja identyfikatora pakietu (Package Name)**: `pl.omninauka.app` (do ostatecznej akceptacji).
* **Nazwa aplikacji (App Name)**: `OmniNauka`.
* **Klucz startowy (Start URL)**: `https://omninauka-mvp.vercel.app/` (musi kończyć się na `/` lub konkretnej ścieżce, która pasuje do `start_url` w manifeście).
* **Zakres (Scope)**: `https://omninauka-mvp.vercel.app/` (musi pokrywać wszystkie podstrony aplikacji).
* **Orientacja ekranu (Orientation)**: `default` (z obsługą automatycznego obracania pion/poziom) lub `portrait` (zalecane dla mobile-first).
* **Kolor paska stanu (Theme Color / Status Bar)**: `#0B1220`.
* **Certyfikacja klucza podpisywania (Android Signing Key / Keystore)**:
  * Należy wygenerować plik keystore za pomocą narzędzia `keytool` lub pozwolić Bubblewrap na jego automatyczne utworzenie.
  * *Wymóg*: Bezpieczne przechowywanie hasła oraz pliku `.keystore` poza repozytorium (np. jako sekrety w CI/CD).
* **Bubblewrap**: Narzędzie CLI od Google rekomendowane do budowania paczek `.apk`/`.aab` bezpośrednio z manifestu PWA. Wymaga lokalnego środowiska Java (JDK 17+) oraz Android Command Line Tools (Android SDK).
* **Play Console Testing Track**: Gotowość do wgrania paczki `.aab` (Android App Bundle) na wybrany kanał testów (Internal/Closed/Open).
* **Urządzenia testowe**: Fizyczny telefon z systemem Android (wersja 8.0+ z zainstalowaną najnowszą wersją Google Chrome) do weryfikacji TWA.
* **Strategia Rollback**: W przypadku błędów w aplikacji, mechanizm PWA SW pobiera aktualizacje w tle ze strony www (brak konieczności wydawania nowej paczki w Google Play przy zmianach czysto webowych).

---

## 3. Weryfikacja powiązania domeny (Digital Asset Links Readiness)

TWA wymaga jednoznacznego potwierdzenia własności domeny webowej, by usunąć pasek adresu przeglądarki nad aplikacją.

* **Wymagany plik**: `https://omninauka-mvp.vercel.app/.well-known/assetlinks.json` (plik musi być serwowany z właściwym nagłówkiem Content-Type: `application/json`).
* **Struktura pliku assetlinks.json**:
  ```json
  [
    {
      "relation": [
        "delegate_permission/common.handle_all_urls"
      ],
      "target": {
        "namespace": "android_app",
        "package_name": "pl.omninauka.app",
        "sha256_cert_fingerprints": [
          "<SHA_256_FINGERPRINT_FROM_PLAY_CONSOLE_OR_KEYSTORE>"
        ]
      }
    }
  ]
  ```
* **Kluczowe decyzje do podjęcia**:
  1. **Wybór domeny**: Czy powiązanie ma dotyczyć domeny Vercel `omninauka-mvp.vercel.app`, czy docelowej domeny brandowej (np. `omninauka.pl`)?
     * *Rekomendacja*: Zrobić powiązanie od razu dla docelowej domeny brandowej. Zmiana domeny po opublikowaniu aplikacji w Google Play wymaga wygenerowania nowej paczki `.aab` z nowym plikiem `assetlinks.json` i ponownego przejścia weryfikacji.

---

## 4. Rejestracja i weryfikacja firmy w Google Play (Google Play Organization Readiness)

Publikacja aplikacji jako organizacja wymaga przejścia pełnego procesu weryfikacji tożsamości:

* **Konto Google Play Console (Organizacyjne)**: Opłata rejestracyjna wynosi 25 USD (jednorazowo).
* **Wymóg DUNS**: Numer D-U-N-S (Data Universal Numbering System) musi być aktywny i w pełni zgodny z danymi w rejestrach (np. KRS / CEIDG).
* **Zgodność profilu płatności (Google Payments Profile)**: Dane właściciela karty płatniczej i profilu płatności w Google Merchant muszą zgadzać się z danymi rejestrowymi organizacji.
* **Szczegóły profilu programisty (placeholdery do uzupełnienia w konsoli)**:
  * Nazwa prawna organizacji: `<LEGAL_ORGANIZATION_NAME>`
  * Adres siedziby: `<ORGANIZATION_ADDRESS>`
  * Telefon kontaktowy organizacji: `<ORGANIZATION_PHONE>`
  * Adres strony www: `<ORGANIZATION_WEBSITE>`
  * Adres e-mail kontaktu dla użytkowników: `<DEVELOPER_CONTACT_EMAIL>`
  * Oficjalny adres e-mail do weryfikacji (w domenie firmowej): np. `kontakt@<ORGANIZATION_WEBSITE>`
* **Dokumenty weryfikacyjne**: Przygotować odpisy KRS/CEIDG, potwierdzenie nadania numeru DUNS oraz wyciągi bankowe lub rachunki (np. za telefon/prąd) wystawione na dane firmy (nie starsze niż 90 dni) na wypadek dodatkowej weryfikacji adresu.

---

## 5. Karta katalogowa aplikacji (Play Store Listing Readiness)

Przygotowanie materiałów graficznych i tekstowych do sklepu Google Play:

* **Nazwa aplikacji**: `OmniNauka` (maksymalnie 30 znaków).
* **Krótki opis (Short Description)**: max. 80 znaków.
  * *Przykład*: *Korepetytor AI dla uczniów. Notatki, quizy i pomoc w nauce na Twoim telefonie.*
* **Pełny opis (Full Description)**: max. 4000 znaków. Szczegółowe opisanie funkcji (skanowanie notatek, podsumowania AI, interaktywny AI Tutor, rozwiązywanie quizów z analizą błędów).
* **Kategoria i tagi**: Kategoria: `Edukacja` (Education). Tagi: `Edukacja`, `Nauka`, `Sztuczna Inteligencja`.
* **Zasoby graficzne**:
  * **Ikona aplikacji (App Icon)**: 512 × 512 px, format PNG 32-bit (z przezroczystością), max. 1MB.
  * **Grafika promująca (Feature Graphic)**: 1024 × 500 px, format PNG lub JPEG, max. 1MB.
  * **Zrzuty ekranu (Screenshots)**: minimum 2 zrzuty z telefonu (rekomendowane 4-6 pokazujące główne flow aplikacji), proporcje 16:9 lub 9:16, rozdzielczość od 320 px do 3840 px.
* **Dane kontaktowe**: Adres e-mail wsparcia (`<DEVELOPER_CONTACT_EMAIL>`) oraz linki do regulaminu i polityki prywatności.

---

## 6. Deklaracje bezpieczeństwa danych (Data Safety Readiness)

Formularz Bezpieczeństwa Danych (Data Safety) jest obowiązkowy. Musi być zgodny z faktycznym działaniem backendu (Supabase) oraz polityką prywatności:

* **Zbierane dane użytkownika**:
  * **Dane osobowe**: Adres e-mail, nazwa użytkownika/imię (zbierane w celu uwierzytelniania konta w Supabase Auth).
  * **Treści użytkownika**: Wgrane materiały (notatki, zdjęcia, pliki PDF/DOCX) w celu ich przetworzenia przez AI.
  * **Historia nauki i aktywność**: Wyniki quizów, statystyki nauki, historia konwersacji z AI Tutorem (przechowywane w bazie danych).
  * **Dane o płatnościach**: Przetwarzane bezpośrednio przez Stripe (aplikacja nie przechowuje numerów kart ani szczegółów konta bankowego na własnych serwerach, zbiera jedynie status subskrypcji).
* **Udostępnianie danych podmiotom trzecim**: Dane przesyłane są do modeli AI (OpenAI API / Gemini API) w celu wygenerowania lekcji i obsługi chatu (z zastrzeżeniem, że dane nie są używane do trenowania modeli publicznych).
* **Bezpieczeństwo**: Szyfrowanie transmisji danych (HTTPS) oraz możliwość żądania usunięcia konta i powiązanych z nim danych (funkcja usunięcia konta jest już zintegrowana w aplikacji).
* **Aplikacja skierowana do dzieci (Target Audience)**: Ponieważ OmniNauka jest przeznaczona dla uczniów (w tym w wieku 12-15 lat), w deklaracji Target Audience w Play Console należy zaznaczyć odpowiednie przedziały wiekowe. Wiąże się to ze szczególnymi wymaganiami dotyczącymi zgody rodziców (obsługiwanej już przez nasz flow zgód) oraz braku profilowania reklam (brak reklam w naszej aplikacji).

---

## 7. Kanały testowe (Testing Track Readiness)

Publikacja aplikacji na nowo utworzonych kontach deweloperskich (szczególnie osobistych) wymaga przeprowadzenia obowiązkowych testów zamkniętych (Closed Testing) z udziałem minimum 20 testerów przez co najmniej 14 dni przed dopuszczeniem do produkcji.
Dla kont organizacji wymogi mogą być łagodniejsze, jednak zaleca się przejście przez pełną ścieżkę testową:

1. **Testy wewnętrzne (Internal Testing)**: Szybki kanał dystrybucji do 100 zaufanych testerów (brak czasu weryfikacji ze strony Google, idealny do szybkich poprawek).
2. **Testy zamknięte (Closed Testing)**: Weryfikacja stabilności PWA/TWA.
3. **Instrukcje logowania dla weryfikatorów Google (App Access)**: W Play Console należy podać działające dane logowania do konta testowego (np. `omnitest1@o2.pl`), aby pracownicy Google mogli wejść do wnętrza aplikacji bez konieczności przechodzenia rzeczywistego potwierdzania tożsamości rodzica lub płatności.

---

## 8. Ryzyka i decyzje otwarte (Risks / Open Decisions)

* **Domena produkcyjna (Krytyczne)**: Czy wdrożyć TWA na domenie `omninauka-mvp.vercel.app`, czy podpiąć najpierw docelową domenę brandową programisty?
  * *Ryzyko*: Wdrożenie TWA na domenie tymczasowej Vercel, a następnie zmiana domeny na docelową wymaga aktualizacji certyfikatów SHA-256 w nowym pliku `assetlinks.json` oraz wydania nowej wersji aplikacji w Google Play Store, co wydłuży czas wdrożenia o czas ponownej weryfikacji przez Google (zazwyczaj 3-7 dni).
* **Weryfikacja DUNS**: Ewentualne rozbieżności w pisowni nazwy firmy lub adresu w bazie Dun & Bradstreet i KRS/CEIDG mogą zablokować weryfikację konta Play Console na kilka tygodni.
* **Logika PWA Cache**: Choć mechanizm `registerType: 'autoUpdate'` w pełni zapobiega problemom "Cache Nightmare", w aplikacji TWA (opakowanej w przeglądarkę systemową Android) należy monitorować zachowanie SW przy aktualizacji krytycznych assetów JS.
* **Kwestia iOS**: Aplikacja na iPhone w dalszym ciągu będzie instalowana za pomocą skrótu Safari ("Dodaj do ekranu początkowego"). Publikacja w Apple App Store nie jest planowana w technologii TWA (wymagałaby opakowania w Capacitor/Cordova i innych zmian architektonicznych).

---

## 9. Rekomendowane następne kroki (Recommended Next Sprint)

W zależności od stanu formalnego konta Google Play Console organizacji, zaleca się:

* **Opcja A (Jeśli konto Play Console nie jest w pełni zweryfikowane/gotowe)**:
  `27-Ops-A — Google Play Organization Setup`
  *(Skupienie się na weryfikacji tożsamości firmy,DUNS, profilu płatności i dostępu do domeny).*
  
* **Opcja B (Jeśli konto Play Console i domena docelowa są gotowe do wdrożenia)**:
  `27D — Android TWA Package Prototype`
  *(Skonfigurowanie Bubblewrap, wygenerowanie podpisanego pakietu .aab oraz wdrożenie pliku assetlinks.json).*
