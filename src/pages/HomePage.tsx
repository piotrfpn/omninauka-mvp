import { useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth-context';
import { Scan, Brain, BookOpen, MessageCircle, BarChart3, ArrowRight, Check } from 'lucide-react';

export default function HomePage() {
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
      title: 'Zeskanuj notatki',
      description: 'Wgraj zdjęcie swoich notatek lub strony z podręcznika.',
    },
    {
      icon: Brain,
      title: 'AI analizuje',
      description: 'Sztuczna inteligencja wyciąga kluczowe pojęcia i tworzy materiał.',
    },
    {
      icon: BookOpen,
      title: 'Ucz się efektywnie',
      description: 'Fiszki, quizy i lekcje dostosowane do Twoich materiałów.',
    },
    {
      icon: MessageCircle,
      title: 'Rozmawiaj z AI',
      description: 'Zadawaj pytania i ucz się przez dialog z korepetytorem AI.',
    },
    {
      icon: BarChart3,
      title: 'Śledź postępy',
      description: 'Monitoruj swoje wyniki i identyfikuj słabe punkty.',
    },
  ];

  const pricingPlans = [
    {
      name: 'Darmowy',
      price: '0 zł',
      period: '/ miesiąc',
      features: [
        '2 analizy dziennie',
        'AI Tutor tekstowy',
        'Quizy z wyjaśnieniami',
        'Historia nauki',
        'Kolejne analizy: 1,99 zł'
      ],
      cta: 'Zacznij za darmo',
      primary: false,
    },
    {
      name: 'Premium',
      price: '29 zł',
      period: '/ miesiąc',
      features: [
        'Więcej analiz każdego dnia',
        'Zaawansowany AI Tutor',
        'Powtórki błędów',
        'Tryb sprawdzianu',
        'Priorytetowe AI'
      ],
      cta: 'Wypróbuj 7 dni',
      primary: true,
    },
    {
      name: 'Rodzinny',
      price: '59 zł',
      period: '/ miesiąc',
      features: [
        'Do 3 kont uczniowskich',
        'Wszystko z Premium',
        'Raporty postępów',
        'Wspólna historia nauki',
        'Panel rodzica — wkrótce'
      ],
      cta: 'Wybierz plan',
      primary: false,
    },
  ];

  return (
    <div className="min-h-screen bg-[var(--omni-bg)]">
      {/* Navigation */}
      <nav className="w-full px-6 py-4 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2">
          <div className="w-10 h-10 rounded-xl bg-[var(--omni-bg-dark)] flex items-center justify-center">
            <span className="text-white font-bold text-lg">O</span>
          </div>
          <span className="font-semibold text-xl text-[var(--omni-text)]">
            OmniNauka
          </span>
        </Link>
        <div className="flex items-center gap-4">
          <Link
            to="/login"
            className="hidden sm:inline-flex px-4 py-2 text-[var(--omni-text)] font-medium hover:text-[var(--omni-accent)] transition-colors"
          >
            Zaloguj się
          </Link>
          <Link 
            to="/login" 
            className="hidden sm:inline-flex items-center justify-center px-5 py-2.5 bg-[#2EE6A6] text-[#0B1220] font-bold rounded-xl text-sm hover:shadow-lg hover:shadow-[#2EE6A6]/10 transition-all active:scale-[0.98]"
          >
            Wypróbuj za darmo
          </Link>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="px-6 pt-10 pb-16 lg:py-24">
        <div className="max-w-6xl mx-auto text-center">
          <h1 className="omni-heading-1 text-[var(--omni-text)] mb-6">
            Nauka, która ożywa
          </h1>
          <p className="omni-body text-[var(--omni-text-muted)] max-w-2xl mx-auto mb-8 text-lg">
            Zeskanuj notatki. OmniNauka stworzy fiszki, quizy i głosowe powtórki
            dopasowane do Twoich materiałów.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 w-full sm:w-auto">
            <Link 
              to="/login" 
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-4 bg-[#2EE6A6] text-[#0B1220] font-bold rounded-xl hover:shadow-xl hover:shadow-[#2EE6A6]/20 transition-all active:scale-[0.98]"
            >
              Wypróbuj za darmo
              <ArrowRight className="w-5 h-5" />
            </Link>
            <Link 
              to="#jak-to-dziala" 
              className="w-full sm:w-auto inline-flex items-center justify-center px-8 py-4 text-[var(--omni-text-muted)] font-medium hover:text-[var(--omni-text)] transition-colors"
            >
              Zobacz jak działa
            </Link>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="jak-to-dziala" className="px-6 py-16 lg:py-24">
        <div className="max-w-6xl mx-auto">
          <h2 className="omni-heading-2 text-[var(--omni-text)] text-center mb-12">
            Jak to działa?
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
            Wybierz plan
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
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
                  {plan.primary && (
                    <span className="omni-chip bg-[var(--omni-accent)] text-white text-xs whitespace-nowrap px-3 py-1">
                      Najpopularniejszy
                    </span>
                  )}
                </div>
                <div className="flex items-baseline mb-4">
                  <span className="text-4xl font-bold text-[var(--omni-text)]">
                    {plan.price}
                  </span>
                  <span className="text-[var(--omni-text-muted)] ml-1">
                    {plan.period}
                  </span>
                </div>
                <ul className="space-y-3 mb-8">
                  {plan.features.map((feature, fIndex) => (
                    <li key={fIndex} className="flex items-center gap-2">
                      <Check className="w-5 h-5 text-green-500 flex-shrink-0" />
                      <span className="text-[var(--omni-text)]">{feature}</span>
                    </li>
                  ))}
                </ul>
                <div className="mt-auto flex justify-center">
                  <Link
                    to="/login"
                    className={`inline-flex items-center justify-center whitespace-nowrap px-8 py-3 rounded-full transition-all ${
                      plan.primary
                        ? 'bg-[#2EE6A6] text-[#0B1220] font-bold hover:shadow-lg'
                        : 'bg-gray-100 text-[var(--omni-text)] font-semibold hover:bg-gray-200'
                    }`}
                  >
                    {plan.cta}
                  </Link>
                </div>
              </div>
            ))}
          </div>
          <p className="text-center text-sm text-[var(--omni-text-muted)] mt-8">
            1 analiza = do 5 zdjęć albo 1 dokument PDF/DOCX.
          </p>
        </div>
      </section>

      {/* CTA Section */}
      <section className="px-6 py-16 lg:py-24">
        <div className="max-w-4xl mx-auto text-center bg-[var(--omni-bg-dark)] rounded-3xl p-8 lg:p-12">
          <h2 className="omni-heading-2 text-white mb-4">
            Gotowy, by zacząć?
          </h2>
          <p className="text-[var(--omni-text-muted-light)] mb-8 text-lg">
            Dołącz do tysięcy uczniów, którzy uczą się mądrzej, nie ciężej.
          </p>
          <Link 
            to="/login" 
            className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-[#2EE6A6] text-[#0B1220] font-bold rounded-xl hover:shadow-xl hover:shadow-[#2EE6A6]/20 transition-all active:scale-[0.98]"
          >
            Wypróbuj za darmo
            <ArrowRight className="w-5 h-5" />
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="px-6 py-12 border-t border-[var(--omni-text)]/10">
        <div className="max-w-6xl mx-auto">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-[var(--omni-bg-dark)] flex items-center justify-center">
                <span className="text-white font-bold text-sm">O</span>
              </div>
              <span className="font-semibold text-[var(--omni-text)]">
                OmniNauka
              </span>
            </div>
            <p className="text-[var(--omni-text-muted)] text-sm">
              © 2025 OmniNauka. Wszelkie prawa zastrzeżone.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
