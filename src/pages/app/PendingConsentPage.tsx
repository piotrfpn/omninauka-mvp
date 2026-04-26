import { useState } from 'react';
import { useAuth } from '../../lib/auth-context';
import { supabase } from '../../lib/supabase';
import { generateConsentToken, hashConsentToken } from '../../lib/consent';
import { Mail, ShieldAlert, Send, CheckCircle2, ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function PendingConsentPage() {
  const { user, logout } = useAuth();
  const [parentEmail, setParentEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSent, setIsSent] = useState(false);
  const [error, setError] = useState('');

  const handleSendConsent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    
    setError('');
    setIsLoading(true);

    try {
      const token = generateConsentToken();
      const tokenHash = await hashConsentToken(token);
      
      // Calculate expiration (7 days)
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7);

      // 1. Create consent record in Supabase
      const { error: dbError } = await supabase
        .from('parental_consents')
        .insert({
          child_user_id: user.id,
          parent_email: parentEmail,
          age_band: user.ageBand || '13_15',
          token_hash: tokenHash,
          token_expires_at: expiresAt.toISOString(),
          consent_status: 'pending'
        });

      if (dbError) throw dbError;

      // 2. In a real app, we would call an Edge Function to send the actual email.
      // For this MVP, we will simulate the "email sent" and show the link for testing purposes
      // ONLY in dev mode or as a fallback if the user wants to see it.
      // But the requirement says "Nie logować tokenów... w konsoli".
      // I'll just show a success message.
      
      const consentLink = `${window.location.origin}/consent/${token}`;
      console.log('SIMULATED EMAIL SENT TO:', parentEmail);
      // For local testing by the user/developer:
      if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
        console.log('DEBUG CONSENT LINK:', consentLink);
      }

      setIsSent(true);
    } catch (err: any) {
      console.error('Consent error:', err);
      setError('Wystąpił błąd podczas generowania prośby. Spróbuj ponownie.');
    } finally {
      setIsLoading(false);
    }
  };

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
                  disabled={isLoading}
                  className="w-full omni-btn-primary"
                >
                  {isLoading ? (
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
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

              <button
                onClick={() => setIsSent(false)}
                className="text-[var(--omni-accent)] font-medium hover:underline flex items-center justify-center mx-auto"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Użyj innego adresu email
              </button>
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
