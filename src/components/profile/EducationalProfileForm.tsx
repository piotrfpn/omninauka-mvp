import { useState } from 'react';
import { useAuth } from '../../lib/auth-context';
import { Loader2, School, GraduationCap, MapPin, UserCircle } from 'lucide-react';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';

export function EducationalProfileForm({ onSuccess }: { onSuccess?: () => void }) {
  const { t } = useTranslation();
  const { user, updateProfile } = useAuth();
  
  const [userRole, setUserRole] = useState(user?.userRole || '');
  const [schoolType, setSchoolType] = useState(user?.schoolType || '');
  const [educationLevel, setEducationLevel] = useState(user?.educationLevel || '');
  const [postalCode, setPostalCode] = useState(user?.postalCode || '');
  const [postalCodeError, setPostalCodeError] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);

  const handleSaveEducational = async () => {
    let normalizedPostal = postalCode.replace(/\D/g, '');
    
    if (normalizedPostal.length > 0 && normalizedPostal.length < 5) {
      setPostalCodeError(t('profile.educational.postalCodeError', 'Kod pocztowy powinien mieć 5 cyfr.'));
      return;
    }

    if (normalizedPostal.length === 5) {
      normalizedPostal = `${normalizedPostal.slice(0, 2)}-${normalizedPostal.slice(2)}`;
    }

    setPostalCode(normalizedPostal);
    setPostalCodeError('');
    setIsUpdating(true);

    try {
      const result = await updateProfile({
        userRole,
        schoolType,
        educationLevel,
        postalCode: normalizedPostal
      });

      if (result.success) {
        toast.success(t('profile.toast.saved', 'Dane profilu zostały zapisane.'));
        if (onSuccess) onSuccess();
      } else {
        throw new Error(result.error);
      }
    } catch (err: any) {
      toast.error(err.message || t('profile.toast.error', 'Nie udało się zapisać danych profilu.'));
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* User Role */}
      <div className="flex items-center justify-between py-3 border-b border-border">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 bg-[var(--omni-lavender)] rounded-lg flex items-center justify-center">
            <UserCircle className="w-5 h-5 text-[var(--omni-text)]" />
          </div>
          <div>
            <p className="font-medium text-[var(--omni-text)]">{t('profile.educational.role.label', 'Kim jesteś?')}</p>
            <p className="text-sm text-[var(--omni-text-muted)]">{t('profile.educational.role.desc', 'Twoja rola w systemie')}</p>
          </div>
        </div>
        <select
          value={userRole}
          onChange={(e) => setUserRole(e.target.value)}
          disabled={isUpdating}
          className="px-4 py-2 bg-background border border-input rounded-lg text-[var(--omni-text)] focus:ring-2 focus:ring-primary/20 transition-all disabled:opacity-50"
        >
          <option value="">{t('profile.educational.role.select', 'Wybierz rolę...')}</option>
          <option value="student">{t('profile.educational.role.student', 'Uczeń')}</option>
          <option value="parent">{t('profile.educational.role.parent', 'Rodzic/opiekun')}</option>
          <option value="teacher">{t('profile.educational.role.teacher', 'Nauczyciel')}</option>
          <option value="other">{t('profile.educational.role.other', 'Inne')}</option>
          <option value="prefer_not_to_say">{t('profile.educational.role.preferNotToSay', 'Nie chcę podawać')}</option>
        </select>
      </div>

      {/* School Type */}
      <div className="flex items-center justify-between py-3 border-b border-border">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 bg-[var(--omni-lavender)] rounded-lg flex items-center justify-center">
            <School className="w-5 h-5 text-[var(--omni-text)]" />
          </div>
          <div>
            <p className="font-medium text-[var(--omni-text)]">{t('profile.educational.school.label', 'Typ szkoły')}</p>
            <p className="text-sm text-[var(--omni-text-muted)]">{t('profile.educational.school.desc', 'Do jakiej szkoły uczęszczasz')}</p>
          </div>
        </div>
        <select
          value={schoolType}
          onChange={(e) => setSchoolType(e.target.value)}
          disabled={isUpdating}
          className="px-4 py-2 bg-background border border-input rounded-lg text-[var(--omni-text)] focus:ring-2 focus:ring-primary/20 transition-all disabled:opacity-50"
        >
          <option value="">{t('profile.educational.school.select', 'Wybierz typ...')}</option>
          <option value="primary_school">{t('profile.educational.school.primary', 'Szkoła podstawowa')}</option>
          <option value="high_school">{t('profile.educational.school.high', 'Liceum')}</option>
          <option value="technical_school">{t('profile.educational.school.technical', 'Technikum')}</option>
          <option value="vocational_school_1">{t('profile.educational.school.vocational1', 'Branżowa I st.')}</option>
          <option value="vocational_school_2">{t('profile.educational.school.vocational2', 'Branżowa II st.')}</option>
          <option value="post_secondary">{t('profile.educational.school.postSecondary', 'Policealna')}</option>
          <option value="homeschooling">{t('profile.educational.school.homeschooling', 'Edukacja domowa')}</option>
          <option value="other">{t('profile.educational.school.other', 'Inna')}</option>
          <option value="prefer_not_to_say">{t('profile.educational.school.preferNotToSay', 'Nie chcę podawać')}</option>
        </select>
      </div>

      {/* Education Level */}
      <div className="flex items-center justify-between py-3 border-b border-border">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 bg-[var(--omni-lavender)] rounded-lg flex items-center justify-center">
            <GraduationCap className="w-5 h-5 text-[var(--omni-text)]" />
          </div>
          <div>
            <p className="font-medium text-[var(--omni-text)]">{t('profile.educational.level.label', 'Poziom edukacji')}</p>
            <p className="text-sm text-[var(--omni-text-muted)]">{t('profile.educational.level.desc', 'Twój aktualny etap nauki')}</p>
          </div>
        </div>
        <select
          value={educationLevel}
          onChange={(e) => setEducationLevel(e.target.value)}
          disabled={isUpdating}
          className="px-4 py-2 bg-background border border-input rounded-lg text-[var(--omni-text)] focus:ring-2 focus:ring-primary/20 transition-all disabled:opacity-50"
        >
          <option value="">{t('profile.educational.level.select', 'Wybierz poziom...')}</option>
          <option value="primary_1_3">{t('profile.educational.level.primary13', 'Klasy 1-3')}</option>
          <option value="primary_4_6">{t('profile.educational.level.primary46', 'Klasy 4-6')}</option>
          <option value="primary_7_8">{t('profile.educational.level.primary78', 'Klasy 7-8')}</option>
          <option value="secondary_1">{t('profile.educational.level.secondary1', 'Liceum/Tech. kl. 1')}</option>
          <option value="secondary_2">{t('profile.educational.level.secondary2', 'Liceum/Tech. kl. 2')}</option>
          <option value="secondary_3">{t('profile.educational.level.secondary3', 'Liceum/Tech. kl. 3')}</option>
          <option value="secondary_4">{t('profile.educational.level.secondary4', 'Liceum/Tech. kl. 4')}</option>
          <option value="secondary_5">{t('profile.educational.level.secondary5', 'Technikum kl. 5')}</option>
          <option value="other">{t('profile.educational.level.other', 'Inne')}</option>
          <option value="prefer_not_to_say">{t('profile.educational.level.preferNotToSay', 'Nie chcę podawać')}</option>
        </select>
      </div>

      {/* Postal Code */}
      <div className="flex items-center justify-between py-3">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 bg-[var(--omni-lavender)] rounded-lg flex items-center justify-center">
            <MapPin className="w-5 h-5 text-[var(--omni-text)]" />
          </div>
          <div>
            <p className="font-medium text-[var(--omni-text)]">{t('profile.educational.postalCode.label', 'Kod pocztowy')}</p>
            <p className="text-sm text-[var(--omni-text-muted)]">{t('profile.educational.postalCode.desc', 'Opcjonalnie')}</p>
            {postalCodeError && (
              <p className="text-xs text-red-500 mt-1">{postalCodeError}</p>
            )}
          </div>
        </div>
        <div className="flex flex-col items-end gap-2">
          <input
            type="text"
            value={postalCode}
            onChange={(e) => {
              const digitsOnly = e.target.value.replace(/\D/g, '').substring(0, 5);
              setPostalCode(digitsOnly);
              setPostalCodeError('');
            }}
            disabled={isUpdating}
            placeholder="np. 60142"
            maxLength={6}
            className={`w-28 px-4 py-2 bg-background border rounded-lg text-[var(--omni-text)] text-center focus:ring-2 focus:ring-primary/20 transition-all disabled:opacity-50 ${
              postalCodeError ? 'border-red-400' : 'border-input'
            }`}
          />
        </div>
      </div>

      {/* Submit Button */}
      <div className="flex justify-end pt-4 mt-2 border-t border-border">
        <button
          onClick={handleSaveEducational}
          disabled={isUpdating}
          className="omni-btn-primary py-2 px-6 flex items-center gap-2"
        >
          {isUpdating && <Loader2 className="w-4 h-4 animate-spin" />}
          {t('common.saveChanges', 'Zapisz zmiany')}
        </button>
      </div>
    </div>
  );
}
