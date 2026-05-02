import { useState, useEffect } from 'react';
import { useAuth } from '../../lib/auth-context';
import { supabase } from '../../lib/supabase';
import { Mail, ShieldAlert, Send, CheckCircle2, ArrowLeft, RefreshCw } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { LanguageSwitcher } from '../../components/LanguageSwitcher';

export default function PendingConsentPage() {
  const { t } = useTranslation();
  const { user, logout } = useAuth();
  const [parentEmail, setParentEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSent, setIsSent] = useState(false);
  const [error, setError] = useState('');
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown > 0) {
      const timer = setTimeout(() => setCooldown(cooldown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [cooldown]);

  const handleSendConsent = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!user || cooldown > 0) return;
    
    setError('');
    setIsLoading(true);

    try {
      // Call Edge Function
      const { data, error: fnError } = await supabase.functions.invoke('send-consent-email', {
        body: { parent_email: parentEmail }
      });

      if (fnError) {
        console.error('send-consent-email error details:', fnError);

        let userFriendlyMsg = 'Wystąpił błąd podczas wysyłania prośby.';
        const status = (fnError as any).status || (fnError as any).context?.status;
        
        // Try to get specific error from message or context
        const errorMsg = fnError.message || '';

        if (errorMsg.includes('Poczekaj') || status === 429) {
          userFriendlyMsg = t('auth.pending.error.wait');
          setCooldown(60);
        } else if (errorMsg.includes('RESEND_API_KEY') || errorMsg.includes('RESEND_FROM_EMAIL')) {
          userFriendlyMsg = t('auth.pending.error.config');
        } else if (errorMsg.includes('Niepoprawny status konta') || status === 400) {
          // Check if it's actually "not pending"
          if (errorMsg.includes('Niepoprawny status konta')) {
            userFriendlyMsg = t('auth.pending.error.notPending');
          } else {
            userFriendlyMsg = t('auth.pending.error.invalidData');
          }
        } else if (errorMsg.includes('Failed to send a request') || fnError.name === 'FunctionsFetchError') {
          userFriendlyMsg = t('auth.pending.error.network');
        } else if (status === 401 || status === 403) {
          userFriendlyMsg = t('auth.pending.error.auth');
        } else {
          userFriendlyMsg = t('auth.pending.error.generic');
          userFriendlyMsg += ` (Kod: ${status || fnError.name || 'unknown'})`;
        }

        setError(userFriendlyMsg);
        return;
      }

      if (data?.error) {
        setError(data.error);
        return;
      }

      setIsSent(true);
      setError('');
      setCooldown(60); // 60s cooldown after successful send
    } catch (err: any) {
      console.error('Consent error:', err);
      setError(t('auth.pending.error.technical'));
    } finally {
      setIsLoading(false);
    }
  };

  const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

  return (
    <div className="min-h-screen bg-[var(--omni-bg)] flex items-center justify-center px-6 py-12 relative">
      <div className="absolute top-4 right-4">
        <LanguageSwitcher />
      </div>
      <div className="w-full max-w-xl">
        <div className="omni-card p-8 md:p-12 text-center">
          <div className="w-20 h-20 bg-amber-100 rounded-full flex items-center justify-center text-amber-600 mx-auto mb-6">
            <ShieldAlert className="w-10 h-10" />
          </div>

          <h1 className="omni-heading-2 mb-4 text-[var(--omni-text)]">
            {t('auth.pending.title')}
          </h1>
          
          <p className="text-[var(--omni-text-muted)] text-lg mb-8">
            {t('auth.pending.desc1')} {user?.name}{t('auth.pending.desc2')}
          </p>

          {!isSent ? (
            <div className="text-left max-w-md mx-auto">
              <form onSubmit={handleSendConsent} className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-[var(--omni-text)] mb-2">
                    {t('auth.pending.emailLabel')}
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                      type="email"
                      value={parentEmail}
                      onChange={(e) => setParentEmail(e.target.value)}
                      placeholder={t('auth.pending.emailPlaceholder')}
                      className="omni-input pl-12"
                      required
                    />
                  </div>
                  <p className="text-xs text-[var(--omni-text-muted)] mt-2">
                    {t('auth.pending.emailHelp')}
                  </p>
                </div>

                {error && (
                  <div className="p-3 bg-red-50 text-red-600 rounded-lg text-sm border border-red-200">
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isLoading || cooldown > 0}
                  className="w-full omni-btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isLoading ? (
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : cooldown > 0 ? (
                    `${t('auth.pending.wait')} ${cooldown}${t('auth.pending.waitSuffix')}`
                  ) : (
                    <>
                      {t('auth.pending.submit')}
                      <Send className="w-5 h-5" />
                    </>
                  )}
                </button>
              </form>
            </div>
          ) : (
            <div className="animate-in fade-in zoom-in duration-500">
              <div className="p-6 bg-green-50 rounded-2xl border border-green-100 text-green-800 mb-8">
                <CheckCircle2 className="w-12 h-12 mx-auto mb-4 text-green-600" />
                <h3 className="text-xl font-bold mb-2">{t('auth.pending.successTitle')}</h3>
                <p>
                  {t('auth.pending.successDesc1')}<strong>{parentEmail}</strong>{t('auth.pending.successDesc2')}
                </p>
                <p className="mt-4 text-sm font-medium">
                  {t('auth.pending.successNote')}
                </p>
              </div>

              <div className="flex flex-col gap-4">
                <button
                  onClick={() => setIsSent(false)}
                  disabled={cooldown > 0}
                  className="text-[var(--omni-accent)] font-medium hover:underline flex items-center justify-center mx-auto disabled:text-gray-400 disabled:no-underline"
                >
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  {cooldown > 0 ? `${t('auth.pending.otherEmailWait')} ${cooldown}s` : t('auth.pending.otherEmail')}
                </button>
                
                {cooldown === 0 && (
                  <button
                    onClick={() => handleSendConsent()}
                    className="text-sm text-[var(--omni-text-muted)] hover:text-[var(--omni-text)] flex items-center justify-center gap-2"
                  >
                    <RefreshCw className="w-4 h-4" />
                    {t('auth.pending.resend')}
                  </button>
                )}
              </div>
              
              {isLocalhost && (
                <div className="mt-6 p-4 bg-gray-100 rounded-lg text-xs text-left border border-gray-200">
                  <p className="font-bold mb-1 text-gray-600 uppercase tracking-wider">Debug (Localhost only):</p>
                  <p className="text-gray-500">Link został wysłany przez Resend API. Sprawdź dashboard Resend lub skrzynkę odbiorczą.</p>
                </div>
              )}
            </div>
          )}

          <div className="mt-12 pt-8 border-t border-gray-100 flex flex-col sm:flex-row items-center justify-center gap-6">
            <button
              onClick={() => logout()}
              className="text-[var(--omni-text-muted)] hover:text-[var(--omni-text)] text-sm flex items-center"
            >
              {t('auth.pending.logout')}
            </button>
            <Link
              to="/regulamin"
              className="text-[var(--omni-text-muted)] hover:text-[var(--omni-text)] text-sm"
            >
              {t('auth.pending.terms')}
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
