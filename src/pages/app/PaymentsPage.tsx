import { useAuth } from '../../lib/auth-context';
import { useTranslation } from 'react-i18next';
import { CheckCircle, AlertCircle, Sparkles, Users, Layers, ExternalLink } from 'lucide-react';
import { isPlanActive } from '../../lib/plan-utils';

export default function PaymentsPage() {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();

  const premium30Link = import.meta.env.VITE_STRIPE_PREMIUM_30_DAYS_PAYMENT_LINK || import.meta.env.VITE_STRIPE_PREMIUM_PAYMENT_LINK;
  const family30Link = import.meta.env.VITE_STRIPE_FAMILY_30_DAYS_PAYMENT_LINK || import.meta.env.VITE_STRIPE_FAMILY_PAYMENT_LINK;

  const premiumSubLink = import.meta.env.VITE_STRIPE_PREMIUM_SUBSCRIPTION_PAYMENT_LINK;
  const familySubLink = import.meta.env.VITE_STRIPE_FAMILY_SUBSCRIPTION_PAYMENT_LINK;

  const lesson5Link = import.meta.env.VITE_STRIPE_LESSON_5_PAYMENT_LINK;
  const lesson10Link = import.meta.env.VITE_STRIPE_LESSON_10_PAYMENT_LINK;
  const lesson25Link = import.meta.env.VITE_STRIPE_LESSON_25_PAYMENT_LINK;

  // Plan status computed values
  const isPaidPlan = user?.plan === 'premium' || user?.plan === 'family';
  const expiresDate = user?.planExpiresAt ? new Date(user.planExpiresAt) : null;
  const isExpired = expiresDate ? expiresDate <= new Date() : false;
  const isPlanActiveNow = isPlanActive(user);
  const hasNoExpiryDate = isPaidPlan && !user?.planExpiresAt;

  const planLabel = user?.plan === 'premium' && isPlanActiveNow
    ? t('payments.plan.premium', 'Premium')
    : user?.plan === 'family' && isPlanActiveNow
      ? t('payments.plan.family', 'Rodzinny')
      : t('payments.plan.free', 'Darmowy');

  const expiryDateFormatted = expiresDate
    ? new Intl.DateTimeFormat(i18n.language === 'pl' ? 'pl-PL' : 'en-US', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(expiresDate)
    : null;

  // Premium CTA logic
  const isPremium = user?.plan === 'premium';
  const isFamily = user?.plan === 'family';

  let premiumCTA = t('payments.premium.cta.buy', 'Kup Premium na 30 dni');
  let premiumDescription = t('payments.premium.description.default', 'Dla ucznia, który chce więcej lekcji AI i wygodniejszą naukę.');
  let premiumCTAIsDisabled = false;

  if (isFamily && isPlanActiveNow) {
    premiumCTA = t('payments.premium.cta.haveFamily', 'Masz plan Rodzinny');
    premiumCTAIsDisabled = true;
  } else if (isPremium) {
    if (isPlanActiveNow) {
      premiumCTA = t('payments.premium.cta.extend', 'Przedłuż Premium o 30 dni');
      premiumDescription = t('payments.premium.description.active', 'Masz aktywny Premium do: {{date}}. Przedłużenie doda kolejne 30 dni do obecnej daty ważności.', { date: expiryDateFormatted });
    } else {
      premiumCTA = t('payments.premium.cta.renew', 'Odnow Premium na 30 dni');
      premiumDescription = t('payments.premium.description.expired', 'Twój poprzedni plan wygasł. Możesz odnowić Premium na kolejne 30 dni.');
    }
  }

  const renderPrice = (priceStr: string) => {
    const match = priceStr.match(/^(.*?)([,.]99)(.*)$/);
    if (match) {
      const [, prefix, cents, suffix] = match;
      return (
        <>
          {prefix}
          <span className="text-[0.6em] align-top relative -top-1">{cents}</span>
          {suffix}
        </>
      );
    }
    return priceStr;
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500 max-w-5xl mx-auto pb-12">
      <header className="mb-8">
        <h1 className="omni-heading text-3xl mb-2">{t('payments.title', 'Płatności i plan')}</h1>
        <p className="text-[var(--omni-text-muted)] text-lg">
          {t('payments.subtitle', 'Tutaj sprawdzisz dostępne opcje Premium i pakiety dodatkowych lekcji AI.')}
        </p>
      </header>

      {/* Sekcja 2: Karta obecnego planu */}
      <section className={`omni-card p-6 border-l-4 ${
        isPlanActiveNow && isPaidPlan ? 'bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-400' : 'bg-gray-50 border-gray-300'
      }`}>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="text-sm font-semibold text-[var(--omni-text-muted)] uppercase tracking-wider mb-1">
              {t('payments.currentPlanLabel', 'Twój obecny plan')}
            </h2>
            <div className="flex items-center gap-3">
              <span className="text-2xl font-bold text-gray-900">{planLabel}</span>
              {isPlanActiveNow && isPaidPlan && (
                <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs font-medium rounded-full">
                  {t('payments.status.active', 'Aktywny')}
                </span>
              )}
              {isPaidPlan && isExpired && (
                <span className="px-2 py-1 bg-red-100 text-red-700 text-xs font-medium rounded-full">
                  {t('payments.status.expired', 'Wygasł')}
                </span>
              )}
            </div>

            <div className="mt-2 space-y-1">
              {isPaidPlan && expiresDate && !isExpired && expiryDateFormatted && (
                <p className="text-sm font-medium text-blue-600">
                  {t('payments.validUntil', 'Ważny do')}: {expiryDateFormatted}
                </p>
              )}
              {isPaidPlan && isExpired && expiryDateFormatted && (
                <p className="text-sm font-medium text-red-500">
                  {t('payments.expiredNotice', 'Twój plan wygasł. Obecnie korzystasz z planu Darmowego.')}
                </p>
              )}
              {hasNoExpiryDate && (
                <p className="text-sm text-amber-600 font-medium">
                  {t('payments.noExpiryDate', 'Plan aktywny. Brak zapisanej daty wygaśnięcia — skontaktuj się z obsługą.')}
                </p>
              )}
              <p className="text-xs text-gray-500">
                {t('payments.currentPlanNote', 'Po płatności aktywacja planu może potrwać do 24 godzin.')}
              </p>
            </div>
          </div>
          <div className="bg-white p-3 rounded-lg border border-blue-100 max-w-xs flex items-start gap-3 shadow-sm">
            <AlertCircle className="w-5 h-5 text-blue-500 shrink-0 mt-0.5" />
            <p className="text-xs text-gray-600 leading-relaxed">
              {t('payments.mvpNote', 'To rozwiązanie MVP. Plan aktywujemy ręcznie po potwierdzeniu płatności.')}
            </p>
          </div>
        </div>
      </section>

      {/* Płatności jednorazowe */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-8">
        {/* Sekcja 3: Premium 30 dni */}
        <div className="omni-card p-6 flex flex-col h-full ring-2 ring-[var(--omni-accent)] relative overflow-hidden">
          <div className="absolute top-0 right-0 bg-[var(--omni-accent)] text-white text-xs font-bold px-3 py-1 rounded-bl-lg">
            Polecane
          </div>
          <div className="mb-4">
            <h3 className="font-bold text-xl text-[var(--omni-text)] flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-[var(--omni-accent)]" />
              Premium 30 dni
            </h3>
            <div className="flex gap-2 mt-2 flex-wrap">
              <span className="text-xs font-medium bg-gray-100 text-gray-600 px-2 py-1 rounded-md">
                Płatność jednorazowa
              </span>
              <span className="text-xs font-medium bg-gray-100 text-gray-600 px-2 py-1 rounded-md">
                Bez automatycznego odnawiania
              </span>
            </div>
          </div>
          <div className="flex items-baseline mb-3" aria-label="29,99 zł">
            <span className="text-4xl font-bold text-[var(--omni-text)]" aria-hidden="true">
              {renderPrice('29,99 zł')}
            </span>
          </div>
          <p className="text-sm text-[var(--omni-text-muted)] mb-6 whitespace-pre-line">
            {premiumDescription}
          </p>
          <ul className="space-y-3 mb-8 flex-1">
            {[
              'Więcej lekcji AI każdego dnia',
              'Dłuższa praca z AI korepetytorem',
              'Więcej quizów i fiszek',
              'Powtórki błędów',
              'Historia nauki i powrót do tematów',
              'Lepsze przygotowanie do sprawdzianów',
              'Priorytetowe funkcje AI w ramach fair use'
            ].map((feature, idx) => (
              <li key={idx} className="flex items-start gap-2">
                <CheckCircle className="w-4 h-4 text-green-500 shrink-0 mt-0.5" />
                <span className="text-sm text-[var(--omni-text)]">{feature}</span>
              </li>
            ))}
          </ul>
          <div className="mt-auto">
            {premiumCTAIsDisabled ? (
              <button disabled className="w-full inline-flex items-center justify-center whitespace-nowrap px-4 py-3 rounded-xl transition-all bg-gray-100 text-gray-400 font-semibold cursor-not-allowed">
                {premiumCTA}
              </button>
            ) : premium30Link ? (
              <a
                href={premium30Link}
                className="w-full inline-flex items-center justify-center whitespace-nowrap px-4 py-3 rounded-xl transition-all bg-[var(--omni-accent)] text-white font-bold hover:shadow-lg gap-2"
              >
                {premiumCTA}
                <ExternalLink className="w-4 h-4" />
              </a>
            ) : (
              <button disabled className="w-full inline-flex items-center justify-center whitespace-nowrap px-4 py-3 rounded-xl transition-all bg-gray-100 text-gray-400 font-semibold cursor-not-allowed">
                Wkrótce
              </button>
            )}
          </div>
        </div>

        {/* Sekcja 4: Rodzinny 30 dni */}
        <div className="omni-card p-6 flex flex-col h-full border border-gray-200">
          <div className="mb-4">
            <h3 className="font-bold text-xl text-[var(--omni-text)] flex items-center gap-2">
              <Users className="w-5 h-5 text-indigo-500" />
              Rodzinny 30 dni
            </h3>
            <div className="flex gap-2 mt-2 flex-wrap">
              <span className="text-xs font-medium bg-gray-100 text-gray-600 px-2 py-1 rounded-md">
                Płatność jednorazowa
              </span>
              <span className="text-xs font-medium bg-gray-100 text-gray-600 px-2 py-1 rounded-md">
                Bez automatycznego odnawiania
              </span>
            </div>
          </div>
          <div className="flex items-baseline mb-3" aria-label="59,99 zł">
            <span className="text-4xl font-bold text-[var(--omni-text)]" aria-hidden="true">
              {renderPrice('59,99 zł')}
            </span>
          </div>
          <p className="text-sm text-[var(--omni-text-muted)] mb-6">
            Dla rodzica i maksymalnie 3 kont uczniowskich.
          </p>
          <ul className="space-y-3 mb-8 flex-1">
            {[
              'Do 3 kont uczniowskich',
              'Panel Rodzica',
              'Podgląd dzieci po zgodzie rodzicielskiej',
              'Wszystko z Premium dla uczniów',
              'Wspólna organizacja nauki'
            ].map((feature, idx) => (
              <li key={idx} className="flex items-start gap-2">
                <CheckCircle className="w-4 h-4 text-green-500 shrink-0 mt-0.5" />
                <span className="text-sm text-[var(--omni-text)]">{feature}</span>
              </li>
            ))}
          </ul>
          <div className="mt-auto">
            {family30Link ? (
              <a
                href={family30Link}
                className="w-full inline-flex items-center justify-center whitespace-nowrap px-4 py-3 rounded-xl transition-all bg-indigo-50 text-indigo-700 font-semibold hover:bg-indigo-100 gap-2"
              >
                Kup Rodzinny na 30 dni
                <ExternalLink className="w-4 h-4" />
              </a>
            ) : (
              <button disabled className="w-full inline-flex items-center justify-center whitespace-nowrap px-4 py-3 rounded-xl transition-all bg-gray-100 text-gray-400 font-semibold cursor-not-allowed">
                Wkrótce
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Sekcja 6: Subskrypcja miesięczna */}
      <section className="mt-12 pt-10 border-t border-gray-100">
        <div className="flex flex-col md:flex-row gap-8 items-start">
          <div className="md:w-1/3">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-purple-100 text-purple-700 text-xs font-semibold rounded-full mb-4 uppercase tracking-wide">
              <Layers className="w-3.5 h-3.5" />
              Automatyczne odnawianie
            </div>
            <h2 className="text-2xl font-bold text-[var(--omni-text)] mb-3">Subskrypcja miesięczna</h2>
            <p className="text-[var(--omni-text-muted)] mb-4">
              Opcja dla osób, które chcą korzystać z OmniNauka regularnie co miesiąc.
            </p>
            <div className="bg-purple-50 p-4 rounded-xl border border-purple-100 text-sm text-purple-900 font-medium flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-purple-500 shrink-0" />
              <p>Płatność odnawia się automatycznie co miesiąc, dopóki jej nie anulujesz.</p>
            </div>
          </div>
          
          <div className="md:w-2/3 grid grid-cols-1 sm:grid-cols-2 gap-4 w-full">
            <div className="omni-card p-5 border border-gray-200 flex flex-col">
              <h4 className="font-semibold text-lg mb-1">Premium</h4>
              <div className="mb-4" aria-label="29,99 zł miesięcznie">
                <span className="text-2xl font-bold" aria-hidden="true">{renderPrice('29,99 zł')}</span>
                <span className="text-[var(--omni-text-muted)] text-sm ml-1" aria-hidden="true">/ miesiąc</span>
              </div>
              <div className="mt-auto">
                {premiumSubLink ? (
                  <a href={premiumSubLink} className="w-full py-2.5 px-4 rounded-lg bg-white border border-gray-300 text-gray-700 font-medium text-center block hover:bg-gray-50 transition-colors">
                    Włącz subskrypcję
                  </a>
                ) : (
                  <button disabled className="w-full py-2.5 px-4 rounded-lg bg-gray-50 border border-gray-200 text-gray-400 font-medium cursor-not-allowed">
                    Wkrótce
                  </button>
                )}
              </div>
            </div>
            
            <div className="omni-card p-5 border border-gray-200 flex flex-col">
              <h4 className="font-semibold text-lg mb-1">Rodzinny</h4>
              <div className="mb-4" aria-label="59,99 zł miesięcznie">
                <span className="text-2xl font-bold" aria-hidden="true">{renderPrice('59,99 zł')}</span>
                <span className="text-[var(--omni-text-muted)] text-sm ml-1" aria-hidden="true">/ miesiąc</span>
              </div>
              <div className="mt-auto">
                {familySubLink ? (
                  <a href={familySubLink} className="w-full py-2.5 px-4 rounded-lg bg-white border border-gray-300 text-gray-700 font-medium text-center block hover:bg-gray-50 transition-colors">
                    Włącz subskrypcję
                  </a>
                ) : (
                  <button disabled className="w-full py-2.5 px-4 rounded-lg bg-gray-50 border border-gray-200 text-gray-400 font-medium cursor-not-allowed">
                    Wkrótce
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Sekcja 5: Pakiety dodatkowych lekcji AI */}
      <section className="mt-12 pt-10 border-t border-gray-100">
        <div className="mb-8 text-center max-w-2xl mx-auto">
          <h2 className="text-2xl font-bold text-[var(--omni-text)] mb-3">Pakiety dodatkowych lekcji AI</h2>
          <p className="text-[var(--omni-text-muted)] mb-2">
            Dla ucznia, który potrzebuje więcej nauki przed sprawdzianem, kartkówką albo powtórką.
          </p>
          <p className="text-xs text-[var(--omni-text-muted-light)] bg-gray-50 inline-block px-3 py-1 rounded-full">
            1 lekcja AI = do 5 zdjęć albo 1 dokument PDF/DOCX.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-4xl mx-auto">
          {[
            { pack: '5 lekcji AI', price: '9,99 zł', link: lesson5Link },
            { pack: '10 lekcji AI', price: '17,99 zł', link: lesson10Link },
            { pack: '25 lekcji AI', price: '34,99 zł', link: lesson25Link }
          ].map((item, idx) => (
            <div key={idx} className="omni-card p-5 text-center flex flex-col">
              <div className="text-3xl font-bold text-[var(--omni-text)] mb-1" aria-label={item.price}>
                <span aria-hidden="true">{renderPrice(item.price)}</span>
              </div>
              <div className="text-sm font-medium text-[var(--omni-text-muted)] mb-5">
                {item.pack}
              </div>
              <div className="mt-auto">
                {item.link ? (
                  <a href={item.link} className="w-full py-2 px-4 rounded-lg bg-blue-50 text-blue-600 font-medium inline-block hover:bg-blue-100 transition-colors">
                    Kup pakiet
                  </a>
                ) : (
                  <button disabled className="w-full py-2 px-4 rounded-lg bg-gray-50 text-gray-400 font-medium cursor-not-allowed">
                    Wkrótce
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
