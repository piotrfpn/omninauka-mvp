import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../lib/auth-context';
import { useParentDashboard } from '../../lib/parent-dashboard';
import { supabase } from '../../lib/supabase';
import { useTranslation } from 'react-i18next';
import {
  ShieldCheck,
  UserCircle,
  Clock,
  GraduationCap,
  AlertTriangle,
  Info,
  Calendar,
  Lock,
  Plus,
  X,
  Loader2,
  Mail
} from 'lucide-react';
import type { ParentChildData } from '../../types';

// ─── helpers ────────────────────────────────────────────────────────────────

const formatDate = (ds: string | null) => {
  if (!ds) return 'Brak danych';
  return new Intl.DateTimeFormat('pl-PL', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(ds));
};

const getEducationLabel = (level: string | null) => {
  if (!level) return 'Nieuzupełniono';
  const labels: Record<string, string> = {
    primary_1_3: 'Szkoła podstawowa 1-3',
    primary_4_6: 'Szkoła podstawowa 4-6',
    primary_7_8: 'Szkoła podstawowa 7-8',
    secondary_1: 'Szkoła średnia 1',
    secondary_2: 'Szkoła średnia 2',
    secondary_3: 'Szkoła średnia 3',
    secondary_4: 'Szkoła średnia 4',
    secondary_5: 'Szkoła średnia 5',
  };
  return labels[level] || 'Inne';
};

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function ParentDashboardPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { t } = useTranslation('common');
  const { childrenData, isLoading, error, refresh } = useParentDashboard();

  // form state
  const [isAddingChild, setIsAddingChild] = useState(false);
  const [childName, setChildName] = useState('');
  const [childEmail, setChildEmail] = useState('');
  const [childAgeBand, setChildAgeBand] = useState<'7_9' | '10_12'>('7_9');
  const [childSchoolType, setChildSchoolType] = useState('');
  const [childGrade, setChildGrade] = useState('');
  const [guardianChecked, setGuardianChecked] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

  useEffect(() => {
    if (user && user.userRole !== 'parent' && user.userRole !== 'guardian') {
      navigate('/app/dashboard', { replace: true });
    }
  }, [user, navigate]);

  const resetForm = () => {
    setChildName('');
    setChildEmail('');
    setChildAgeBand('7_9');
    setChildSchoolType('');
    setChildGrade('');
    setGuardianChecked(false);
    setSubmitError('');
    setIsAddingChild(false);
  };

  const handleAddChild = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError('');

    if (!guardianChecked) {
      setSubmitError('Musisz oświadczyć, że jesteś rodzicem lub opiekunem prawnym dziecka.');
      return;
    }
    if (!childName.trim()) {
      setSubmitError('Podaj imię lub pseudonim dziecka.');
      return;
    }

    const emailNormalized = childEmail.trim().toLowerCase();

    setIsSubmitting(true);
    try {
      const { error: insertError } = await supabase.from('child_profiles').insert({
        parent_user_id: user?.id,
        display_name: childName.trim(),
        child_email: childEmail.trim(),
        child_email_normalized: emailNormalized,
        age_band: childAgeBand,
        school_type: childSchoolType || null,
        grade_level: childGrade || null,
        status: 'pending_child_registration',
        guardian_consent_acknowledged_at: new Date().toISOString(),
        guardian_consent_version: 'child_email_preapproval_v1',
      });

      if (insertError) {
        if (insertError.code === '23505') {
          setSubmitError('Profil z tym adresem e-mail dziecka już istnieje w Twoim panelu.');
        } else {
          throw insertError;
        }
        return;
      }

      resetForm();
      refresh();
    } catch (err: any) {
      console.error('Błąd podczas dodawania profilu:', err);
      setSubmitError(err.message || 'Wystąpił błąd podczas dodawania profilu dziecka.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // ── loading / error states ──────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="w-12 h-12 border-4 border-[var(--omni-accent)]/30 border-t-[var(--omni-accent)] rounded-full animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 max-w-4xl mx-auto text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-red-100 mb-4">
          <AlertTriangle className="w-8 h-8 text-red-600" />
        </div>
        <h2 className="text-xl font-bold text-[var(--omni-text)] mb-2">Błąd</h2>
        <p className="text-[var(--omni-text-muted)]">{error}</p>
      </div>
    );
  }

  const activeCount = childrenData.filter(
    c => c.consent_status === 'approved' || c.consent_status === 'active'
      || c.consent_status === 'linked' || c.consent_status === 'pending_child_registration'
  ).length;
  const pendingConsentCount = childrenData.filter(c => c.consent_status === 'pending').length;

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-12">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div>
          <h1 className="omni-heading-3 text-[var(--omni-text)] mb-2 flex items-center gap-3">
            <ShieldCheck className="w-8 h-8 text-[var(--omni-accent)]" />
            Panel rodzica
          </h1>
          <p className="text-[var(--omni-text-muted)]">
            Zarządzaj profilami edukacyjnymi pod Twoją opieką.
          </p>
        </div>
        {!isAddingChild && (
          <button
            id="btn-add-child"
            onClick={() => setIsAddingChild(true)}
            className="omni-btn-primary flex items-center gap-2 whitespace-nowrap"
          >
            <Plus className="w-5 h-5" />
            Dodaj dziecko
          </button>
        )}
      </div>

      {/* ── Add Child Form ──────────────────────────────────────────────────── */}
      {isAddingChild && (
        <div className="omni-card p-6 border-[var(--omni-primary)] bg-[var(--omni-lavender)]/20 animate-in fade-in slide-in-from-top-2">
          <div className="flex justify-between items-start mb-1">
            <h3 className="text-xl font-bold text-[var(--omni-text)]">Dodaj dziecko (&lt;13 lat)</h3>
            <button onClick={resetForm} className="text-[var(--omni-text-muted)] hover:text-[var(--omni-text)]">
              <X className="w-6 h-6" />
            </button>
          </div>
          <p className="text-sm text-[var(--omni-text-muted)] mb-5">
            Wpisz dane dziecka i adres e-mail, którym dziecko będzie mogło później zarejestrować konto. Ten adres zostanie powiązany z Twoją zgodą.
          </p>

          <form onSubmit={handleAddChild} className="space-y-4 max-w-xl">
            {/* Name */}
            <div>
              <label className="block text-sm font-medium text-[var(--omni-text)] mb-1">
                Imię lub pseudonim dziecka <span className="text-red-500">*</span>
              </label>
              <input
                id="child-name"
                type="text"
                value={childName}
                onChange={e => setChildName(e.target.value)}
                className="omni-input"
                placeholder="np. Antek"
                required
              />
            </div>

            {/* Email */}
            <div>
              <label className="block text-sm font-medium text-[var(--omni-text)] mb-1">
                Adres e-mail dziecka <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  id="child-email"
                  type="email"
                  value={childEmail}
                  onChange={e => setChildEmail(e.target.value)}
                  className="omni-input pl-11"
                  placeholder="dziecko@email.pl"
                  required
                />
              </div>
              <p className="text-xs text-[var(--omni-text-muted)] mt-1">
                {t('parent.addChild.emailHint')}
              </p>
              <p className="mt-1 text-xs text-amber-600 font-medium">
                {t('parent.addChild.cleanupHint')}
              </p>
            </div>

            {/* Age band + school */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-[var(--omni-text)] mb-1">Przedział wieku</label>
                <select
                  id="child-age-band"
                  value={childAgeBand}
                  onChange={e => setChildAgeBand(e.target.value as '7_9' | '10_12')}
                  className="omni-input"
                >
                  <option value="7_9">7–9 lat</option>
                  <option value="10_12">10–12 lat</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-[var(--omni-text)] mb-1">Typ szkoły</label>
                <select
                  id="child-school-type"
                  value={childSchoolType}
                  onChange={e => setChildSchoolType(e.target.value)}
                  className="omni-input"
                >
                  <option value="">Wybierz...</option>
                  <option value="primary">Szkoła podstawowa</option>
                  <option value="homeschooling">Edukacja domowa</option>
                </select>
              </div>
            </div>

            {/* Guardian consent checkbox */}
            <label className="flex items-start gap-3 mt-2 cursor-pointer">
              <input
                id="guardian-consent"
                type="checkbox"
                checked={guardianChecked}
                onChange={e => setGuardianChecked(e.target.checked)}
                className="mt-0.5 w-4 h-4 rounded border-gray-300 text-[var(--omni-primary)]"
              />
              <span className="text-sm text-[var(--omni-text)]">
                Oświadczam, że jestem rodzicem lub opiekunem prawnym dziecka i zgadzam się na utworzenie konta edukacyjnego OmniNauka dla podanego adresu e-mail.
              </span>
            </label>

            {submitError && (
              <div className="p-3 bg-red-50 text-red-600 rounded-lg text-sm border border-red-200">
                {submitError}
              </div>
            )}

            <div className="flex gap-3 pt-2">
              <button
                id="btn-submit-child"
                type="submit"
                disabled={isSubmitting}
                className="omni-btn-primary flex items-center gap-2"
              >
                {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
                Dodaj dziecko
              </button>
              <button type="button" onClick={resetForm} className="omni-btn-secondary px-6">
                Anuluj
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ── Stats cards ─────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="omni-card p-6 flex items-start gap-4">
          <div className="w-10 h-10 bg-[var(--omni-lavender)] rounded-lg flex items-center justify-center shrink-0">
            <UserCircle className="w-5 h-5 text-[var(--omni-primary)]" />
          </div>
          <div>
            <p className="text-sm font-medium text-[var(--omni-text-muted)]">Profile w panelu</p>
            <p className="text-2xl font-bold text-[var(--omni-text)] mt-1">{activeCount}</p>
            {pendingConsentCount > 0 && (
              <p className="text-sm text-yellow-600 mt-1">Oczekujące zgody: {pendingConsentCount}</p>
            )}
          </div>
        </div>
        <div className="omni-card p-6 flex items-start gap-4">
          <div className="w-10 h-10 bg-[var(--omni-lavender)] rounded-lg flex items-center justify-center shrink-0">
            <Lock className="w-5 h-5 text-[var(--omni-primary)]" />
          </div>
          <div>
            <p className="text-sm font-medium text-[var(--omni-text-muted)]">Bezpieczeństwo i wsparcie</p>
            <p className="text-sm text-[var(--omni-text)] mt-1">
              Widzisz podstawowe informacje o postępach. Treść notatek jest prywatna.
            </p>
          </div>
        </div>
      </div>

      {/* ── Children list ────────────────────────────────────────────────────── */}
      <div className="space-y-6">
        {childrenData.length === 0 && !isAddingChild ? (
          <div className="omni-card p-12 text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-[var(--omni-bg-muted)] mb-4">
              <UserCircle className="w-8 h-8 text-[var(--omni-text-muted)]" />
            </div>
            <h3 className="text-lg font-bold text-[var(--omni-text)] mb-3">Brak przypisanych profili</h3>
            <div className="text-[var(--omni-text-muted)] max-w-md mx-auto text-sm space-y-3">
              <p>
                <strong>Dziecko poniżej 13 lat?</strong><br />
                Dodaj jego profil bezpośrednio tutaj. Wpisz adres e-mail, którego dziecko będzie używać do rejestracji — ten adres stanie się powiązany z Twoją zgodą.
              </p>
              <p>
                <strong>Dziecko w wieku 13–15 lat?</strong><br />
                Dziecko powinno samo założyć konto ucznia i podać Twój adres e-mail — wyślemy Ci wtedy link do potwierdzenia.
              </p>
            </div>
          </div>
        ) : (
          childrenData.map((child, index) => (
            <ChildCard
              key={child.consent_id ?? child.child_profile_id ?? String(index)}
              data={child}
            />
          ))
        )}
      </div>

      {/* Privacy notice */}
      <div className="omni-card p-6 bg-blue-50/50 border-blue-100 flex items-start gap-4">
        <Info className="w-5 h-5 text-blue-500 shrink-0 mt-0.5" />
        <p className="text-sm text-blue-900">
          W wersji MVP panel pokazuje podstawowe informacje. Pełna treść notatek i rozmów jest prywatna, aby wspierać samodzielność ucznia.
        </p>
      </div>
    </div>
  );
}

// ─── ChildCard ────────────────────────────────────────────────────────────────

function ChildCard({ data }: { data: ParentChildData }) {
  const { t } = useTranslation('common');
  const isConsent = data.child_source === 'consent';
  const isLocalPreapproved = data.child_source === 'local_preapproved';
  const isPendingRegistration = data.consent_status === 'pending_child_registration';

  // consent-based child states
  const isConsentApproved = data.consent_status === 'approved';
  const isConsentPending = data.consent_status === 'pending';

  // Displayed status badge
  const statusLabel = data.status_label
    ?? (isPendingRegistration ? 'Oczekuje na rejestrację dziecka' : data.consent_status);

  const badgeColor = isConsentApproved || data.consent_status === 'linked' || data.consent_status === 'active'
    ? 'bg-green-100 text-green-800 border-green-200'
    : isPendingRegistration || isConsentPending
      ? 'bg-amber-100 text-amber-800 border-amber-200'
      : 'bg-red-100 text-red-800 border-red-200';

  // ── pending consent (13-15) ────────────────────────────────────────────────
  if (isConsent && isConsentPending) {
    return (
      <div className="omni-card p-6 border-yellow-200 bg-yellow-50/30">
        <div className="flex items-center gap-3 mb-3">
          <Clock className="w-5 h-5 text-yellow-600" />
          <h3 className="font-semibold text-[var(--omni-text)]">Zgoda oczekuje na potwierdzenie</h3>
        </div>
        <p className="text-[var(--omni-text-muted)] text-sm mb-2">
          Sprawdź skrzynkę e-mail (folder SPAM), żeby zatwierdzić zgodę i odblokować profil dziecka.
        </p>
        <p className="text-xs text-gray-400">Wysłano: {formatDate(data.consent_created_at)}</p>
      </div>
    );
  }

  // ── revoked / other bad states ─────────────────────────────────────────────
  if (isConsent && !isConsentApproved) {
    return (
      <div className="omni-card p-6 border-red-200 bg-red-50/30">
        <div className="flex items-center gap-3 mb-2">
          <AlertTriangle className="w-5 h-5 text-red-600" />
          <h3 className="font-semibold text-[var(--omni-text)]">Brak dostępu</h3>
        </div>
        <p className="text-[var(--omni-text-muted)] text-sm">
          Zgoda nie jest aktywna. Panel dziecka nie jest dostępny.
        </p>
      </div>
    );
  }

  // ── full card (approved consent OR local pre-approved) ─────────────────────
  return (
    <div className="omni-card overflow-hidden">
      {/* Card header */}
      <div className="p-6 border-b border-border bg-slate-50/50 dark:bg-slate-900/50 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-[var(--omni-lavender)] rounded-full flex items-center justify-center shrink-0">
            <UserCircle className="w-6 h-6 text-[var(--omni-primary)]" />
          </div>
          <div>
            <h3 className="text-xl font-bold text-[var(--omni-text)]">
              {data.safe_child_name ?? 'Uczeń'}
            </h3>
            {data.child_email_masked && (
              <p className="text-sm text-[var(--omni-text-muted)]">{data.child_email_masked}</p>
            )}
            {isLocalPreapproved && data.age_band && (
              <p className="text-xs text-[var(--omni-text-muted)] mt-0.5">
                {data.age_band === '7_9' ? '7–9 lat' : '10–12 lat'}
              </p>
            )}
          </div>
        </div>
        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${badgeColor}`}>
          {statusLabel}
        </span>
      </div>

      {/* Card body */}
      <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-6">
          <div>
            <h4 className="text-sm font-semibold text-[var(--omni-text)] uppercase tracking-wider mb-4 flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              Aktywność
            </h4>
            <dl className="space-y-3">
              {data.last_login_at && (
                <div>
                  <dt className="text-sm text-[var(--omni-text-muted)]">Ostatnie logowanie</dt>
                  <dd className="text-sm font-medium text-[var(--omni-text)] mt-0.5">{formatDate(data.last_login_at)}</dd>
                </div>
              )}
              {data.education_level && (
                <div>
                  <dt className="text-sm text-[var(--omni-text-muted)]">Etap edukacji</dt>
                  <dd className="text-sm font-medium text-[var(--omni-text)] mt-0.5">{getEducationLabel(data.education_level)}</dd>
                </div>
              )}
              {isLocalPreapproved && isPendingRegistration && (
                <div className="p-3 bg-amber-50 border border-amber-100 rounded-lg">
                  <p className="text-xs font-semibold text-amber-900 mb-1">Oczekiwanie na rejestrację dziecka</p>
                  <p className="text-xs text-amber-800">
                    {t('parent.childCard.pendingRegistration')}
                  </p>
                </div>
              )}
            </dl>
          </div>

          <div>
            <h4 className="text-sm font-semibold text-[var(--omni-text)] uppercase tracking-wider mb-4 flex items-center gap-2">
              <GraduationCap className="w-4 h-4" />
              Postępy
            </h4>
            {isLocalPreapproved ? (
              <p className="text-sm text-[var(--omni-text-muted)] italic leading-relaxed">
                Tryb nauki pod opieką rodzica zostanie przygotowany w kolejnym etapie.
              </p>
            ) : (
              <p className="text-sm text-[var(--omni-text-muted)] italic leading-relaxed">
                Wnioski o postępach pojawią się po pierwszych sesjach nauki i quizach.
              </p>
            )}
          </div>
        </div>

        <div>
          <h4 className="text-sm font-semibold text-[var(--omni-text)] uppercase tracking-wider mb-4 flex items-center gap-2">
            <ShieldCheck className="w-4 h-4" />
            Wsparcie i bezpieczeństwo
          </h4>
          <p className="text-sm text-[var(--omni-text-muted)] italic leading-relaxed">
            Dbamy o bezpieczne środowisko nauki, które buduje samodzielność dziecka.
          </p>
        </div>
      </div>
    </div>
  );
}
