import { useAuth } from '../../lib/auth-context';
import { useTranslation } from 'react-i18next';
import { CheckCircle, AlertCircle, Sparkles, Users, ExternalLink } from 'lucide-react';
import { isPlanActive } from '../../lib/plan-utils';

export default function PaymentsPage() {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();

  const premium30Link = import.meta.env.VITE_STRIPE_PREMIUM_30_DAYS_PAYMENT_LINK || import.meta.env.VITE_STRIPE_PREMIUM_PAYMENT_LINK;
  const family30Link = import.meta.env.VITE_STRIPE_FAMILY_30_DAYS_PAYMENT_LINK || import.meta.env.VITE_STRIPE_FAMILY_PAYMENT_LINK;

  // Sub link variables removed for MVP phase

  const lesson5Link = import.meta.env.VITE_STRIPE_LESSON_5_PAYMENT_LINK;
  const lesson10Link = import.meta.env.VITE_STRIPE_LESSON_10_PAYMENT_LINK;
  const lesson25Link = import.meta.env.VITE_STRIPE_LESSON_25_PAYMENT_LINK;

  // Plan status computed values
  const isPaidPlan = user?.plan === 'premium' || user?.plan === 'family';
  const expiresDate = user?.planExpiresAt ? new Date(user.planExpiresAt) : null;
  const isExpired = expiresDate ? expiresDate <= new Date() : false;
  const isPlanActiveNow = isPlanActive(user);
  const hasNoExpiryDate = isPaidPlan && !user?.planExpiresAt;

  /**
   * Helper to append client_reference_id (Supabase User ID) to Stripe Payment Links.
   * This is critical for the webhook to identify the user for auto-activation.
   */
  const buildStripePaymentUrl = (baseUrl: string | undefined, userId: string | undefined): string | undefined => {
    if (!baseUrl || !userId) return undefined;
    try {
      const url = new URL(baseUrl);
      url.searchParams.set('client_reference_id', userId);
      return url.toString();
    } catch (e) {
      console.error('Invalid Stripe URL:', baseUrl);
      return baseUrl;
    }
  };

  const premium30Url = buildStripePaymentUrl(premium30Link, user?.id);
  const family30Url = buildStripePaymentUrl(family30Link, user?.id);
  // Variables removed for MVP phase

  const planLabel = (user?.effectivePlan || user?.plan) === 'premium' && isPlanActiveNow
    ? t('payments.plan.premium', 'Premium')
    : (user?.effectivePlan || user?.plan) === 'family' && isPlanActiveNow
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
        isPlanActiveNow && isPaidPlan
          ? 'bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30 border-blue-400 dark:border-blue-600'
          : 'bg-gray-50 dark:bg-slate-900/50 border-gray-300 dark:border-slate-800'
      }`}>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="text-sm font-semibold text-[var(--omni-text-muted)] uppercase tracking-wider mb-1">
              {t('payments.currentPlanLabel', 'Twój obecny plan')}
            </h2>
            <div className="flex items-center gap-3">
              <span className="text-2xl font-bold text-gray-900 dark:text-slate-50">{planLabel}</span>
              {isPlanActiveNow && (user?.effectivePlan || user?.plan) !== 'free' && (
                <span className="px-2 py-1 bg-blue-100 dark:bg-blue-950/40 text-blue-700 dark:text-blue-400 text-xs font-semibold rounded-full">
                  {t('payments.status.active', 'Aktywny')}
                </span>
              )}
              {isPaidPlan && isExpired && !user?.inheritedFromParent && (
                <span className="px-2 py-1 bg-red-100 text-red-700 text-xs font-medium rounded-full">
                  {t('payments.status.expired', 'Wygasł')}
                </span>
              )}
            </div>

            <div className="mt-2 space-y-1">
              {user?.inheritedFromParent ? (
                <p className="text-sm font-medium text-indigo-600">
                  {t('payments.plan.inherited', 'Dostęp od rodzica')} 
                  {user.sourcePlanExpiresAt && ` (${t('payments.validUntil', 'ważny do')}: ${new Intl.DateTimeFormat(i18n.language === 'pl' ? 'pl-PL' : 'en-US').format(new Date(user.sourcePlanExpiresAt))})`}
                </p>
              ) : (
                <>
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
                </>
              )}
              {hasNoExpiryDate && !user?.inheritedFromParent && (
                <p className="text-sm text-amber-600 font-medium">
                  {t('payments.noExpiryDate', 'Plan aktywny. Brak zapisanej daty wygaśnięcia — skontaktuj się z obsługą.')}
                </p>
              )}
              <p className="text-xs text-gray-500 dark:text-slate-400">
                {t('payments.currentPlanNote', 'Twój plan Premium powinien zostać aktywowany automatycznie w ciągu kilku minut od płatności.')}
              </p>
            </div>
          </div>
          <div className="bg-white dark:bg-slate-900 p-3 rounded-lg border border-blue-100 dark:border-blue-950/50 max-w-xs flex items-start gap-3 shadow-sm">
            <AlertCircle className="w-5 h-5 text-blue-500 dark:text-blue-400 shrink-0 mt-0.5" />
            <p className="text-xs text-gray-600 dark:text-slate-300 leading-relaxed">
              {t('payments.mvpNote', 'Plan aktywujemy automatycznie przez Stripe. W razie opóźnień odśwież stronę lub skontaktuj się z obsługą.')}
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
              <span className="text-xs font-medium bg-gray-100 dark:bg-slate-800/80 text-gray-600 dark:text-slate-300 px-2 py-1 rounded-md">
                Płatność jednorazowa
              </span>
              <span className="text-xs font-medium bg-gray-100 dark:bg-slate-800/80 text-gray-600 dark:text-slate-300 px-2 py-1 rounded-md">
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
              t('home.pricing.premium.feat1', 'Więcej lekcji AI każdego dnia'),
              t('home.pricing.premium.feat2', 'Zaawansowany AI Tutor'),
              t('home.pricing.premium.feat3', 'Pełne omówienie błędów z quizu'),
              t('home.pricing.premium.feat4', 'Sprawdzian z raportem błędów'),
              t('home.pricing.premium.feat5', 'Fiszki Premium i powtórki'),
              t('home.pricing.premium.feat6', 'Historia nauki i powrót do tematów')
            ].map((feature, idx) => (
              <li key={idx} className="flex items-start gap-2">
                <CheckCircle className="w-4 h-4 text-green-500 shrink-0 mt-0.5" />
                <span className="text-sm text-[var(--omni-text)]">{feature}</span>
              </li>
            ))}
          </ul>
          <div className="mt-auto">
            {premiumCTAIsDisabled ? (
              <button disabled className="w-full inline-flex items-center justify-center whitespace-nowrap px-4 py-3 rounded-xl transition-all bg-gray-100 dark:bg-slate-800/80 text-gray-400 dark:text-slate-500 font-semibold cursor-not-allowed">
                {premiumCTA}
              </button>
            ) : premium30Url ? (
              <a
                href={premium30Url}
                className="w-full inline-flex items-center justify-center whitespace-nowrap px-4 py-3 bg-[#6366f1] dark:bg-[#2EE6A6] text-white dark:text-[#0B1220] font-bold rounded-xl hover:shadow-lg gap-2 active:scale-[0.98] transition-all"
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
              <span className="text-xs font-medium bg-gray-100 dark:bg-slate-800/80 text-gray-600 dark:text-slate-300 px-2 py-1 rounded-md">
                Płatność jednorazowa
              </span>
              <span className="text-xs font-medium bg-gray-100 dark:bg-slate-800/80 text-gray-600 dark:text-slate-300 px-2 py-1 rounded-md">
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
              t('home.pricing.family.feat1', 'Do 3 kont uczniowskich'),
              t('home.pricing.family.feat2', 'Panel Rodzica'),
              t('home.pricing.family.feat3', 'Podgląd dzieci po zgodzie rodzicielskiej'),
              t('home.pricing.family.feat4', 'Wszystko z Premium dla uczniów'),
              t('home.pricing.family.feat5', 'Wspólna organizacja nauki')
            ].map((feature, idx) => (
              <li key={idx} className="flex items-start gap-2">
                <CheckCircle className="w-4 h-4 text-green-500 shrink-0 mt-0.5" />
                <span className="text-sm text-[var(--omni-text)]">{feature}</span>
              </li>
            ))}
          </ul>
          <div className="mt-auto">
            {family30Url ? (
              <a
                href={family30Url}
                className="w-full inline-flex items-center justify-center whitespace-nowrap px-4 py-3 rounded-xl transition-all bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 font-bold hover:bg-indigo-100 dark:hover:bg-indigo-900/60 gap-2"
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

      {/* Sekcja 6: Subskrypcja miesięczna (Tymczasowo ukryta do czasu pełnego wdrożenia płatności cyklicznych) */}

      {/* Sekcja 5: Pakiety dodatkowych lekcji AI */}
      <section className="mt-12 pt-10 border-t border-gray-100">
        <div className="mb-8 text-center max-w-2xl mx-auto">
          <h2 className="text-2xl font-bold text-[var(--omni-text)] mb-3">Pakiety dodatkowych lekcji AI</h2>
          <p className="text-[var(--omni-text-muted)] mb-2">
            Dla ucznia, który potrzebuje więcej nauki przed sprawdzianem, kartkówką albo powtórką.
          </p>
          <p className="text-xs text-[var(--omni-text-muted-light)] bg-gray-50 dark:bg-slate-900/50 inline-block px-3 py-1 rounded-full">
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
                  <a href={buildStripePaymentUrl(item.link, user?.id)} className="w-full py-2 px-4 rounded-lg bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 font-bold inline-block hover:bg-blue-100 dark:hover:bg-blue-900/60 transition-colors">
                    Kup pakiet
                  </a>
                ) : (
                  <button disabled className="w-full py-2 px-4 rounded-lg bg-gray-50 dark:bg-slate-900/50 text-gray-400 dark:text-slate-600 font-medium cursor-not-allowed">
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
