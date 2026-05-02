import LegalPageLayout from '../../components/legal/LegalPageLayout';
import { useTranslation } from 'react-i18next';

export default function CookiesPage() {
  const { t } = useTranslation();
  return (
    <LegalPageLayout title={t('legal.cookies.title', 'Polityka Cookies i Przechowywania Danych')} lastUpdated="26.04.2026">
      <p>
        Serwis OmniNauka wykorzystuje pliki "cookies" oraz funkcje przeglądarki (localStorage i sessionStorage) w celu zapewnienia prawidłowego działania aplikacji.
      </p>

      <section>
        <h2>1. Pliki Niezbędne (Techniczne)</h2>
        <p>Są one wymagane do podstawowego działania Serwisu i nie wymagają zgody Użytkownika. Obejmują:</p>
        <ul>
          <li><strong>Uwierzytelnianie:</strong> Przechowywanie informacji o zalogowanej sesji (Supabase Auth).</li>
          <li><strong>Bezpieczeństwo:</strong> Ochrona przed nieuprawnionym dostępem i zabezpieczenie formularzy.</li>
        </ul>
      </section>

      <section>
        <h2>2. Pliki Funkcjonalne</h2>
        <p>Pomagają nam zapamiętać Twoje preferencje, np.:</p>
        <ul>
          <li><strong>Motyw graficzny (Dark/Light Mode):</strong> Informacja o wybranym motywie aplikacji (<code>omninauka-theme</code>).</li>
          <li><strong>Ustawienia interfejsu:</strong> Ukrycie powitalnych komunikatów po ich przeczytaniu.</li>
        </ul>
      </section>

      <section>
        <h2>3. Analityka i Marketing (W przyszłości)</h2>
        <p>
          W obecnej wersji Serwis minimalizuje użycie skryptów śledzących. W przypadku wdrożenia narzędzi analitycznych (np. Google Analytics), Użytkownik zostanie poproszony o wyrażenie zgody za pomocą dedykowanego banera.
        </p>
      </section>

      <section>
        <h2>4. Zarządzanie ustawieniami</h2>
        <p>
          Większość przeglądarek domyślnie akceptuje pliki cookies. Możesz zmienić te ustawienia w menu swojej przeglądarki (np. Chrome, Firefox, Safari), aby blokować lub usuwać cookies. Pamiętaj, że zablokowanie plików niezbędnych uniemożliwi zalogowanie się do Serwisu.
        </p>
      </section>
    </LegalPageLayout>
  );
}
