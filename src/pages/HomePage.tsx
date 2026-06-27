import { useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth-context';
import { Scan, Brain, BookOpen, MessageCircle, BarChart3, ArrowRight, Check } from 'lucide-react';
import OmniNaukaLogo from '../components/brand/OmniNaukaLogo';
import { useTranslation } from 'react-i18next';
import { LanguageSwitcher } from '../components/LanguageSwitcher';

export default function HomePage() {
  const { t } = useTranslation();
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();

  // Redirect to app if already logged in
  useEffect(() => {
    if (isAuthenticated) {
      navigate('/app/dashboard');
    }
  }, [isAuthenticated, navigate]);

  const features = [
    {
      icon: Scan,
      title: t('home.howItWorks.scan.title', 'Zeskanuj notatki'),
      description: t('home.howItWorks.scan.description', 'Wgraj zdjęcie swoich notatek lub strony z podręcznika.'),
    },
    {
      icon: Brain,
      title: t('home.howItWorks.ai.title', 'AI analizuje'),
      description: t('home.howItWorks.ai.description', 'Sztuczna inteligencja wyciąga kluczowe pojęcia i tworzy materiał.'),
    },
    {
      icon: BookOpen,
      title: t('home.howItWorks.learn.title', 'Ucz się efektywnie'),
      description: t('home.howItWorks.learn.description', 'Fiszki, quizy i lekcje dostosowane do Twoich materiałów.'),
    },
    {
      icon: MessageCircle,
      title: t('home.howItWorks.chat.title', 'Rozmawiaj z AI'),
      description: t('home.howItWorks.chat.description', 'Zadawaj pytania i ucz się przez dialog z korepetytorem AI.'),
    },
    {
      icon: BarChart3,
      title: t('home.howItWorks.progress.title', 'Śledź postępy'),
      description: t('home.howItWorks.progress.description', 'Monitoruj swoje wyniki i identyfikuj słabe punkty.'),
    },
  ];

  const pricingPlans = [
    {
      name: t('home.pricing.free.title', 'Darmowy'),
      price: t('home.pricing.free.price', '0 zł'),
      period: '',
      desc: t('home.pricing.free.desc', 'Dobry na start.'),
      features: [
        t('home.pricing.free.feat1', '2 lekcje AI dziennie'),
        t('home.pricing.free.feat2', 'AI Tutor podstawowy'),
        t('home.pricing.free.feat3', 'Quiz podstawowy'),
        t('home.pricing.free.feat4', 'Podstawowe fiszki'),
        t('home.pricing.free.feat5', 'Historia nauki'),
        t('home.pricing.free.feat6', 'Możliwość dokupienia Premium')
      ],
      cta: t('home.pricing.free.cta', 'Zacznij za darmo'),
      primary: false,
    },
    {
      name: t('home.pricing.premium.title', 'Premium 30 dni'),
      price: t('home.pricing.premium.price', '29,99 zł'),
      period: '',
      tags: ['Płatność jednorazowa', 'Bez automatycznego odnawiania'],
      badge: t('home.pricing.premium.badge', 'Najpopularniejszy'),
      desc: t('home.pricing.premium.desc', 'Dla regularnej nauki i powtórek.'),
      features: [
        t('home.pricing.premium.feat1', 'Więcej lekcji AI każdego dnia'),
        t('home.pricing.premium.feat2', 'Zaawansowany AI Tutor'),
        t('home.pricing.premium.feat3', 'Pełne omówienie błędów z quizu'),
        t('home.pricing.premium.feat4', 'Sprawdzian z raportem błędów'),
        t('home.pricing.premium.feat5', 'Fiszki Premium i powtórki'),
        t('home.pricing.premium.feat6', 'Historia nauki i powrót do tematów')
      ],
      cta: t('home.pricing.premium.cta', 'Załóż konto i kup Premium'),
      primary: true,
      link: '/register',
    },
    {
      name: t('home.pricing.family.title', 'Rodzinny 30 dni'),
      price: t('home.pricing.family.price', '59,99 zł'),
      period: '',
      tags: ['Płatność jednorazowa', 'Bez automatycznego odnawiania'],
      desc: t('home.pricing.family.desc', 'Dla rodzica i maksymalnie 3 kont uczniowskich. Plan Rodzinny nie ma jeszcze automatycznej aktywacji po płatności. Skontaktuj się z nami, jeśli chcesz go uruchomić testowo.'),
      features: [
        t('home.pricing.family.feat1', 'Do 3 kont uczniowskich'),
        t('home.pricing.family.feat2', 'Panel Rodzica'),
        t('home.pricing.family.feat3', 'Podgląd dzieci po zgodzie rodzicielskiej'),
        t('home.pricing.family.feat4', 'Wszystko z Premium dla uczniów'),
        t('home.pricing.family.feat5', 'Wspólna organizacja nauki')
      ],
      cta: t('home.pricing.family.cta', 'Dostępne po kontakcie'),
      primary: false,
    },
  ];

  const faqItems = [
    {
      question: t('home.faq.q1.q', 'Czym jest lekcja AI?'),
      answer: t('home.faq.q1.a', 'Lekcja AI to jedna analiza materiału dodanego przez ucznia. Może to być do 5 zdjęć notatek albo 1 dokument PDF/DOCX. Po dodaniu materiału OmniNauka pomaga zrozumieć temat, prowadzi rozmowę z AI Tutorem i może przygotować quiz.')
    },
    {
      question: t('home.faq.q2.q', 'Czym różni się quiz od sprawdzianu?'),
      answer: t('home.faq.q2.a', 'Quiz z wyjaśnieniami to krótki trening po lekcji. Pomaga sprawdzić podstawowe zrozumienie tematu i pokazuje, dlaczego odpowiedź jest dobra lub błędna. Sprawdzian z raportem błędów to większy test gotowości do kartkówki lub sprawdzianu. Na końcu uczeń otrzymuje wynik oraz informację, które zagadnienia warto powtórzyć.')
    },
    {
      question: t('home.faq.q3.q', 'Czym jest plan Premium?'),
      answer: t('home.faq.q3.a', 'Plan Premium pozwala na pełne korzystanie ze wszystkich funkcji aplikacji, w tym z zaawansowanego AI Tutora, sprawdzianów z raportem błędów oraz rozszerzonego dostępu do fiszek i historii nauki w okresie 30 dni.')
    },
    {
      question: t('home.faq.q4.q', 'Czy mogę przygotować się do sprawdzianu?'),
      answer: t('home.faq.q4.a', 'Tak, OmniNauka pomaga w przygotowaniu do sprawdzianów i kartkówek poprzez generowanie quizów, sprawdzianów z raportem błędów oraz fiszek dopasowanych do Twoich własnych notatek i materiałów lekcyjnych.')
    },
    {
      question: t('home.faq.q5.q', 'Czy OmniNauka jest oficjalnym narzędziem CKE?'),
      answer: t('home.faq.q5.a', 'Nie. OmniNauka nie jest oficjalnym narzędziem CKE. Tryb egzaminacyjny będzie tworzony jako wsparcie nauki, z zadaniami w stylu egzaminacyjnym i materiałami inspirowanymi wymaganiami egzaminacyjnymi.')
    },
    {
      question: t('home.faq.q6.q', 'Czy mogę dodać PDF albo dokument Word?'),
      answer: t('home.faq.q6.a', 'Tak. OmniNauka obsługuje zdjęcia JPG, PNG, WEBP, tekstowe pliki PDF oraz dokumenty DOCX. Skanowane PDF-y mogą wymagać dodania stron jako zdjęcia.')
    },
    {
      question: t('home.faq.q7.q', 'Czy OmniNauka rozwiązuje zadania za ucznia?'),
      answer: t('home.faq.q7.a', 'Celem OmniNauka nie jest podawanie gotowych odpowiedzi bez nauki. AI Tutor pomaga zrozumieć materiał, tłumaczy błędy, zadaje pytania i prowadzi ucznia krok po kroku.')
    },
    {
      question: t('home.faq.q8.q', 'Czy płatności są już aktywne?'),
      answer: t('home.faq.q8.a', 'Na etapie wersji beta płatności i limity mogą być uruchamiane etapowo. Obecne pakiety pokazują planowany model korzystania z OmniNauka.')
    }
  ];

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
    <div className="min-h-screen bg-[var(--omni-bg)] omninauka-home-bg">
      {/* Navigation */}
      <nav className="w-full px-6 py-4 flex items-center justify-between">
        <Link to="/" className="flex items-center">
          <OmniNaukaLogo size={40} />
        </Link>
        <div className="flex items-center gap-4">
          <LanguageSwitcher />
          <Link
            to="/login"
            className="px-4 py-2 text-[var(--omni-text)] font-medium hover:text-[var(--omni-accent)] transition-colors"
          >
            {t('home.nav.login')}
          </Link>
          <Link 
            to="/register" 
            className="hidden sm:inline-flex items-center justify-center px-5 py-2.5 bg-[#2EE6A6] text-[#0B1220] font-bold rounded-xl text-sm hover:shadow-lg hover:shadow-[#2EE6A6]/10 transition-all active:scale-[0.98]"
          >
            {t('home.nav.tryFree')}
          </Link>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="px-6 pt-10 pb-16 lg:py-24">
        <div className="max-w-6xl mx-auto text-center">
          <h1 className="omni-heading-1 text-[var(--omni-text)] mb-6">
            {t('home.hero.title')}
          </h1>
          <p className="omni-body text-[var(--omni-text-muted)] max-w-2xl mx-auto mb-8 text-lg">
            {t('home.hero.subtitle')}
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 w-full sm:w-auto">
            <Link 
              to="/register" 
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-4 bg-[#2EE6A6] text-[#0B1220] font-bold rounded-xl hover:shadow-xl hover:shadow-[#2EE6A6]/20 transition-all active:scale-[0.98]"
            >
              {t('home.hero.cta.tryFree')}
              <ArrowRight className="w-5 h-5" />
            </Link>
            <Link 
              to="#jak-to-dziala" 
              className="w-full sm:w-auto inline-flex items-center justify-center px-8 py-4 text-[var(--omni-text-muted)] font-medium hover:text-[var(--omni-text)] transition-colors"
            >
              {t('home.hero.cta.howItWorks')}
            </Link>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="jak-to-dziala" className="px-6 py-16 lg:py-24">
        <div className="max-w-6xl mx-auto">
          <h2 className="omni-heading-2 text-[var(--omni-text)] text-center mb-12">
            {t('home.howItWorks.title', 'Jak to działa?')}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feature, index) => (
              <div
                key={index}
                className="omni-card p-6 hover:shadow-xl transition-shadow"
              >
                <div className="w-12 h-12 rounded-xl bg-[var(--omni-lavender)] flex items-center justify-center mb-4">
                  <feature.icon className="w-6 h-6 text-[var(--omni-text)]" />
                </div>
                <h3 className="font-semibold text-xl text-[var(--omni-text)] mb-2">
                  {feature.title}
                </h3>
                <p className="text-[var(--omni-text-muted)]">
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="cennik" className="px-6 py-16 lg:py-24">
        <div className="max-w-6xl mx-auto">
          <h2 className="omni-heading-2 text-[var(--omni-text)] text-center mb-12">
            {t('home.pricing.title', 'Wybierz plan')}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {pricingPlans.map((plan, index) => (
              <div
                key={index}
                className={`omni-card p-6 flex flex-col h-full ${
                  plan.primary ? 'ring-2 ring-[var(--omni-accent)]' : ''
                }`}
              >
                <div className="flex items-center justify-between gap-2 mb-2 min-h-[32px]">
                  <h3 className="font-semibold text-xl text-[var(--omni-text)]">
                    {plan.name}
                  </h3>
                  {plan.badge && (
                    <span className={`omni-chip ${plan.primary ? 'bg-[var(--omni-accent)] text-white' : 'bg-blue-100 text-blue-700'} text-xs whitespace-nowrap px-3 py-1`}>
                      {plan.badge}
                    </span>
                  )}
                </div>
                {plan.tags && plan.tags.length > 0 && (
                  <div className="flex gap-2 mb-3 flex-wrap">
                    {plan.tags.map((tag: string, tIndex: number) => (
                      <span key={tIndex} className="text-[10px] font-semibold uppercase tracking-wide bg-gray-100 text-[var(--omni-text-muted)] px-2 py-1 rounded-md">
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
                <div 
                  className="flex items-baseline mb-4"
                  aria-label={plan.price.match(/[,.]99/) ? `${plan.price} ${t('home.pricing.ariaPeriod', 'miesięcznie')}` : undefined}
                >
                  <span 
                    className="text-4xl font-bold text-[var(--omni-text)]"
                    aria-hidden={plan.price.match(/[,.]99/) ? "true" : undefined}
                  >
                    {renderPrice(plan.price)}
                  </span>
                  <span 
                    className="text-[var(--omni-text-muted)] ml-1"
                    aria-hidden={plan.price.match(/[,.]99/) ? "true" : undefined}
                  >
                    {plan.period}
                  </span>
                </div>
                {plan.desc && (
                  <p className="text-sm text-[var(--omni-text-muted)] mb-6 whitespace-pre-line">
                    {plan.desc}
                  </p>
                )}
                <ul className="space-y-3 mb-8">
                  {plan.features.map((feature, fIndex) => (
                    <li key={fIndex} className="flex items-center gap-2">
                      <Check className="w-5 h-5 text-green-500 flex-shrink-0" />
                      <span className="text-[var(--omni-text)] text-sm">{feature}</span>
                    </li>
                  ))}
                </ul>
                <div className="mt-auto flex justify-center">
                  {plan.link ? (
                    <Link
                      to={plan.link}
                      className={`w-full inline-flex items-center justify-center whitespace-nowrap px-4 py-3 rounded-xl transition-all ${
                        plan.primary
                          ? 'bg-[#2EE6A6] text-[#0B1220] font-bold hover:shadow-lg'
                          : plan.name === t('home.pricing.free.title', 'Darmowy')
                            ? 'bg-gray-100 text-[var(--omni-text)] font-semibold hover:bg-gray-200'
                            : 'bg-gray-100 text-[var(--omni-text)] font-semibold hover:bg-gray-200'
                      }`}
                    >
                      {plan.cta}
                    </Link>
                  ) : (
                    <button
                      disabled
                      className="w-full inline-flex items-center justify-center whitespace-nowrap px-4 py-3 rounded-xl transition-all bg-gray-100 text-[var(--omni-text-muted)] font-semibold opacity-60 cursor-not-allowed"
                    >
                      {plan.cta}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
          <p className="text-center text-sm text-[var(--omni-text-muted)] mt-8">
            {t('home.pricing.extra.info', '1 lekcja AI = do 5 zdjęć albo 1 dokument PDF/DOCX.')}
          </p>
          
          <div className="mt-12 max-w-2xl mx-auto bg-white/60 dark:bg-[#121A2B] border border-gray-100 dark:border-slate-700/60 rounded-2xl p-6 md:p-8 text-center shadow-sm">
            <h3 className="font-bold text-2xl text-slate-800 dark:text-slate-50 mb-2">{t('home.pricing.extra.title', 'Need more learning time?')}</h3>
            <p className="text-slate-600 dark:text-slate-300 mb-6">
              {t('home.pricing.extra.note', 'Extra AI lesson packs will be available on request.')}
            </p>
            
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
              <div className="bg-white dark:bg-[#0B1220] p-4 rounded-xl border border-gray-100 dark:border-slate-800/80 shadow-sm flex flex-col items-center transition-all hover:scale-[1.02]">
                <span className="text-xl font-bold text-slate-800 dark:text-slate-50 mb-1">9,99 zł</span>
                <span className="text-sm font-medium text-slate-500 dark:text-slate-400">{t('home.pricing.extra.pack1', '5 AI lessons')}</span>
              </div>
              <div className="bg-white dark:bg-[#0B1220] p-4 rounded-xl border border-gray-100 dark:border-slate-800/80 shadow-sm flex flex-col items-center transition-all hover:scale-[1.02]">
                <span className="text-xl font-bold text-slate-800 dark:text-slate-50 mb-1">17,99 zł</span>
                <span className="text-sm font-medium text-slate-500 dark:text-slate-400">{t('home.pricing.extra.pack2', '10 AI lessons')}</span>
              </div>
              <div className="bg-white dark:bg-[#0B1220] p-4 rounded-xl border border-[var(--omni-accent)]/30 dark:border-[#2EE6A6]/30 ring-1 ring-[var(--omni-accent)]/10 dark:ring-[#2EE6A6]/10 shadow-sm flex flex-col items-center relative overflow-hidden transition-all hover:scale-[1.02]">
                <div className="absolute top-0 right-0 bg-[var(--omni-accent)]/10 dark:bg-[#2EE6A6]/10 text-[var(--omni-accent)] dark:text-[#2EE6A6] text-[10px] font-bold px-2 py-0.5 rounded-bl-lg">{t('home.pricing.extra.bestValue', 'Best value')}</div>
                <span className="text-xl font-bold text-slate-800 dark:text-slate-50 mb-1">34,99 zł</span>
                <span className="text-sm font-medium text-slate-500 dark:text-slate-400">{t('home.pricing.extra.pack3', '25 AI lessons')}</span>
              </div>
            </div>

            <button
              disabled
              className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-gray-100 dark:bg-slate-800/80 text-slate-400 dark:text-slate-500 font-bold rounded-xl cursor-not-allowed"
            >
              {t('home.pricing.extra.cta', 'Lesson packs - coming soon')}
            </button>
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section id="faq" className="px-6 py-16 lg:py-24 bg-white/30 dark:bg-transparent">
        <div className="max-w-4xl mx-auto">
          <h2 className="omni-heading-2 text-[var(--omni-text)] text-center mb-12">
            {t('home.faq.title', 'Najczęściej zadawane pytania')}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {faqItems.map((item, index) => (
              <div key={index} className="omni-card p-6 bg-white/80 dark:bg-[#121A2B]/85 border border-gray-100 dark:border-slate-700/60 hover:border-[var(--omni-accent)]/20 dark:hover:border-[var(--omni-accent)]/40 transition-all flex flex-col">
                <h3 className="font-bold text-[var(--omni-text)] dark:text-slate-50 mb-2">
                  {item.question}
                </h3>
                <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
                  {item.answer}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>
 
      {/* O nas Section */}
      <section id="o-nas" className="px-6 py-16 lg:py-24">
        <div className="max-w-4xl mx-auto">
          <div className="omni-card p-8 lg:p-12 bg-white/50 dark:bg-[#121A2B]/85 border border-gray-100 dark:border-slate-700/60">
            <h2 className="omni-heading-3 text-[var(--omni-text)] dark:text-slate-50 mb-6 text-center">{t('home.about.title', 'O nas')}</h2>
            <div className="space-y-4 text-slate-700 dark:text-slate-300 leading-relaxed">
              <p>
                {t('home.about.p1', 'OmniNauka to nowoczesny korepetytor AI dla uczniów. Pomaga zrozumieć materiał z notatek, zdjęć, PDF-ów i dokumentów Word, prowadzi rozmowę z AI Tutorem, tworzy quizy i wspiera powtórki błędów.')}
              </p>
              <p>
                {t('home.about.p2', 'Tworzymy aplikację, która nie wyręcza ucznia, ale pomaga mu naprawdę zrozumieć temat.')}
              </p>
              <p className="pt-4 border-t border-gray-100 dark:border-slate-700/60 text-sm italic">
                {t('home.about.p3', 'OmniNauka jest rozwijana jako produkt mobile-first — prosty, szybki i wygodny dla uczniów korzystających głównie z telefonu lub tabletu.')}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="px-6 py-16 lg:py-24">
        <div className="max-w-4xl mx-auto text-center bg-[var(--omni-bg-dark)] rounded-3xl p-8 lg:p-12">
          <h2 className="omni-heading-2 text-white mb-4">
            {t('home.cta.title')}
          </h2>
          <p className="text-[var(--omni-text-muted-light)] mb-8 text-lg">
            {t('home.cta.subtitle')}
          </p>
          <Link 
            to="/register" 
            className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-[#2EE6A6] text-[#0B1220] font-bold rounded-xl hover:shadow-xl hover:shadow-[#2EE6A6]/20 transition-all active:scale-[0.98]"
          >
            {t('home.hero.cta.tryFree')}
            <ArrowRight className="w-5 h-5" />
          </Link>
        </div>
      </section>


      {/* Footer */}
      <footer className="px-6 pt-16 pb-8 bg-[#0B1220] text-white border-t border-white/5">
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-12 mb-16">
            {/* Brand Column */}
            <div className="flex flex-col gap-4">
              <div className="flex items-center">
                <OmniNaukaLogo size={32} className="!text-white" />
              </div>
              <p className="text-[#94A3B8] text-sm leading-relaxed max-w-[200px]">
                {t('home.footer.brandDesc', 'Personalizowana nauka dla każdego ucznia')}
              </p>
            </div>

            {/* Product Column */}
            <div>
              <h4 className="font-bold text-white mb-6 uppercase tracking-wider text-sm">{t('home.footer.product.title', 'Produkt')}</h4>
              <ul className="space-y-4">
                <li><a href="#jak-to-dziala" className="text-[#94A3B8] hover:text-[#2EE6A6] transition-colors text-sm">{t('home.footer.product.features', 'Funkcje')}</a></li>
                <li><a href="#cennik" className="text-[#94A3B8] hover:text-[#2EE6A6] transition-colors text-sm">{t('home.footer.product.pricing', 'Cennik')}</a></li>
                <li><a href="#faq" className="text-[#94A3B8] hover:text-[#2EE6A6] transition-colors text-sm">{t('home.footer.product.faq', 'FAQ')}</a></li>
              </ul>
            </div>

            {/* Company Column */}
            <div>
              <h4 className="font-bold text-white mb-6 uppercase tracking-wider text-sm">{t('home.footer.company.title', 'Firma')}</h4>
              <ul className="space-y-4">
                <li><a href="#o-nas" className="text-[#94A3B8] hover:text-[#2EE6A6] transition-colors text-sm">{t('home.footer.company.about', 'O nas')}</a></li>
                <li><a href="#" className="text-[#94A3B8] hover:text-[#2EE6A6] transition-colors text-sm">Blog</a></li>
                <li><Link to="/kontakt" className="text-[#94A3B8] hover:text-[#2EE6A6] transition-colors text-sm">{t('home.footer.company.contact', 'Kontakt')}</Link></li>
              </ul>
            </div>

            {/* Legal Column */}
            <div>
              <h4 className="font-bold text-white mb-6 uppercase tracking-wider text-sm">{t('home.footer.legal.title', 'Prawne')}</h4>
              <ul className="space-y-4">
                <li><Link to="/regulamin" className="text-[#94A3B8] hover:text-[#2EE6A6] transition-colors text-sm">{t('home.footer.legal.terms', 'Regulamin')}</Link></li>
                <li><Link to="/polityka-prywatnosci" className="text-[#94A3B8] hover:text-[#2EE6A6] transition-colors text-sm">{t('home.footer.legal.privacy', 'Polityka prywatności')}</Link></li>
                <li><Link to="/polityka-cookies" className="text-[#94A3B8] hover:text-[#2EE6A6] transition-colors text-sm">{t('home.footer.legal.cookies', 'Polityka cookies')}</Link></li>
                <li><Link to="/polityka-prywatnosci#rodo" className="text-[#94A3B8] hover:text-[#2EE6A6] transition-colors text-sm">RODO</Link></li>
                <li><Link to="/ai-disclaimer" className="text-[#94A3B8] hover:text-[#2EE6A6] transition-colors text-sm">{t('home.footer.legal.aiDisclaimer', 'AI Disclaimer')}</Link></li>
                <li><Link to="/polityka-zglaszania-naruszen" className="text-[#94A3B8] hover:text-[#2EE6A6] transition-colors text-sm">{t('home.footer.legal.reports', 'Zgłaszanie naruszeń i usuwanie treści')}</Link></li>
              </ul>
            </div>

          </div>

          <div className="pt-8 border-t border-white/5 flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex flex-col gap-1 text-center md:text-left">
              <p className="text-[#94A3B8] text-xs">
                {t('home.footer.copyright', '© 2026 OmniNauka. Wszelkie prawa zastrzeżone.')}
              </p>
              <p className="text-[#94A3B8] text-xs opacity-60 italic">
                {t('home.footer.creatorPrefix', 'Projekt, koncepcja i rozwój produktu:')} Piotr Fiszer —{' '}
                <a href="tel:+48604904150" className="hover:text-white underline transition-colors">+48 604 904 150</a>
                {' · '}
                <a href="mailto:piotr.fiszer@pfconsulting.pl" className="hover:text-white underline transition-colors">piotr.fiszer@pfconsulting.pl</a>
              </p>
            </div>
            <div className="flex items-center gap-6">
              {/* Optional: Add social icons here if needed in future */}
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
