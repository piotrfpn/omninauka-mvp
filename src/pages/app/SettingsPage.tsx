import { useState, useEffect } from 'react';
import { useAuth } from '../../lib/auth-context';
import { useNavigate, Link } from 'react-router-dom';
import { Bell, Moon, Globe, Shield, Trash2, LogOut, AlertTriangle, Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { supabase } from '../../lib/supabase';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../../components/ui/dialog";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { toast } from "sonner";

export default function SettingsPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const [notifications, setNotifications] = useState(true);
  const [darkMode, setDarkMode] = useState(() => {
    return document.documentElement.classList.contains('dark');
  });
  const [selectedLang, setSelectedLang] = useState(i18n.resolvedLanguage || i18n.language || 'pl');
  
  useEffect(() => {
    const handleLanguageChanged = (lng: string) => {
      setSelectedLang(lng);
    };
    i18n.on("languageChanged", handleLanguageChanged);
    return () => {
      i18n.off("languageChanged", handleLanguageChanged);
    };
  }, [i18n]);
  // Deletion state
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

  const toggleDarkMode = (enabled: boolean) => {
    setDarkMode(enabled);
    if (enabled) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('omninauka-theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('omninauka-theme', 'light');
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const handleDeleteAccount = async () => {
    if (deleteConfirmText !== 'USUŃ') return;
    
    setIsDeleting(true);
    try {
      const { error } = await supabase.functions.invoke('delete-account');
      
      if (error) throw error;
      
      toast.success(t('settings.account.deleted', "Konto zostało usunięte."));
      logout();
      navigate('/');
    } catch (err: any) {
      console.error('Account deletion failed:', err);
      toast.error(err.message || t('settings.account.deleteError', "Nie udało się usunąć konta. Spróbuj ponownie później."));
    } finally {
      setIsDeleting(false);
      setIsDeleteDialogOpen(false);
    }
  };

  const handleSaveLanguage = async () => {
    await i18n.changeLanguage(selectedLang);
    localStorage.setItem("i18nextLng", selectedLang);
    toast.success(t('settings.language.saved', 'Język interfejsu został zapisany'));
  };

  const settingsGroups = [
    {
      title: t('settings.notifications.title', 'Powiadomienia'),
      items: [
        {
          icon: Bell,
          label: t('settings.notifications.enable', 'Włącz powiadomienia'),
          description: t('settings.notifications.desc', 'Otrzymuj przypomnienia o sesjach nauki'),
          type: 'toggle' as const,
          value: notifications,
          onChange: setNotifications,
        },
      ],
    },
    {
      title: t('settings.appearance.title', 'Wygląd'),
      items: [
        {
          icon: Moon,
          label: t('settings.appearance.dark', 'Tryb ciemny'),
          description: t('settings.appearance.desc', 'Zmień motyw aplikacji'),
          type: 'toggle' as const,
          value: darkMode,
          onChange: toggleDarkMode,
        },
      ],
    },
    {
      title: t('settings.language.title', 'Język'),
      hasSaveButton: true,
      onSave: handleSaveLanguage,
      items: [
        {
          icon: Globe,
          label: t('settings.language.interface', 'Język interfejsu'),
          description: t('settings.language.desc', 'Wybierz preferowany język'),
          type: 'select' as const,
          value: selectedLang,
          options: [
            { value: 'pl', label: 'Polski' },
            { value: 'en', label: 'English' },
            { value: 'uk', label: 'Українська' },
            { value: 'de', label: 'Deutsch' },
            { value: 'es', label: 'Español' },
            { value: 'it', label: 'Italiano' },
          ],
          onChange: setSelectedLang,
        },
      ],
    },

  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="omni-heading-3 text-[var(--omni-text)] mb-2">
          {t('settings.header.title', 'Ustawienia')}
        </h1>
        <p className="text-[var(--omni-text-muted)]">
          {t('settings.header.desc', 'Dostosuj aplikację do swoich potrzeb')}
        </p>
      </div>

      {/* Settings Groups */}
      {settingsGroups.map((group, groupIndex) => (
        <div key={groupIndex} className="omni-card p-6">
          <h3 className="font-semibold text-[var(--omni-text)] mb-4">
            {group.title}
          </h3>
          <div className="space-y-4">
            {group.items.map((item, itemIndex) => (
              <div
                key={itemIndex}
                className="flex items-center justify-between py-3 border-b border-border last:border-0"
              >
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-[var(--omni-lavender)] rounded-lg flex items-center justify-center">
                    <item.icon className="w-5 h-5 text-[var(--omni-text)]" />
                  </div>
                  <div>
                    <p className="font-medium text-[var(--omni-text)]">
                      {item.label}
                    </p>
                    <p className="text-sm text-[var(--omni-text-muted)]">
                      {item.description}
                    </p>
                  </div>
                </div>

                {item.type === 'toggle' && (
                  <button
                    onClick={() => item.onChange(!item.value)}
                    className={`w-12 h-6 rounded-full transition-colors relative ${
                      item.value ? 'bg-[var(--omni-accent)]' : 'bg-gray-300'
                    }`}
                  >
                    <span
                      className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${
                        item.value ? 'left-7' : 'left-1'
                      }`}
                    />
                  </button>
                )}

                {item.type === 'select' && (
                  <select
                    value={item.value}
                    onChange={(e) => item.onChange(e.target.value)}
                    className="px-4 py-2 bg-background border border-input rounded-lg text-[var(--omni-text)] focus:ring-2 focus:ring-primary/20 transition-all disabled:opacity-50"
                  >
                    {item.options?.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                )}

              </div>
            ))}
          </div>
          {group.hasSaveButton && (
            <div className="mt-6 flex justify-end">
              <button
                onClick={group.onSave}
                className="omni-btn-primary px-6 py-2"
              >
                {t('settings.language.save', 'Zapisz zmiany')}
              </button>
            </div>
          )}
        </div>
      ))}

      {/* Profile Link */}
      <div className="omni-card p-6">
        <h3 className="font-semibold text-[var(--omni-text)] mb-4">{t('settings.profile.title', 'Profil')}</h3>
        <div className="flex items-center justify-between">
          <div>
            <p className="font-medium text-[var(--omni-text)]">{t('settings.profile.data', 'Dane edukacyjne i profilowe')}</p>
            <p className="text-sm text-[var(--omni-text-muted)]">{t('settings.profile.desc', 'Edytuj dane profilu i informacje edukacyjne.')}</p>
          </div>
          <button 
            onClick={() => navigate('/app/profile')}
            className="omni-btn-secondary px-6 py-2"
          >
            {t('settings.profile.goTo', 'Przejdź do profilu')}
          </button>
        </div>
      </div>

      {/* Parent Dashboard Link */}
      {(user?.userRole === 'parent' || user?.userRole === 'guardian') && (
        <div className="omni-card p-6">
          <h3 className="font-semibold text-[var(--omni-text)] mb-4">{t('settings.parent.title', 'Dla rodzica / opiekuna')}</h3>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <p className="font-medium text-[var(--omni-text)]">{t('settings.parent.dashboard', 'Panel rodzica')}</p>
              <p className="text-sm text-[var(--omni-text-muted)]">{t('settings.parent.desc', 'Sprawdź status zgody i podstawowe informacje o postępach dziecka.')}</p>
            </div>
            <button 
              onClick={() => navigate('/app/parent')}
              className="omni-btn-secondary px-6 py-2 whitespace-nowrap"
            >
              {t('settings.parent.open', 'Otwórz Panel Rodzica')}
            </button>
          </div>
        </div>
      )}

      {/* Account Actions */}
      <div className="omni-card p-6">
        <h3 className="font-semibold text-[var(--omni-text)] mb-4">
          {t('settings.account.title', 'Konto')}
        </h3>
        <div className="space-y-3">
          <button 
            onClick={() => setIsDeleteDialogOpen(true)}
            className="w-full flex items-center gap-4 p-4 bg-muted hover:bg-destructive/10 border border-transparent hover:border-destructive/30 rounded-xl transition-colors"
          >
            <div className="w-10 h-10 bg-red-100 dark:bg-red-900/30 rounded-lg flex items-center justify-center">
              <Trash2 className="w-5 h-5 text-red-500" />
            </div>
            <div className="flex-1 text-left">
              <p className="font-medium text-red-500">{t('settings.account.delete', 'Usuń konto')}</p>
              <p className="text-sm text-muted-foreground">
                {t('settings.account.deleteDesc', 'Tej akcji nie można cofnąć')}
              </p>
            </div>
          </button>

          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-4 p-4 bg-muted hover:bg-muted/80 border border-transparent hover:border-border rounded-xl transition-colors"
          >
            <div className="w-10 h-10 bg-secondary dark:bg-slate-700 rounded-lg flex items-center justify-center">
              <LogOut className="w-5 h-5 text-foreground" />
            </div>
            <div className="flex-1 text-left">
              <p className="font-medium text-foreground">{t('settings.account.logout', 'Wyloguj się')}</p>
              <p className="text-sm text-muted-foreground">
                {t('settings.account.logoutDesc', 'Zakończ sesję')}
              </p>
            </div>
          </button>
        </div>
      </div>

      {/* Privacy */}
      <div className="omni-card p-6">
        <h3 className="font-semibold text-[var(--omni-text)] mb-4 flex items-center gap-2">
          <Shield className="w-5 h-5" />
          {t('settings.privacy.title', 'Prywatność')}
        </h3>
        <p className="text-sm text-[var(--omni-text-muted)] mb-4">
          {t('settings.privacy.desc1', 'Twoje dane są bezpieczne. Nie udostępniamy ich osobom trzecim. Przeczytaj naszą')}{' '}
          <Link to="/polityka-prywatnosci" className="text-[var(--omni-accent)] hover:underline">
            {t('settings.privacy.desc2', 'Politykę prywatności')}
          </Link>
          .
        </p>
      </div>

      {/* Version */}
      <div className="text-center text-sm text-[var(--omni-text-muted)]">
        OmniNauka v1.0.0
      </div>

      {/* Delete Account Modal */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="w-5 h-5" />
              Usuwanie konta
            </DialogTitle>
            <DialogDescription className="py-2">
              Ta akcja jest <strong>trwała i nieodwracalna</strong>. Twoje konto, historia nauki, quizy, fiszki oraz wszystkie przesłane materiały zostaną trwale usunięte z naszych serwerów.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <p className="text-sm font-medium">
                Aby potwierdzić, wpisz poniżej <span className="font-bold text-[var(--omni-text)]">USUŃ</span>:
              </p>
              <Input
                placeholder="USUŃ"
                value={deleteConfirmText}
                onChange={(e) => setDeleteConfirmText(e.target.value)}
                autoFocus
                className="uppercase"
                disabled={isDeleting}
              />
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setIsDeleteDialogOpen(false)}
              disabled={isDeleting}
              className="flex-1 sm:flex-none"
            >
              Anuluj
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteAccount}
              disabled={deleteConfirmText !== 'USUŃ' || isDeleting}
              className="flex-1 sm:flex-none"
            >
              {isDeleting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  Usuwanie...
                </>
              ) : (
                'Trwale usuń konto'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
