import LegalPageLayout from '../../components/legal/LegalPageLayout';
import { useTranslation } from 'react-i18next';

export default function CookiesPage() {
  const { t } = useTranslation();
  return (
    <LegalPageLayout title={t('legal.cookies.title', 'Polityka Cookies i Przechowywania Danych')} lastUpdated="02.05.2026">
      <p className="mb-6">
        Serwis OmniNauka wykorzystuje pliki "cookies" oraz funkcje przeglądarki (localStorage i sessionStorage) w celu zapewnienia prawidłowego działania aplikacji, bezpieczeństwa oraz zapamiętania Twoich preferencji.
      </p>

      <section className="mb-8">
        <h2 className="text-xl font-bold mb-4">1. Czym są pliki cookies i podobne technologie?</h2>
        <p className="mb-4">
          Pliki cookies to małe pliki tekstowe zapisywane na Twoim urządzeniu. Technologie podobne, takie jak localStorage i sessionStorage, pozwalają aplikacji na przechowywanie danych bezpośrednio w pamięci przeglądarki. 
        </p>
        <p>
          W OmniNauka minimalizujemy zbieranie danych i wykorzystujemy wyłącznie te technologie, które są niezbędne do świadczenia usług edukacyjnych.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-bold mb-4">2. Technologie niezbędne (Techniczne)</h2>
        <p className="mb-4">Są one wymagane do podstawowego działania Serwisu i nie wymagają zgody Użytkownika. Obejmują:</p>
        <ul className="list-disc pl-6 space-y-2 text-[var(--omni-text-muted)]">
          <li><strong>Uwierzytelnianie (Supabase Auth):</strong> Przechowywanie informacji o zalogowanej sesji, abyś nie musiał logować się na każdej podstronie.</li>
          <li><strong>Bezpieczeństwo:</strong> Ochrona przed atakami CSRF i zabezpieczenie Twojego konta.</li>
          <li><strong>Pamięć sesji (sessionStorage):</strong> Przechowywanie tymczasowych danych aktywnych lekcji, wyników quizów i analiz AI (np. <code>currentSessionId</code>, <code>quizResults</code>), które są usuwane po zamknięciu przeglądarki.</li>
        </ul>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-bold mb-4">3. Technologie funkcjonalne</h2>
        <p className="mb-4">Pomagają nam zapamiętać Twoje ustawienia, aby korzystanie z aplikacji było wygodniejsze:</p>
        <ul className="list-disc pl-6 space-y-2 text-[var(--omni-text-muted)]">
          <li><strong>Preferencje motywu:</strong> Informacja o wybranym motywie jasnym lub ciemnym (<code>omninauka-theme</code>).</li>
          <li><strong>Ustawienia języka:</strong> Zapamiętanie wybranego języka interfejsu (<code>i18nextLng</code>).</li>
          <li><strong>Postępy w nauce:</strong> Lokalna pamięć postępu w rozwiązywaniu quizów lub przeglądaniu fiszek (<code>quiz-progress-*</code>), dzięki czemu możesz wrócić do nauki w tym samym miejscu.</li>
        </ul>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-bold mb-4">4. Analityka, Marketing i Profilowanie</h2>
        <div className="space-y-4">
          <p>
            <strong>W obecnej wersji Serwis NIE UŻYWA żadnych plików cookies analitycznych (np. Google Analytics) ani marketingowych (np. Meta Pixel).</strong>
          </p>
          <p>
            Zgodnie z zasadą <strong>Privacy-by-Design</strong>, OmniNauka nie prowadzi profilowania reklamowego użytkowników, w szczególności dzieci i młodzieży. Nie śledzimy Twojej aktywności w celach komercyjnych ani nie udostępniamy danych firmom reklamowym.
          </p>
          <p>
            Jeżeli w przyszłości zdecydujemy się na wprowadzenie narzędzi analitycznych lub marketingowych w celu ulepszania Serwisu, wdrożymy dedykowany mechanizm zgody (cookie banner). Będzie on umożliwiał:
          </p>
          <ul className="list-disc pl-6 space-y-1 text-[var(--omni-text-muted)]">
            <li>Wyrażenie dobrowolnej zgody na wybrane kategorie plików.</li>
            <li>Odrzucenie wszystkich plików niebędących niezbędnymi.</li>
            <li>Łatwą zmianę ustawień lub wycofanie zgody w dowolnym momencie.</li>
          </ul>
        </div>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-bold mb-4">5. Zarządzanie ustawieniami i zgoda</h2>
        <p className="mb-4">
          Zgodnie z obowiązującymi przepisami (RODO oraz dyrektywa ePrivacy), <strong>technologie niezbędne i funkcjonalne</strong> działają bez konieczności uzyskiwania osobnej zgody, ponieważ są one kluczowe dla dostarczenia usługi, o którą prosi użytkownik (np. zalogowanie się, zapamiętanie postępu w quizie).
        </p>
        <p className="mb-4">
          Możesz jednak w każdej chwili zmienić ustawienia w swojej przeglądarce (np. Chrome, Firefox, Safari, Edge), aby blokować lub usuwać cookies. 
        </p>
        <p>
          Pamiętaj, że zablokowanie technologii niezbędnych uniemożliwi poprawne zalogowanie się i korzystanie z funkcji edukacyjnych OmniNauka.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-bold mb-4">6. Kontakt</h2>
        <p>
          W przypadku pytań dotyczących technologii stosowanych w OmniNauka, prosimy o kontakt:<br />
          E-mail: <a href="mailto:piotr.fiszer@pfconsulting.pl" className="text-[var(--omni-accent)] hover:underline font-medium">piotr.fiszer@pfconsulting.pl</a>
        </p>
      </section>
    </LegalPageLayout>
  );
}
