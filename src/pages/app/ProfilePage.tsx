import { useState, useEffect } from 'react';
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
  XCircle,
  Loader2
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';

export default function ProfilePage() {
  const { t, i18n } = useTranslation();
  const { user, updateProfile } = useAuth();

  const [isEditingName, setIsEditingName] = useState(false);
  const [editedName, setEditedName] = useState(user?.name || '');
  const [isUpdatingName, setIsUpdatingName] = useState(false);

  useEffect(() => {
    if (user?.name && !isEditingName) {
      setEditedName(user.name);
    }
  }, [user?.name, isEditingName]);

  const handleSaveName = async () => {
    if (!editedName.trim()) {
      toast.error(t('profile.error.emptyName', 'Imię nie może być puste'));
      return;
    }
    setIsUpdatingName(true);
    try {
      const result = await updateProfile({ name: editedName });
      if (result.success) {
        toast.success(t('profile.toast.nameUpdated', 'Imię zostało zaktualizowane'));
        setIsEditingName(false);
      } else {
        throw new Error(result.error);
      }
    } catch (err: any) {
      toast.error(err.message || t('profile.error.updateFailed', 'Błąd podczas aktualizacji'));
    } finally {
      setIsUpdatingName(false);
    }
  };

  const handleCancelName = () => {
    setEditedName(user?.name || '');
    setIsEditingName(false);
  };

  const currentLocale = i18n.language === 'pl' ? 'pl-PL' : i18n.language;

  // Format date helper
  const formatDate = (date: Date | undefined) => {
    if (!date) return t('common.noData', 'Brak danych');
    try {
      return new Intl.DateTimeFormat(currentLocale, {
        day: 'numeric',
        month: 'long',
        year: 'numeric'
      }).format(date);
    } catch (e) {
      return date.toLocaleDateString();
    }
  };

  const formatLastSignIn = (date: Date | undefined) => {
    if (!date) return t('common.noData', 'Brak danych');
    const now = new Date();
    const isToday = 
      date.getDate() === now.getDate() &&
      date.getMonth() === now.getMonth() &&
      date.getFullYear() === now.getFullYear();
      
    const timeFormatter = new Intl.DateTimeFormat(currentLocale, {
      hour: '2-digit',
      minute: '2-digit'
    });
    
    if (isToday) {
      return `${t('common.today', 'Dzisiaj')}, ${timeFormatter.format(date)}`;
    }
    
    const dateFormatter = new Intl.DateTimeFormat(currentLocale, {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
    
    return `${dateFormatter.format(date)}, ${timeFormatter.format(date)}`;
  };

  // Plan formatting
  const getPlanLabel = (plan: string | undefined) => {
    if (plan === 'premium') return t('appShell.plan.premium', 'Premium');
    return t('appShell.plan.free', 'Darmowy');
  };

  // Status mapping
  const getStatusDisplay = (status: string | undefined) => {
    switch (status) {
      case 'active':
      case 'parent_approved':
        return { label: t('profile.status.active', 'Dostęp edukacyjny: aktywny'), color: 'bg-green-100 text-green-700 border-green-200', icon: CheckCircle2 };
      case 'pending_parent_consent':
        return { label: t('profile.status.pending', 'Zgoda rodzica: oczekuje na zatwierdzenie'), color: 'bg-yellow-100 text-yellow-700 border-yellow-200', icon: Clock };
      case 'parent_withdrawn':
        return { label: t('profile.status.withdrawn', 'Dostęp edukacyjny: wstrzymany'), color: 'bg-red-100 text-red-700 border-red-200', icon: XCircle };
      case 'suspended':
        return { label: t('profile.status.suspended', 'Dostęp edukacyjny: wstrzymany'), color: 'bg-red-100 text-red-700 border-red-200', icon: AlertTriangle };
      default:
        return { label: t('profile.status.active', 'Dostęp edukacyjny: aktywny'), color: 'bg-green-100 text-green-700 border-green-200', icon: CheckCircle2 };
    }
  };

  const statusInfo = getStatusDisplay(user?.accountStatus);
  const StatusIcon = statusInfo.icon;

  return (
    <div className="space-y-6 max-w-4xl mx-auto animate-in fade-in duration-500">
      {/* Header */}
      <div>
        <h1 className="omni-heading-3 text-[var(--omni-text)] mb-2">
          {t('profile.title', 'Twój profil')}
        </h1>
        <p className="text-[var(--omni-text-muted)]">
          {t('profile.subtitle', 'Dostosuj profil i dane edukacyjne')}
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
          <div className="min-w-0 flex-1">
            {isEditingName ? (
              <div className="flex flex-col gap-2">
                <input
                  type="text"
                  value={editedName}
                  onChange={(e) => setEditedName(e.target.value)}
                  disabled={isUpdatingName}
                  className="text-xl font-bold text-[var(--omni-text)] bg-background border border-primary/30 rounded-lg px-3 py-1 w-full max-w-md focus:ring-2 focus:ring-primary/20 outline-none"
                  placeholder={t('auth.register.namePlaceholder', 'Twoje imię')}
                  autoFocus
                />
                <p className="text-sm text-[var(--omni-text-muted)]">
                  {user?.email}
                </p>
              </div>
            ) : (
              <>
                <h2 className="text-2xl font-bold text-[var(--omni-text)] truncate">
                  {user?.name || t('appShell.user', 'Użytkownik')}
                </h2>
                <p className="text-[var(--omni-text-muted)] truncate">
                  {user?.email}
                </p>
              </>
            )}
          </div>
        </div>
        <div className="flex gap-3 shrink-0">
          {isEditingName ? (
            <>
              <button 
                onClick={handleCancelName}
                disabled={isUpdatingName}
                className="omni-btn-secondary px-4 py-2 text-sm"
              >
                {t('common.cancel', 'Anuluj')}
              </button>
              <button 
                onClick={handleSaveName}
                disabled={isUpdatingName}
                className="omni-btn-primary px-6 py-2 text-sm flex items-center gap-2"
              >
                {isUpdatingName && <Loader2 className="w-4 h-4 animate-spin" />}
                {t('common.save', 'Zapisz')}
              </button>
            </>
          ) : (
            <button 
              onClick={() => setIsEditingName(true)}
              className="omni-btn-secondary px-6 py-2"
            >
              {t('profile.editProfile', 'Edytuj profil')}
            </button>
          )}
        </div>
      </div>

      {/* 2. Information Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Plan Card */}
        <div className="omni-card p-6 flex items-start gap-4 hover:border-[var(--omni-accent)] transition-colors">
          <div className="w-10 h-10 bg-[var(--omni-lavender)] rounded-lg flex items-center justify-center shrink-0">
            <Crown className="w-5 h-5 text-[var(--omni-primary)]" />
          </div>
          <div>
            <p className="text-sm font-medium text-[var(--omni-text-muted)]">{t('profile.info.plan', 'Plan')}</p>
            <p className="text-lg font-semibold text-[var(--omni-text)] mt-1">
              {getPlanLabel(user?.plan)}
            </p>
          </div>
        </div>

        {/* Joined Card */}
        <div className="omni-card p-6 flex items-start gap-4 hover:border-[var(--omni-accent)] transition-colors">
          <div className="w-10 h-10 bg-[var(--omni-lavender)] rounded-lg flex items-center justify-center shrink-0">
            <Calendar className="w-5 h-5 text-[var(--omni-primary)]" />
          </div>
          <div>
            <p className="text-sm font-medium text-[var(--omni-text-muted)]">{t('profile.info.joined', 'Dołączono')}</p>
            <p className="text-lg font-semibold text-[var(--omni-text)] mt-1">
              {formatDate(user?.createdAt)}
            </p>
          </div>
        </div>

        {/* Email Card */}
        <div className="omni-card p-6 flex items-start gap-4 hover:border-[var(--omni-accent)] transition-colors">
          <div className="w-10 h-10 bg-[var(--omni-lavender)] rounded-lg flex items-center justify-center shrink-0">
            <Mail className="w-5 h-5 text-[var(--omni-primary)]" />
          </div>
          <div className="min-w-0 flex-1 overflow-hidden">
            <p className="text-sm font-medium text-[var(--omni-text-muted)]">{t('profile.info.email', 'E-mail')}</p>
            <p className="text-lg font-semibold text-[var(--omni-text)] mt-1 truncate" title={user?.email}>
              {user?.email || t('common.noData', 'Brak danych')}
            </p>
          </div>
        </div>
      </div>

      {/* 3. Account Activity & Status */}
      <div className="omni-card p-6">
        <div className="flex items-center gap-3 mb-6">
          <Activity className="w-5 h-5 text-[var(--omni-text-muted)]" />
          <h3 className="font-semibold text-[var(--omni-text)]">
            {t('profile.activity.title', 'Aktywność i status konta')}
          </h3>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <p className="text-sm text-[var(--omni-text-muted)] mb-2">{t('profile.activity.status', 'Status konta')}</p>
            <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium border ${statusInfo.color}`}>
              <StatusIcon className="w-4 h-4" />
              {statusInfo.label}
            </span>
          </div>
          
          <div>
            <p className="text-sm text-[var(--omni-text-muted)] mb-2">{t('profile.activity.lastLogin', 'Ostatnie logowanie')}</p>
            <p className="text-[var(--omni-text)] font-medium">
              {formatLastSignIn(user?.lastLoginAt)}
            </p>
          </div>
        </div>
      </div>

      {/* 4. Educational Context */}
      <div id="educational-section" className="omni-card p-6 scroll-mt-24">
        <h3 className="font-semibold text-[var(--omni-text)] mb-4">
          {t('profile.educational.title', 'Dane edukacyjne')}
        </h3>
        <EducationalProfileForm />
        
        <div className="mt-8 pt-6 border-t border-border">
          <p className="text-sm text-[var(--omni-text-muted)] text-center">
            {t('profile.educational.notice', 'Te dane są opcjonalne. Pomagają dopasować naukę i rozwijać OmniNauka. Nie podawaj adresu, nazwy szkoły ani danych wrażliwych.')}
          </p>
        </div>
      </div>
    </div>
  );
}
