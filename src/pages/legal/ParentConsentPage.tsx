import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { hashConsentToken } from '../../lib/consent';
import { ShieldCheck, CheckCircle2, AlertTriangle, Loader2, ArrowRight, ExternalLink } from 'lucide-react';
import OmniNaukaLogo from '../../components/brand/OmniNaukaLogo';

export default function ParentConsentPage() {
  const { token } = useParams<{ token: string }>();
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [consentData, setConsentData] = useState<any>(null);
  const [status, setStatus] = useState<'idle' | 'success' | 'expired' | 'invalid'>('idle');
  
  // Consents
  const [consents, setConsents] = useState({
    isParent: false,
    terms: false,
    privacy: false,
    aiUse: false,
    ocrUse: false,
    mistakes: false
  });

  useEffect(() => {
    const verifyToken = async () => {
      if (!token) {
        setStatus('invalid');
        setIsLoading(false);
        return;
      }

      try {
        const tokenHash = await hashConsentToken(token);
        
        // Query consent record (using public policy)
        // We include a join to get the child's name
        const { data, error } = await supabase
          .from('parental_consents')
          .select(`
            *,
            profiles:child_user_id (name)
          `)
          .eq('token_hash', tokenHash)
          .single();

        if (error || !data) {
          setStatus('invalid');
        } else if (data.consent_status === 'approved') {
          setStatus('success');
          setConsentData(data);
        } else if (new Date(data.token_expires_at) < new Date()) {
          setStatus('expired');
        } else {
          setConsentData(data);
        }
      } catch (err) {
        console.error('Verification error:', err);
        setStatus('invalid');
      } finally {
        setIsLoading(false);
      }
    };

    verifyToken();
  }, [token]);

  const handleSubmit = async () => {
    if (!token || !consentData) return;
    
    // Check if all required consents are checked
    const allChecked = Object.values(consents).every(v => v === true);
    if (!allChecked) return;

    setIsSubmitting(true);
    try {
      const tokenHash = await hashConsentToken(token);
      
      // Call the secure RPC function we created in the migration
      // This function handles both consent update and profile status update
      const { data, error } = await supabase.rpc('approve_parental_consent', {
        p_token_hash: tokenHash,
        p_ip: 'parent-approved', // In a real app we'd get real IP if possible
        p_user_agent: window.navigator.userAgent
      });

      if (error || data === false) throw error || new Error('Approval failed');

      setStatus('success');
    } catch (err) {
      console.error('Approval error:', err);
      alert('Wystąpił błąd podczas zapisywania zgody. Spróbuj ponownie.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[var(--omni-bg)] flex flex-col items-center justify-center p-6">
        <Loader2 className="w-12 h-12 text-[var(--omni-accent)] animate-spin mb-4" />
        <p className="text-[var(--omni-text-muted)]">Weryfikacja prośby...</p>
      </div>
    );
  }

  if (status === 'invalid' || status === 'expired') {
    return (
      <div className="min-h-screen bg-[var(--omni-bg)] flex items-center justify-center p-6">
        <div className="omni-card p-10 max-w-md text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center text-red-600 mx-auto mb-6">
            <AlertTriangle className="w-8 h-8" />
          </div>
          <h1 className="omni-heading-3 mb-4">Link nieprawidłowy lub wygasł</h1>
          <p className="text-[var(--omni-text-muted)] mb-8">
            Ten link do potwierdzenia zgody rodzica jest już nieaktywny lub został wygenerowany ponownie. 
            Poproś dziecko o wysłanie nowej prośby.
          </p>
          <Link to="/" className="omni-btn-primary w-full">
            Wróć do strony głównej
          </Link>
        </div>
      </div>
    );
  }

  if (status === 'success') {
    return (
      <div className="min-h-screen bg-[var(--omni-bg)] flex items-center justify-center p-6">
        <div className="omni-card p-10 max-w-md text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center text-green-600 mx-auto mb-6">
            <CheckCircle2 className="w-8 h-8" />
          </div>
          <h1 className="omni-heading-3 mb-4">Zgoda zatwierdzona!</h1>
          <p className="text-[var(--omni-text-muted)] mb-8">
            Dziękujemy. Twoje dziecko może już w pełni korzystać z funkcji edukacyjnych OmniNauka.
          </p>
          <Link to="/" className="omni-btn-primary w-full">
            Przejdź do OmniNauka
          </Link>
        </div>
      </div>
    );
  }

  const allChecked = Object.values(consents).every(v => v === true);

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-6">
      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-10">
          <Link to="/" className="inline-block mb-6">
            <OmniNaukaLogo size={48} />
          </Link>
          <h1 className="omni-heading-2 text-[var(--omni-text)]">
            Potwierdzenie zgody rodzica
          </h1>
          <p className="text-[var(--omni-text-muted)] mt-2">
            Zgoda dla użytkownika: <span className="font-bold text-[var(--omni-text)]">{consentData?.profiles?.name}</span>
          </p>
        </div>

        <div className="omni-card p-8 md:p-10 shadow-xl border-t-4 border-[var(--omni-accent)]">
          <div className="prose prose-slate max-w-none mb-10">
            <p className="text-lg text-slate-700 leading-relaxed">
              <strong>OmniNauka</strong> to nowoczesna aplikacja edukacyjna wspierająca uczniów w nauce za pomocą sztucznej inteligencji. Pozwala na analizę notatek, generowanie fiszek, quizów oraz dialog z AI Tutorem.
            </p>
            <div className="bg-blue-50 p-6 rounded-2xl border border-blue-100 flex gap-4 mt-6">
              <ShieldCheck className="w-6 h-6 text-blue-600 shrink-0" />
              <div>
                <h4 className="text-blue-900 font-bold m-0 mb-1">Bezpieczeństwo przede wszystkim</h4>
                <p className="text-blue-800 text-sm m-0">
                  Zgodnie z RODO, prosimy o zatwierdzenie poniższych punktów, aby Twoje dziecko mogło bezpiecznie korzystać z funkcji AI w naszej aplikacji.
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div className="flex items-start gap-4">
              <input 
                type="checkbox" 
                id="c-parent" 
                className="w-5 h-5 mt-1 rounded border-gray-300 text-[var(--omni-accent)] focus:ring-[var(--omni-accent)]"
                checked={consents.isParent}
                onChange={e => setConsents(prev => ({ ...prev, isParent: e.target.checked }))}
              />
              <label htmlFor="c-parent" className="text-slate-700 font-medium cursor-pointer">
                Potwierdzam, że jestem rodzicem lub opiekunem prawnym użytkownika {consentData?.profiles?.name}.
              </label>
            </div>

            <div className="flex items-start gap-4">
              <input 
                type="checkbox" 
                id="c-legal" 
                className="w-5 h-5 mt-1 rounded border-gray-300 text-[var(--omni-accent)] focus:ring-[var(--omni-accent)]"
                checked={consents.terms && consents.privacy}
                onChange={e => setConsents(prev => ({ ...prev, terms: e.target.checked, privacy: e.target.checked }))}
              />
              <label htmlFor="c-legal" className="text-slate-700 cursor-pointer">
                Akceptuję <Link to="/regulamin" target="_blank" className="text-[var(--omni-accent)] hover:underline inline-flex items-center">Regulamin <ExternalLink className="w-3 h-3 ml-1"/></Link> oraz zapoznałem/am się z <Link to="/polityka-prywatnosci" target="_blank" className="text-[var(--omni-accent)] hover:underline inline-flex items-center">Polityką Prywatności <ExternalLink className="w-3 h-3 ml-1"/></Link>.
              </label>
            </div>

            <div className="flex items-start gap-4">
              <input 
                type="checkbox" 
                id="c-ai" 
                className="w-5 h-5 mt-1 rounded border-gray-300 text-[var(--omni-accent)] focus:ring-[var(--omni-accent)]"
                checked={consents.aiUse}
                onChange={e => setConsents(prev => ({ ...prev, aiUse: e.target.checked }))}
              />
              <label htmlFor="c-ai" className="text-slate-700 cursor-pointer">
                Wyrażam zgodę na korzystanie przez dziecko z funkcji edukacyjnych opartych na sztucznej inteligencji (AI Tutor, Lekcje AI).
              </label>
            </div>

            <div className="flex items-start gap-4">
              <input 
                type="checkbox" 
                id="c-ocr" 
                className="w-5 h-5 mt-1 rounded border-gray-300 text-[var(--omni-accent)] focus:ring-[var(--omni-accent)]"
                checked={consents.ocrUse}
                onChange={e => setConsents(prev => ({ ...prev, ocrUse: e.target.checked }))}
              />
              <label htmlFor="c-ocr" className="text-slate-700 cursor-pointer">
                Rozumiem i akceptuję, że przesyłane materiały edukacyjne (notatki, zdjęcia) będą analizowane technicznie przez systemy OCR i AI.
              </label>
            </div>

            <div className="flex items-start gap-4">
              <input 
                type="checkbox" 
                id="c-mistakes" 
                className="w-5 h-5 mt-1 rounded border-gray-300 text-[var(--omni-accent)] focus:ring-[var(--omni-accent)]"
                checked={consents.mistakes}
                onChange={e => setConsents(prev => ({ ...prev, mistakes: e.target.checked }))}
              />
              <label htmlFor="c-mistakes" className="text-slate-700 cursor-pointer text-sm">
                Rozumiem, że sztuczna inteligencja może generować błędy i nie zastępuje ona oficjalnego programu nauczania ani nauczyciela.
              </label>
            </div>
          </div>

          <div className="mt-12">
            <button
              onClick={handleSubmit}
              disabled={!allChecked || isSubmitting}
              className="w-full omni-btn-primary disabled:opacity-50 disabled:grayscale disabled:cursor-not-allowed text-lg py-4"
            >
              {isSubmitting ? (
                <Loader2 className="w-6 h-6 animate-spin" />
              ) : (
                <>
                  Potwierdzam zgodę i odblokowuję konto
                  <ArrowRight className="w-6 h-6" />
                </>
              )}
            </button>
            {!allChecked && (
              <p className="text-center text-xs text-red-500 mt-3 font-medium">
                Aby kontynuować, musisz zaznaczyć wszystkie powyższe oświadczenia.
              </p>
            )}
          </div>
        </div>

        <div className="mt-8 text-center text-[var(--omni-text-muted)] text-sm">
          <p>© 2026 OmniNauka | PFConsulting Piotr Fiszer</p>
          <div className="mt-2 flex items-center justify-center gap-4">
            <Link to="/regulamin" className="hover:underline">Regulamin</Link>
            <Link to="/polityka-prywatnosci" className="hover:underline">Prywatność</Link>
            <Link to="/kontakt" className="hover:underline">Kontakt</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
