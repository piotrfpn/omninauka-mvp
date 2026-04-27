import { useState, useEffect } from 'react';
import { useAuth } from '../../lib/auth-context';
import { supabase } from '../../lib/supabase';
import { Mail, ShieldAlert, Send, CheckCircle2, ArrowLeft, RefreshCw } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function PendingConsentPage() {
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
        // Handle specific cooldown error from backend
        if (fnError.message?.includes('Poczekaj')) {
          setError(fnError.message);
          setCooldown(60);
          return;
        }
        throw fnError;
      }

      if (data?.error) throw new Error(data.error);

      setIsSent(true);
      setCooldown(60); // 60s cooldown after successful send
    } catch (err: any) {
      console.error('Consent error:', err);
      setError(err.message || 'Wystąpił błąd podczas wysyłania prośby. Spróbuj ponownie.');
    } finally {
      setIsLoading(false);
    }
  };

  const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

  return (
    <div className="min-h-screen bg-[var(--omni-bg)] flex items-center justify-center px-6 py-12">
      <div className="w-full max-w-xl">
        <div className="omni-card p-8 md:p-12 text-center">
          <div className="w-20 h-20 bg-amber-100 rounded-full flex items-center justify-center text-amber-600 mx-auto mb-6">
            <ShieldAlert className="w-10 h-10" />
          </div>

          <h1 className="omni-heading-2 mb-4 text-[var(--omni-text)]">
            Potrzebujemy zgody rodzica
          </h1>
          
          <p className="text-[var(--omni-text-muted)] text-lg mb-8">
            Witaj, {user?.name}! Ponieważ masz mniej niż 16 lat, zgodnie z przepisami bezpieczeństwa (RODO) potrzebujemy potwierdzenia od Twojego rodzica lub opiekuna, abyś mógł korzystać z funkcji AI w OmniNauka.
          </p>

          {!isSent ? (
            <div className="text-left max-w-md mx-auto">
              <form onSubmit={handleSendConsent} className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-[var(--omni-text)] mb-2">
                    Email rodzica lub opiekuna
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                      type="email"
                      value={parentEmail}
                      onChange={(e) => setParentEmail(e.target.value)}
                      placeholder="rodzic@email.pl"
                      className="omni-input pl-12"
                      required
                    />
                  </div>
                  <p className="text-xs text-[var(--omni-text-muted)] mt-2">
                    Wyślemy na ten adres bezpieczny link do potwierdzenia zgody.
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
                    `Odczekaj ${cooldown}s...`
                  ) : (
                    <>
                      Wyślij prośbę o zgodę
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
                <h3 className="text-xl font-bold mb-2">Prośba wysłana!</h3>
                <p>
                  Poproś rodzica o sprawdzenie poczty (<strong>{parentEmail}</strong>) i kliknięcie w link potwierdzający.
                </p>
                <p className="mt-4 text-sm font-medium">
                  Gdy rodzic zatwierdzi zgodę, Twoje konto zostanie automatycznie odblokowane.
                </p>
              </div>

              <div className="flex flex-col gap-4">
                <button
                  onClick={() => setIsSent(false)}
                  disabled={cooldown > 0}
                  className="text-[var(--omni-accent)] font-medium hover:underline flex items-center justify-center mx-auto disabled:text-gray-400 disabled:no-underline"
                >
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  {cooldown > 0 ? `Użyj innego adresu za ${cooldown}s` : "Użyj innego adresu email"}
                </button>
                
                {cooldown === 0 && (
                  <button
                    onClick={() => handleSendConsent()}
                    className="text-sm text-[var(--omni-text-muted)] hover:text-[var(--omni-text)] flex items-center justify-center gap-2"
                  >
                    <RefreshCw className="w-4 h-4" />
                    Wyślij ponownie na ten sam adres
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
              Wyloguj się i wróć później
            </button>
            <Link
              to="/regulamin"
              className="text-[var(--omni-text-muted)] hover:text-[var(--omni-text)] text-sm"
            >
              Przeczytaj regulamin
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
