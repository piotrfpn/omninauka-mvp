import LegalPageLayout from '../../components/legal/LegalPageLayout';
import { useTranslation } from 'react-i18next';

export default function AIDisclaimerPage() {
  const { t } = useTranslation();
  return (
    <LegalPageLayout title={t('legal.aiDisclaimer.title', 'Oświadczenie dot. Sztucznej Inteligencji (AI Disclaimer)')} lastUpdated="06.06.2026">
      <section>
        <p className="font-semibold mb-2">
          Wersja: 1.0
        </p>
        <p className="text-sm text-[var(--omni-text-muted)] italic mb-6">
          Dokument prawny jest dostępny wyłącznie w języku polskim. W przypadku korzystania z aplikacji w innym języku, wiążąca pozostaje polska wersja dokumentu.
        </p>
      </section>

      <p>
        OmniNauka to narzędzie wykorzystujące nowoczesne modele sztucznej inteligencji (AI) do wspierania procesu uczenia się. Korzystając z Serwisu, Użytkownik przyjmuje do wiadomości następujące zasady:
      </p>

      <section>
        <h2>1. Narzędzie Wspomagające</h2>
        <p>
          AI wspiera naukę, ale nie zastępuje nauczyciela, szkoły ani oficjalnych materiałów dydaktycznych. Powinno być traktowane jako cyfrowy asystent, a nie ostateczne źródło prawdy naukowej.
        </p>
      </section>

      <section>
        <h2>2. Możliwość błędów (Halucynacje)</h2>
        <p>
          Sztuczna Inteligencja może generować odpowiedzi błędne merytorycznie, niepełne lub nieaktualne. Użytkownik powinien weryfikować kluczowe fakty (szczególnie przed egzaminami) w sprawdzonych źródłach.
        </p>
      </section>

      <section>
        <h2>3. Brak gwarancji wyników</h2>
        <p>
          OmniNauka nie gwarantuje uzyskania określonych wyników na testach, sprawdzianach ani egzaminach państwowych. Sukces edukacyjny zależy od osobistego zaangażowania Użytkownika.
        </p>
      </section>

      <section>
        <h2>4. Brak powiązania z CKE</h2>
        <p>
          Serwis OmniNauka nie jest powiązany z Centralną Komisją Egzaminacyjną (CKE). Tryb Egzaminacyjny jest autorskim opracowaniem mającym na celu pomoc w treningu, a nie oficjalnym arkuszem egzaminacyjnym.
        </p>
      </section>

      <section>
        <h2>5. Odpowiedzialność za treści</h2>
        <p>
          Użytkownik zobowiązany jest do wgrywania materiałów zgodnych z prawem. Prosimy o niewgrywanie danych wrażliwych (np. PESEL, dane medyczne) w materiałach edukacyjnych, jeśli nie jest to niezbędne do procesu nauki.
        </p>
      </section>

      <section>
        <h2>6. Weryfikacja odpowiedzi</h2>
        <p>
          W przypadku jakichkolwiek wątpliwości co do odpowiedzi udzielonej przez AI Tutora lub wyniku quizu, zachęcamy do konsultacji z nauczycielem lub opiekunem.
        </p>
      </section>
    </LegalPageLayout>
  );
}
