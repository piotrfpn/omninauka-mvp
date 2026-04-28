import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../lib/auth-context';
import { 
  UserCircle, 
  School, 
  GraduationCap, 
  MapPin, 
  Loader2, 
  CheckCircle2,
  ArrowRight
} from 'lucide-react';
import { toast } from 'sonner';

const USER_ROLES = [
  { value: 'student', label: 'Uczeń' },
  { value: 'parent', label: 'Rodzic/opiekun' },
  { value: 'teacher', label: 'Nauczyciel' },
  { value: 'other', label: 'Inne' },
  { value: 'prefer_not_to_say', label: 'Nie chcę podawać' },
];

const SCHOOL_TYPES = [
  { value: 'primary_school', label: 'Szkoła podstawowa' },
  { value: 'high_school', label: 'Liceum ogólnokształcące' },
  { value: 'technical_school', label: 'Technikum' },
  { value: 'vocational_school_1', label: 'Szkoła branżowa I stopnia' },
  { value: 'vocational_school_2', label: 'Szkoła branżowa II stopnia' },
  { value: 'post_secondary', label: 'Szkoła policealna' },
  { value: 'homeschooling', label: 'Edukacja domowa' },
  { value: 'other', label: 'Inna' },
  { value: 'prefer_not_to_say', label: 'Nie chcę podawać' },
];

const EDUCATION_LEVELS = [
  { value: 'primary_1_3', label: 'Klasy 1–3 szkoły podstawowej' },
  { value: 'primary_4_6', label: 'Klasy 4–6 szkoły podstawowej' },
  { value: 'primary_7_8', label: 'Klasy 7–8 szkoły podstawowej' },
  { value: 'secondary_1', label: 'Szkoła średnia, klasa 1' },
  { value: 'secondary_2', label: 'Szkoła średnia, klasa 2' },
  { value: 'secondary_3', label: 'Szkoła średnia, klasa 3' },
  { value: 'secondary_4', label: 'Szkoła średnia, klasa 4' },
  { value: 'secondary_5', label: 'Szkoła średnia, klasa 5' },
  { value: 'other', label: 'Inne' },
  { value: 'prefer_not_to_say', label: 'Nie chcę podawać' },
];

export default function CompleteProfilePage() {
  const { user, updateProfile } = useAuth();
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  
  const [formData, setFormData] = useState({
    userRole: user?.userRole || '',
    schoolType: user?.schoolType || '',
    educationLevel: user?.educationLevel || '',
    postalCode: user?.postalCode || '',
  });

  const [postalError, setPostalError] = useState('');

  const validatePostalCode = (code: string) => {
    if (!code) return true;
    const regex = /^\d{2}-\d{3}$/;
    return regex.test(code);
  };

  const handlePostalChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value.replace(/[^\d-]/g, '');
    if (value.length === 2 && !value.includes('-')) {
      value += '-';
    }
    if (value.length > 6) value = value.substring(0, 6);
    
    setFormData(prev => ({ ...prev, postalCode: value }));
    
    if (value && !validatePostalCode(value)) {
      setPostalError('Format: XX-XXX (np. 60-142)');
    } else {
      setPostalError('');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.postalCode && !validatePostalCode(formData.postalCode)) {
      setPostalError('Format: XX-XXX (np. 60-142)');
      return;
    }

    setIsLoading(true);
    try {
      const result = await updateProfile({
        ...formData,
        profileCompleted: true,
        profileCompletedAt: new Date(),
      });

      if (result.success) {
        toast.success('Profil został zaktualizowany');
        navigate('/app/dashboard');
      } else {
        toast.error(result.error || 'Nie udało się zapisać danych');
      }
    } catch (error) {
      toast.error('Wystąpił błąd podczas zapisu');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSkip = () => {
    navigate('/app/dashboard');
  };

  return (
    <div className="min-h-screen bg-[var(--omni-bg)] py-12 px-6">
      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-10">
          <h1 className="omni-heading-2 mb-3">Dokończ swój profil</h1>
          <p className="text-[var(--omni-text-muted)] max-w-md mx-auto">
            Te dane pomagają nam dopasować materiały do Twojego poziomu edukacji. 
            Są one opcjonalne i możesz je zmienić później.
          </p>
        </div>

        <div className="omni-card p-8">
          <form onSubmit={handleSubmit} className="space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* User Role */}
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-sm font-medium text-[var(--omni-text)]">
                  <UserCircle className="w-4 h-4 text-[var(--omni-accent)]" />
                  Kim jesteś?
                </label>
                <select
                  className="omni-input bg-white cursor-pointer"
                  value={formData.userRole}
                  onChange={(e) => setFormData(prev => ({ ...prev, userRole: e.target.value }))}
                >
                  <option value="" disabled>Wybierz rolę...</option>
                  {USER_ROLES.map(role => (
                    <option key={role.value} value={role.value}>{role.label}</option>
                  ))}
                </select>
              </div>

              {/* School Type */}
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-sm font-medium text-[var(--omni-text)]">
                  <School className="w-4 h-4 text-[var(--omni-accent)]" />
                  Typ szkoły
                </label>
                <select
                  className="omni-input bg-white cursor-pointer"
                  value={formData.schoolType}
                  onChange={(e) => setFormData(prev => ({ ...prev, schoolType: e.target.value }))}
                >
                  <option value="" disabled>Wybierz typ...</option>
                  {SCHOOL_TYPES.map(school => (
                    <option key={school.value} value={school.value}>{school.label}</option>
                  ))}
                </select>
              </div>

              {/* Education Level */}
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-sm font-medium text-[var(--omni-text)]">
                  <GraduationCap className="w-4 h-4 text-[var(--omni-accent)]" />
                  Poziom edukacji
                </label>
                <select
                  className="omni-input bg-white cursor-pointer"
                  value={formData.educationLevel}
                  onChange={(e) => setFormData(prev => ({ ...prev, educationLevel: e.target.value }))}
                >
                  <option value="" disabled>Wybierz poziom...</option>
                  {EDUCATION_LEVELS.map(level => (
                    <option key={level.value} value={level.value}>{level.label}</option>
                  ))}
                </select>
              </div>

              {/* Postal Code */}
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-sm font-medium text-[var(--omni-text)]">
                  <MapPin className="w-4 h-4 text-[var(--omni-accent)]" />
                  Kod pocztowy (opcjonalnie)
                </label>
                <input
                  type="text"
                  placeholder="XX-XXX"
                  className={`omni-input ${postalError ? 'border-red-400' : ''}`}
                  value={formData.postalCode}
                  onChange={handlePostalChange}
                />
                {postalError && <p className="text-xs text-red-500">{postalError}</p>}
              </div>
            </div>

            <div className="p-4 bg-[var(--omni-lavender)] rounded-xl text-xs text-[var(--omni-text-muted)] border border-[var(--omni-accent)]/10">
              <p className="flex items-center gap-2">
                <CheckCircle2 className="w-3 h-3 text-[var(--omni-accent)]" />
                Minimalizacja danych: Nie zbieramy Twojego dokładnego adresu ani nazwy szkoły.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row items-center gap-4 pt-4">
              <button
                type="submit"
                disabled={isLoading || !!postalError}
                className="w-full sm:flex-1 omni-btn-primary py-4"
              >
                {isLoading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <>
                    Zapisz i kontynuuj
                    <ArrowRight className="w-5 h-5" />
                  </>
                )}
              </button>
              <button
                type="button"
                onClick={handleSkip}
                disabled={isLoading}
                className="w-full sm:w-auto px-8 py-4 text-[var(--omni-text-muted)] hover:text-[var(--omni-text)] font-medium transition-colors"
              >
                Pomiń
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
