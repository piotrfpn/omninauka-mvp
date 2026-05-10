import { useState } from 'react';
import { useAuth } from '../../lib/auth-context';
import { supabase } from '../../lib/supabase';
import {
  Search, Shield, ShieldOff, CheckCircle, AlertTriangle,
  Loader2, User, Calendar, Crown, Users, FileText,
} from 'lucide-react';

// ── Types ──────────────────────────────────────────────────────────────────────

interface AdminUserProfile {
  id: string;
  email: string;
  plan: 'free' | 'premium' | 'family';
  plan_expires_at: string | null;
  plan_updated_at: string | null;
  created_at?: string | null;
}

type ActionStatus = 'idle' | 'loading' | 'success' | 'error';

// ── Helpers ────────────────────────────────────────────────────────────────────

const FUNCTION_URL_BASE = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-plan-management`;

function formatDate(isoString: string | null | undefined): string {
  if (!isoString) return '—';
  try {
    return new Intl.DateTimeFormat('pl-PL', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    }).format(new Date(isoString));
  } catch {
    return isoString;
  }
}

function getPlanLabel(plan: string): string {
  switch (plan) {
    case 'premium': return 'Premium';
    case 'family':  return 'Rodzinny';
    default:        return 'Darmowy';
  }
}

/** Returns true when a paid plan is expired (plan_expires_at in the past). */
function isPlanExpired(plan: string, plan_expires_at: string | null): boolean {
  if (plan === 'free') return false;
  if (!plan_expires_at) return false;
  return new Date(plan_expires_at) <= new Date();
}

/** Effective plan: premium/family with past expiry → behaves as free. */
function getEffectivePlanLabel(plan: string, plan_expires_at: string | null): string {
  if (isPlanExpired(plan, plan_expires_at)) return 'Darmowy (plan wygasł)';
  return getPlanLabel(plan);
}

function getPlanBadgeClass(plan: string, expired: boolean): string {
  if (expired) return 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400';
  switch (plan) {
    case 'premium': return 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-300';
    case 'family':  return 'bg-violet-100 text-violet-800 dark:bg-violet-900/40 dark:text-violet-300';
    default:        return 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300';
  }
}

// ── Main Component ─────────────────────────────────────────────────────────────

export default function AdminPage() {
  const { user } = useAuth();

  // Search state
  const [searchEmail, setSearchEmail]   = useState('');
  const [searchStatus, setSearchStatus] = useState<ActionStatus>('idle');
  const [searchError, setSearchError]   = useState<string | null>(null);
  const [isForbidden, setIsForbidden]   = useState(false);

  // Found user state
  const [foundUser, setFoundUser] = useState<AdminUserProfile | null>(null);
  const [notFound, setNotFound]   = useState(false);

  // Action state
  const [actionStatus, setActionStatus]   = useState<ActionStatus>('idle');
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [actionError, setActionError]     = useState<string | null>(null);

  // Reason field
  const [reason, setReason] = useState('');

  // ── API call helper ────────────────────────────────────────────────────────

  const callAdminFunction = async (body: Record<string, unknown>) => {
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;
    if (!token) throw new Error('Brak tokenu sesji. Zaloguj się ponownie.');

    const response = await fetch(FUNCTION_URL_BASE, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (response.status === 403) {
      setIsForbidden(true);
      throw new Error('forbidden');
    }

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      throw new Error(errData.error || `HTTP ${response.status}`);
    }

    return await response.json();
  };

  // ── Search handler ─────────────────────────────────────────────────────────

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    const email = searchEmail.trim().toLowerCase();
    if (!email || !email.includes('@')) {
      setSearchError('Wpisz poprawny adres e-mail.');
      return;
    }

    setSearchStatus('loading');
    setSearchError(null);
    setFoundUser(null);
    setNotFound(false);
    setIsForbidden(false);
    setActionMessage(null);
    setActionError(null);
    setReason('');

    try {
      const result = await callAdminFunction({ action: 'search_user', email });
      if (result.user) {
        setFoundUser(result.user);
        setNotFound(false);
      } else {
        setFoundUser(null);
        setNotFound(true);
      }
      setSearchStatus('idle');
    } catch (err: any) {
      if (err.message === 'forbidden') {
        setSearchStatus('idle');
      } else {
        setSearchError(err.message || 'Błąd wyszukiwania.');
        setSearchStatus('error');
      }
    }
  };

  // ── Action handler ─────────────────────────────────────────────────────────

  const handleAction = async (action: string, label: string) => {
    if (!foundUser) return;

    if (action === 'set_free') {
      const confirmed = window.confirm(
        'Ta akcja ustawi konto użytkownika jako Free. Kontynuować?'
      );
      if (!confirmed) return;
    }

    setActionStatus('loading');
    setActionMessage(null);
    setActionError(null);

    try {
      const result = await callAdminFunction({
        action,
        userId: foundUser.id,
        reason: reason.trim() || null, // Explicit null instead of undefined
      });

      if (result.success && result.user) {
        setFoundUser(result.user);
        setActionMessage(`✓ ${label} — plan został zaktualizowany.`);
        setActionStatus('success');
        setReason(''); // wyczyść powód po sukcesie
      } else {
        throw new Error('Nieoczekiwana odpowiedź z serwera.');
      }
    } catch (err: any) {
      if (err.message === 'forbidden') {
        setActionError('Nie masz uprawnień administratora.');
      } else {
        setActionError(err.message || 'Błąd podczas aktualizacji planu.');
      }
      setActionStatus('error');
      // NIE czyść reason przy błędzie — admin może chcieć spróbować ponownie
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="max-w-2xl mx-auto space-y-8 animate-in fade-in duration-300">

      {/* Header */}
      <header>
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 bg-red-100 dark:bg-red-900/30 rounded-xl flex items-center justify-center">
            <Shield className="w-5 h-5 text-red-600 dark:text-red-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Panel administratora</h1>
            <p className="text-sm text-muted-foreground">
              Ręczna aktywacja i zarządzanie planem użytkownika
            </p>
          </div>
        </div>
        <div className="mt-3 flex items-center gap-2 text-xs text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg px-3 py-2">
          <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
          <span>
            Zalogowany jako: <strong>{user?.email}</strong>.
            Każda operacja jest zapisywana w logu audytowym.
          </span>
        </div>
      </header>

      {/* Forbidden state */}
      {isForbidden && (
        <div className="flex items-start gap-3 p-5 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-2xl">
          <ShieldOff className="w-5 h-5 text-red-600 dark:text-red-400 mt-0.5 flex-shrink-0" />
          <div>
            <p className="font-semibold text-red-800 dark:text-red-300">
              Nie masz uprawnień administratora.
            </p>
            <p className="text-sm text-red-700 dark:text-red-400 mt-1">
              Twój adres e-mail nie jest na liście administratorów.
              Skontaktuj się z właścicielem projektu.
            </p>
          </div>
        </div>
      )}

      {/* Search Section */}
      <section className="omni-card p-6 space-y-4">
        <h2 className="font-semibold text-foreground flex items-center gap-2">
          <Search className="w-4 h-4" />
          Wyszukaj użytkownika
        </h2>
        <form onSubmit={handleSearch} className="flex gap-2">
          <input
            id="admin-search-email"
            type="email"
            value={searchEmail}
            onChange={(e) => setSearchEmail(e.target.value)}
            placeholder="email@uzytkownika.pl"
            autoComplete="off"
            className="flex-1 bg-muted border-none outline-none text-sm text-foreground placeholder:text-muted-foreground px-4 py-3 rounded-xl focus:ring-2 focus:ring-[var(--omni-accent)]/30 transition-all"
          />
          <button
            id="admin-search-btn"
            type="submit"
            disabled={searchStatus === 'loading'}
            className="px-5 py-3 bg-[var(--omni-accent)] text-white font-semibold rounded-xl disabled:opacity-50 hover:opacity-90 transition-all flex items-center gap-2 whitespace-nowrap"
          >
            {searchStatus === 'loading'
              ? <Loader2 className="w-4 h-4 animate-spin" />
              : <Search className="w-4 h-4" />}
            Szukaj
          </button>
        </form>

        {searchError && (
          <p className="text-sm text-red-600 dark:text-red-400 flex items-center gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5" />
            {searchError}
          </p>
        )}
        {notFound && (
          <p className="text-sm text-muted-foreground flex items-center gap-1.5">
            <User className="w-3.5 h-3.5" />
            Nie znaleziono użytkownika o podanym adresie e-mail.
          </p>
        )}
      </section>

      {/* Found User Card */}
      {foundUser && (() => {
        const expired = isPlanExpired(foundUser.plan, foundUser.plan_expires_at);
        const effectiveLabel = getEffectivePlanLabel(foundUser.plan, foundUser.plan_expires_at);
        const badgeClass = getPlanBadgeClass(foundUser.plan, expired);

        return (
          <section className="omni-card p-6 space-y-6">

            {/* ── User Info ── */}
            <div className="space-y-3">
              <h2 className="font-semibold text-foreground flex items-center gap-2">
                <User className="w-4 h-4" />
                Użytkownik
              </h2>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* E-mail */}
                <div className="bg-muted/50 rounded-xl px-4 py-3">
                  <p className="text-xs text-muted-foreground mb-0.5">E-mail</p>
                  <p className="text-sm font-medium text-foreground break-all">{foundUser.email}</p>
                </div>

                {/* Plan w bazie + efektywny status */}
                <div className="bg-muted/50 rounded-xl px-4 py-3 space-y-1.5">
                  <p className="text-xs text-muted-foreground">Plan w bazie</p>
                  <span className={`inline-block text-sm font-semibold px-2 py-0.5 rounded-md ${badgeClass}`}>
                    {getPlanLabel(foundUser.plan)}
                    {expired && ' (wygasły)'}
                  </span>
                  {expired && (
                    <p className="text-xs text-amber-700 dark:text-amber-400 font-medium flex items-center gap-1 mt-1">
                      <AlertTriangle className="w-3 h-3" />
                      Efektywnie: {effectiveLabel}
                    </p>
                  )}
                </div>

                {/* Ważny do */}
                <div className="bg-muted/50 rounded-xl px-4 py-3">
                  <p className="text-xs text-muted-foreground mb-0.5 flex items-center gap-1">
                    <Calendar className="w-3 h-3" /> Ważny do
                  </p>
                  <p className={`text-sm font-medium ${expired ? 'text-red-600 dark:text-red-400' : 'text-foreground'}`}>
                    {foundUser.plan_expires_at
                      ? `${formatDate(foundUser.plan_expires_at)}${expired ? ' ⚠ wygasł' : ''}`
                      : '—'}
                  </p>
                </div>

                {/* Ostatnia zmiana planu */}
                <div className="bg-muted/50 rounded-xl px-4 py-3">
                  <p className="text-xs text-muted-foreground mb-0.5">Ostatnia zmiana planu</p>
                  <p className="text-sm font-medium text-foreground">{formatDate(foundUser.plan_updated_at)}</p>
                </div>
              </div>
            </div>

            {/* ── Powód zmiany ── */}
            <div className="space-y-1.5">
              <label
                htmlFor="admin-reason"
                className="flex items-center gap-1.5 text-sm font-medium text-foreground"
              >
                <FileText className="w-3.5 h-3.5 text-muted-foreground" />
                Powód zmiany <span className="text-muted-foreground font-normal">(opcjonalnie)</span>
              </label>
              <textarea
                id="admin-reason"
                value={reason}
                onChange={(e) => setReason(e.target.value.slice(0, 500))}
                placeholder="np. płatność ręczna, reklamacja, bonus, test"
                rows={2}
                className="w-full bg-muted border-none outline-none text-sm text-foreground placeholder:text-muted-foreground px-4 py-3 rounded-xl focus:ring-2 focus:ring-[var(--omni-accent)]/30 transition-all resize-none"
              />
              <p className="text-xs text-muted-foreground flex justify-between items-center mt-1">
                <span>Powód zostanie zapisany w logu przy następnej operacji planu.</span>
                <span>{reason.length}/500</span>
              </p>
            </div>

            {/* ── Action Feedback ── */}
            {actionMessage && (
              <div className="flex items-center gap-2 px-4 py-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl text-sm text-green-800 dark:text-green-300 font-medium">
                <CheckCircle className="w-4 h-4 flex-shrink-0" />
                {actionMessage}
              </div>
            )}
            {actionError && (
              <div className="flex items-center gap-2 px-4 py-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl text-sm text-red-800 dark:text-red-300 font-medium">
                <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                {actionError}
              </div>
            )}

            {/* ── Actions ── */}
            <div className="space-y-3">
              <h3 className="font-semibold text-foreground text-sm">Zarządzanie planem</h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <ActionButton
                  id="admin-activate-premium"
                  icon={<Crown className="w-4 h-4" />}
                  label="Aktywuj Premium 30 dni"
                  description="Nowy okres od dzisiaj"
                  onClick={() => handleAction('activate_premium_30', 'Aktywuj Premium 30 dni')}
                  loading={actionStatus === 'loading'}
                  variant="primary"
                />
                <ActionButton
                  id="admin-extend-premium"
                  icon={<Crown className="w-4 h-4" />}
                  label="Przedłuż Premium 30 dni"
                  description="Nie skróci aktywnego dostępu"
                  onClick={() => handleAction('extend_premium_30', 'Przedłuż Premium 30 dni')}
                  loading={actionStatus === 'loading'}
                  variant="secondary"
                />
                <ActionButton
                  id="admin-activate-family"
                  icon={<Users className="w-4 h-4" />}
                  label="Aktywuj Family 30 dni"
                  description="Nowy okres od dzisiaj"
                  onClick={() => handleAction('activate_family_30', 'Aktywuj Family 30 dni')}
                  loading={actionStatus === 'loading'}
                  variant="secondary"
                />
                <ActionButton
                  id="admin-set-free"
                  icon={<ShieldOff className="w-4 h-4" />}
                  label="Ustaw Free"
                  description="Usuwa daty ważności planu"
                  onClick={() => handleAction('set_free', 'Ustaw Free')}
                  loading={actionStatus === 'loading'}
                  variant="danger"
                />
              </div>
            </div>

          </section>
        );
      })()}
    </div>
  );
}

// ── ActionButton Sub-Component ─────────────────────────────────────────────────

interface ActionButtonProps {
  id: string;
  icon: React.ReactNode;
  label: string;
  description: string;
  onClick: () => void;
  loading: boolean;
  variant: 'primary' | 'secondary' | 'danger';
}

function ActionButton({ id, icon, label, description, onClick, loading, variant }: ActionButtonProps) {
  const variantClass = {
    primary:   'bg-indigo-600 text-white hover:bg-indigo-700',
    secondary: 'bg-muted text-foreground hover:bg-muted/80 border border-border',
    danger:    'bg-red-50 text-red-700 hover:bg-red-100 border border-red-200 dark:bg-red-900/20 dark:text-red-300 dark:border-red-800 dark:hover:bg-red-900/40',
  }[variant];

  return (
    <button
      id={id}
      onClick={onClick}
      disabled={loading}
      className={`flex items-start gap-3 px-4 py-3 rounded-xl text-left transition-all disabled:opacity-50 ${variantClass}`}
    >
      <div className="mt-0.5 flex-shrink-0">
        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : icon}
      </div>
      <div>
        <p className="text-sm font-semibold">{label}</p>
        <p className="text-xs opacity-70 mt-0.5">{description}</p>
      </div>
    </button>
  );
}
