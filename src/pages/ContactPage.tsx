import { Link } from 'react-router-dom';
import { Mail, Phone, MapPin, ArrowLeft } from 'lucide-react';
import OmniNaukaLogo from '../components/brand/OmniNaukaLogo';
import { useTranslation } from 'react-i18next';

export default function ContactPage() {
  const { t } = useTranslation();

  return (
    <div className="min-h-screen bg-[var(--omni-bg)] flex flex-col">
      {/* Navigation */}
      <nav className="w-full px-6 py-4 flex items-center justify-between border-b border-[var(--omni-text)]/5">
        <Link to="/" className="flex items-center">
          <OmniNaukaLogo size={40} />
        </Link>
        <Link 
          to="/login" 
          className="px-4 py-2 text-[var(--omni-text)] font-medium hover:text-[var(--omni-accent)] transition-colors"
        >
          {t('home.nav.login', 'Zaloguj się')}
        </Link>
      </nav>

      <main className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-4xl">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
            <div>
              <Link 
                to="/" 
                className="inline-flex items-center gap-2 text-[var(--omni-text-muted)] hover:text-[var(--omni-text)] mb-8 transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                {t('contact.backHome', 'Wróć na stronę główną')}
              </Link>
              
              <h1 className="omni-heading-2 text-[var(--omni-text)] mb-6">{t('contact.title', 'Kontakt')}</h1>
              <p className="text-[var(--omni-text-muted)] text-lg mb-8 leading-relaxed">
                {t('contact.description', 'W sprawach współpracy, testów beta lub pytań dotyczących OmniNauka prosimy o kontakt mailowy lub telefoniczny.')}
              </p>
            </div>

            <div className="omni-card p-8 lg:p-10 border border-gray-100 bg-white shadow-sm">
              <div className="space-y-6">
                <div>
                  <h2 className="font-bold text-xl mb-4 text-[var(--omni-accent)]">PFConsulting</h2>
                  <div className="space-y-2 text-[var(--omni-text)]">
                    <p className="font-semibold text-lg">Piotr Fiszer</p>
                    <div className="flex items-start gap-3 text-[var(--omni-text-muted)]">
                      <MapPin className="w-5 h-5 mt-0.5 text-[var(--omni-accent)]/60" />
                      <div>
                        <p>ul. Promienista 114</p>
                        <p>60-142 Poznań</p>
                        <p>Polska</p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="pt-6 border-t border-gray-100 space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-[var(--omni-lavender)] flex items-center justify-center">
                      <Mail className="w-5 h-5 text-[var(--omni-text)]" />
                    </div>
                    <div>
                      <p className="text-xs text-[var(--omni-text-muted)] uppercase tracking-wider font-bold">{t('contact.emailLabel', 'E-mail')}</p>
                      <a 
                        href="mailto:piotr.fiszer@pfconsulting.pl" 
                        className="text-[var(--omni-text)] hover:text-[var(--omni-accent)] font-medium transition-colors"
                      >
                        piotr.fiszer@pfconsulting.pl
                      </a>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-[var(--omni-lavender)] flex items-center justify-center">
                      <Phone className="w-5 h-5 text-[var(--omni-text)]" />
                    </div>
                    <div>
                      <p className="text-xs text-[var(--omni-text-muted)] uppercase tracking-wider font-bold">{t('contact.phoneLabel', 'Telefon')}</p>
                      <a 
                        href="tel:+48604904150" 
                        className="text-[var(--omni-text)] hover:text-[var(--omni-accent)] font-medium transition-colors"
                      >
                        +48 604 904 150
                      </a>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="px-6 py-12 bg-[#0B1220] text-white/50 text-center text-sm border-t border-white/5">
        <div className="max-w-4xl mx-auto">
          <div className="flex flex-wrap justify-center gap-x-6 gap-y-3 mb-6 text-xs uppercase tracking-wider font-medium">
            <Link to="/regulamin" className="hover:text-white transition-colors">{t('home.footer.legal.terms', 'Regulamin')}</Link>
            <Link to="/polityka-prywatnosci" className="hover:text-white transition-colors">{t('home.footer.legal.privacy', 'Polityka prywatności')}</Link>
            <Link to="/polityka-cookies" className="hover:text-white transition-colors">{t('home.footer.legal.cookies', 'Polityka cookies')}</Link>
            <Link to="/ai-disclaimer" className="hover:text-white transition-colors">{t('home.footer.legal.aiDisclaimer', 'AI Disclaimer')}</Link>
            <Link to="/polityka-zglaszania-naruszen" className="hover:text-white transition-colors">{t('home.footer.legal.reports', 'Zgłaszanie naruszeń')}</Link>
          </div>
          <p>{t('home.footer.copyright', '© 2026 OmniNauka. Wszelkie prawa zastrzeżone.')}</p>
        </div>
      </footer>
    </div>
  );
}

