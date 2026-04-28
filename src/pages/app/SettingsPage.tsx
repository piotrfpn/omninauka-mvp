import { useState } from 'react';
import { useAuth } from '../../lib/auth-context';
import { useNavigate } from 'react-router-dom';
import { Bell, Moon, Globe, Shield, Trash2, LogOut, AlertTriangle, Loader2, School, GraduationCap, MapPin, UserCircle } from 'lucide-react';
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
  const { user, logout, updateProfile } = useAuth();
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState(true);
  const [darkMode, setDarkMode] = useState(() => {
    return document.documentElement.classList.contains('dark');
  });
  const [language, setLanguage] = useState('pl');
  
  // Educational metadata state
  const [userRole, setUserRole] = useState(user?.userRole || '');
  const [schoolType, setSchoolType] = useState(user?.schoolType || '');
  const [educationLevel, setEducationLevel] = useState(user?.educationLevel || '');
  const [postalCode, setPostalCode] = useState(user?.postalCode || '');
  const [isUpdating, setIsUpdating] = useState(false);
  
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

  const handleUpdateEducational = async (field: string, value: string) => {
    // Local state update
    if (field === 'userRole') setUserRole(value);
    if (field === 'schoolType') setSchoolType(value);
    if (field === 'educationLevel') setEducationLevel(value);
    if (field === 'postalCode') {
      // Basic PL postal code formatting
      let formatted = value.replace(/[^\d-]/g, '');
      if (formatted.length === 2 && !formatted.includes('-')) formatted += '-';
      if (formatted.length > 6) formatted = formatted.substring(0, 6);
      setPostalCode(formatted);
      value = formatted;
    }

    setIsUpdating(true);
    try {
      const result = await updateProfile({ [field]: value });
      if (result.success) {
        toast.success("Zaktualizowano profil");
      } else {
        throw new Error(result.error);
      }
    } catch (err: any) {
      toast.error(err.message || "Nie udało się zaktualizować danych");
    } finally {
      setIsUpdating(false);
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
      
      toast.success("Konto zostało usunięte.");
      logout();
      navigate('/');
    } catch (err: any) {
      console.error('Account deletion failed:', err);
      toast.error(err.message || "Nie udało się usunąć konta. Spróbuj ponownie później.");
    } finally {
      setIsDeleting(false);
      setIsDeleteDialogOpen(false);
    }
  };

  const settingsGroups = [
    {
      title: 'Powiadomienia',
      items: [
        {
          icon: Bell,
          label: 'Włącz powiadomienia',
          description: 'Otrzymuj przypomnienia o sesjach nauki',
          type: 'toggle' as const,
          value: notifications,
          onChange: setNotifications,
        },
      ],
    },
    {
      title: 'Wygląd',
      items: [
        {
          icon: Moon,
          label: 'Tryb ciemny',
          description: 'Zmień motyw aplikacji',
          type: 'toggle' as const,
          value: darkMode,
          onChange: toggleDarkMode,
        },
      ],
    },
    {
      title: 'Język',
      items: [
        {
          icon: Globe,
          label: 'Język interfejsu',
          description: 'Wybierz preferowany język',
          type: 'select' as const,
          value: language,
          options: [
            { value: 'pl', label: 'Polski' },
            { value: 'en', label: 'English' },
          ],
          onChange: setLanguage,
        },
      ],
    },
    {
      title: 'Dane edukacyjne (opcjonalne)',
      items: [
        {
          icon: UserCircle,
          label: 'Kim jesteś?',
          description: 'Twoja rola w systemie',
          type: 'select' as const,
          value: userRole,
          options: [
            { value: '', label: 'Wybierz rolę...' },
            { value: 'student', label: 'Uczeń' },
            { value: 'parent', label: 'Rodzic/opiekun' },
            { value: 'teacher', label: 'Nauczyciel' },
            { value: 'other', label: 'Inne' },
            { value: 'prefer_not_to_say', label: 'Nie chcę podawać' },
          ],
          onChange: (val: string) => handleUpdateEducational('userRole', val),
        },
        {
          icon: School,
          label: 'Typ szkoły',
          description: 'Do jakiej szkoły uczęszczasz',
          type: 'select' as const,
          value: schoolType,
          options: [
            { value: '', label: 'Wybierz typ...' },
            { value: 'primary_school', label: 'Szkoła podstawowa' },
            { value: 'high_school', label: 'Liceum' },
            { value: 'technical_school', label: 'Technikum' },
            { value: 'vocational_school_1', label: 'Branżowa I st.' },
            { value: 'vocational_school_2', label: 'Branżowa II st.' },
            { value: 'post_secondary', label: 'Policealna' },
            { value: 'homeschooling', label: 'Edukacja domowa' },
            { value: 'other', label: 'Inna' },
            { value: 'prefer_not_to_say', label: 'Nie chcę podawać' },
          ],
          onChange: (val: string) => handleUpdateEducational('schoolType', val),
        },
        {
          icon: GraduationCap,
          label: 'Poziom edukacji',
          description: 'Twój aktualny etap nauki',
          type: 'select' as const,
          value: educationLevel,
          options: [
            { value: '', label: 'Wybierz poziom...' },
            { value: 'primary_1_3', label: 'Klasy 1-3' },
            { value: 'primary_4_6', label: 'Klasy 4-6' },
            { value: 'primary_7_8', label: 'Klasy 7-8' },
            { value: 'secondary_1', label: 'Liceum/Tech. kl. 1' },
            { value: 'secondary_2', label: 'Liceum/Tech. kl. 2' },
            { value: 'secondary_3', label: 'Liceum/Tech. kl. 3' },
            { value: 'secondary_4', label: 'Liceum/Tech. kl. 4' },
            { value: 'secondary_5', label: 'Technikum kl. 5' },
            { value: 'other', label: 'Inne' },
            { value: 'prefer_not_to_say', label: 'Nie chcę podawać' },
          ],
          onChange: (val: string) => handleUpdateEducational('educationLevel', val),
        },
        {
          icon: MapPin,
          label: 'Kod pocztowy',
          description: 'Format XX-XXX',
          type: 'input' as const,
          value: postalCode,
          onChange: (val: string) => handleUpdateEducational('postalCode', val),
        },
      ],
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="omni-heading-3 text-[var(--omni-text)] mb-2">
          Ustawienia
        </h1>
        <p className="text-[var(--omni-text-muted)]">
          Dostosuj aplikację do swoich potrzeb
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
                    disabled={isUpdating}
                    className="px-4 py-2 bg-background border border-input rounded-lg text-[var(--omni-text)] focus:ring-2 focus:ring-primary/20 transition-all disabled:opacity-50"
                  >
                    {item.options?.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                )}

                {item.type === 'input' && (
                  <input
                    type="text"
                    value={item.value}
                    onChange={(e) => item.onChange(e.target.value)}
                    disabled={isUpdating}
                    placeholder="XX-XXX"
                    className="w-24 px-4 py-2 bg-background border border-input rounded-lg text-[var(--omni-text)] text-center focus:ring-2 focus:ring-primary/20 transition-all disabled:opacity-50"
                  />
                )}
              </div>
            ))}
          </div>
        </div>
      ))}

      {/* Account Actions */}
      <div className="omni-card p-6">
        <h3 className="font-semibold text-[var(--omni-text)] mb-4">
          Konto
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
              <p className="font-medium text-red-500">Usuń konto</p>
              <p className="text-sm text-muted-foreground">
                Tej akcji nie można cofnąć
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
              <p className="font-medium text-foreground">Wyloguj się</p>
              <p className="text-sm text-muted-foreground">
                Zakończ sesję
              </p>
            </div>
          </button>
        </div>
      </div>

      {/* Privacy */}
      <div className="omni-card p-6">
        <h3 className="font-semibold text-[var(--omni-text)] mb-4 flex items-center gap-2">
          <Shield className="w-5 h-5" />
          Prywatność
        </h3>
        <p className="text-sm text-[var(--omni-text-muted)] mb-4">
          Twoje dane są bezpieczne. Nie udostępniamy ich osobom trzecim.
          Przeczytaj naszą{' '}
          <a href="#" className="text-[var(--omni-accent)] hover:underline">
            Politykę prywatności
          </a>
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
