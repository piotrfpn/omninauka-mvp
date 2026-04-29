import { useAuth } from '../../lib/auth-context';
import { EducationalProfileForm } from '../../components/profile/EducationalProfileForm';
import { 
  UserCircle, 
  Crown, 
  Calendar, 
  Mail, 
  Activity, 
  Clock, 
  CheckCircle2, 
  AlertTriangle, 
  XCircle 
} from 'lucide-react';

export default function ProfilePage() {
  const { user } = useAuth();

  // Format date helper
  const formatDate = (date: Date | undefined) => {
    if (!date) return 'Brak danych';
    return new Intl.DateTimeFormat('pl-PL', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    }).format(date);
  };

  const formatLastSignIn = (date: Date | undefined) => {
    if (!date) return 'Brak danych';
    const now = new Date();
    const isToday = 
      date.getDate() === now.getDate() &&
      date.getMonth() === now.getMonth() &&
      date.getFullYear() === now.getFullYear();
      
    const timeFormatter = new Intl.DateTimeFormat('pl-PL', {
      hour: '2-digit',
      minute: '2-digit'
    });
    
    if (isToday) {
      return `Dzisiaj, ${timeFormatter.format(date)}`;
    }
    
    const dateFormatter = new Intl.DateTimeFormat('pl-PL', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
    
    return `${dateFormatter.format(date)}, ${timeFormatter.format(date)}`;
  };

  // Plan formatting
  const getPlanLabel = (plan: string | undefined) => {
    if (plan === 'premium') return 'Premium';
    return 'Darmowy';
  };

  // Status mapping
  const getStatusDisplay = (status: string | undefined) => {
    switch (status) {
      case 'active':
      case 'parent_approved':
        return { label: 'Aktywne', color: 'bg-green-100 text-green-700 border-green-200', icon: CheckCircle2 };
      case 'pending_parent_consent':
        return { label: 'Oczekuje na zgodę rodzica', color: 'bg-yellow-100 text-yellow-700 border-yellow-200', icon: Clock };
      case 'parent_withdrawn':
        return { label: 'Cofnięta zgoda', color: 'bg-red-100 text-red-700 border-red-200', icon: XCircle };
      case 'suspended':
        return { label: 'Zawieszone', color: 'bg-red-100 text-red-700 border-red-200', icon: AlertTriangle };
      default:
        return { label: 'Aktywne', color: 'bg-green-100 text-green-700 border-green-200', icon: CheckCircle2 };
    }
  };

  const statusInfo = getStatusDisplay(user?.accountStatus);
  const StatusIcon = statusInfo.icon;

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="omni-heading-3 text-[var(--omni-text)] mb-2">
          Twój profil
        </h1>
        <p className="text-[var(--omni-text-muted)]">
          Dostosuj dane profilu i informacje edukacyjne
        </p>
      </div>

      {/* 1. Identity Card */}
      <div className="omni-card p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
        <div className="flex items-center gap-6">
          <div className="w-20 h-20 bg-[var(--omni-lavender)] rounded-full flex items-center justify-center shrink-0">
            {user?.name ? (
              <span className="text-3xl font-bold text-[var(--omni-primary)]">
                {user.name.charAt(0).toUpperCase()}
              </span>
            ) : (
              <UserCircle className="w-10 h-10 text-[var(--omni-primary)]" />
            )}
          </div>
          <div>
            <h2 className="text-2xl font-bold text-[var(--omni-text)]">
              {user?.name || 'Użytkownik'}
            </h2>
            <p className="text-[var(--omni-text-muted)]">
              {user?.email}
            </p>
          </div>
        </div>
        <button 
          onClick={() => {
            document.getElementById('educational-section')?.scrollIntoView({ behavior: 'smooth' });
          }}
          className="omni-btn-secondary px-6 py-2 shrink-0"
        >
          Edytuj dane
        </button>
      </div>

      {/* 2. Information Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Plan Card */}
        <div className="omni-card p-6 flex items-start gap-4">
          <div className="w-10 h-10 bg-[var(--omni-lavender)] rounded-lg flex items-center justify-center shrink-0">
            <Crown className="w-5 h-5 text-[var(--omni-primary)]" />
          </div>
          <div>
            <p className="text-sm font-medium text-[var(--omni-text-muted)]">Plan</p>
            <p className="text-lg font-semibold text-[var(--omni-text)] mt-1">
              {getPlanLabel(user?.plan)}
            </p>
          </div>
        </div>

        {/* Joined Card */}
        <div className="omni-card p-6 flex items-start gap-4">
          <div className="w-10 h-10 bg-[var(--omni-lavender)] rounded-lg flex items-center justify-center shrink-0">
            <Calendar className="w-5 h-5 text-[var(--omni-primary)]" />
          </div>
          <div>
            <p className="text-sm font-medium text-[var(--omni-text-muted)]">Dołączył(a)</p>
            <p className="text-lg font-semibold text-[var(--omni-text)] mt-1">
              {formatDate(user?.createdAt)}
            </p>
          </div>
        </div>

        {/* Email Card */}
        <div className="omni-card p-6 flex items-start gap-4">
          <div className="w-10 h-10 bg-[var(--omni-lavender)] rounded-lg flex items-center justify-center shrink-0">
            <Mail className="w-5 h-5 text-[var(--omni-primary)]" />
          </div>
          <div className="min-w-0 flex-1 overflow-hidden">
            <p className="text-sm font-medium text-[var(--omni-text-muted)]">E-mail</p>
            <p className="text-lg font-semibold text-[var(--omni-text)] mt-1 truncate" title={user?.email}>
              {user?.email || 'Brak danych'}
            </p>
          </div>
        </div>
      </div>

      {/* 3. Account Activity & Status */}
      <div className="omni-card p-6">
        <div className="flex items-center gap-3 mb-6">
          <Activity className="w-5 h-5 text-[var(--omni-text-muted)]" />
          <h3 className="font-semibold text-[var(--omni-text)]">Aktywność i status konta</h3>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <p className="text-sm text-[var(--omni-text-muted)] mb-2">Status konta</p>
            <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium border ${statusInfo.color}`}>
              <StatusIcon className="w-4 h-4" />
              {statusInfo.label}
            </span>
          </div>
          
          <div>
            <p className="text-sm text-[var(--omni-text-muted)] mb-2">Ostatnie logowanie</p>
            <p className="text-[var(--omni-text)] font-medium">
              {formatLastSignIn(user?.lastLoginAt)}
            </p>
          </div>
        </div>
      </div>

      {/* 4. Educational Context */}
      <div id="educational-section" className="omni-card p-6 scroll-mt-24">
        <h3 className="font-semibold text-[var(--omni-text)] mb-4">
          Dane edukacyjne
        </h3>
        <EducationalProfileForm />
        
        <div className="mt-8 pt-6 border-t border-border">
          <p className="text-sm text-[var(--omni-text-muted)] text-center">
            Te dane są opcjonalne. Pomagają dopasować naukę i rozwijać OmniNauka. Nie podawaj adresu, nazwy szkoły ani danych wrażliwych.
          </p>
        </div>
      </div>
    </div>
  );
}
