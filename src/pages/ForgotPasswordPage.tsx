import { useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Mail, ArrowLeft, Loader2, CheckCircle2 } from 'lucide-react';
import OmniNaukaLogo from '../components/brand/OmniNaukaLogo';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { LanguageSwitcher } from '../components/LanguageSwitcher';

export default function ForgotPasswordPage() {
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      // Dynamic redirectTo for local/vercel/prod
      const redirectTo = `${window.location.origin}/reset-password`;
      
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo,
      });

      if (error) throw error;

      setIsSubmitted(true);
      toast.success(t('auth.forgot.toastSuccess'));
    } catch (error: any) {
      console.error('Forgot Password Error:', error);
      // We still show a generic message to prevent email enumeration
      // but log the error for debugging
      setIsSubmitted(true);
    } finally {
      setIsLoading(false);
    }
  };

  if (isSubmitted) {
    return (
      <div className="min-h-screen bg-[var(--omni-bg)] flex items-center justify-center px-6 py-12 relative">
        <div className="absolute top-4 right-4">
          <LanguageSwitcher />
        </div>
        <div className="w-full max-w-md text-center">
          <div className="mb-8">
            <OmniNaukaLogo size={48} className="mx-auto" />
          </div>
          <div className="omni-card p-8 space-y-6">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto text-green-600">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            {/* The text is intentionally neutral to avoid account enumeration (Hotfix 23B.3) */}
            <h1 className="omni-heading-3">{t('auth.forgot.successTitle', 'Sprawdź swoją pocztę')}</h1>
            <div className="space-y-4 text-[var(--omni-text-muted)] text-base">
              <p>
                {t('auth.forgot.successDesc1', 'Jeżeli konto z tym adresem istnieje, wysłaliśmy na nie link do resetowania hasła.')}
              </p>
              <p className="text-sm">
                {t('auth.forgot.successDesc2', 'Sprawdź też folder spam lub oferty. Jeżeli nie masz jeszcze konta w OmniNauce, możesz je utworzyć.')}
              </p>
            </div>
            <div className="flex flex-col gap-3 pt-4">
              <Link
                to="/login"
                className="omni-btn-primary w-full flex items-center justify-center gap-2"
              >
                <ArrowLeft className="w-4 h-4" />
                {t('auth.forgot.backToLogin', 'Wróć do logowania')}
              </Link>
              <Link
                to="/register"
                className="omni-btn-secondary w-full"
              >
                Utwórz konto
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--omni-bg)] flex items-center justify-center px-6 py-12 relative">
      <div className="absolute top-4 right-4">
        <LanguageSwitcher />
      </div>
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link to="/" className="inline-flex items-center mb-4">
            <OmniNaukaLogo size={48} />
          </Link>
          <h1 className="omni-heading-3 text-[var(--omni-text)] mb-2">
            {t('auth.forgot.title')}
          </h1>
          <p className="text-[var(--omni-text-muted)]">
            {t('auth.forgot.subtitle')}
          </p>
        </div>

        <div className="omni-card p-6 lg:p-8">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-[var(--omni-text)] mb-2">
                {t('auth.email')}
              </label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="twoj@email.pl"
                  className="omni-input pl-12"
                  required
                  disabled={isLoading}
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading || !email}
              className="w-full omni-btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                t('auth.forgot.submit')
              )}
            </button>
          </form>

          <div className="mt-6 text-center">
            <Link
              to="/login"
              className="text-[var(--omni-text-muted)] text-sm hover:text-[var(--omni-text)] flex items-center justify-center gap-2"
            >
              <ArrowLeft className="w-4 h-4" />
              {t('auth.forgot.backToLogin')}
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
