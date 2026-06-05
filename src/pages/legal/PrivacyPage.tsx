import LegalPageLayout from '../../components/legal/LegalPageLayout';
import { useTranslation } from 'react-i18next';

export default function PrivacyPage() {
  const { t } = useTranslation();
  return (
    <LegalPageLayout title={t('home.footer.legal.privacy', 'Polityka prywatności')} lastUpdated="26.04.2026">
      <section>
        <h2>1. Administrator Danych Osobowych</h2>
        <p>Administratorem Twoich danych osobowych jest:</p>
        <p>
          <strong>PFConsulting Piotr Fiszer</strong><br />
          ul. Promienista 114, 60-142 Poznań, Polska<br />
          E-mail: <a href="mailto:piotr.fiszer@pfconsulting.pl">piotr.fiszer@pfconsulting.pl</a>
        </p>
      </section>

      <section>
        <h2>2. Kontakt</h2>
        <p>
          W sprawach związanych z ochroną danych osobowych możesz skontaktować się z nami pod adresem: <a href="mailto:piotr.fiszer@pfconsulting.pl">piotr.fiszer@pfconsulting.pl</a>.
        </p>
      </section>

      <section>
        <h2>3. Kategorie przetwarzanych danych</h2>
        <p>Przetwarzamy następujące dane:</p>
        <ul>
          <li><strong>Dane identyfikacyjne:</strong> Adres e-mail, nazwa profilu (imię/pseudonim).</li>
          <li><strong>Materiały edukacyjne:</strong> Przesłane zdjęcia (notatki), dokumenty (PDF, DOCX).</li>
          <li><strong>Treści generowane przez AI:</strong> Podsumowania, fiszki, pytania, historia rozmów z AI Tutorem.</li>
          <li><strong>Dane techniczne:</strong> Adres IP, logi systemowe, dane o urządzeniu.</li>
        </ul>
      </section>

      <section>
        <h2>4. Cele i podstawy prawne przetwarzania</h2>
        <ul>
          <li><strong>Świadczenie usług (Art. 6 ust. 1 lit. b RODO):</strong> Realizacja funkcji aplikacji, prowadzenie konta Użytkownika.</li>
          <li><strong>Zgoda (Art. 6 ust. 1 lit. a RODO):</strong> Analiza materiałów przez silniki AI.</li>
          <li><strong>Prawnie uzasadniony interes (Art. 6 ust. 1 lit. f RODO):</strong> Zapewnienie bezpieczeństwa, obrona przed roszczeniami, analityka.</li>
        </ul>
      </section>

      <section>
        <h2>5. Odbiorcy danych i Procesorzy</h2>
        <p>Twoje dane powierzamy zaufanym partnerom technologicznym:</p>
        <ul>
          <li><strong>Supabase:</strong> Infrastruktura bazy danych i uwierzytelniania.</li>
          <li><strong>Vercel:</strong> Hosting aplikacji i funkcje serwerowe.</li>
          <li><strong>OpenAI (lub inny dostawca AI):</strong> Przetwarzanie treści w celu generowania odpowiedzi edukacyjnych.</li>
          <li><strong>Google Cloud Vision (lub inny dostawca OCR):</strong> Rozpoznawanie tekstu ze zdjęć.</li>
          <li><strong>Dostawcy płatności:</strong> Obsługa transakcji jednorazowych, np. dostępu Premium na 30 dni.</li>
        </ul>
      </section>

      <section>
        <h2>6. Przekazywanie danych poza EOG</h2>
        <p>
          Niektórzy nasi dostawcy technologii (np. OpenAI) mogą przetwarzać dane w USA. Zapewniamy bezpieczeństwo danych poprzez stosowanie Standardowych Klauzul Umownych oraz współpracę z podmiotami gwarantującymi wysoki poziom ochrony.
        </p>
      </section>

      <section>
        <h2>7. Okres przechowywania danych</h2>
        <p>
          Dane przechowujemy przez okres posiadania konta w Serwisie. Po usunięciu konta dane są usuwane, z wyjątkiem informacji niezbędnych do celów dowodowych lub podatkowych (np. historia płatności).
        </p>
      </section>

      <section id="rodo">
        <h2>8. Twoje prawa (RODO)</h2>
        <p>Masz prawo do:</p>
        <ul>
          <li>Dostępu do swoich danych oraz otrzymania ich kopii.</li>
          <li>Sprostowania (poprawienia) danych.</li>
          <li>Usunięcia danych ("prawo do bycia zapomnianym").</li>
          <li>Ograniczenia przetwarzania.</li>
          <li>Przenoszenia danych.</li>
          <li>Wniesienia sprzeciwu.</li>
          <li>Cofnięcia zgody w dowolnym momencie.</li>
        </ul>
      </section>

      <section>
        <h2>9. Osoby niepełnoletnie i zgody rodzicielskie</h2>
        <p>
          Ze względu na edukacyjny profil aplikacji, przetwarzamy dane osób niepełnoletnich. Wymagamy, aby rejestracja odbywała się za wiedzą i zgodą rodzica lub opiekuna prawnego.
        </p>
        <p className="mt-4">
          Jeżeli dziecko poniżej 13 roku życia rozpocznie rejestrację konta, a podany adres e-mail nie został wcześniej dodany i zatwierdzony przez rodzica lub opiekuna prawnego w Panelu Rodzica, konto dziecka pozostaje zablokowane i nie ma dostępu do funkcji edukacyjnych OmniNauka.
        </p>
        <p className="mt-2">
          Dane takiego konta są przetwarzane wyłącznie w celu umożliwienia powiązania konta z rodzicem lub opiekunem prawnym. Jeżeli konto nie zostanie powiązane z rodzicem lub opiekunem w ciągu 72 godzin, może zostać usunięte lub oznaczone do usunięcia zgodnie z zasadą minimalizacji danych.
        </p>
      </section>

      <section>
        <h2>10. Usuwanie konta i danych</h2>
        <p>
          Możesz samodzielnie usunąć sesje nauki lub całe konto w aplikacji. Usunięcie konta skutkuje nieodwracalnym skasowaniem Twoich materiałów z baz produkcyjnych.
        </p>
      </section>

      <section>
        <h2>11. Bezpieczeństwo danych</h2>
        <p>
          Stosujemy szyfrowanie połączeń (SSL/TLS), bezpieczne standardy autoryzacji oraz regularne aktualizacje komponentów systemu w celu ochrony Twoich danych przed nieuprawnionym dostępem.
        </p>
      </section>

      <section>
        <h2>12. Minimalizacja danych (Szkoły/JST)</h2>
        <p>
          W przypadku współpracy z placówkami oświatowymi, stosujemy zasadę minimalizacji danych, zbierając jedynie te informacje, które są niezbędne do realizacji celów dydaktycznych.
        </p>
      </section>

      <section>
        <h2>13. Pliki cookies</h2>
        <p>
          Nasza strona korzysta z plików cookies i podobnych technologii w celach technicznych i funkcjonalnych. Szczegółowe informacje na ten temat znajdziesz w naszej <a href="/polityka-cookies" className="text-[var(--omni-accent)] hover:underline">Polityce cookies</a>.
        </p>
      </section>
    </LegalPageLayout>
  );
}
