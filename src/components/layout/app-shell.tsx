import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../lib/auth-context';
import {
  LayoutDashboard,
  Upload,
  BookOpen,
  HelpCircle,
  MessageCircle,
  BarChart3,
  History,
  Settings,
  User,
  Menu,
  X,
  LogOut,
  ChevronRight,
  ShieldCheck,
  CreditCard,
} from 'lucide-react';
import OmniNaukaLogo from '../brand/OmniNaukaLogo';
import { useTranslation } from 'react-i18next';
import { getEffectivePlan } from '../../lib/plan-utils';

interface AppShellProps {
  children: React.ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  const { t } = useTranslation();
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const navItems = [
    { label: t('appShell.nav.dashboard', 'Dashboard'), href: '/app/dashboard', icon: LayoutDashboard },
    { label: t('appShell.nav.upload', 'Upload'), href: '/app/upload', icon: Upload },
    { label: t('appShell.nav.flashcards', 'Fiszki'), href: '/app/flashcards', icon: BookOpen },
    { label: t('appShell.nav.quiz', 'Quiz'), href: '/app/quiz', icon: HelpCircle },
    { label: t('appShell.nav.lesson', 'Lekcja AI'), href: '/app/lesson', icon: MessageCircle },
    { label: t('appShell.nav.results', 'Wyniki'), href: '/app/results', icon: BarChart3 },
    { label: t('appShell.nav.history', 'Historia'), href: '/app/history', icon: History },
  ];

  const bottomNavItems = [
    { label: t('appShell.nav.payments', 'Płatności i plan'), href: '/app/payments', icon: CreditCard },
    { label: t('appShell.nav.profile', 'Profil'), href: '/app/profile', icon: User },
    { label: t('appShell.nav.settings', 'Ustawienia'), href: '/app/settings', icon: Settings },
  ];

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  // getActiveSessionId logic: URL (:id) > sessionStorage
  const getActiveSessionId = () => {
    // 1. Try to extract ID from URL (e.g., /app/analysis/123)
    const match = location.pathname.match(/\/app\/(analysis|flashcards|quiz|lesson)\/([^/]+)/);
    if (match && match[2]) return match[2];

    // 2. Fallback to sessionStorage
    return sessionStorage.getItem('currentSessionId');
  };

  const activeId = getActiveSessionId();

  const isParent = user?.userRole === 'parent' || user?.userRole === 'guardian';

  let baseNavItems = [];
  if (isParent) {
    baseNavItems = [
      { label: t('appShell.nav.parentPanel', 'Panel rodzica'), href: '/app/parent', icon: ShieldCheck as any }
    ];
  } else {
    baseNavItems = [...navItems];
  }

  const dynamicNavItems = baseNavItems.map(item => {
    // Only apply to learning modules based on href
    if (activeId && ['/app/flashcards', '/app/quiz', '/app/lesson'].includes(item.href)) {
      return { ...item, href: `${item.href}/${activeId}` };
    }
    return item;
  });

  const isActive = (href: string) => {
    // For dynamic routes, we want to match the base path too
    const basePath = href.split('/:id')[0].split('/').slice(0, 3).join('/');
    return location.pathname === href || (activeId && location.pathname.startsWith(basePath));
  };

  return (
    <div className="min-h-screen bg-[var(--omni-bg)] flex">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex flex-col w-64 bg-card h-screen sticky top-0 border-r border-border">
        {/* Logo */}
        <div className="p-6">
          <Link to="/app/dashboard" className="flex items-center">
            <OmniNaukaLogo size={40} />
          </Link>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-4 py-4 overflow-y-auto">
          <div className="space-y-1">
            {dynamicNavItems.map((item) => (
              <Link
                key={item.href}
                to={item.href}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
                  isActive(item.href)
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                }`}
              >
                <item.icon className="w-5 h-5" />
                <span className="font-medium">{item.label}</span>
              </Link>
            ))}
          </div>
        </nav>

        {/* Bottom Navigation */}
        <div className="p-4 border-t border-border">
          <div className="space-y-1 mb-4">
            {bottomNavItems.map((item) => (
              <Link
                key={item.href}
                to={item.href}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
                  isActive(item.href)
                    ? 'bg-[var(--omni-lavender)] text-[var(--omni-text)]'
                    : 'text-[var(--omni-text-muted)] hover:bg-gray-100 hover:text-[var(--omni-text)]'
                }`}
              >
                <item.icon className="w-5 h-5" />
                <span className="font-medium">{item.label}</span>
              </Link>
            ))}
          </div>

          {/* User */}
          <div className="flex items-center gap-3 px-4 py-3">
            <div className="w-10 h-10 rounded-full bg-[var(--omni-lavender)] flex items-center justify-center">
              <span className="font-semibold text-[var(--omni-text)]">
                {user?.name?.charAt(0) || 'U'}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-foreground truncate">
                {user?.name || t('appShell.user', 'Użytkownik')}
              </p>
              <p className="text-xs text-[var(--omni-text-muted)] truncate">
                {getEffectivePlan(user) === 'premium' 
                  ? t('appShell.plan.premium', 'Premium') 
                  : getEffectivePlan(user) === 'family'
                    ? t('appShell.plan.family', 'Rodzinny')
                    : t('appShell.plan.free', 'Darmowy')}
              </p>
            </div>
            <button
              onClick={handleLogout}
              className="p-2 text-[var(--omni-text-muted)] hover:text-red-500 transition-colors"
              title={t('appShell.logout', 'Wyloguj')}
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>
      </aside>

      {/* Mobile Header */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-50 bg-card border-b border-border shadow-sm">
        <div className="flex items-center justify-between px-4 py-3">
          <Link to="/app/dashboard" className="flex items-center">
            <OmniNaukaLogo size={32} />
          </Link>
          <button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="p-2 text-foreground hover:bg-muted rounded-lg transition-colors"
          >
            {isMobileMenuOpen ? (
              <X className="w-6 h-6" />
            ) : (
              <Menu className="w-6 h-6" />
            )}
          </button>
        </div>

        {/* Mobile Menu */}
        {isMobileMenuOpen && (
          <div className="absolute top-full left-0 right-0 bg-card border-b border-border shadow-xl animate-in slide-in-from-top-2">
            <nav className="p-4">
              <div className="space-y-1">
                {dynamicNavItems.map((item) => (
                  <Link
                    key={item.href}
                    to={item.href}
                    onClick={() => setIsMobileMenuOpen(false)}
                    className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
                      isActive(item.href)
                        ? 'bg-primary text-primary-foreground'
                        : 'text-muted-foreground hover:bg-muted'
                    }`}
                  >
                    <item.icon className="w-5 h-5" />
                    <span className="font-medium">{item.label}</span>
                    <ChevronRight className="w-4 h-4 ml-auto" />
                  </Link>
                ))}
              </div>
              <div className="mt-4 pt-4 border-t border-gray-100 space-y-1">
                {bottomNavItems.map((item) => (
                  <Link
                    key={item.href}
                    to={item.href}
                    onClick={() => setIsMobileMenuOpen(false)}
                    className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
                      isActive(item.href)
                        ? 'bg-secondary text-secondary-foreground'
                        : 'text-muted-foreground hover:bg-muted'
                    }`}
                  >
                    <item.icon className="w-5 h-5" />
                    <span className="font-medium">{item.label}</span>
                  </Link>
                ))}
                <button
                  onClick={handleLogout}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-red-500 hover:bg-red-50"
                >
                  <LogOut className="w-5 h-5" />
                  <span className="font-medium">{t('appShell.logout', 'Wyloguj')}</span>
                </button>
              </div>
            </nav>
          </div>
        )}
      </div>

      {/* Main Content */}
      <main className={`flex-1 min-h-screen-dvh lg:ml-0 pt-16 lg:pt-0 ${isActive('/app/lesson') ? 'h-screen-dvh flex flex-col overflow-hidden' : ''}`}>
        <div className={isActive('/app/lesson') 
          ? "flex-1 flex flex-col h-full w-full" 
          : "p-4 lg:p-8 max-w-6xl mx-auto"
        }>
          {children}
        </div>
      </main>
    </div>
  );
}
