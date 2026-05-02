import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth-context';
import { supabase } from '../lib/supabase';
import { Eye, EyeOff, Mail, Lock, User, ArrowRight, ShieldCheck, AlertTriangle } from 'lucide-react';
import OmniNaukaLogo from '../components/brand/OmniNaukaLogo';
import { useTranslation } from 'react-i18next';
import { LanguageSwitcher } from '../components/LanguageSwitcher';

export default function RegisterPage() {
  const { t } = useTranslation();
  const { register, isAuthenticated, user } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [ageBand, setAgeBand] = useState('');
  const [userRole, setUserRole] = useState<'student' | 'parent' | ''>('');
  // Sprint 17B: under_13 link result
  const [under13LinkResult, setUnder13LinkResult] = useState<'linked' | 'no_preapproval' | null>(null);

  // Redirect if already logged in
  useEffect(() => {
    if (isAuthenticated && user) {
      // under_13 flow manages its own redirect after link check
      if (under13LinkResult !== null) return;
      if (user.userRole === 'parent' || user.userRole === 'guardian') {
        navigate('/app/parent');
      } else {
        navigate('/app/dashboard');
      }
    }
  }, [isAuthenticated, user, navigate, under13LinkResult]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    if (!userRole) {
      setError(t('auth.register.error.noRole'));
      setIsLoading(false);
      return;
    }

    if (userRole === 'student' && !ageBand) {
      setError(t('auth.register.error.noAge'));
      setIsLoading(false);
      return;
    }

    if (password.length < 6) {
      setError(t('auth.register.error.passLength'));
      setIsLoading(false);
      return;
    }

    try {
      const result = await register(email, password, name, userRole === 'parent' ? 'parent' : ageBand, userRole);

      if (!result.success) {
        setError(result.message || t('auth.register.error.failed'));
      } else if (result.requireEmailVerification) {
        setSuccessMessage(t('auth.register.success.verify'));
        setPassword('');
      } else if (ageBand === '13_15') {
        setSuccessMessage(t('auth.register.success.consent'));
        setPassword('');
      } else if (ageBand === 'under_13') {
        // Sprint 17B: attempt to link with parent pre-approval immediately after sign-up
        try {
          const { data: linkResult } = await supabase.rpc('link_child_account');
          setUnder13LinkResult(linkResult?.linked === true ? 'linked' : 'no_preapproval');
        } catch {
          setUnder13LinkResult('no_preapproval');
        }
      }
      // 16+ / parent: redirected automatically via isAuthenticated useEffect
    } catch (err: any) {
      setError(err?.message || t('auth.register.error.generic'));
    } finally {
      setIsLoading(false);
    }
  };

  // ── Sprint 17B: under_13 — linked successfully ────────────────────────────
  if (under13LinkResult === 'linked') {
    return (
      <div className="min-h-screen bg-[var(--omni-bg)] flex items-center justify-center px-6 py-12 relative">
        <div className="absolute top-4 right-4"><LanguageSwitcher /></div>
        <div className="w-full max-w-md">
          <div className="omni-card p-8 flex flex-col items-center gap-6 text-center animate-in fade-in zoom-in duration-500">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center text-green-600">
              <ShieldCheck className="w-8 h-8" />
            </div>
            <h2 className="omni-heading-3 text-[var(--omni-text)]">{t('pending.under13.successTitle')}</h2>
            <p className="text-[var(--omni-text-muted)]">
              {t('pending.under13.successSubtitle')}
            </p>
            <button onClick={() => navigate('/app/dashboard')} className="w-full omni-btn-primary">
              {t('pending.under13.goToApp')} <ArrowRight className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Sprint 17B: under_13 — no parent pre-approval found ──────────────────
  if (under13LinkResult === 'no_preapproval') {
    return (
      <div className="min-h-screen bg-[var(--omni-bg)] flex items-center justify-center px-6 py-12 relative">
        <div className="absolute top-4 right-4"><LanguageSwitcher /></div>
        <div className="w-full max-w-md">
          <div className="omni-card p-8 flex flex-col items-center gap-6 text-center">
            <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center text-amber-600">
              <AlertTriangle className="w-8 h-8" />
            </div>
            <h2 className="omni-heading-3 text-[var(--omni-text)]">{t('pending.under13.blockedTitle')}</h2>
            <p className="text-[var(--omni-text-muted)]">
              {t('pending.under13.blockedSubtitle')}
            </p>
            <div className="p-4 bg-amber-50 border border-amber-100 rounded-lg text-sm text-amber-800 text-left w-full">
              <p className="font-semibold mb-2">{t('pending.under13.nextStepsTitle')}</p>
              <ol className="list-decimal list-inside space-y-2">
                <li>{t('pending.under13.step1')}</li>
                <li>{t('pending.under13.step2')}</li>
                <li>{t('pending.under13.step3')}</li>
              </ol>
            </div>
            <p className="text-xs text-[var(--omni-text-muted)] italic">
              {t('pending.under13.cleanupRule')}
            </p>
            <button onClick={() => navigate('/login')} className="w-full omni-btn-primary">
              {t('pending.under13.goToLogin')}
            </button>
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
        {/* Logo */}
        <div className="text-center mb-8">
          <Link to="/" className="inline-flex items-center mb-4">
            <OmniNaukaLogo size={48} />
          </Link>
          <h1 className="omni-heading-3 text-[var(--omni-text)] mb-2">
            {t('auth.register.title')}
          </h1>
          <p className="text-[var(--omni-text-muted)]">
            {t('auth.register.subtitle')}
          </p>
        </div>

        {/* Register Form */}
        <div className="omni-card p-6 lg:p-8">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-[var(--omni-text)] mb-2">
                {t('auth.register.name')}
              </label>
              <div className="relative">
                <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={t('auth.register.namePlaceholder')}
                  className="omni-input pl-12"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-[var(--omni-text)] mb-2">
                {t('auth.register.role')}
              </label>
              <div className="grid grid-cols-2 gap-4">
                <button
                  type="button"
                  onClick={() => { setUserRole('student'); setAgeBand(''); }}
                  className={`p-4 border rounded-xl flex flex-col items-center justify-center gap-2 transition-all ${userRole === 'student' ? 'border-[var(--omni-primary)] bg-[var(--omni-primary)]/5 text-[var(--omni-primary)]' : 'border-border hover:border-gray-300 text-[var(--omni-text-muted)]'}`}
                >
                  <User className="w-6 h-6" />
                  <span className="font-medium text-sm">{t('auth.register.roleStudent')}</span>
                </button>
                <button
                  type="button"
                  onClick={() => { setUserRole('parent'); setAgeBand('parent'); }}
                  className={`p-4 border rounded-xl flex flex-col items-center justify-center gap-2 transition-all ${userRole === 'parent' ? 'border-[var(--omni-primary)] bg-[var(--omni-primary)]/5 text-[var(--omni-primary)]' : 'border-border hover:border-gray-300 text-[var(--omni-text-muted)]'}`}
                >
                  <User className="w-6 h-6" />
                  <span className="font-medium text-sm">{t('auth.register.roleParent')}</span>
                </button>
              </div>
            </div>

            {userRole === 'student' && (
              <div className="animate-in fade-in slide-in-from-top-2 duration-300">
                <label className="block text-sm font-medium text-[var(--omni-text)] mb-2">
                  {t('auth.register.age')}
                </label>
                <select
                  value={ageBand}
                  onChange={(e) => setAgeBand(e.target.value)}
                  className="omni-input"
                  required
                >
                  <option value="" disabled>{t('auth.register.agePlaceholder')}</option>
                  <option value="under_13">{t('auth.register.ageUnder13')}</option>
                  <option value="13_15">{t('auth.register.age13to15')}</option>
                  <option value="16_17">{t('auth.register.age16to17')}</option>
                  <option value="18_plus">{t('auth.register.age18plus')}</option>
                </select>
                {ageBand === 'under_13' && (
                  <p className="mt-2 text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2 italic">
                    {t('auth.register.under13.registerHint')}
                  </p>
                )}
              </div>
            )}

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
              <p className="text-xs text-[var(--omni-text-muted)] mt-1">
                {t('auth.register.passwordMin')}
              </p>
            </div>

            {error && (
              <div className="p-3 bg-red-50 text-red-600 rounded-lg text-sm border border-red-200">
                {error}
              </div>
            )}

            {successMessage && (
              <div className="p-4 bg-green-50 border border-green-200 text-green-700 rounded-lg text-sm flex flex-col gap-3 animate-in fade-in zoom-in duration-300">
                <p className="font-semibold text-base leading-snug">{successMessage}</p>
                <Link to="/login" className="inline-flex items-center text-green-800 hover:text-green-900 font-medium">
                  {t('auth.register.success.toLogin')} <ArrowRight className="ml-1 w-4 h-4" />
                </Link>
              </div>
            )}

            {!successMessage && (
              <button
                type="submit"
                disabled={isLoading}
                className="w-full omni-btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? (
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    {t('auth.register.submit')}
                    <ArrowRight className="w-5 h-5" />
                  </>
                )}
              </button>
            )}
          </form>

          <div className="mt-6 text-center">
            <p className="text-[var(--omni-text-muted)] text-sm">
              {t('auth.register.hasAccount')}{' '}
              <Link
                to="/login"
                className="text-[var(--omni-accent)] font-medium hover:underline"
              >
                {t('auth.register.login')}
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
