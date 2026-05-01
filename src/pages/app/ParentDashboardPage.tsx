import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../lib/auth-context';
import { useParentDashboard } from '../../lib/parent-dashboard';
import { 
  ShieldCheck, 
  UserCircle, 
  Clock, 
  GraduationCap, 
  AlertTriangle,
  Info,
  Calendar,
  Lock
} from 'lucide-react';
import type { ParentChildData } from '../../types';

export default function ParentDashboardPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { childrenData, isLoading, error } = useParentDashboard();

  useEffect(() => {
    if (user && user.userRole !== 'parent' && user.userRole !== 'guardian') {
      navigate('/app/dashboard', { replace: true });
    }
  }, [user, navigate]);

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

  const approvedCount = childrenData.filter(c => c.consent_status === 'approved').length;
  const pendingCount = childrenData.filter(c => c.consent_status === 'pending').length;

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-12">
      {/* Header */}
      <div>
        <h1 className="omni-heading-3 text-[var(--omni-text)] mb-2 flex items-center gap-3">
          <ShieldCheck className="w-8 h-8 text-[var(--omni-accent)]" />
          Panel rodzica
        </h1>
        <p className="text-[var(--omni-text-muted)]">
          Sprawdź aktywność i postępy dziecka w OmniNauka.
        </p>
      </div>

      {/* Status Card */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="omni-card p-6 flex items-start gap-4">
          <div className="w-10 h-10 bg-[var(--omni-lavender)] rounded-lg flex items-center justify-center shrink-0">
            <UserCircle className="w-5 h-5 text-[var(--omni-primary)]" />
          </div>
          <div>
            <p className="text-sm font-medium text-[var(--omni-text-muted)]">Połączone konta dzieci</p>
            <p className="text-2xl font-bold text-[var(--omni-text)] mt-1">{approvedCount}</p>
            {pendingCount > 0 && (
              <p className="text-sm text-yellow-600 mt-1">Oczekujące zgody: {pendingCount}</p>
            )}
          </div>
        </div>
        <div className="omni-card p-6 flex items-start gap-4">
          <div className="w-10 h-10 bg-[var(--omni-lavender)] rounded-lg flex items-center justify-center shrink-0">
            <Lock className="w-5 h-5 text-[var(--omni-primary)]" />
          </div>
          <div>
            <p className="text-sm font-medium text-[var(--omni-text-muted)]">Zgody i bezpieczeństwo</p>
            <p className="text-sm text-[var(--omni-text)] mt-1">
              Widzisz tylko podstawowe informacje o postępach. Zależy nam na samodzielności ucznia, dlatego treść notatek jest prywatna.
            </p>
          </div>
        </div>
      </div>

      {/* Children List */}
      <div className="space-y-6">
        {childrenData.length === 0 ? (
          <div className="omni-card p-12 text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-[var(--omni-bg-muted)] mb-4">
              <UserCircle className="w-8 h-8 text-[var(--omni-text-muted)]" />
            </div>
            <h3 className="text-lg font-bold text-[var(--omni-text)] mb-2">
              Brak powiązanych kont
            </h3>
            <p className="text-[var(--omni-text-muted)] max-w-md mx-auto">
              Nie masz podpiętych dzieci do tego konta e-mail. Dziecko musi wysłać prośbę o zgodę na ten adres e-mail podczas rejestracji.
            </p>
          </div>
        ) : (
          childrenData.map((child) => (
            <ChildCard key={child.consent_id} data={child} />
          ))
        )}
      </div>

      {/* Privacy Notice */}
      <div className="omni-card p-6 bg-blue-50/50 border-blue-100 flex items-start gap-4">
        <Info className="w-5 h-5 text-blue-500 shrink-0 mt-0.5" />
        <p className="text-sm text-blue-900">
          W wersji MVP panel pokazuje tylko podstawowe informacje o postępach. Pełna treść prywatnych notatek i rozmów dziecka nie jest udostępniana, aby wspierać zaufanie i samodzielność w nauce.
        </p>
      </div>
    </div>
  );
}

function ChildCard({ data }: { data: ParentChildData }) {
  const isApproved = data.consent_status === 'approved';
  const isPending = data.consent_status === 'pending';
  
  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'Brak danych';
    return new Intl.DateTimeFormat('pl-PL', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    }).format(new Date(dateString));
  };

  const getEducationLabel = (level: string | null) => {
    if (!level) return 'Nieuzupełniono';
    const labels: Record<string, string> = {
      'primary_1_3': 'Szkoła podstawowa 1-3',
      'primary_4_6': 'Szkoła podstawowa 4-6',
      'primary_7_8': 'Szkoła podstawowa 7-8',
      'secondary_1': 'Szkoła średnia 1',
      'secondary_2': 'Szkoła średnia 2',
      'secondary_3': 'Szkoła średnia 3',
      'secondary_4': 'Szkoła średnia 4',
      'secondary_5': 'Szkoła średnia 5',
    };
    return labels[level] || 'Inne';
  };

  if (isPending) {
    return (
      <div className="omni-card p-6 border-yellow-200 bg-yellow-50/30">
        <div className="flex items-center gap-3 mb-4">
          <Clock className="w-5 h-5 text-yellow-600" />
          <h3 className="font-semibold text-[var(--omni-text)]">Zgoda oczekuje na potwierdzenie</h3>
        </div>
        <p className="text-[var(--omni-text-muted)] text-sm mb-2">
          Zgoda rodzicielska oczekuje na potwierdzenie. Sprawdź wiadomość e-mail (w tym folder SPAM) i zatwierdź zgodę, aby zobaczyć profil dziecka.
        </p>
        <p className="text-xs text-gray-400">
          Wysłano: {formatDate(data.consent_created_at)}
        </p>
      </div>
    );
  }

  if (!isApproved) {
    return (
      <div className="omni-card p-6 border-red-200 bg-red-50/30">
        <div className="flex items-center gap-3 mb-2">
          <AlertTriangle className="w-5 h-5 text-red-600" />
          <h3 className="font-semibold text-[var(--omni-text)]">Brak dostępu</h3>
        </div>
        <p className="text-[var(--omni-text-muted)] text-sm">
          Zgoda została cofnięta lub nie jest aktywna. Panel dziecka nie jest dostępny.
        </p>
      </div>
    );
  }

  return (
    <div className="omni-card overflow-hidden">
      <div className="p-6 border-b border-border bg-slate-50/50 dark:bg-slate-900/50 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-[var(--omni-lavender)] rounded-full flex items-center justify-center shrink-0">
            <UserCircle className="w-6 h-6 text-[var(--omni-primary)]" />
          </div>
          <div>
            <h3 className="text-xl font-bold text-[var(--omni-text)]">
              {data.safe_child_name || 'Uczeń'}
            </h3>
            {data.child_email_masked && (
              <p className="text-sm text-[var(--omni-text-muted)]">{data.child_email_masked}</p>
            )}
          </div>
        </div>
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 border border-green-200">
          Zgoda aktywna
        </span>
      </div>

      <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Education & Activity */}
        <div className="space-y-6">
          <div>
            <h4 className="text-sm font-semibold text-[var(--omni-text)] uppercase tracking-wider mb-4 flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              Aktywność
            </h4>
            <dl className="space-y-3">
              <div>
                <dt className="text-sm text-[var(--omni-text-muted)]">Ostatnie logowanie</dt>
                <dd className="text-sm font-medium text-[var(--omni-text)] mt-0.5">
                  {formatDate(data.last_login_at)}
                </dd>
              </div>
              <div>
                <dt className="text-sm text-[var(--omni-text-muted)]">Etap edukacji</dt>
                <dd className="text-sm font-medium text-[var(--omni-text)] mt-0.5">
                  {getEducationLabel(data.education_level)}
                </dd>
              </div>
            </dl>
          </div>

          <div>
            <h4 className="text-sm font-semibold text-[var(--omni-text)] uppercase tracking-wider mb-4 flex items-center gap-2">
              <GraduationCap className="w-4 h-4" />
              Postępy i wyniki
            </h4>
            <p className="text-sm text-[var(--omni-text-muted)] italic leading-relaxed">
              Wnioski o postępach pojawią się po pierwszych sesjach nauki i quizach.
            </p>
          </div>
        </div>

        {/* AI & Security */}
        <div className="space-y-6">
          <div>
            <h4 className="text-sm font-semibold text-[var(--omni-text)] uppercase tracking-wider mb-4 flex items-center gap-2">
              <UserCircle className="w-4 h-4" />
              AI korepetytor
            </h4>
            <p className="text-sm text-[var(--omni-text-muted)] italic leading-relaxed">
              W przyszłości zobaczysz tutaj ogólne statystyki korzystania z AI korepetytora, bez pełnego podglądu prywatnych rozmów.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
