import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth-context';
import { Eye, EyeOff, Mail, Lock, User, ArrowRight } from 'lucide-react';
import OmniNaukaLogo from '../components/brand/OmniNaukaLogo';

export default function RegisterPage() {
  const { register, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Redirect if already logged in
  useEffect(() => {
    if (isAuthenticated) {
      navigate('/app/dashboard');
    }
  }, [isAuthenticated, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    if (password.length < 6) {
      setError('Hasło musi mieć co najmniej 6 znaków');
      setIsLoading(false);
      return;
    }

    try {
      const result = await register(email, password, name);
      
      if (!result.success) {
        setError(result.message || 'Nie udało się utworzyć konta.');
      } else if (result.requireEmailVerification) {
        setSuccessMessage('Konto zostało utworzone. Sprawdź email i potwierdź adres, aby się zalogować.');
        // Clear sensitive inputs
        setPassword('');
      } else {
        // Automatically logged in (handled by onAuthStateChange in AuthProvider routing to /app/dashboard)
      }
    } catch (err: any) {
      setError(err?.message || 'Wystąpił błąd podczas rejestracji');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[var(--omni-bg)] flex items-center justify-center px-6 py-12">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <Link to="/" className="inline-flex items-center mb-4">
            <OmniNaukaLogo size={48} />
          </Link>
          <h1 className="omni-heading-3 text-[var(--omni-text)] mb-2">
            Utwórz konto
          </h1>
          <p className="text-[var(--omni-text-muted)]">
            Zacznij uczyć się mądrzej z OmniNauką
          </p>
        </div>

        {/* Register Form */}
        <div className="omni-card p-6 lg:p-8">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-[var(--omni-text)] mb-2">
                Imię
              </label>
              <div className="relative">
                <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Twoje imię"
                  className="omni-input pl-12"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-[var(--omni-text)] mb-2">
                Email
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
                Hasło
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
                Minimum 6 znaków
              </p>
            </div>

            {error && (
              <div className="p-3 bg-red-50 text-red-600 rounded-lg text-sm border border-red-200">
                {error}
              </div>
            )}

            {successMessage && (
              <div className="p-4 bg-green-50 border border-green-200 text-green-700 rounded-lg text-sm flex flex-col gap-3 animate-in fade-in zoom-in duration-300">
                <p className="font-semibold text-base">{successMessage}</p>
                <Link to="/login" className="inline-flex items-center text-green-800 hover:text-green-900 font-medium">
                  Przejdź do logowania <ArrowRight className="ml-1 w-4 h-4" />
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
                    Utwórz konto
                    <ArrowRight className="w-5 h-5" />
                  </>
                )}
              </button>
            )}
          </form>

          <div className="mt-6 text-center">
            <p className="text-[var(--omni-text-muted)] text-sm">
              Masz już konto?{' '}
              <Link
                to="/login"
                className="text-[var(--omni-accent)] font-medium hover:underline"
              >
                Zaloguj się
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
            ← Wróć na stronę główną
          </Link>
        </div>
      </div>
    </div>
  );
}
