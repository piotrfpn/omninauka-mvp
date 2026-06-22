import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Lock, Eye, EyeOff, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';
import OmniNaukaLogo from '../components/brand/OmniNaukaLogo';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { LanguageSwitcher } from '../components/LanguageSwitcher';

export default function ResetPasswordPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasSession, setHasSession] = useState<boolean | null>(null);

  useEffect(() => {
    // Check if we have a valid session (Supabase should have set it via recovery link)
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setHasSession(!!session);
    };
    checkSession();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password.length < 6) {
      setError(t('auth.reset.error.length'));
      return;
    }

    if (password !== confirmPassword) {
      setError(t('auth.reset.error.mismatch'));
      return;
    }

    setIsLoading(true);

    try {
      const { error } = await supabase.auth.updateUser({
        password: password
      });

      if (error) throw error;

      setIsSuccess(true);
      toast.success(t('auth.reset.toastSuccess'));
      
      // Clear passwords from state for security
      setPassword('');
      setConfirmPassword('');

      // Auto redirect after 3 seconds
      setTimeout(() => {
        navigate('/login');
      }, 3000);
    } catch (error: any) {
      console.error('Reset Password Error:', error);
      setError(error.message || t('auth.reset.error.generic'));
    } finally {
      setIsLoading(false);
    }
  };

  if (hasSession === false) {
    return (
      <div className="min-h-screen bg-[var(--omni-bg)] omninauka-bg-shell flex items-center justify-center px-6 py-12 relative">
        <div className="absolute top-4 right-4">
          <LanguageSwitcher />
        </div>
        <div className="w-full max-w-md text-center">
          <div className="omni-card p-8 space-y-6">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto text-red-600">
              <AlertCircle className="w-8 h-8" />
            </div>
            <h1 className="omni-heading-3">{t('auth.reset.expired.title')}</h1>
            <p className="text-[var(--omni-text-muted)]">
              {t('auth.reset.expired.desc')}
            </p>
            <div className="pt-4">
              <Link
                to="/forgot-password"
                className="omni-btn-primary w-full"
              >
                {t('auth.reset.expired.submit')}
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (isSuccess) {
    return (
      <div className="min-h-screen bg-[var(--omni-bg)] omninauka-bg-shell flex items-center justify-center px-6 py-12 relative">
        <div className="absolute top-4 right-4">
          <LanguageSwitcher />
        </div>
        <div className="w-full max-w-md text-center">
          <div className="omni-card p-8 space-y-6">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto text-green-600">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <h1 className="omni-heading-3">{t('auth.reset.success.title')}</h1>
            <p className="text-[var(--omni-text-muted)]">
              {t('auth.reset.success.desc')}
            </p>
            <Link
              to="/login"
              className="omni-btn-primary w-full"
            >
              {t('auth.reset.success.submit')}
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--omni-bg)] omninauka-bg-shell flex items-center justify-center px-6 py-12 relative">
      <div className="absolute top-4 right-4">
        <LanguageSwitcher />
      </div>
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link to="/" className="inline-flex items-center mb-4">
            <OmniNaukaLogo size={48} />
          </Link>
          <h1 className="omni-heading-3 text-[var(--omni-text)] mb-2">
            {t('auth.reset.title')}
          </h1>
          <p className="text-[var(--omni-text-muted)]">
            {t('auth.reset.subtitle')}
          </p>
        </div>

        <div className="omni-card p-6 lg:p-8">
          {hasSession === null ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-8 h-8 animate-spin text-[var(--omni-accent)]" />
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <label className="block text-sm font-medium text-[var(--omni-text)]">
                  {t('auth.reset.newPassword')}
                </label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder={t('auth.reset.newPasswordPlaceholder')}
                    className="omni-input pl-12 pr-12"
                    required
                    disabled={isLoading}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-medium text-[var(--omni-text)]">
                  {t('auth.reset.confirmPassword')}
                </label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder={t('auth.reset.confirmPasswordPlaceholder')}
                    className="omni-input pl-12"
                    required
                    disabled={isLoading}
                  />
                </div>
              </div>

              {error && (
                <div className="p-3 bg-red-50 text-red-600 rounded-lg text-sm flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={isLoading || !password || !confirmPassword}
                className="w-full omni-btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  t('auth.reset.submit')
                )}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

