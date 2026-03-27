import { Link } from 'react-router-dom';
import { useAuth } from '../../lib/auth-context';
import { mockDashboardSummary, mockStudySessions } from '../../mock/data';
import {
  Upload,
  BookOpen,
  HelpCircle,
  MessageCircle,
  TrendingUp,
  Clock,
  Award,
  Flame,
  ArrowRight,
  Calendar,
} from 'lucide-react';

export default function DashboardPage() {
  const { user } = useAuth();
  const summary = mockDashboardSummary;
  const recentSessions = mockStudySessions.slice(0, 3);

  const quickActions = [
    {
      label: 'Nowy upload',
      href: '/app/upload',
      icon: Upload,
      color: 'bg-[var(--omni-lavender)]',
    },
    {
      label: 'Fiszki',
      href: '/app/flashcards',
      icon: BookOpen,
      color: 'bg-[var(--omni-mint)]',
    },
    {
      label: 'Quiz',
      href: '/app/quiz',
      icon: HelpCircle,
      color: 'bg-[var(--omni-blush)]',
    },
    {
      label: 'Lekcja AI',
      href: '/app/lesson',
      icon: MessageCircle,
      color: 'bg-[var(--omni-sky)]',
    },
  ];

  const stats = [
    {
      label: 'Sesje nauki',
      value: summary.totalStudySessions,
      icon: Calendar,
      color: 'text-[var(--omni-accent)]',
    },
    {
      label: 'Godziny nauki',
      value: Math.round(summary.totalStudyTimeMinutes / 60),
      icon: Clock,
      color: 'text-blue-500',
    },
    {
      label: 'Średni wynik',
      value: `${summary.averageScore}%`,
      icon: TrendingUp,
      color: 'text-green-500',
    },
    {
      label: 'Streak',
      value: summary.currentStreak,
      icon: Flame,
      color: 'text-orange-500',
    },
  ];

  return (
    <div className="space-y-8">
      {/* Welcome Section */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="omni-heading-3 text-[var(--omni-text)] mb-1">
            Cześć, {user?.name || 'Użytkownik'}! 👋
          </h1>
          <p className="text-[var(--omni-text-muted)]">
            Gotowy na kolejną sesję nauki?
          </p>
        </div>
        <Link to="/app/upload" className="omni-btn-primary self-start">
          <Upload className="w-5 h-5" />
          Nowy upload
        </Link>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat, index) => (
          <div key={index} className="omni-card p-4 lg:p-6">
            <div className="flex items-center gap-3 mb-2">
              <stat.icon className={`w-5 h-5 ${stat.color}`} />
              <span className="text-sm text-[var(--omni-text-muted)]">
                {stat.label}
              </span>
            </div>
            <p className="text-2xl lg:text-3xl font-bold text-[var(--omni-text)]">
              {stat.value}
            </p>
          </div>
        ))}
      </div>

      {/* Quick Actions */}
      <div>
        <h2 className="font-semibold text-lg text-[var(--omni-text)] mb-4">
          Szybkie akcje
        </h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {quickActions.map((action, index) => (
            <Link
              key={index}
              to={action.href}
              className="omni-card p-4 lg:p-6 hover:shadow-lg transition-shadow group"
            >
              <div
                className={`w-12 h-12 ${action.color} rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform`}
              >
                <action.icon className="w-6 h-6 text-[var(--omni-text)]" />
              </div>
              <span className="font-medium text-[var(--omni-text)]">
                {action.label}
              </span>
            </Link>
          ))}
        </div>
      </div>

      {/* Recent Sessions */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-lg text-[var(--omni-text)]">
            Ostatnie sesje
          </h2>
          <Link
            to="/app/history"
            className="text-sm text-[var(--omni-accent)] hover:underline flex items-center gap-1"
          >
            Zobacz wszystkie
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

        {recentSessions.length > 0 ? (
          <div className="space-y-3">
            {recentSessions.map((session) => (
              <div
                key={session.id}
                className="omni-card p-4 flex items-center justify-between"
              >
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-[var(--omni-lavender)] rounded-xl flex items-center justify-center">
                    <Award className="w-6 h-6 text-[var(--omni-text)]" />
                  </div>
                  <div>
                    <p className="font-medium text-[var(--omni-text)]">
                      {session.analysis.subject}
                    </p>
                    <p className="text-sm text-[var(--omni-text-muted)]">
                      {session.analysis.topic}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-medium text-[var(--omni-text)]">
                    {session.totalTimeMinutes} min
                  </p>
                  <p className="text-sm text-green-500">Ukończono</p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="omni-card p-8 text-center">
            <p className="text-[var(--omni-text-muted)] mb-4">
              Nie masz jeszcze żadnych sesji nauki.
            </p>
            <Link to="/app/upload" className="omni-btn-primary">
              <Upload className="w-5 h-5" />
              Rozpocznij naukę
            </Link>
          </div>
        )}
      </div>

      {/* Subject Progress */}
      <div>
        <h2 className="font-semibold text-lg text-[var(--omni-text)] mb-4">
          Postępy w przedmiotach
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {summary.subjectProgress.map((subject, index) => (
            <div key={index} className="omni-card p-4">
              <div className="flex items-center justify-between mb-3">
                <span className="font-medium text-[var(--omni-text)]">
                  {subject.subject}
                </span>
                <span
                  className={`text-sm font-medium ${
                    subject.averageScore >= 80
                      ? 'text-green-500'
                      : subject.averageScore >= 60
                      ? 'text-yellow-500'
                      : 'text-orange-500'
                  }`}
                >
                  {subject.averageScore}%
                </span>
              </div>
              <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full ${
                    subject.averageScore >= 80
                      ? 'bg-green-500'
                      : subject.averageScore >= 60
                      ? 'bg-yellow-500'
                      : 'bg-orange-500'
                  }`}
                  style={{ width: `${subject.averageScore}%` }}
                />
              </div>
              <p className="text-xs text-[var(--omni-text-muted)] mt-2">
                {subject.totalSessions} sesji • {Math.round(subject.totalTimeMinutes / 60)}h
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
