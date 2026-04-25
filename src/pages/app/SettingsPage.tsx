import { useState } from 'react';
import { useAuth } from '../../lib/auth-context';
import { useNavigate } from 'react-router-dom';
import { Bell, Moon, Globe, Shield, Trash2, LogOut } from 'lucide-react';

export default function SettingsPage() {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState(true);
  const [darkMode, setDarkMode] = useState(() => {
    return document.documentElement.classList.contains('dark');
  });
  const [language, setLanguage] = useState('pl');

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
                className="flex items-center justify-between py-3 border-b border-gray-100 last:border-0"
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
                    className="px-4 py-2 bg-background border border-input rounded-lg text-[var(--omni-text)] focus:ring-2 focus:ring-primary/20 transition-all"
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
        </div>
      ))}

      {/* Account Actions */}
      <div className="omni-card p-6">
        <h3 className="font-semibold text-[var(--omni-text)] mb-4">
          Konto
        </h3>
        <div className="space-y-3">
          <button className="w-full flex items-center gap-4 p-4 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors">
            <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center">
              <Trash2 className="w-5 h-5 text-red-500" />
            </div>
            <div className="flex-1 text-left">
              <p className="font-medium text-red-500">Usuń konto</p>
              <p className="text-sm text-[var(--omni-text-muted)]">
                Tej akcji nie można cofnąć
              </p>
            </div>
          </button>

          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-4 p-4 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors"
          >
            <div className="w-10 h-10 bg-gray-200 rounded-lg flex items-center justify-center">
              <LogOut className="w-5 h-5 text-[var(--omni-text)]" />
            </div>
            <div className="flex-1 text-left">
              <p className="font-medium text-[var(--omni-text)]">Wyloguj się</p>
              <p className="text-sm text-[var(--omni-text-muted)]">
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
    </div>
  );
}
