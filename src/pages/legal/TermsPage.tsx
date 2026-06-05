import LegalPageLayout from '../../components/legal/LegalPageLayout';
import { useTranslation } from 'react-i18next';

export default function TermsPage() {
  const { t } = useTranslation();
  return (
    <LegalPageLayout title={t('home.footer.legal.terms', 'Regulamin')} lastUpdated="26.04.2026">
      <section>
        <p className="font-semibold mb-6">
          Wersja: REGULAMIN_v02 (Wersja 1.0)<br />
          Data wejścia w życie: 26.04.2026
        </p>
      </section>

      <section>
        <h2>§ 1. Postanowienia ogólne</h2>
        <p>
          1. Niniejszy Regulamin określa zasady korzystania z aplikacji edukacyjnej OmniNauka, 
          prawa i obowiązki Użytkowników oraz Usługodawcy, a także zasady świadczenia usług drogą elektroniczną.
        </p>
        <p>
          2. Usługodawcą i administratorem aplikacji jest <strong>PFConsulting Piotr Fiszer</strong>, 
          z siedzibą przy ul. Promienista 114, 60-142 Poznań, Polska. 
          Kontakt: <a href="mailto:piotr.fiszer@pfconsulting.pl" className="break-all">piotr.fiszer@pfconsulting.pl</a>.
        </p>
      </section>

      <section>
        <h2>§ 2. Definicje</h2>
        <p>Na potrzeby Regulaminu poniższe pojęcia oznaczają:</p>
        <ul className="list-none space-y-4">
          <li><strong>1. Aplikacja / OmniNauka</strong> — aplikacja edukacyjna wykorzystująca narzędzia sztucznej inteligencji do wspierania nauki, analizy materiałów edukacyjnych, tworzenia lekcji AI, quizów, fiszek, powtórek błędów, historii nauki i raportów postępów.</li>
          <li><strong>2. Usługodawca</strong> — PFConsulting, Piotr Fiszer, ul. Promienista 114, 60-142 Poznań, Polska.</li>
          <li><strong>3. Użytkownik</strong> — osoba korzystająca z aplikacji, w tym uczeń, rodzic, opiekun prawny lub pełnoletni użytkownik.</li>
          <li><strong>4. Uczeń</strong> — użytkownik korzystający z funkcji edukacyjnych aplikacji.</li>
          <li><strong>5. Rodzic / Opiekun prawny</strong> — osoba sprawująca władzę rodzicielską lub opiekę prawną nad użytkownikiem niepełnoletnim.</li>
          <li><strong>6. Konto</strong> — indywidualne konto użytkownika w aplikacji.</li>
          <li><strong>7. Konto dziecka</strong> — konto wykorzystywane przez użytkownika niepełnoletniego, powiązane z kontem rodzica lub opiekuna prawnego.</li>
          <li><strong>8. Konto rodzica</strong> — konto rodzica lub opiekuna prawnego służące do zarządzania korzystaniem z aplikacji przez dziecko, w szczególności w ramach planu rodzinnego.</li>
          <li><strong>9. Materiały Użytkownika</strong> — zdjęcia, pliki, dokumenty, notatki, teksty, obrazy, tekstowe pliki PDF, DOCX lub inne treści przesyłane przez użytkownika do aplikacji.</li>
          <li><strong>10. Lekcja AI</strong> — pojedyncze przetworzenie materiału edukacyjnego w aplikacji, obejmujące do 5 zdjęć albo 1 dokument PDF/DOCX, zgodnie z aktualnym opisem usługi.</li>
          <li><strong>11. AI Tutor</strong> — funkcja aplikacji umożliwiająca rozmowę edukacyjną z systemem sztucznej inteligencji.</li>
          <li><strong>12. Funkcje AI</strong> — funkcje aplikacji wykorzystujące sztuczną inteligencję, w szczególności analiza materiałów, generowanie wyjaśnień, odpowiedzi, quizów, fiszek, rekomendacji nauki, powtórki i raportów.</li>
          <li><strong>13. Plan Darmowy</strong> — bezpłatny zakres korzystania z aplikacji, zgodnie z aktualnym opisem widocznym w aplikacji.</li>
          <li><strong>14. Plan Premium lub Plan Rodzinny</strong> — płatny zakres korzystania z aplikacji, zgodnie z aktualnym opisem widocznym w aplikacji.</li>
          <li><strong>15. Fair use</strong> — zasady uczciwego, rozsądnego i zgodnego z przeznaczeniem korzystania z aplikacji w granicach technicznych, kosztowych, organizacyjnych i bezpieczeństwa określonych przez Usługodawcę.</li>
          <li><strong>16. Usługi cyfrowe</strong> — usługi świadczone drogą elektroniczną za pośrednictwem aplikacji OmniNauka.</li>
          <li><strong>17. Regulamin</strong> — niniejszy regulamin korzystania z aplikacji OmniNauka.</li>
        </ul>
      </section>

      <section>
        <h2>§ 3. Charakter i przeznaczenie OmniNauka</h2>
        <p>1. OmniNauka jest aplikacją edukacyjną AI dla dzieci i młodzieży, wspierającą naukę przez analizę materiałów edukacyjnych, dialog z AI Tutorem, quizy, fiszki, powtórki błędów, historię nauki i raporty postępów.</p>
        <p>2. Aplikacja ma charakter pomocniczy, edukacyjny i wspierający.</p>
        <p>3. OmniNauka nie jest szkołą, placówką oświatową, poradnią psychologiczno-pedagogiczną, oficjalnym narzędziem Centralnej Komisji Egzaminacyjnej, okręgowych komisji egzaminacyjnych, Ministerstwa Edukacji ani żadnej szkoły publicznej lub prywatnej, chyba że zostanie to wyraźnie wskazane w odrębnej umowie lub oficjalnym komunikacie.</p>
        <p>4. OmniNauka nie zastępuje nauczyciela, korepetytora, szkoły, rodzica, podręcznika ani samodzielnej weryfikacji wiedzy.</p>
        <p>5. Aplikacja nie gwarantuje uzyskania określonej oceny, poprawy wyników szkolnych, zdania egzaminu ani uzyskania określonego wyniku egzaminacyjnego.</p>
        <p>6. Aplikacja nie służy do uzyskiwania porad medycznych, psychologicznych, prawnych, finansowych ani innych porad specjalistycznych.</p>
      </section>

      <section>
        <h2>§ 4. Zakres usług świadczonych drogą elektroniczną</h2>
        <p>1. Usługodawca świadczy za pośrednictwem aplikacji w szczególności następujące usługi:</p>
        <ul className="list-[lower-alpha] pl-6 space-y-1">
          <li>rejestrację i obsługę konta,</li>
          <li>logowanie do konta,</li>
          <li>upload materiałów edukacyjnych,</li>
          <li>analizę materiałów edukacyjnych,</li>
          <li>generowanie lekcji AI,</li>
          <li>korzystanie z AI Tutora,</li>
          <li>generowanie quizów, fiszek i powtórek,</li>
          <li>historię nauki,</li>
          <li>dashboard postępów,</li>
          <li>profil użytkownika,</li>
          <li>ustawienia konta,</li>
          <li>raporty błędów i postępów,</li>
          <li>funkcje przygotowania do sprawdzianów,</li>
          <li>funkcje płatne w ramach planów czasowych Premium i Rodzinny.</li>
        </ul>
        <p>2. Zakres funkcji może różnić się w zależności od planu, wersji aplikacji, dostępności technicznej, limitów oraz etapu rozwoju produktu.</p>
        <p>3. Niektóre funkcje mogą być oznaczone jako testowe, beta, pilotażowe albo dostępne w przyszłości.</p>
        <p>4. Funkcje oznaczone jako „wkrótce”, „beta”, „testowe” lub podobne mogą nie być jeszcze dostępne albo mogą działać w ograniczonym zakresie.</p>
      </section>

      <section>
        <h2>§ 5. Warunki techniczne korzystania z aplikacji</h2>
        <p>1. Do korzystania z aplikacji wymagane jest:</p>
        <ul className="list-[lower-alpha] pl-6 space-y-1">
          <li>urządzenie z dostępem do internetu,</li>
          <li>aktualna przeglądarka internetowa lub obsługiwane środowisko aplikacji,</li>
          <li>aktywny adres e-mail,</li>
          <li>możliwość odbierania wiadomości e-mail związanych z rejestracją, bezpieczeństwem, reklamacjami lub płatnościami.</li>
        </ul>
        <p>2. Aplikacja może obsługiwać w szczególności pliki JPG, PNG, WEBP, tekstowe PDF oraz DOCX.</p>
        <p>3. Jakość działania funkcji AI, OCR lub analizy materiałów może zależeć od jakości przesłanych plików, czytelności zdjęć, kompletności dokumentów, dostępności internetu, dostępności usług zewnętrznych oraz obciążenia systemu.</p>
        <p>4. Usługodawca może wprowadzać ograniczenia techniczne dotyczące rozmiaru plików, liczby plików, formatów, częstotliwości przesyłania materiałów oraz liczby zapytań do funkcji AI.</p>
      </section>

      <section>
        <h2>§ 6. Rejestracja, konto i bezpieczeństwo</h2>
        <p>1. Użytkownik może założyć konto w aplikacji z wykorzystaniem adresu e-mail i hasła.</p>
        <p>2. Użytkownik jest zobowiązany do podawania danych prawdziwych, aktualnych i niewprowadzających w błąd.</p>
        <p>3. Użytkownik odpowiada za zachowanie poufności danych logowania i nie powinien udostępniać konta osobom nieuprawnionym.</p>
        <p>4. W przypadku podejrzenia nieuprawnionego dostępu do konta użytkownik powinien niezwłocznie skontaktować się z Usługodawcą.</p>
        <p>5. Usługodawca może zastosować dodatkowe mechanizmy bezpieczeństwa, takie jak potwierdzenie adresu e-mail, reset hasła, komunikaty bezpieczeństwa lub inne środki chroniące konto.</p>
        <p>6. Użytkownik nie może korzystać z konta innej osoby bez jej zgody ani tworzyć kont w celu obchodzenia limitów, nadużyć, testowania zabezpieczeń lub działania na szkodę aplikacji.</p>
      </section>

      <section>
        <h2>§ 7. Użytkownicy niepełnoletni i zgoda rodzica lub opiekuna</h2>
        <p>1. Aplikacja OmniNauka jest przeznaczona również dla uczniów, w tym osób niepełnoletnich, jednak zasady korzystania z aplikacji zależą od wieku użytkownika oraz zakresu funkcji, z których korzysta.</p>
        <p>2. Użytkownik, który nie ukończył 13 lat, korzysta z aplikacji za pośrednictwem konta powiązanego z kontem rodzica lub opiekuna prawnego w ramach funkcjonalności Panelu Rodzica.</p>
        <p>3. Użytkownik, który ukończył 13 lat, ale nie ukończył 16 lat, korzysta z aplikacji za zgodą lub akceptacją rodzica albo opiekuna prawnego, w szczególności w zakresie przetwarzania danych osobowych, utworzenia konta oraz korzystania z funkcji wymagających przesyłania materiałów edukacyjnych.</p>
        <p>4. Użytkownik, który ukończył 16 lat, korzysta z aplikacji zgodnie z Regulaminem, z zastrzeżeniem ograniczeń wynikających z przepisów prawa, w szczególności dotyczących zawierania umów płatnych przez osoby niepełnoletnie.</p>
        <p>5. Umowy dotyczące usług płatnych są zawierane przez osobę pełnoletnią albo przez rodzica lub opiekuna prawnego działającego na rzecz użytkownika niepełnoletniego.</p>
        <p>6. Rodzic lub opiekun prawny odpowiada za nadzór nad korzystaniem z aplikacji przez dziecko oraz za upewnienie się, że dziecko nie przesyła do aplikacji danych wrażliwych, dokumentów tożsamości, danych osób trzecich, materiałów naruszających prawa autorskie lub innych treści, których nie powinno przesyłać.</p>
        <p>7. Usługodawca może stosować odpowiednie środki weryfikacji wieku użytkownika oraz zgody rodzica lub opiekuna prawnego, proporcjonalne do rodzaju usługi, dostępnej technologii i ryzyka związanego z przetwarzaniem danych dzieci. Konto dziecka poniżej 13 roku życia może korzystać z funkcji edukacyjnych wyłącznie po wcześniejszym dodaniu adresu e-mail dziecka przez rodzica lub opiekuna prawnego w Panelu Rodzica i powiązaniu konta z tym adresem. Konta niepowiązane z rodzicem lub opiekunem mogą zostać zablokowane, oznaczone do usunięcia lub usunięte po upływie określonego czasu, w szczególności po 72 godzinach od rozpoczęcia rejestracji bez powiązania.</p>
        <p>8. Usługodawca może odmówić świadczenia usług lub ograniczyć dostęp do wybranych funkcji, jeżeli nie uzyska wymaganej zgody rodzica lub opiekuna prawnego albo jeżeli istnieje uzasadnione podejrzenie, że konto zostało utworzone z naruszeniem zasad dotyczących wieku użytkownika.</p>
      </section>

      <section>
        <h2>§ 8. Proste zasady OmniNauka dla ucznia</h2>
        <p>1. OmniNauka pomaga Ci się uczyć, ale AI może się pomylić.</p>
        <p>2. Nie traktuj odpowiedzi AI jako jedynego źródła prawdy. Ważne informacje sprawdź w podręczniku, u nauczyciela albo z rodzicem.</p>
        <p>3. Nie wysyłaj dokumentów z PESEL-em, adresem, numerem telefonu, danymi zdrowotnymi ani zdjęciami innych osób.</p>
        <p>4. Wysyłaj tylko takie notatki, zdjęcia i pliki, z których możesz korzystać.</p>
        <p>5. Nie używaj aplikacji do obrażania, oszukiwania, nękania ani obchodzenia limitów.</p>
        <p>6. OmniNauka nie jest oficjalnym narzędziem CKE i nie gwarantuje oceny ani wyniku egzaminu.</p>
        <p>7. Jeśli coś Cię zaniepokoi albo odpowiedź wygląda źle, pokaż to dorosłemu.</p>
        <p>8. Powyższe proste zasady nie zastępują całego Regulaminu, ale pomagają uczniowi zrozumieć najważniejsze obowiązki i ograniczenia.</p>
      </section>

      <section>
        <h2>§ 9. Materiały przesyłane przez użytkownika</h2>
        <p>1. Użytkownik może przesyłać do aplikacji materiały edukacyjne wyłącznie w celu korzystania z funkcji OmniNauka, w szczególności utworzenia lekcji AI, quizów, fiszek, powtórek, raportów i historii nauki.</p>
        <p>2. Użytkownik oświadcza, że posiada prawo do korzystania z przesyłanych materiałów w zakresie niezbędnym do użycia ich w aplikacji, w szczególności że przesłanie materiałów nie narusza praw autorskich, praw osobistych, prywatności ani innych praw osób trzecich.</p>
        <p>3. Zabronione jest przesyłanie do aplikacji:</p>
        <ul className="list-[lower-alpha] pl-6 space-y-1">
          <li>dokumentów tożsamości, numerów PESEL, danych finansowych, danych logowania lub innych poufnych danych,</li>
          <li>danych dotyczących zdrowia, opinii psychologicznych, orzeczeń lub innych danych szczególnych kategorii,</li>
          <li>danych osobowych osób trzecich bez odpowiedniej podstawy prawnej,</li>
          <li>zdjęć osób, jeżeli nie jest to konieczne do nauki,</li>
          <li>materiałów naruszających prawa autorskie lub inne prawa osób trzecich,</li>
          <li>treści bezprawnych, przemocowych, seksualnych, dyskryminujących, obraźliwych lub nieodpowiednich dla osób niepełnoletnich,</li>
          <li>treści zawierających złośliwe oprogramowanie, wirusy lub elementy zakłócające działanie aplikacji.</li>
        </ul>
        <p>4. Usługodawca może usunąć, ograniczyć przetwarzanie lub zablokować dostęp do materiałów, jeżeli istnieje uzasadnione podejrzenie, że naruszają one Regulamin, przepisy prawa lub prawa osób trzecich.</p>
        <p>5. Materiały użytkownika są przetwarzane wyłącznie w zakresie niezbędnym do świadczenia usług, zapewnienia bezpieczeństwa aplikacji, obsługi konta oraz wykonania obowiązków prawnych Usługodawcy.</p>
      </section>

      <section>
        <h2>§ 10. Licencja techniczna na materiały użytkownika</h2>
        <p>1. Użytkownik zachowuje prawa do materiałów przesłanych do aplikacji.</p>
        <p>2. Przesyłając materiały do OmniNauka, użytkownik udziela Usługodawcy niewyłącznej, nieodpłatnej licencji technicznej na korzystanie z tych materiałów wyłącznie w zakresie niezbędnym do świadczenia usług w aplikacji.</p>
        <p>3. Licencja obejmuje w szczególności:</p>
        <ul className="list-[lower-alpha] pl-6 space-y-1">
          <li>przyjęcie i zapisanie materiału w systemie,</li>
          <li>techniczne przetworzenie materiału,</li>
          <li>analizę materiału przez funkcje AI lub OCR,</li>
          <li>wygenerowanie lekcji AI,</li>
          <li>obsługę AI Tutora, quizów, fiszek, powtórek i raportów,</li>
          <li>zapis historii nauki,</li>
          <li>diagnostykę błędów, bezpieczeństwo i prawidłowe działanie aplikacji.</li>
        </ul>
        <p>4. Licencja nie oznacza przeniesienia praw autorskich na Usługodawcę.</p>
        <p>5. Licencja wygasa w zakresie, w jakim materiały nie są już potrzebne do świadczenia usług, obsługi konta, zabezpieczenia roszczeń, spełnienia obowiązków prawnych albo technicznego odtworzenia danych z kopii bezpieczeństwa.</p>
      </section>

      <section>
        <h2>§ 11. Wykorzystywanie materiałów do rozwoju systemów AI</h2>
        <p>1. Materiały przesyłane przez użytkowników nie są wykorzystywane do trenowania publicznych modeli sztucznej inteligencji bez odrębnej podstawy prawnej oraz, jeżeli jest to wymagane, bez odrębnej, wyraźnej zgody użytkownika, rodzica lub opiekuna prawnego.</p>
        <p>2. Usługodawca może przetwarzać materiały użytkownika w sposób techniczny wyłącznie w zakresie koniecznym do świadczenia usługi, w tym do analizy materiału, wygenerowania lekcji AI, obsługi AI Tutora, zapewnienia bezpieczeństwa oraz diagnostyki błędów.</p>
        <p>3. Jeżeli w przyszłości Usługodawca zamierzałby wykorzystywać materiały użytkowników do ulepszania własnych modeli, funkcji lub systemów AI w zakresie wykraczającym poza bieżące świadczenie usługi, użytkownik zostanie o tym poinformowany przed rozpoczęciem takiego przetwarzania.</p>
        <p>4. W przypadku materiałów użytkowników niepełnoletnich takie przetwarzanie powinno podlegać szczególnej ocenie ryzyka, zasadom minimalizacji danych oraz, jeżeli jest to wymagane, osobnej zgodzie rodzica lub opiekuna prawnego.</p>
      </section>

      <section>
        <h2>§ 12. Zasady działania funkcji AI</h2>
        <p>1. OmniNauka wykorzystuje systemy sztucznej inteligencji do analizy materiałów edukacyjnych oraz generowania wyjaśnień, odpowiedzi, quizów, fiszek, rekomendacji i raportów nauki.</p>
        <p>2. Użytkownik przyjmuje do wiadomości, że treści generowane przez AI mogą być błędne, niepełne, nieaktualne, nieprecyzyjne, nieodpowiednie do konkretnego programu nauczania albo niewystarczające do samodzielnego przygotowania się do sprawdzianu lub egzaminu.</p>
        <p>3. AI Tutor i inne funkcje AI mają charakter pomocniczy i edukacyjny. Nie zastępują nauczyciela, szkoły, korepetytora, rodzica, podręcznika ani samodzielnej weryfikacji wiedzy.</p>
        <p>4. Użytkownik powinien weryfikować ważne informacje, w szczególności odpowiedzi dotyczące egzaminów, ocen, zadań matematycznych, chemicznych, fizycznych, biologicznych, historycznych lub innych treści wymagających szczególnej dokładności.</p>
        <p>5. OmniNauka nie gwarantuje uzyskania określonej oceny, poprawy wyników szkolnych, zdania egzaminu, uzyskania określonego wyniku egzaminacyjnego ani zgodności każdej odpowiedzi z wymaganiami konkretnej szkoły, nauczyciela, programu nauczania lub arkusza egzaminacyjnego.</p>
        <p>6. Usługodawca dokłada starań, aby użytkownik był informowany, kiedy korzysta z funkcji opartych na sztucznej inteligencji.</p>
        <p>7. Funkcje AI powinny być używane zgodnie z ich przeznaczeniem edukacyjnym i nie mogą być wykorzystywane do działań bezprawnych, oszustw, nękania, generowania treści szkodliwych, obchodzenia zabezpieczeń ani innych działań niezgodnych z Regulaminem.</p>
      </section>

      <section>
        <h2>§ 13. Brak oficjalnej afiliacji z CKE i instytucjami publicznymi</h2>
        <p>1. OmniNauka może oferować funkcje wspierające przygotowanie do egzaminu ósmoklasisty, matury lub innych sprawdzianów, w tym zadania w stylu egzaminacyjnym, arkusze próbne i raporty błędów.</p>
        <p>2. OmniNauka nie jest oficjalnym narzędziem Centralnej Komisji Egzaminacyjnej, okręgowych komisji egzaminacyjnych, Ministerstwa Edukacji ani żadnej szkoły, chyba że wyraźnie wskazano inaczej w odrębnej umowie lub oficjalnym komunikacie.</p>
        <p>3. Określenia takie jak „w stylu egzaminacyjnym”, „arkusz próbny”, „przygotowanie do egzaminu”, „tryb egzaminacyjny” lub podobne oznaczają materiały pomocnicze i edukacyjne, a nie oficjalne materiały CKE, OKE, Ministerstwa Edukacji lub szkoły.</p>
        <p>4. Usługodawca nie powinien używać w komunikacji marketingowej sformułowań sugerujących oficjalną certyfikację, zatwierdzenie, akredytację lub współpracę z CKE, OKE, Ministerstwem Edukacji albo szkołą, jeżeli taka współpraca nie istnieje.</p>
      </section>

      <section>
        <h2>§ 14. Limity korzystania i zasady fair use</h2>
        <p>1. OmniNauka korzysta z narzędzi sztucznej inteligencji (AI), technologii rozpoznawania tekstu (OCR) oraz automatycznego przetwarzania materiałów edukacyjnych. Ze względu na koszty operacyjne, bezpieczeństwo działania usługi oraz stabilność systemu Operator stosuje limity korzystania z wybranych funkcji.</p>
        <p>2. Limity mogą dotyczyć w szczególności:</p>
        <ul className="list-[lower-alpha] pl-6 space-y-1">
          <li>liczby lekcji AI dziennie lub w innym okresie,</li>
          <li>liczby wiadomości wymienianych z AI Tutorem,</li>
          <li>liczby przesyłanych zdjęć lub dokumentów (skany OCR),</li>
          <li>regeneracji materiałów, fiszek, quizów i sprawdzianów,</li>
          <li>pojemności przechowywania materiałów i historii nauki.</li>
        </ul>
        <p>3. Plan Premium lub Rodzinny zwiększa dostępne limity i odblokowuje funkcje rozszerzone, ale nie oznacza nielimitowanego korzystania z usługi. Korzystanie z funkcji AI odbywa się w ramach zasad fair use.</p>
        <p>4. Aktualne limity techniczne mogą być prezentowane w aplikacji, cenniku, komunikatach systemowych lub dokumentacji usługi. Jedna lekcja AI oznacza przetworzenie do 5 zdjęć albo 1 dokumentu PDF/DOCX, chyba że opis usługi stanowi inaczej.</p>
        <p>5. Operator może czasowo ograniczyć, spowolnić lub zablokować dostęp do wybranych funkcji w przypadku:</p>
        <ul className="list-[lower-alpha] pl-6 space-y-1">
          <li>nadużyć lub działań automatycznych (boty),</li>
          <li>nietypowego użycia wykraczającego poza standardową naukę ucznia,</li>
          <li>nadmiernego obciążenia systemu zagrażającego stabilności usługi,</li>
          <li>naruszenia zasad fair use lub Regulaminu.</li>
        </ul>
        <p>6. Usługodawca dokłada starań, aby limity były dobrane w sposób zapewniający komfortową naukę, jednocześnie chroniąc projekt przed niekontrolowanymi kosztami i nadużyciami.</p>
      </section>

      <section>
        <h2>§ 15. Plany cenowe i usługi płatne</h2>
        <p>1. Aplikacja jest oferowana w planach bezpłatnych i płatnych. Aktualny zakres planów, ceny, limity i dostępność funkcji są prezentowane użytkownikowi w aplikacji przed zakupem usługi płatnej.</p>
        <p>2. Plan Darmowy obejmuje w szczególności:</p>
        <ul className="list-[lower-alpha] pl-6 space-y-1">
          <li>0 zł,</li>
          <li>dostęp do podstawowych funkcji w ramach określonych limitów bezpłatnych zapytań AI,</li>
          <li>AI Tutor w wersji podstawowej,</li>
          <li>quizy z wyjaśnieniami,</li>
          <li>historię nauki.</li>
        </ul>
        <p>3. Plan Premium 30 dni obejmuje dostęp do rozszerzonych funkcji aplikacji (takich jak dodatkowe lekcje AI każdego dnia, zaawansowany AI Tutor, sprawdzian Premium, powtórki fiszek Premium i pełny raport błędów) na okres 30 dni od momentu aktywacji. Dostęp ma charakter jednorazowy i nie odnawia się automatycznie.</p>
        <p>4. Plan Rodzinny 30 dni obejmuje funkcje planu Premium dla maksymalnie 3 kont uczniów powiązanych z kontem rodzica/opiekuna oraz dostęp do Panelu Rodzica na okres 30 dni od momentu aktywacji. Dostęp ma charakter jednorazowy i nie odnawia się automatycznie.</p>
        <p>5. Dodatkowe pakiety lekcji AI są oferowane według cennika i warunków widocznych w aplikacji przed dokonaniem zakupu.</p>
        <p>6. Aktualna cena, zakres i czas trwania dostępu płatnego są prezentowane użytkownikowi bezpośrednio przed dokonaniem zakupu.</p>
        <p>7. Ceny, zakres planów i dostępność funkcji mogą ulegać zmianie. Zmiany nie naruszają praw nabytych konsumenta wynikających z obowiązujących przepisów prawa.</p>
        <p>8. Informacje prezentowane w aplikacji przed zakupem jednoznacznie wskazują, co użytkownik kupuje, jaka jest cena, jaki jest okres dostępu, jaki jest charakter płatności (dostęp jednorazowy, brak automatycznego odnawiania), jakie są limity oraz jak można zrezygnować z usługi.</p>
      </section>

      <section>
        <h2>§ 16. Zasady jednorazowego dostępu płatnego</h2>
        <p>1. Usługi płatne są oferowane jako jednorazowy dostęp czasowy, np. Premium na 30 dni.</p>
        <p>2. Umowa o usługę płatną zostaje zawarta z chwilą potwierdzenia zakupu przez użytkownika oraz otrzymania przez Usługodawcę potwierdzenia skutecznej płatności.</p>
        <p>3. Zakres, cena i czas trwania są pokazywane użytkownikowi przed zakupem.</p>
        <p>4. Płatności może dokonywać wyłącznie osoba pełnoletnia albo rodzic lub opiekun prawny.</p>
        <p>5. Usługodawca obecnie nie oferuje subskrypcji odnawialnych. Dostęp płatny wygasa automatycznie po upływie wykupionego okresu.</p>
        <p>6. Jeżeli w przyszłości zostaną wprowadzone inne modele płatności, regulamin i komunikaty w aplikacji zostaną odpowiednio zaktualizowane przed ich uruchomieniem.</p>
      </section>

      <section>
        <h2>§ 17. Płatności</h2>
        <p>1. Płatności za usługi płatne są obsługiwane przez zewnętrznych operatorów płatności, takich jak Stripe lub inny dostawca wskazany w aplikacji.</p>
        <p>2. Przed dokonaniem płatności użytkownik otrzymuje jasne informacje o:</p>
        <ul className="list-[lower-alpha] pl-6 space-y-1">
          <li>sprzedawcy usługi,</li>
          <li>cenie brutto,</li>
          <li>rodzaju płatności,</li>
          <li>zakresie kupowanej usługi,</li>
          <li>okresie dostępu,</li>
          <li>limitach,</li>
          <li>braku automatycznego odnawiania,</li>
          <li>zasadach rezygnacji,</li>
          <li>prawie odstąpienia od umowy.</li>
        </ul>
        <p>3. Usługodawca nie przechowuje pełnych danych karty płatniczej. Obsługa płatności odbywa się za pośrednictwem zewnętrznego dostawcy płatności.</p>
        <p>4. Szczegółowe zasady płatności wynikają z regulaminów operatorów płatności, z których korzysta użytkownik.</p>
        <p>5. W przypadku płatności realizowanych przez platformy mobilne (np. Google Play, Apple App Store), zastosowanie mają regulaminy i zasady tych platform.</p>
      </section>

      <section>
        <h2>§ 18. Prawo odstąpienia od umowy</h2>
        <p>1. Konsumentowi przysługuje prawo odstąpienia od umowy zawartej na odległość w terminie 14 dni zgodnie z obowiązującymi przepisami prawa konsumenckiego.</p>
        <p>2. Szczegółowe zasady odstąpienia od umowy, w tym informacje dotyczące ewentualnej utraty prawa odstąpienia w przypadku wyrażenia zgody na natychmiastowe rozpoczęcie świadczenia i dostarczania treści cyfrowych, są przedstawiane użytkownikowi w procesie zakupowym przed dokonaniem płatności.</p>
        <p>3. Użytkownik może złożyć oświadczenie o odstąpieniu od umowy kontaktując się z Usługodawcą drogą elektroniczną na adres e-mail: <a href="mailto:piotr.fiszer@pfconsulting.pl">piotr.fiszer@pfconsulting.pl</a>.</p>
      </section>

      <section>
        <h2>§ 19. Reklamacje</h2>
        <p>1. Użytkownik może złożyć reklamację dotyczącą działania aplikacji, konta, funkcji AI, płatności lub innych usług świadczonych drogą elektroniczną.</p>
        <p>2. Reklamację należy przesłać na adres e-mail: <a href="mailto:piotr.fiszer@pfconsulting.pl">piotr.fiszer@pfconsulting.pl</a>.</p>
        <p>3. Reklamacja powinna zawierać:</p>
        <ul className="list-[lower-alpha] pl-6 space-y-1">
          <li>imię i nazwisko albo nazwę użytkownika,</li>
          <li>adres e-mail powiązany z kontem,</li>
          <li>opis problemu,</li>
          <li>datę wystąpienia problemu,</li>
          <li>oczekiwany sposób rozwiązania sprawy.</li>
        </ul>
        <p>4. Usługodawca rozpatruje reklamacje w terminie 14 dni od dnia ich otrzymania.</p>
        <p>5. Jeżeli reklamacja nie zawiera informacji potrzebnych do jej rozpatrzenia, Usługodawca zwraca się do użytkownika o jej uzupełnienie.</p>
        <p>6. Żadne postanowienie Regulaminu nie ogranicza praw konsumenta wynikających z przepisów dotyczących niezgodności usługi cyfrowej lub treści cyfrowej z umową.</p>
      </section>

      <section>
        <h2>§ 20. Zakazane sposoby korzystania</h2>
        <p>1. Użytkownik nie może korzystać z aplikacji w sposób:</p>
        <ul className="list-[lower-alpha] pl-6 space-y-1">
          <li>sprzeczny z prawem,</li>
          <li>naruszający prawa osób trzecich,</li>
          <li>prowadzący do obejścia limitów,</li>
          <li>polegający na automatycznym masowym generowaniu treści,</li>
          <li>zakłócający działanie aplikacji,</li>
          <li>polegający na próbach uzyskania nieuprawnionego dostępu do systemów, kont lub danych,</li>
          <li>polegający na przesyłaniu szkodliwego kodu,</li>
          <li>naruszający bezpieczeństwo dzieci lub innych użytkowników,</li>
          <li>wykorzystujący aplikację do nękania, obrażania, dyskryminacji, oszustw lub działań nieuczciwych,</li>
          <li>wykorzystujący funkcje AI do generowania treści bezprawnych, szkodliwych, niebezpiecznych lub nieodpowiednich dla osób niepełnoletnich.</li>
        </ul>
        <p>2. Zabronione jest podejmowanie prób reverse engineeringu, testowania zabezpieczeń, automatycznego scrapowania, masowego generowania kont lub używania botów bez zgody Usługodawcy.</p>
        <p>3. Zabronione jest sprzedawanie, odsprzedawanie, udostępnianie lub komercyjne wykorzystywanie dostępu do aplikacji bez zgody Usługodawcy.</p>
      </section>

      <section>
        <h2>§ 21. Treści bezprawne i zgłoszenia naruszeń</h2>
        <p>1. Jeżeli użytkownik lub osoba trzecia uzna, że w aplikacji znajdują się treści bezprawne, naruszające prawa autorskie, dobra osobiste, prywatność lub inne prawa, może zgłosić to Usługodawcy na adres: <a href="mailto:piotr.fiszer@pfconsulting.pl">piotr.fiszer@pfconsulting.pl</a>.</p>
        <p>2. Zgłoszenie powinno zawierać:</p>
        <ul className="list-[lower-alpha] pl-6 space-y-1">
          <li>dane osoby zgłaszającej,</li>
          <li>opis naruszenia,</li>
          <li>wskazanie treści, konta lub materiału, którego dotyczy zgłoszenie,</li>
          <li>uzasadnienie zgłoszenia,</li>
          <li>dane kontaktowe do odpowiedzi.</li>
        </ul>
        <p>3. Usługodawca podejmuje odpowiednie działania, w tym w uzasadnionych przypadkach:</p>
        <ul className="list-[lower-alpha] pl-6 space-y-1">
          <li>prosi o dodatkowe informacje,</li>
          <li>ogranicza dostęp do treści,</li>
          <li>usuwa treść,</li>
          <li>zablokuje konto,</li>
          <li>odmawia usunięcia treści, jeżeli zgłoszenie jest oczywiście bezzasadne.</li>
        </ul>
        <p>4. Użytkownik, którego treść została usunięta albo konto zostało ograniczone, może złożyć odwołanie na adres e-mail Usługodawcy.</p>
        <p>5. Zakres obowiązków Usługodawcy związanych z treściami bezprawnymi może zależeć od faktycznego modelu działania aplikacji, w szczególności od tego, czy aplikacja umożliwia publiczne udostępnianie treści innym użytkownikom.</p>
      </section>

      <section>
        <h2>§ 22. Dane osobowe i cookies</h2>
        <p>1. Zasady przetwarzania danych osobowych użytkowników określa Polityka Prywatności RODO oraz odpowiednie klauzule informacyjne dostępne w aplikacji lub na stronie internetowej.</p>
        <p>2. Zasady korzystania z plików cookies i technologii podobnych określa Polityka Cookies.</p>
        <p>3. Użytkownik nie powinien przesyłać do aplikacji danych wrażliwych ani danych osobowych osób trzecich, jeżeli nie jest to konieczne do korzystania z aplikacji i nie posiada odpowiedniej podstawy prawnej.</p>
        <p>4. W przypadku użytkowników niepełnoletnich informacje dotyczące przetwarzania danych osobowych powinny być przedstawione w sposób zrozumiały dla dziecka oraz rodzica lub opiekuna prawnego.</p>
        <p>5. Usługodawca może korzystać z dostawców zewnętrznych wspierających działanie aplikacji, takich jak hosting, baza danych, przechowywanie plików, OCR, narzędzia AI, analityka, płatności lub poczta e-mail, zgodnie z Polityką Prywatności i zawartymi umowami powierzenia lub innymi właściwymi podstawami prawnymi.</p>
      </section>

      <section>
        <h2>§ 23. Retencja danych i usuwanie materiałów</h2>
        <p>1. Materiały Użytkownika są przechowywane przez okres niezbędny do świadczenia usług, obsługi konta, zachowania historii nauki, realizacji funkcji aplikacji, bezpieczeństwa, rozpatrywania reklamacji oraz spełnienia obowiązków prawnych.</p>
        <p>2. Użytkownik ma prawo złożyć wniosek o usunięcie konta lub określonych danych, zgodnie z zasadami opisanymi w Regulaminie i Polityce Prywatności.</p>
        <p>3. Usunięcie konta skutkuje utratą dostępu do historii nauki, lekcji AI, quizów, raportów, materiałów użytkownika i ustawień konta.</p>
        <p>4. Niektóre dane są przechowywane przez dłuższy okres, jeżeli jest to wymagane przez przepisy prawa, obowiązki księgowe, podatkowe, rozpatrywanie reklamacji, zabezpieczenie roszczeń lub bezpieczeństwo systemu.</p>
        <p>5. Dane pozostają przez ograniczony czas w kopiach bezpieczeństwa, zanim zostaną trwale usunięte w ramach standardowego cyklu technicznego usuwania backupów. Konta dzieci poniżej 13 roku życia, które nie zostały powiązane z kontem rodzica lub opiekuna prawnego w terminie 72 godzin od rejestracji, są usuwane zgodnie z zasadą minimalizacji danych.</p>
        <p>6. Szczegółowe okresy retencji danych są określone w Polityce Prywatności.</p>
      </section>

      <section>
        <h2>§ 24. Odpowiedzialność Usługodawcy</h2>
        <p>1. Usługodawca dokłada należytej staranności, aby aplikacja działała prawidłowo, bezpiecznie i zgodnie z opisem usługi.</p>
        <p>2. Usługodawca nie gwarantuje, że:</p>
        <ul className="list-[lower-alpha] pl-6 space-y-1">
          <li>aplikacja będzie działała nieprzerwanie i bez jakichkolwiek błędów,</li>
          <li>każda odpowiedź AI będzie poprawna, pełna lub zgodna z oczekiwaniami użytkownika,</li>
          <li>korzystanie z aplikacji zapewni określony wynik szkolny, egzaminacyjny lub edukacyjny,</li>
          <li>materiały przesłane przez użytkownika będą zawsze możliwe do prawidłowego odczytania, jeżeli są nieczytelne, uszkodzone, niekompletne lub złej jakości,</li>
          <li>aplikacja będzie zgodna z wymaganiami konkretnego nauczyciela, szkoły, podręcznika, programu nauczania lub arkusza egzaminacyjnego.</li>
        </ul>
        <p>3. Usługodawca nie ponosi odpowiedzialności za treści przesłane przez użytkownika, jeżeli nie miał wiedzy o ich bezprawnym charakterze i podjął odpowiednie działania po uzyskaniu wiarygodnej informacji o naruszeniu.</p>
        <p>4. Usługodawca nie ponosi odpowiedzialności za skutki korzystania z aplikacji w sposób sprzeczny z Regulaminem, prawem, przeznaczeniem aplikacji lub instrukcjami bezpieczeństwa.</p>
        <p>5. Żadne postanowienie Regulaminu nie ogranicza praw konsumenta wynikających z bezwzględnie obowiązujących przepisów prawa, w szczególności praw dotyczących niezgodności usługi cyfrowej lub treści cyfrowej z umową.</p>
      </section>

      <section>
        <h2>§ 25. Przerwy techniczne i zmiany funkcji</h2>
        <p>1. Usługodawca może wprowadzać przerwy techniczne, aktualizacje, poprawki bezpieczeństwa, zmiany funkcji oraz inne działania niezbędne do utrzymania i rozwoju aplikacji.</p>
        <p>2. Usługodawca będzie starał się, aby przerwy techniczne były możliwie najmniej uciążliwe dla użytkowników.</p>
        <p>3. Niektóre funkcje mogą zostać zmienione, ograniczone, zastąpione lub wycofane, jeżeli jest to uzasadnione rozwojem produktu, bezpieczeństwem, kosztami technicznymi, zmianą prawa, zmianą dostawców zewnętrznych lub potrzebą przeciwdziałania nadużyciom.</p>
        <p>4. Zmiany istotnie wpływające na prawa użytkowników, szczególnie użytkowników płatnych, powinny być komunikowane z odpowiednim wyprzedzeniem, chyba że natychmiastowa zmiana jest konieczna ze względów bezpieczeństwa, prawnych lub technicznych.</p>
      </section>

      <section>
        <h2>§ 26. Zmiany Regulaminu</h2>
        <p>1. Usługodawca może zmienić Regulamin w przypadku:</p>
        <ul className="list-[lower-alpha] pl-6 space-y-1">
          <li>zmiany przepisów prawa,</li>
          <li>zmiany zakresu lub sposobu działania aplikacji,</li>
          <li>wdrożenia nowych funkcji,</li>
          <li>zmiany modelu płatności,</li>
          <li>konieczności doprecyzowania zasad bezpieczeństwa,</li>
          <li>przeciwdziałania nadużyciom,</li>
          <li>dostosowania Regulaminu do wymagań technicznych,</li>
          <li>zmiany dostawców zewnętrznych,</li>
          <li>zmiany zasad działania funkcji AI.</li>
        </ul>
        <p>2. Użytkownicy powinni zostać poinformowani o istotnych zmianach Regulaminu w sposób odpowiedni do charakteru zmiany, np. przez komunikat w aplikacji lub wiadomość e-mail.</p>
        <p>3. Zmiany Regulaminu nie powinny naruszać praw nabytych konsumenta wynikających z obowiązujących przepisów prawa.</p>
        <p>4. Jeżeli użytkownik nie akceptuje zmian Regulaminu, może zakończyć korzystanie z aplikacji.</p>
      </section>

      <section>
        <h2>§ 27. Rozwiązanie umowy i usunięcie konta</h2>
        <p>1. Użytkownik może zakończyć korzystanie z aplikacji oraz złożyć wniosek o usunięcie konta.</p>
        <p>2. Wniosek o usunięcie konta można złożyć w ustawieniach konta, jeżeli taka funkcja jest dostępna, albo kontaktując się z Usługodawcą pod adresem e-mail: <a href="mailto:piotr.fiszer@pfconsulting.pl">piotr.fiszer@pfconsulting.pl</a>.</p>
        <p>3. Usługodawca może ograniczyć dostęp do konta, zawiesić konto lub zablokować konto w przypadku:</p>
        <ul className="list-[lower-alpha] pl-6 space-y-1">
          <li>naruszenia Regulaminu,</li>
          <li>działań bezprawnych,</li>
          <li>obchodzenia limitów,</li>
          <li>nadużyć technicznych,</li>
          <li>naruszenia praw osób trzecich,</li>
          <li>działań zagrażających bezpieczeństwu aplikacji,</li>
          <li>braku wymaganej zgody rodzica lub opiekuna prawnego.</li>
        </ul>
        <p>4. Usunięcie konta nie wpływa na obowiązki płatnicze, księgowe, podatkowe, reklamacyjne lub archiwizacyjne, które powstały przed usunięciem konta.</p>
        <p>5. Usunięcie konta nie musi oznaczać natychmiastowego usunięcia wszystkich danych z kopii bezpieczeństwa, jeżeli ich usunięcie następuje w ramach standardowego cyklu technicznego backupów.</p>
      </section>

      <section>
        <h2>§ 28. Prawo właściwe i rozstrzyganie sporów</h2>
        <p>1. Do Regulaminu oraz umów zawieranych na jego podstawie stosuje się prawo polskie, z zastrzeżeniem bezwzględnie obowiązujących przepisów prawa Unii Europejskiej oraz przepisów chroniących konsumenta, których nie można wyłączyć umownie.</p>
        <p>2. Wybór prawa polskiego nie pozbawia konsumenta ochrony przyznanej mu na podstawie bezwzględnie obowiązujących przepisów prawa państwa, w którym konsument ma miejsce zwykłego pobytu, jeżeli taka ochrona wynika z obowiązujących przepisów.</p>
        <p>3. Spory z konsumentami będą rozstrzygane przez właściwe sądy zgodnie z obowiązującymi przepisami prawa.</p>
        <p>4. Żadne postanowienie Regulaminu nie ogranicza prawa konsumenta do korzystania z właściwych środków ochrony prawnej.</p>
        <p>5. Regulamin nie wprowadza obowiązkowego arbitrażu ani obowiązkowej rezygnacji z dochodzenia roszczeń przed sądem.</p>
      </section>

      <section>
        <h2>§ 29. Postanowienia końcowe</h2>
        <p>1. Regulamin jest udostępniany użytkownikowi nieodpłatnie przed rozpoczęciem korzystania z aplikacji w sposób umożliwiający jego pozyskanie, odtwarzanie i utrwalanie.</p>
        <p>2. W sprawach nieuregulowanych Regulaminem zastosowanie mają właściwe przepisy prawa polskiego oraz prawa Unii Europejskiej.</p>
        <p>3. Postanowienia Regulaminu nie wyłączają ani nie ograniczają praw konsumenta przysługujących mu na podstawie bezwzględnie obowiązujących przepisów prawa.</p>
        <p>4. Niniejszy Regulamin wchodzi w życie z dniem 26.04.2026 i jest oznaczony jako wersja REGULAMIN_v02. Wszelkie archiwalne wersje regulaminu są przechowywane przez Usługodawcę i udostępniane na żądanie Użytkownika.</p>
      </section>
    </LegalPageLayout>
  );
}
