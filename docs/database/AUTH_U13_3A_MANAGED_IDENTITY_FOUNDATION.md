# AUTH-U13.3A — uśpiony fundament tożsamości dziecka

## Zakres i baseline

- Punkt wyjścia: `8be6234277633a529c06aa2459ab643bb9bee9ec`, branch `release/how-it-works-only`, czysty checkout.
- Zainstalowane: React 19.2.3, `@supabase/supabase-js` i `@supabase/auth-js` 2.100.1, TypeScript 5.9.3, CLI 2.108.0.
- Nowa migracja: `20261020204341_auth_u13_managed_identity_foundation.sql`, utworzona przez lokalne `supabase migration new`.
- Migracja nie została zastosowana do żadnej bazy. Brak lokalnego PostgreSQL/Supabase do testów runtime. Nie używać produkcji jako zamiennika.
- Nie zmieniono `src/`, istniejących funkcji Edge, `config.toml`, pakietów ani starych migracji.
- Nie ma endpointu, aktywacji, Auth Admin, hooka, wysyłki emaila ani automatycznej zmiany statusu konta.

## Pierwszeństwo istniejącego SQL

Jedenaście history anchors to komentarze. Definicje `profiles`, `child_profiles`, `handle_new_user`, `link_child_account`, `get_parent_children` i `get_my_effective_plan` pochodzą z `20261010073638_canonical_baseline.sql`.
Późniejsze `20261010073843`, `20261010131220` i `20261010174000` dodają RLS aktywnych sesji, bariery purge/Storage, nadpisują `check_and_reserve_ai_usage` i dodają lookup właściciela Storage. Nie zastępują wymienionych funkcji Auth/rodzic–dziecko.
Nowy plik dodaje wyłącznie obiekty we własnym schemacie. Archiwum i baseline pozostają niezmienione.

## Feasibility: dowody i ograniczenia

| Zagadnienie | Dowód | Granica dowodu |
|---|---|---|
| Własny UUID Auth | Zainstalowany `AdminUserAttributes.id?: string`, `GoTrueAdminApi.createUser` przekazuje attributes w body | Test z atrapą fetch potwierdza transport i typy; nie potwierdza docelowego serwera |
| Powiązanie UUID | Przyszły backend odczytuje serwerowo wygenerowany `reserved_auth_user_id` i przekazuje go Admin API | W 3A binding Auth jest zabroniony; nie ma klienta Admin |
| Hasło bez skrzynki | Dokumentacja password/email oraz Admin `email_confirm` | Przyszłe potwierdzenie wyłącznie technicznego adresu; nie dowodzi własności osobistej skrzynki ani opiekuństwa |
| Before User Created | Udokumentowane odrzucenie tworzenia przed INSERT | Nie zakładać wywołania dla Admin create ani kolejności app_metadata; test w izolowanym Auth jest blokującą zależnością |
| Send Email | Hook zastępuje standardową wysyłkę | Nie zakładać objęcia każdej wiadomości bezpieczeństwa; sprawdzić wszystkie kanały. Usterka może zatrzymać email starszych uczniów/rodziców |
| Własność | Rezerwacja sprawdza UUID rodzica, jego aktywny profil, potwierdzenie emaila i własny pending child_profile | Rezerwacja nie potwierdza faktycznego opiekuństwa i nie udziela dostępu edukacyjnego |

Źródła platformy:
- https://supabase.com/docs/reference/javascript/auth-admin-createuser
- https://supabase.com/docs/guides/auth/passwords
- https://supabase.com/docs/guides/auth/auth-hooks/before-user-created-hook
- https://supabase.com/docs/guides/auth/auth-hooks/send-email-hook
- https://supabase.com/changelog

Przed pierwszym Auth create trzeba osobno dowieść kontroli namespace na publicznym signup, email change, resend, OTP/magic-link/recovery, telefonie oraz OAuth/identity linking. Hook tworzenia nie zastępuje ochrony późniejszych zmian tożsamości. Hook wysyłki nie zastępuje autoryzacji.
Konfiguracja musi zachować normalną rejestrację i pocztę 13+, rodziców oraz globalne Confirm Email. Te warunki nie zostały przetestowane runtime.

## Identyfikator i konfiguracja

- Kod: 12 niezależnych symboli z 32-elementowego alfabetu `23456789abcdefghjklmnpqrstuvwxyz`: 60 bitów entropii. Bez `0`, `1`, `I`, `O`; litera L pozostaje, ale cyfra 1 jest wykluczona.
- Prezentacja: `UCZEN-7FD2-K9M3-PQ8R`; przykład sześcioliterowy ze zlecenia jest ilustracją, nie akceptowanym formatem.
- Normalizacja: ASCII, niewrażliwa na wielkość liter, opcjonalny prefiks i dokładne grupowanie 4–4–4, przycięcie otaczających białych znaków; brak fuzzy matching/homoglifów.
- Adres: `u-7fd2k9m3pq8r@dzieci.omninauka.eu`. Kod nie jest hasłem i nie jest sekretem. Hasła i ich hashe pozostają poza tym modułem.
- Przestrzeń 2^60 daje dla miliona niezależnych losowań prawdopodobieństwo co najmniej jednej kolizji około 4,3e-7; unikalność gwarantuje dopiero UNIQUE w DB, nie ten szacunek.
- `MANAGED_CHILD_IDENTITIES_ENABLED` domyślnie wyłączone; tylko dokładne `true` odblokowuje lokalny generator.
- `MANAGED_CHILD_IDENTITY_NAMESPACE` jest konfiguracją serwerową; wartość domyślna to proponowane `dzieci.omninauka.eu`. Nie zapisano zmiennych środowiska ani konfiguracji produkcji.
- Walidacja składni DNS nie potwierdza własności domeny. Nie sprawdzano DNS i nie uruchamiano poczty. Przed aktywacją: własność, brak skrzynek/catch-all/forwardingu, kontrola wysyłki i przejęcia domeny.
- Import modułu nie odczytuje środowiska i nie wykonuje I/O. Użycie w przeglądarce jest odrzucane. Moduł nie jest importowany przez frontend ani istniejące endpointy.

## Prywatna baza

Schemat `managed_child_private` musi pozostać poza exposed schemas PostgREST. Migracja nie zmienia ustawień API. Nie przyjmuje istniejącego schematu o tej nazwie: konflikt zatrzymuje transakcję.

`identities`:
- Własność: rodzic i konkretny child_profile po UUID; żadnego dopasowania emaila.
- Serwer generuje `id`, przyszły `reserved_auth_user_id` i czasy, ignorując próby ich podstawienia.
- `reserved_auth_user_id` nie ma FK do nieistniejącego Auth usera. `auth_user_id` ma poprawny nullable FK, ale dodatkowy CHECK wymusza NULL przez cały sprint 3A.
- Kod, techniczny adres, reserved UUID i child_profile są unikalne; kod i adres nie wracają do puli po anulowaniu.
- Prezentowany login i adres są kolumnami GENERATED ALWAYS. Namespace zapisany przy rezerwacji jest niezmienny.
- Dozwolone tylko `reserved -> cancelled`. Brak `active`, bindingu i reactivation. Ponowienie anulowania obsługuje przyszły adapter przez odczyt stanu; trigger odrzuca drugi UPDATE.

`operations`:
- Typy planowane: provision/recover/delete; jedyne fazy to planned/cancelled, nie wykonują żadnej operacji Auth.
- Composite FK wymusza zgodność identity/parent. UUID idempotency jest nieprzezroczystym identyfikatorem backendu, nie hashem body ani hasła.
- UNIQUE `(parent_user_id, operation_type, idempotency_key)` oraz najwyżej jedna pending operacja na identity.
- `execution_version` zaczyna od 0, przy anulowaniu zwiększa się serwerowo. To miejsce na przyszły fencing, nie zaimplementowany protokół workerów/lease.
- Dozwolone wyłącznie zamknięte kategorie błędów. Brak JSON/payloadów, haseł, tokenów, dowolnych komunikatów providera i danych dziecka.

ACL: PUBLIC/anon/authenticated nie mają dostępu do schematu, tabel ani funkcji. RLS ENABLE + FORCE, brak polityk dopuszczających. `service_role`: tylko USAGE oraz SELECT/INSERT/UPDATE tych dwóch tabel; brak CREATE/DELETE/TRUNCATE i bezpośredniego EXECUTE triggerów. RLS nie ogranicza uprzywilejowanego BYPASSRLS; service key jest granicą zaufania, nie dowodem zgody rodzica.
Te granty dotyczą SQL i nie wystawiają prywatnego schematu w PostgREST. Przyszły adapter wymaga zaufanego połączenia SQL albo osobno przejrzanego RPC z EXECUTE wyłącznie dla service_role. Samo `.schema('managed_child_private')` w kliencie REST nie jest rozwiązaniem; nie należy wystawiać schematu, żeby uruchomić adapter.
Oba triggery mają SECURITY DEFINER, właściciela postgres i pusty search_path; są przypięte wyłącznie do nowych tabel, a ich funkcje nie są publicznymi RPC.

FK do istniejących kont mają RESTRICT. Po przyszłym wprowadzeniu rezerwacji mogą blokować usuwanie rodzica/child_profile. Przed pierwszym takim zapisem w działającym produkcie trzeba uzgodnić cleanup/retencję i przetestować delete-account. Nie zmieniono istniejących kaskad jako obejścia.

## Kolizje, retry i przyszły adapter

`reserveManagedChildIdentifier` otrzymuje wyłącznie zaufany adapter, bez gotowej implementacji DB. Maksymalnie pięć prób. Adapter może zwrócić `identifier_collision` tylko po konflikcie UNIQUE kodu/adresu; inne błędy muszą przerwać operację.
Przyszły adapter musi:
1. Zweryfikować sesję, potwierdzony email, status rodzica i własność child_profile; nie ufać parent ID z requestu.
2. Rozpoznać replay idempotency i zwrócić istniejącą rezerwację przed generowaniem nowej.
3. Zapisać rezerwację i operację w jednej krótkiej transakcji oraz odczytać UUID z RETURNING.
4. Odróżniać konflikt loginu od child_profile/parent/idempotency/Auth UUID. Kolizja nie daje prawa do istniejącego konta.
5. Nie przechwytywać timeoutu jako kolizji; po niepewnym commit wykonać reconciliation.

Nie ma publicznego resolvera username, RPC rezerwacji ani endpointu Auth. Wygenerowanie kandydata nie oznacza rezerwacji ani dostępu.

## Istniejące luki poza zakresem

Obecny emailowy `link_child_account` wybiera pierwszy pasujący preapproval. Obecne odczyty historii nie mają pełnej kontroli statusu konta, a `AnalysisPage` tworzy signed URLs ważne 3600 sekund. `delete-account` kontynuuje po błędzie Storage. Nie naprawiano tych domen w 3A. To dodatkowe blokery aktywacji realnych managed accounts, niezależne od poprawności prywatnego rejestru.

## Testowanie i bramka kolejnego sprintu

- `node --test --test-reporter=tap tests/managed-child-identity.test.mjs`: utility runtime, ograniczone retry, mock SDK, typecheck i statyczny kontrakt SQL.
- Istniejące testy Node oraz `npm.cmd run build`: regresja lokalna; nie dowodzą działania Supabase.
- Zmieniono jedynie dokładną allowlistę nowej migracji/pliku w testach freeze. Checksumy baseline/archiwum pozostają wymagane.
- Znany baseline: test `account-security.test.mjs:649` porównuje CRLF z LF. Nie naprawiano go w tym zakresie.
- Wykonany baseline wybranych pięciu zestawów: 490 PASS / 1 FAIL. Nowy zestaw: 67/67 PASS. Pełna suita po zmianach: 982 PASS / 1 FAIL (983 testy); jedyny FAIL to ten sam CRLF/LF. Typecheck aplikacji i konfiguracji: exit 0. Porównanie istniejącego Auth source po normalizacji końców linii jest zgodne z HEAD.
- `npm.cmd run build`: PASS, exit 0 (TypeScript, Vite i PWA). Ostrzeżenia dotyczą nieaktualnego Browserslist i chunków >500 kB; nie zmieniano zależności ani bundlera. Build zapisuje wyłącznie zwykłe ignorowane artefakty lokalne.
- SQL parse/DDL/ACL/RLS/concurrency/trigger runtime: NOT_RUN, dopóki nie będzie osobno autoryzowanego izolowanego środowiska.

AUTH-U13.3B może rozpocząć przygotowanie testów i kontraktów izolowanego provisioningu. Zależna implementacja Auth/binding/aktywacji pozostaje zablokowana do testów rzeczywistego Admin create z zarezerwowanym UUID, hooków, kanałów alternatywnych, braku wysyłki, izolacji danych i usuwania kont.
Nie stosować tej migracji do produkcji i nie usuwać blokad dormant jako skrótu. Rollback lokalny: nie używać nowych obiektów; nie usuwać rekordów w przyszłości bez inwentaryzacji. Nie wykonano deploya, commita ani recovery konta.
