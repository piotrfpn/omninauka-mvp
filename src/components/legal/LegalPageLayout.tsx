import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, AlertTriangle, Info } from 'lucide-react';
import OmniNaukaLogo from '../brand/OmniNaukaLogo';
import { useTranslation } from 'react-i18next';

interface LegalPageLayoutProps {
  title: string;
  lastUpdated?: string;
  isDraft?: boolean;
  children: React.ReactNode;
}

export default function LegalPageLayout({ 
  title, 
  lastUpdated, 
  isDraft = true, 
  children 
}: LegalPageLayoutProps) {
  const { t, i18n } = useTranslation();

  // Ensure the page starts at the top
  React.useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  return (
    <div className="min-h-screen bg-[var(--omni-bg)] flex flex-col">
      {/* Navigation */}
      <nav className="w-full px-6 py-4 flex items-center justify-between border-b border-[var(--omni-text)]/5 bg-[var(--omni-bg)] sticky top-0 z-50">
        <Link to="/" className="flex items-center">
          <OmniNaukaLogo size={36} />
        </Link>
        <Link 
          to="/login" 
          className="px-4 py-2 text-[var(--omni-text)] font-medium hover:text-[var(--omni-accent)] transition-colors text-sm"
        >
          {t('auth.login', 'Zaloguj się')}
        </Link>
      </nav>

      {/* Main Content */}
      <main className="flex-1 px-6 py-12 lg:py-20">
        <div className="max-w-3xl mx-auto">
          {/* Back link */}
          <Link 
            to="/" 
            className="inline-flex items-center gap-2 text-[var(--omni-text-muted)] hover:text-[var(--omni-text)] mb-8 transition-colors text-sm"
          >
            <ArrowLeft className="w-4 h-4" />
            {t('legal.backHome', 'Wróć na stronę główną')}
          </Link>

          {/* Binding Notice for non-PL languages */}
          {i18n.language !== 'pl' && (
            <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-900/30 rounded-xl flex items-start gap-3">
              <Info className="w-5 h-5 text-blue-600 dark:text-blue-500 mt-0.5 flex-shrink-0" />
              <p className="text-sm text-blue-800 dark:text-blue-200 font-medium">
                {t('legal.bindingNotice', 'This translation is provided for convenience only. The Polish version is the legally binding version.')}
              </p>
            </div>
          )}

          {/* Draft Notice */}
          {isDraft && (
            <div className="mb-10 p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-900/30 rounded-xl flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-500 mt-0.5 flex-shrink-0" />
              <p className="text-sm text-amber-800 dark:text-amber-200 font-medium">
                Dokument roboczy — wymaga finalnej weryfikacji prawnej przed komercyjnym uruchomieniem usługi.
              </p>
            </div>
          )}

          <div className="space-y-8">
            <header>
              <h1 className="omni-heading-2 text-[var(--omni-text)] mb-2">{title}</h1>
              {lastUpdated && (
                <p className="text-sm text-[var(--omni-text-muted)]">
                  Ostatnia aktualizacja: {lastUpdated}
                </p>
              )}
            </header>

            <div className="prose prose-slate dark:prose-invert max-w-none 
              prose-headings:text-[var(--omni-text)] 
              prose-p:text-[var(--omni-text-muted)] 
              prose-li:text-[var(--omni-text-muted)]
              prose-strong:text-[var(--omni-text)]
              prose-headings:font-bold
              prose-h2:text-2xl prose-h2:mt-12 prose-h2:mb-6
              prose-h3:text-xl prose-h3:mt-8 prose-h3:mb-4
              prose-p:leading-relaxed prose-li:leading-relaxed
              prose-a:text-[var(--omni-accent)] prose-a:no-underline hover:prose-a:underline">
              {children}
            </div>
          </div>
        </div>
      </main>

      {/* Simplified Footer */}
      <footer className="px-6 py-12 bg-[#0B1220] text-white/50 border-t border-white/5 mt-auto">
        <div className="max-w-3xl mx-auto text-center">
          <div className="flex justify-center mb-8">
            <OmniNaukaLogo size={32} />
          </div>
          <div className="flex flex-wrap justify-center gap-x-8 gap-y-4 mb-8 text-xs font-medium uppercase tracking-wider">
            <Link to="/regulamin" className="hover:text-white transition-colors">{t('home.footer.legal.terms', 'Regulamin')}</Link>
            <Link to="/polityka-prywatnosci" className="hover:text-white transition-colors">{t('home.footer.legal.privacy', 'Prywatność')}</Link>
            <Link to="/cookies" className="hover:text-white transition-colors">{t('legal.cookies.title', 'Cookies')}</Link>
            <Link to="/ai-disclaimer" className="hover:text-white transition-colors">{t('legal.aiDisclaimer.title', 'AI Disclaimer')}</Link>
            <Link to="/polityka-zglaszania-naruszen" className="hover:text-white transition-colors">{t('home.footer.legal.reports', 'Zgłaszanie naruszeń')}</Link>
            <Link to="/kontakt" className="hover:text-white transition-colors">{t('contact.title', 'Kontakt')}</Link>
          </div>
          <p className="text-sm">{t('home.footer.copyright', '© 2026 OmniNauka. Wszelkie prawa zastrzeżone.')}</p>
        </div>
      </footer>
    </div>
  );
}
