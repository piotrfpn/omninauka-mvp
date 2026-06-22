import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth-context';
import { Eye, EyeOff, Mail, Lock, ArrowRight, Sparkles, ShieldCheck } from 'lucide-react';
import OmniNaukaLogo from '../components/brand/OmniNaukaLogo';
import { useTranslation } from 'react-i18next';
import { LanguageSwitcher } from '../components/LanguageSwitcher';

export default function LoginPage() {
  const { t } = useTranslation();
  const { login, loginAsDemo, isAuthenticated, user } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Redirect if already logged in
  useEffect(() => {
    if (isAuthenticated && user) {
      if (user.userRole === 'parent' || user.userRole === 'guardian') {
        navigate('/app/parent');
      } else {
        navigate('/app/dashboard');
      }
    }
  }, [isAuthenticated, user, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const success = await login(email, password);
      if (!success) {
        setError(t('auth.login.error.invalid'));
      }
    } catch {
      setError(t('auth.login.error.generic'));
    } finally {
      setIsLoading(false);
    }
  };

  const handleDemoLogin = () => {
    loginAsDemo();
    navigate('/app/dashboard');
  };

  return (
    <div className="min-h-screen bg-[var(--omni-bg)] omninauka-bg-shell flex items-center justify-center px-6 py-12 relative">
      <div className="absolute top-4 right-4">
        <LanguageSwitcher />
      </div>
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <Link to="/" className="inline-flex items-center mb-4">
            <OmniNaukaLogo size={48} />
          </Link>
          <h1 className="omni-heading-3 text-[var(--omni-text)] mb-2">
            {t('auth.login.title')}
          </h1>
          <p className="text-[var(--omni-text-muted)]">
            {t('auth.login.subtitle')}
          </p>
        </div>

        {/* Parent Info Card */}
        <div className="mb-6 p-4 bg-[var(--omni-lavender)] rounded-xl flex items-start gap-4">
          <ShieldCheck className="w-6 h-6 text-[var(--omni-primary)] shrink-0" />
          <div className="text-left">
            <h3 className="font-semibold text-[var(--omni-text)] text-sm">{t('auth.login.parent.title')}</h3>
            <p className="text-xs text-[var(--omni-text-muted)] mt-1">
              {t('auth.login.parent.desc')}
            </p>
          </div>
        </div>

        {/* Login Form */}
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
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-[var(--omni-text)] mb-2">
                {t('auth.password')}
              </label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="omni-input pl-12 pr-12"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showPassword ? (
                    <EyeOff className="w-5 h-5" />
                  ) : (
                    <Eye className="w-5 h-5" />
                  )}
                </button>
              </div>
              <div className="flex justify-end mt-2">
                <Link
                  to="/forgot-password"
                  className="text-sm text-[var(--omni-accent)] hover:underline"
                >
                  {t('auth.login.forgot')}
                </Link>
              </div>
            </div>

            {error && (
              <div className="p-3 bg-red-50 text-red-600 rounded-lg text-sm">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="w-full omni-btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  {t('auth.login.submit')}
                  <ArrowRight className="w-5 h-5" />
                </>
              )}
            </button>
          </form>

          <div className="mt-6 pt-6 border-t border-gray-100">
            <button
              onClick={handleDemoLogin}
              className="w-full flex items-center justify-center gap-2 px-6 py-3 
                       bg-[var(--omni-lavender)] text-[var(--omni-text)] font-semibold rounded-full
                       transition-all duration-200 hover:shadow-lg"
            >
              <Sparkles className="w-5 h-5" />
              {t('auth.login.demo')}
            </button>
          </div>

          <div className="mt-6 text-center">
            <p className="text-[var(--omni-text-muted)] text-sm">
              {t('auth.login.noAccount')}{' '}
              <Link
                to="/register"
                className="text-[var(--omni-accent)] font-medium hover:underline"
              >
                {t('auth.login.register')}
              </Link>
            </p>
          </div>
        </div>

        {/* Back link */}
        <div className="mt-6 text-center">
          <Link
            to="/"
            className="text-[var(--omni-text-muted)] text-sm hover:text-[var(--omni-text)]"
          >
            {t('auth.backToHome')}
          </Link>
        </div>
      </div>
    </div>
  );
}
