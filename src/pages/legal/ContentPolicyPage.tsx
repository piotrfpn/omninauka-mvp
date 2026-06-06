import LegalPageLayout from '../../components/legal/LegalPageLayout';
import { useTranslation } from 'react-i18next';

export default function ContentPolicyPage() {
  const { t } = useTranslation();
  return (
    <LegalPageLayout 
      title={t('home.footer.legal.reports', 'Polityka zgłaszania naruszeń i usuwania treści')} 
      lastUpdated="06.06.2026"
      isDraft={false}
    >
      <section>
        <p className="font-semibold mb-2">
          Wersja: 1.0<br />
          Data publikacji: 6 czerwca 2026 r.
        </p>
        <p className="text-sm text-[var(--omni-text-muted)] italic mb-6">
          Dokument prawny jest dostępny wyłącznie w języku polskim. W przypadku korzystania z aplikacji w innym języku, wiążąca pozostaje polska wersja dokumentu.
        </p>
      </section>

      <p className="text-lg mb-8 leading-relaxed">
        Zasady zgłaszania naruszeń praw autorskich, treści bezprawnych, naruszeń prywatności oraz procedura usuwania lub blokowania treści w OmniNauka.
      </p>

      <section>
        <h2>1. Cel Polityki</h2>
        <p>
          Celem Polityki jest zapewnienie prostego i bezpiecznego sposobu zgłaszania treści lub działań, które mogą naruszać prawo, prawa osób trzecich, bezpieczeństwo dzieci albo zasady korzystania z OmniNauka.
        </p>
        <p>
          Polityka ma zastosowanie w szczególności do materiałów przesyłanych przez użytkowników, takich jak zdjęcia notatek, obrazy, tekstowe pliki PDF, pliki DOCX, treści wpisywane w aplikacji, materiały edukacyjne oraz inne pliki lub informacje przetwarzane w OmniNauka.
        </p>
      </section>

      <section>
        <h2>2. Dane kontaktowe do zgłoszeń</h2>
        <p>Zgłoszenia naruszeń należy kierować na adres:</p>
        <p>
          <strong>E-mail:</strong> <a href="mailto:piotr.fiszer@pfconsulting.pl">piotr.fiszer@pfconsulting.pl</a><br />
          <strong>Operator:</strong> PFConsulting, Piotr Fiszer<br />
          <strong>Adres:</strong> ul. Promienista 114, 60-142 Poznań, Polska
        </p>
      </section>

      <section>
        <h2>3. Kto może zgłosić naruszenie</h2>
        <p>Zgłoszenie może złożyć w szczególności:</p>
        <ol className="list-decimal pl-6 space-y-1">
          <li>właściciel praw autorskich lub praw pokrewnych,</li>
          <li>osoba uprawniona do działania w imieniu właściciela praw,</li>
          <li>użytkownik aplikacji,</li>
          <li>rodzic lub opiekun prawny dziecka,</li>
          <li>osoba, której dane osobowe, prywatność, wizerunek lub dobra osobiste mogły zostać naruszone,</li>
          <li>nauczyciel, szkoła, wydawca lub inny podmiot, którego prawa mogły zostać naruszone,</li>
          <li>każda osoba lub podmiot, który uważa, że w OmniNauka znajduje się treść bezprawna albo naruszająca Regulamin.</li>
        </ol>
      </section>

      <section>
        <h2>4. Co można zgłosić</h2>
        <p>Zgłoszenie może dotyczyć w szczególności:</p>
        <ol className="list-decimal pl-6 space-y-1">
          <li>naruszenia praw autorskich lub praw pokrewnych,</li>
          <li>bezprawnego wykorzystania materiałów edukacyjnych, podręczników, kart pracy, arkuszy, zdjęć, grafik, tekstów, opracowań lub dokumentów,</li>
          <li>naruszenia prywatności, wizerunku albo dóbr osobistych,</li>
          <li>bezprawnego przetwarzania danych osobowych,</li>
          <li>przesłania danych dziecka, danych wrażliwych, dokumentów tożsamości, numerów PESEL, danych zdrowotnych lub innych danych niepotrzebnych do nauki,</li>
          <li>treści przemocowych, seksualnych, dyskryminujących, obraźliwych lub nieodpowiednich dla osób niepełnoletnich,</li>
          <li>treści zawierających złośliwe oprogramowanie, phishing, spam albo inne elementy technicznie szkodliwe,</li>
          <li>nadużycia aplikacji, obejścia limitów, automatycznego masowego uploadu, prób uzyskania nieuprawnionego dostępu albo działania na szkodę systemu.</li>
        </ol>
      </section>

      <section>
        <h2>5. Zgłaszanie naruszeń praw autorskich</h2>
        <p>
          Jeżeli zgłoszenie dotyczy naruszenia praw autorskich lub praw pokrewnych, osoba zgłaszająca powinna podać możliwie dokładne informacje pozwalające ocenić zgłoszenie.
        </p>
        <p>Zgłoszenie powinno zawierać:</p>
        <ol className="list-decimal pl-6 space-y-1">
          <li>imię i nazwisko albo nazwę zgłaszającego,</li>
          <li>dane kontaktowe zgłaszającego, w szczególności adres e-mail,</li>
          <li>wskazanie, czy zgłaszający jest właścicielem praw, osobą upoważnioną, rodzicem/opiekunem, nauczycielem, szkołą, wydawcą lub innym podmiotem,</li>
          <li>opis utworu lub materiału, którego prawa dotyczą,</li>
          <li>wskazanie materiału w OmniNauka, którego dotyczy zgłoszenie (np. link, identyfikator lekcji, zrzut ekranu),</li>
          <li>opis, na czym polega naruszenie,</li>
          <li>oświadczenie o dobrej wierze i prawdziwości podanych informacji,</li>
          <li>podpis elektroniczny lub imię i nazwisko zgłaszającego.</li>
        </ol>
      </section>

      <section>
        <h2>6. Materiały edukacyjne i prywatne użycie</h2>
        <p>
          Użytkownik odpowiada za legalność materiałów przesyłanych do OmniNauka. Powinien przesyłać wyłącznie takie materiały, do których ma prawo albo z których może korzystać zgodnie z obowiązującymi przepisami prawa (np. własne notatki).
        </p>
      </section>

      <section>
        <h2>7. Procedura reakcji OmniNauka</h2>
        <p>
          Po otrzymaniu zgłoszenia OmniNauka może podjąć działania takie jak: analiza zgłoszenia, prośba o uzupełnienie danych, czasowe zablokowanie materiału, kontakt z użytkownikiem, usunięcie materiału lub ograniczenie konta w przypadku poważnych naruszeń.
        </p>
        <p>
          W przypadku zgłoszeń dotyczących bezpieczeństwa dzieci, danych wrażliwych lub treści niebezpiecznych, OmniNauka może nadać sprawie wyższy priorytet.
        </p>
      </section>

      <section>
        <h2>8. Czasowe zablokowanie treści</h2>
        <p>
          OmniNauka może czasowo zablokować dostęp do materiału, jeżeli zgłoszenie uprawdopodabnia naruszenie lub jeżeli materiał zawiera dane, których nie powinno się przetwarzać (np. dokumenty tożsamości).
        </p>
      </section>

      <section>
        <h2>9. Decyzja OmniNauka</h2>
        <p>
          Decyzja o usunięciu lub pozostawieniu materiału jest podejmowana na podstawie dostępnych informacji, ryzyka dla użytkowników oraz obowiązujących przepisów prawa.
        </p>
      </section>

      <section>
        <h2>10. Odwołanie użytkownika</h2>
        <p>
          Użytkownik, którego materiał został usunięty lub zablokowany, może złożyć odwołanie na adres: <a href="mailto:piotr.fiszer@pfconsulting.pl">piotr.fiszer@pfconsulting.pl</a>. OmniNauka przeanalizuje odwołanie i podejmie decyzję o utrzymaniu blokady lub przywróceniu treści.
        </p>
      </section>

      <section>
        <h2>11. Powtarzające się naruszenia</h2>
        <p>
          OmniNauka może zawiesić lub usunąć konto użytkownika, który wielokrotnie narusza Regulamin, przesyła treści bezprawne lub próbuje obejść zabezpieczenia aplikacji.
        </p>
      </section>

      <section>
        <h2>12. Zgłoszenia dotyczące dzieci i danych wrażliwych</h2>
        <p>
          Zgłoszenia tego typu są traktowane priorytetowo. OmniNauka nie zastępuje jednak organów ścigania ani służb interwencyjnych – w przypadkach bezpośredniego zagrożenia należy kontaktować się z właściwymi służbami.
        </p>
      </section>

      <section>
        <h2>13. Zgłoszenia DMCA (USA)</h2>
        <p>
          Dla zgłoszeń dotyczących praw autorskich na podstawie prawa USA, udostępniamy kanał kontaktowy: <a href="mailto:piotr.fiszer@pfconsulting.pl">piotr.fiszer@pfconsulting.pl</a>.
        </p>
      </section>

      <section>
        <h2>14. Fałszywe zgłoszenia</h2>
        <p>
          Zabronione jest składanie zgłoszeń oczywiście fałszywych lub mających na celu nękanie innych użytkowników. OmniNauka może ograniczyć możliwość składania zgłoszeń przez osoby nadużywające tej procedury.
        </p>
      </section>

      <section>
        <h2>15. Zmiany Polityki</h2>
        <p>
          Polityka może ulegać zmianom w związku ze zmianą przepisów (np. DSA, RODO) lub rozwojem funkcji aplikacji. Aktualna wersja jest zawsze dostępna na stronie internetowej.
        </p>
      </section>
    </LegalPageLayout>
  );
}
