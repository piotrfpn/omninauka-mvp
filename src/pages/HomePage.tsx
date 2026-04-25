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
        '2 lekcje AI dziennie',
        'AI Tutor tekstowy',
        'Quizy z wyjaśnieniami',
        'Historia nauki',
        'Kolejna lekcja AI: 1,99 zł'
      ],
      cta: 'Zacznij za darmo',
      primary: false,
    },
    {
      name: 'Premium',
      price: '29 zł',
      period: '/ miesiąc',
      badge: 'Najpopularniejszy',
      features: [
        'Więcej lekcji AI każdego dnia',
        'Zaawansowany AI Tutor',
        'Powtórki błędów',
        'Sprawdziany z raportem błędów',
        'Priorytetowe AI'
      ],
      cta: 'Wypróbuj 7 dni',
      primary: true,
    },
    {
      name: 'Premium+',
      price: '49 zł',
      period: '/ miesiąc',
      badge: 'Egzaminy',
      features: [
        'Wszystko z Premium',
        'Przygotowanie do egzaminu ósmoklasisty',
        'Przygotowanie do matury',
        'Zadania w stylu egzaminacyjnym',
        'Arkusze próbne i raport błędów'
      ],
      cta: 'Wypróbuj 7 dni',
      primary: false,
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
      cta: 'Wypróbuj 7 dni',
      primary: false,
    },
  ];

  const faqItems = [
    {
      question: "Czym jest lekcja AI?",
      answer: "Lekcja AI to jedna analiza materiału dodanego przez ucznia. Może to być do 5 zdjęć notatek albo 1 dokument PDF/DOCX. Po dodaniu materiału OmniNauka pomaga zrozumieć temat, prowadzi rozmowę z AI Tutorem i może przygotować quiz."
    },
    {
      question: "Czym różni się quiz od sprawdzianu?",
      answer: "Quiz z wyjaśnieniami to krótki trening po lekcji. Pomaga sprawdzić podstawowe zrozumienie tematu i pokazuje, dlaczego odpowiedź jest dobra lub błędna. Sprawdzian z raportem błędów to większy test gotowości do kartkówki lub sprawdzianu. Na końcu uczeń otrzymuje wynik oraz informację, które zagadnienia warto powtórzyć."
    },
    {
      question: "Czym jest Premium+?",
      answer: "Premium+ to plan dla uczniów przygotowujących się do ważniejszych egzaminów, takich jak egzamin ósmoklasisty lub matura. Obejmuje zadania w stylu egzaminacyjnym, arkusze próbne i raport błędów."
    },
    {
      question: "Czy OmniNauka przygotuje do egzaminu ósmoklasisty i matury?",
      answer: "Tak, planujemy tryb egzaminacyjny dla egzaminu ósmoklasisty i matury. Będzie to osobny moduł rozwijany po podstawowej wersji aplikacji."
    },
    {
      question: "Czy OmniNauka jest oficjalnym narzędziem CKE?",
      answer: "Nie. OmniNauka nie jest oficjalnym narzędziem CKE. Tryb egzaminacyjny będzie tworzony jako wsparcie nauki, z zadaniami w stylu egzaminacyjnym i materiałami inspirowanymi wymaganiami egzaminacyjnymi."
    },
    {
      question: "Czy mogę dodać PDF albo dokument Word?",
      answer: "Tak. OmniNauka obsługuje zdjęcia JPG, PNG, WEBP, tekstowe pliki PDF oraz dokumenty DOCX. Skanowane PDF-y mogą wymagać dodania stron jako zdjęcia."
    },
    {
      question: "Czy OmniNauka rozwiązuje zadania za ucznia?",
      answer: "Celem OmniNauka nie jest podawanie gotowych odpowiedzi bez nauki. AI Tutor pomaga zrozumieć materiał, tłumaczy błędy, zadaje pytania i prowadzi ucznia krok po kroku."
    },
    {
      question: "Czy płatności są już aktywne?",
      answer: "Na etapie wersji beta płatności i limity mogą być uruchamiane etapowo. Obecne pakiety pokazują planowany model korzystania z OmniNauka."
    }
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
            className="px-4 py-2 text-[var(--omni-text)] font-medium hover:text-[var(--omni-accent)] transition-colors"
          >
            Zaloguj się
          </Link>
          <Link 
            to="/register" 
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
              to="/register" 
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
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
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
                      <span className="text-[var(--omni-text)] text-sm">{feature}</span>
                    </li>
                  ))}
                </ul>
                <div className="mt-auto flex justify-center">
                  <Link
                    to="/register"
                    className={`w-full inline-flex items-center justify-center whitespace-nowrap px-4 py-3 rounded-xl transition-all ${
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
            1 lekcja AI = do 5 zdjęć albo 1 dokument PDF/DOCX.
          </p>
          
          <div className="mt-12 max-w-sm mx-auto bg-white/50 border border-gray-100 rounded-2xl p-6 text-center">
            <h3 className="font-semibold text-[var(--omni-text)] mb-4">Dodatkowe lekcje AI</h3>
            <div className="space-y-2 text-[var(--omni-text-muted)] text-sm mb-4">
              <div className="flex justify-between items-center px-4">
                <span>5 lekcji AI</span>
                <span className="font-medium text-[var(--omni-text)]">7,99 zł</span>
              </div>
              <div className="flex justify-between items-center px-4">
                <span>10 lekcji AI</span>
                <span className="font-medium text-[var(--omni-text)]">14,99 zł</span>
              </div>
              <div className="flex justify-between items-center px-4">
                <span>25 lekcji AI</span>
                <span className="font-medium text-[var(--omni-text)]">29,99 zł</span>
              </div>
            </div>
            <p className="text-xs text-[var(--omni-text-muted-light)] border-t border-gray-100 pt-4">
              Pakiety dodatkowych lekcji będą dostępne po uruchomieniu płatności.
            </p>
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section id="faq" className="px-6 py-16 lg:py-24 bg-white/30">
        <div className="max-w-4xl mx-auto">
          <h2 className="omni-heading-2 text-[var(--omni-text)] text-center mb-12">
            Najczęściej zadawane pytania
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {faqItems.map((item, index) => (
              <div key={index} className="omni-card p-6 bg-white/80 border border-gray-100 hover:border-[var(--omni-accent)]/20 transition-all flex flex-col">
                <h3 className="font-bold text-[var(--omni-text)] mb-2">
                  {item.question}
                </h3>
                <p className="text-sm text-[var(--omni-text-muted)] leading-relaxed">
                  {item.answer}
                </p>
              </div>
            ))}
          </div>
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
            to="/register" 
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
