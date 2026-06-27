import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Download, CheckCircle2, Share, Plus, Smartphone, Monitor, AlertCircle } from 'lucide-react';
import OmniNaukaLogo from '../components/brand/OmniNaukaLogo';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { LanguageSwitcher } from '../components/LanguageSwitcher';

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{
    outcome: 'accepted' | 'dismissed';
    platform: string;
  }>;
};

const getInitialPlatform = (): 'android' | 'ios' | 'desktop' => {
  if (typeof window === 'undefined') return 'desktop';
  const userAgent = window.navigator.userAgent.toLowerCase();
  if (/iphone|ipad|ipod/.test(userAgent)) return 'ios';
  if (/android/.test(userAgent)) return 'android';
  return 'desktop';
};

const getInitialInstalled = (): boolean => {
  if (typeof window === 'undefined') return false;
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches || 
                      ((window.navigator as unknown) as { standalone?: boolean }).standalone;
  return !!isStandalone;
};

export default function InstallPage() {
  const { t } = useTranslation();
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState<boolean>(getInitialInstalled);
  const [platform] = useState<'android' | 'ios' | 'desktop'>(getInitialPlatform);

  // Detect platform
  useEffect(() => {
    // Handle beforeinstallprompt event
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    // Handle appinstalled event
    const handleAppInstalled = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
      toast.success(t('install.successToast', 'Aplikacja została pomyślnie zainstalowana!'));
    };

    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, [t]);

  const handleInstallClick = async () => {
    if (!deferredPrompt) {
      toast.info(t('install.toastNoPrompt', 'Użyj menu przeglądarki, aby zainstalować aplikację.'));
      return;
    }
    
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    console.log(`User choice: ${outcome}`);
    setDeferredPrompt(null);
  };

  return (
    <div className="min-h-screen bg-[var(--omni-bg)] omninauka-bg-shell flex flex-col justify-between px-6 py-8 relative">
      <div className="absolute top-4 right-4">
        <LanguageSwitcher />
      </div>

      <div className="w-full max-w-2xl mx-auto flex-1 flex flex-col justify-center">
        <div className="mb-6">
          <Link 
            to="/" 
            className="inline-flex items-center text-[var(--omni-text-muted)] hover:text-[var(--omni-text)] text-sm transition-colors"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            {t('auth.backToHome', '← Wróć na stronę główną')}
          </Link>
        </div>

        <div className="flex flex-col items-center text-center mb-8">
          <OmniNaukaLogo size={56} showWordmark={false} className="justify-center mb-3" />
          <div className="font-bold text-3xl text-[var(--omni-text)] dark:text-slate-50 leading-none mb-2">
            OmniNauka
          </div>
          <div className="inline-flex items-center justify-center gap-1.5 px-3 py-1 rounded-full bg-[var(--omni-accent)]/10 text-[var(--omni-accent)] text-xs font-bold uppercase tracking-wider mb-6">
            <span className="w-1.5 h-1.5 rounded-full bg-[var(--omni-accent)] animate-pulse" />
            Progressive Web App
          </div>
          <h1 className="omni-heading-2 text-[var(--omni-text)] dark:text-slate-50 mb-3">
            {t('install.title', 'Zainstaluj OmniNauka na telefonie')}
          </h1>
          <p className="text-[var(--omni-text-muted)] text-base max-w-lg mx-auto">
            {t('install.subtitle', 'Dodaj OmniNauka do ekranu głównego i korzystaj jak z aplikacji.')}
          </p>
        </div>

        {isInstalled ? (
          <div className="omni-card p-8 text-center space-y-4 max-w-md mx-auto w-full">
            <div className="w-16 h-16 bg-green-500/10 text-green-500 rounded-full flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <h2 className="omni-heading-3 text-[var(--omni-text)] dark:text-slate-50">
              {t('install.installedTitle', 'Aplikacja zainstalowana!')}
            </h2>
            <p className="text-[var(--omni-text-muted)] text-sm">
              {t('install.postInstall', 'Po dodaniu ikony możesz uruchamiać OmniNauka bezpośrednio z ekranu głównego telefonu.')}
            </p>
            <div className="pt-4">
              <Link 
                to="/login" 
                className="omni-btn omni-btn-primary w-full inline-flex justify-center"
              >
                {t('auth.login.submit', 'Zaloguj się')}
              </Link>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Android / Chrome Section */}
            {(platform === 'android' || platform === 'desktop') && (
              <div className={`omni-card p-6 border-l-4 ${platform === 'android' ? 'border-l-[var(--omni-accent)] bg-[var(--omni-accent)]/5' : 'border-l-slate-400'}`}>
                <div className="flex items-start gap-4">
                  <div className="p-3 bg-[var(--omni-accent)]/10 text-[var(--omni-accent)] rounded-lg">
                    <Smartphone className="w-6 h-6" />
                  </div>
                  <div className="space-y-3 flex-1">
                    <h3 className="font-bold text-lg text-[var(--omni-text)] dark:text-slate-50">
                      {t('install.androidTitle', 'Android / Chrome')}
                    </h3>
                    <p className="text-sm text-[var(--omni-text-muted)] leading-relaxed">
                      {t('install.androidDesc', 'Kliknij przycisk „Zainstaluj aplikację”, jeśli jest dostępny. Jeśli nie widzisz przycisku, otwórz menu Chrome i wybierz „Dodaj do ekranu głównego” lub „Zainstaluj aplikację”.')}
                    </p>
                    
                    {deferredPrompt ? (
                      <button
                        type="button"
                        onClick={handleInstallClick}
                        className="omni-btn omni-btn-primary inline-flex items-center gap-2 mt-2"
                        aria-live="polite"
                      >
                        <Download className="w-4 h-4" />
                        {t('install.androidBtn', 'Zainstaluj aplikację')}
                      </button>
                    ) : (
                      <div className="space-y-2">
                        <div className="flex items-start gap-2 text-amber-500 text-xs mt-2 bg-amber-500/10 p-2.5 rounded border border-amber-500/20">
                          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                          <span>
                            {t('install.androidFallback', 'Jeśli przycisk nie jest dostępny, użyj menu przeglądarki i wybierz „Dodaj do ekranu głównego”.')}
                          </span>
                        </div>
                        <p className="text-[11px] text-[var(--omni-text-muted)]">
                          {t('install.androidFallbackNote', 'Przycisk może nie pojawić się, jeśli aplikacja jest już zainstalowana lub przeglądarka nie udostępniła jeszcze instalacji.')}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* iOS / Safari Section */}
            {(platform === 'ios' || platform === 'desktop') && (
              <div className={`omni-card p-6 border-l-4 ${platform === 'ios' ? 'border-l-[var(--omni-accent)] bg-[var(--omni-accent)]/5' : 'border-l-slate-400'}`}>
                <div className="flex items-start gap-4">
                  <div className="p-3 bg-indigo-500/10 text-indigo-500 rounded-lg">
                    <Share className="w-6 h-6" />
                  </div>
                  <div className="space-y-3 flex-1">
                    <h3 className="font-bold text-lg text-[var(--omni-text)] dark:text-slate-50">
                      {t('install.iosTitle', 'iPhone / Safari')}
                    </h3>
                    <div className="text-sm text-[var(--omni-text-muted)] space-y-2 leading-relaxed">
                      <p>{t('install.iosDesc1', '1. Otwórz OmniNauka w Safari.')}</p>
                      <p className="flex items-center gap-1.5">
                        {t('install.iosDesc2', '2. Kliknij ikonę Udostępnij.')}
                        <Share className="w-3.5 h-3.5 inline text-indigo-500" />
                      </p>
                      <p className="flex items-center gap-1.5">
                        {t('install.iosDesc3', '3. Wybierz „Dodaj do ekranu początkowego”.')}
                        <Plus className="w-3.5 h-3.5 inline text-indigo-500" />
                      </p>
                      <p>{t('install.iosDesc4', '4. Kliknij „Dodaj”.')}</p>
                    </div>
                    <div className="text-xs text-[var(--omni-text-muted)] italic pt-1 border-t border-slate-200 dark:border-slate-800">
                      {t('install.iosNote', 'Na iPhone instalacja wymaga ręcznego dodania przez menu Safari.')}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Desktop Fallback Info */}
            {platform === 'desktop' && (
              <div className="omni-card p-6 border-l-4 border-l-slate-400 bg-slate-500/5">
                <div className="flex items-start gap-4">
                  <div className="p-3 bg-slate-500/10 text-slate-500 rounded-lg">
                    <Monitor className="w-6 h-6" />
                  </div>
                  <div className="space-y-2 flex-1">
                    <h3 className="font-bold text-lg text-[var(--omni-text)] dark:text-slate-50">
                      {t('install.desktopTitle', 'Komputer / Desktop')}
                    </h3>
                    <p className="text-sm text-[var(--omni-text-muted)] leading-relaxed">
                      {t('install.desktopDesc', 'Aby w pełni cieszyć się trybem aplikacji mobilnej, zeskanuj kod QR lub otwórz tę stronę na swoim smartfonie.')}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="text-center text-xs text-[var(--omni-text-muted)] mt-8">
        {t('home.footer.copyright', '© 2026 OmniNauka. Wszelkie prawa zastrzeżone.')}
      </div>
    </div>
  );
}
