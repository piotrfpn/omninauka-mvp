# Zautomatyzowane Reguły i Instrukcje Workspace (OmniNauka)

## Reguły dla Sprintu 27A — Bezpieczne generowanie ikon PWA

Podczas realizacji Sprintu 27A oraz wszelkich prac związanych z ikonami PWA, należy bezwzględnie przestrzegać poniższych wytycznych:

### 1. Zakaz Ręcznego Generowania Plików Binarnych PNG
* **ZAKAZ**: Sztuczna inteligencja (LLM) nie może samodzielnie tworzyć plików binarnych PNG, base64 PNG ani pustych placeholderów PNG.
* **ZAKAZ**: Nie commituj uszkodzonych plików graficznych.
* **ROZWIĄZANIE**: Zastosuj bezpieczną ścieżkę generowania:
  1. Wygeneruj prostą, poprawną składniowo ikonę źródłową SVG (jako poprawny dokument XML, a nie base64).
  2. Użyj dedykowanego narzędzia `@vite-pwa/assets-generator` do automatycznego wyrenderowania plików PNG w wymaganych rozmiarach.

### 2. Zależności i Narzędzia
* Dozwolone jest zainstalowanie i użycie paczki `@vite-pwa/assets-generator` jako `devDependencies` w celu wygenerowania PNG z pliku SVG:
  ```bash
  npm install -D @vite-pwa/assets-generator
  ```
* Nie dodawaj biblioteki `sharp` ani innych paczek graficznych ręcznie (chyba że npm zainstaluje je automatycznie jako zależności).

### 3. Wymagane ikony i konfiguracja manifestu
* Wszystkie ikony PWA muszą być wygenerowane automatycznie do folderu `public/` z pliku źródłowego `public/omninauka-icon.svg`.
* **Wymagane pliki docelowe**:
  * `public/pwa-192x192.png` (sizes: '192x192', purpose: 'any')
  * `public/pwa-512x512.png` (sizes: '512x512', purpose: 'any')
  * `public/maskable-icon-512x512.png` (sizes: '512x512', purpose: 'maskable')
  * `public/apple-touch-icon.png` (sizes: '180x180' / dla urządzeń Apple)
  * `public/favicon.svg` (jako favicon dla nowoczesnych przeglądarek)
* **Manifest (VitePWA Config)**:
  * Musi wskazywać na wygenerowane pliki PNG jako główne ikony (nie może być skonfigurowany wyłącznie na SVG).
  * W `includeAssets` uwzględnij tylko te pliki, które realnie istnieją w `public/` po wygenerowaniu.
* **Szablon index.html**:
  * Favicon: `<link rel="icon" href="/favicon.svg" type="image/svg+xml" />`
  * Apple Touch Icon: `<link rel="apple-touch-icon" href="/apple-touch-icon.png" />`

### 4. Walidacja Obrazów
* Przed zatwierdzeniem zmian i commitem należy bezwzględnie sprawdzić poprawność wygenerowanych obrazów (rozmiar i format PNG) za pomocą skryptu Node lub komendy systemowej.
* Nie commituj ikon bez upewnienia się, że są one poprawnymi obrazami rastrowymi.
