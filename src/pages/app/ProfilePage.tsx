import { useState } from 'react';
import { useAuth } from '../../lib/auth-context';
import { User, Mail, Calendar, Award, Edit2, Check, X } from 'lucide-react';

export default function ProfilePage() {
  const { user, updateProfile } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [name, setName] = useState(user?.name || '');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSave = async () => {
    if (!name.trim()) {
      setError('Imię nie może być puste');
      return;
    }

    setIsSaving(true);
    setError(null);
    setSuccess(false);

    try {
      const result = await updateProfile({ name });
      if (result.success) {
        setIsEditing(false);
        setSuccess(true);
        setTimeout(() => setSuccess(false), 3000);
      } else {
        setError(result.error || 'Wystąpił błąd podczas zapisywania');
      }
    } catch (err) {
      setError('Wystąpił błąd połączenia');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setName(user?.name || '');
    setError(null);
    setIsEditing(false);
  };

  const stats = [
    { label: 'Plan', value: user?.plan === 'premium' ? 'Premium' : 'Darmowy', icon: Award },
    { label: 'Dołączył', value: user?.createdAt ? new Date(user.createdAt).toLocaleDateString('pl-PL') : '-', icon: Calendar },
    { label: 'Email', value: user?.email || '-', icon: Mail },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="omni-heading-3 text-[var(--omni-text)] mb-2">
            Twój profil
          </h1>
          <p className="text-[var(--omni-text-muted)]">
            Zarządzaj swoimi danymi
          </p>
        </div>
        
        {success && (
          <div className="px-4 py-2 bg-green-50 text-green-600 rounded-xl text-sm font-medium animate-in fade-in slide-in-from-top-2">
            Profil został zaktualizowany!
          </div>
        )}
      </div>

      {/* Profile Card */}
      <div className="omni-card p-6 lg:p-8">
        <div className="flex flex-col sm:flex-row items-center gap-6">
          {/* Avatar */}
          <div className="w-24 h-24 bg-[var(--omni-lavender)] rounded-full flex items-center justify-center">
            <span className="text-3xl font-bold text-[var(--omni-text)]">
              {user?.name?.charAt(0) || 'U'}
            </span>
          </div>

          {/* Info */}
          <div className="flex-1 text-center sm:text-left w-full max-w-md">
            {isEditing ? (
              <div className="space-y-3">
                <div>
                  <label className="block text-xs text-[var(--omni-text-muted)] mb-1 ml-1">Imię</label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="omni-input"
                    placeholder="Imię"
                    disabled={isSaving}
                  />
                </div>
                
                <div>
                  <label className="block text-xs text-[var(--omni-text-muted)] mb-1 ml-1">Email (nie można zmienić)</label>
                  <input
                    type="email"
                    value={user?.email || ''}
                    className="omni-input opacity-50 cursor-not-allowed"
                    disabled
                  />
                </div>

                {error && (
                  <p className="text-sm text-red-500 ml-1">{error}</p>
                )}

                <div className="flex gap-2 justify-center sm:justify-start pt-2">
                  <button
                    onClick={handleSave}
                    disabled={isSaving}
                    className="px-4 py-2 bg-green-500 text-white rounded-lg flex items-center gap-2 hover:bg-green-600 transition-colors disabled:opacity-50"
                  >
                    {isSaving ? (
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                      <Check className="w-4 h-4" />
                    )}
                    Zapisz
                  </button>
                  <button
                    onClick={handleCancel}
                    disabled={isSaving}
                    className="px-4 py-2 bg-muted text-muted-foreground rounded-lg flex items-center gap-2 hover:bg-muted/80 transition-colors disabled:opacity-50"
                  >
                    <X className="w-4 h-4" />
                    Anuluj
                  </button>
                </div>
              </div>
            ) : (
              <>
                <h2 className="text-2xl font-bold text-[var(--omni-text)] mb-1">
                  {user?.name || 'Użytkownik'}
                </h2>
                <p className="text-[var(--omni-text-muted)] mb-4">
                  {user?.email}
                </p>
                <button
                  onClick={() => setIsEditing(true)}
                  className="inline-flex items-center gap-2 text-[var(--omni-accent)] font-medium hover:underline"
                >
                  <Edit2 className="w-4 h-4" />
                  Edytuj profil
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {stats.map((stat, index) => (
          <div key={index} className="omni-card p-4 flex items-center gap-4">
            <div className="w-12 h-12 bg-[var(--omni-lavender)] rounded-xl flex items-center justify-center">
              <stat.icon className="w-6 h-6 text-[var(--omni-text)]" />
            </div>
            <div>
              <p className="text-sm text-[var(--omni-text-muted)]">{stat.label}</p>
              <p className="font-medium text-[var(--omni-text)]">{stat.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Activity */}
      <div className="omni-card p-6">
        <h3 className="font-semibold text-[var(--omni-text)] mb-4 flex items-center gap-2">
          <User className="w-5 h-5" />
          Aktywność
        </h3>
        <div className="space-y-4">
          <div className="flex items-center justify-between p-4 bg-muted dark:bg-slate-800/50 rounded-xl">
            <span className="text-foreground font-medium">Ostatnie logowanie</span>
            <span className="text-muted-foreground">
              Dzisiaj, {new Date().toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>
          <div className="flex items-center justify-between p-4 bg-muted dark:bg-slate-800/50 rounded-xl">
            <span className="text-foreground font-medium">Status konta</span>
            <span className="px-3 py-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded-full text-sm font-medium">
              Aktywne
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
