import { useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Mail, ArrowLeft, Loader2, CheckCircle2 } from 'lucide-react';
import OmniNaukaLogo from '../components/brand/OmniNaukaLogo';
import { toast } from 'sonner';

export default function ForgotPasswordPage() {
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
      toast.success('Wysłano link do resetu hasła');
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
      <div className="min-h-screen bg-[var(--omni-bg)] flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-md text-center">
          <div className="mb-8">
            <OmniNaukaLogo size={48} className="mx-auto" />
          </div>
          <div className="omni-card p-8 space-y-6">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto text-green-600">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <h1 className="omni-heading-3">Sprawdź swoją pocztę</h1>
            <p className="text-[var(--omni-text-muted)]">
              Jeżeli konto z adresem <span className="font-medium text-[var(--omni-text)]">{email}</span> istnieje w naszym systemie, wysłaliśmy na nie link do resetowania hasła.
            </p>
            <Link
              to="/login"
              className="inline-flex items-center gap-2 text-[var(--omni-accent)] hover:underline font-medium"
            >
              <ArrowLeft className="w-4 h-4" />
              Wróć do logowania
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--omni-bg)] flex items-center justify-center px-6 py-12">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link to="/" className="inline-flex items-center mb-4">
            <OmniNaukaLogo size={48} />
          </Link>
          <h1 className="omni-heading-3 text-[var(--omni-text)] mb-2">
            Resetowanie hasła
          </h1>
          <p className="text-[var(--omni-text-muted)]">
            Wpisz swój adres email, a wyślemy Ci link do zmiany hasła
          </p>
        </div>

        <div className="omni-card p-6 lg:p-8">
          <form onSubmit={handleSubmit} className="space-y-4">
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
                'Wyślij link do resetu'
              )}
            </button>
          </form>

          <div className="mt-6 text-center">
            <Link
              to="/login"
              className="text-[var(--omni-text-muted)] text-sm hover:text-[var(--omni-text)] flex items-center justify-center gap-2"
            >
              <ArrowLeft className="w-4 h-4" />
              Wróć do logowania
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
