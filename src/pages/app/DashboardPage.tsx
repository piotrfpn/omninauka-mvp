import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../lib/auth-context';
import { supabase } from '../../lib/supabase';
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
  Trash2,
} from 'lucide-react';

export default function DashboardPage() {
  const { user, isDemoMode } = useAuth();
  
  const [sessions, setSessions] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Stats derived from actual user data
  const [computedStats, setComputedStats] = useState({
    totalSessions: 0,
    totalTimeMinutes: 0,
    averageScore: 85, // Defaulted placeholder
    currentStreak: 2, // Defaulted placeholder
    subjectProgress: [] as any[]
  });

  useEffect(() => {
    if (!user || isDemoMode) {
      // 100% Mock Mode for Demo Account
      setSessions(mockStudySessions.slice(0, 3));
      setComputedStats({
        totalSessions: mockDashboardSummary.totalStudySessions,
        totalTimeMinutes: mockDashboardSummary.totalStudyTimeMinutes,
        averageScore: mockDashboardSummary.averageScore,
        currentStreak: mockDashboardSummary.currentStreak,
        subjectProgress: mockDashboardSummary.subjectProgress
      });
      setIsLoading(false);
      return;
    }

    const fetchDashboard = async () => {
      try {
        const { data, error: dbError } = await supabase
          .from('study_sessions')
          .select('*')
          .eq('user_id', user.id)
          .is('deleted_at', null)          // Sprint 1: filter soft-deleted
          .order('created_at', { ascending: false });

        if (dbError) throw dbError;

        const allSessions = data || [];
        setSessions(allSessions.slice(0, 3));

        // Aggregate actual data logically
        const groupedSubjects = allSessions.reduce((acc, sess) => {
          const sub = sess.subject || 'W trakcie analizy';
          if (!acc[sub]) acc[sub] = { count: 0 };
          acc[sub].count += 1;
          return acc;
        }, {} as Record<string, { count: number }>);

        const progressMap = Object.entries(groupedSubjects).map(([subject, stats]: [string, any]) => ({
          subject,
          averageScore: 80, // Static until Results integration
          totalSessions: stats.count,
          totalTimeMinutes: stats.count * 15 // Assuming ~15m generic per sprint 2C scope
        }));

        setComputedStats({
          totalSessions: allSessions.length,
          totalTimeMinutes: allSessions.length * 15,
          averageScore: 80,
          currentStreak: allSessions.length > 0 ? 1 : 0,
          subjectProgress: progressMap
        });

      } catch (err: any) {
        console.error("Dashboard DB fetch error:", err);
        setError("Nie udało się pobrać danych z chmury.");
      } finally {
        setIsLoading(false);
      }
    };

    fetchDashboard();
  }, [user]);

  const handleDeleteSession = async (e: React.MouseEvent, sessionId: string) => {
    e.stopPropagation();
    if (isDemoMode) return;
    if (!window.confirm('Czy na pewno chcesz usunąć tę sesję?')) return;

    setDeletingId(sessionId);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const functionUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/delete-session`;
      const response = await fetch(functionUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
          ...(session ? { 'Authorization': `Bearer ${session.access_token}` } : {}),
        },
        body: JSON.stringify({ sessionId }),
      });
      if (response.ok) {
        setSessions(prev => prev.filter(s => s.id !== sessionId));
      }
    } catch (err) {
      console.error('Delete session failed:', err);
    } finally {
      setDeletingId(null);
    }
  };

  const quickActions = [
    { label: 'Nowy upload', href: '/app/upload', icon: Upload, color: 'bg-[var(--omni-lavender)]' },
    { label: 'Fiszki', href: '/app/flashcards', icon: BookOpen, color: 'bg-[var(--omni-mint)]' },
    { label: 'Quiz', href: '/app/quiz', icon: HelpCircle, color: 'bg-[var(--omni-blush)]' },
    { label: 'Lekcja AI', href: '/app/lesson', icon: MessageCircle, color: 'bg-[var(--omni-sky)]' }
  ];

  const statCards = [
    { label: 'Sesje nauki', value: computedStats.totalSessions, icon: Calendar, color: 'text-[var(--omni-accent)]' },
    { label: 'Godziny nauki', value: Math.round(computedStats.totalTimeMinutes / 60), icon: Clock, color: 'text-blue-500' },
    { label: 'Średni wynik', value: `${computedStats.averageScore}%`, icon: TrendingUp, color: 'text-green-500' },
    { label: 'Streak', value: computedStats.currentStreak, icon: Flame, color: 'text-orange-500' }
  ];

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 bg-red-50 text-red-600 rounded-lg text-center">
        <p>{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
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
          <Upload className="w-5 h-5" /> Nowy upload
        </Link>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((stat, index) => (
          <div key={index} className="omni-card p-4 lg:p-6">
            <div className="flex items-center gap-3 mb-2">
              <stat.icon className={`w-5 h-5 ${stat.color}`} />
              <span className="text-sm text-[var(--omni-text-muted)]">{stat.label}</span>
            </div>
            <p className="text-2xl lg:text-3xl font-bold text-[var(--omni-text)]">{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Quick Actions */}
      <div>
        <h2 className="font-semibold text-lg text-[var(--omni-text)] mb-4">Szybkie akcje</h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {quickActions.map((action, index) => (
            <Link key={index} to={action.href} className="omni-card p-4 lg:p-6 hover:shadow-lg transition-shadow group">
              <div className={`w-12 h-12 ${action.color} rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform`}>
                <action.icon className="w-6 h-6 text-[var(--omni-text)]" />
              </div>
              <span className="font-medium text-[var(--omni-text)]">{action.label}</span>
            </Link>
          ))}
        </div>
      </div>

      {/* Recent Sessions List */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-lg text-[var(--omni-text)]">Ostatnie sesje</h2>
          <Link to="/app/history" className="text-sm text-[var(--omni-accent)] hover:underline flex items-center gap-1">
            Zobacz wszystkie <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

        {sessions.length > 0 ? (
          <div className="space-y-3">
            {sessions.map((session) => (
              <div key={session.id} className="omni-card p-4 flex items-center justify-between group cursor-pointer" onClick={() => {
                sessionStorage.setItem('currentSessionId', session.id);
                window.location.href = '/app/analysis';
              }}>
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-[var(--omni-lavender)] rounded-xl flex items-center justify-center">
                    <Award className="w-6 h-6 text-[var(--omni-text)] group-hover:scale-110 transition-transform" />
                  </div>
                  <div>
                    <p className="font-medium text-[var(--omni-text)]">
                       {session.subject || (session.analysis && session.analysis.subject) || 'Trwa Generowanie...'}
                    </p>
                    <p className="text-sm text-[var(--omni-text-muted)]">
                       {session.topic || (session.analysis && session.analysis.topic) || 'Przetwarzanie OCR'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <p className="text-sm text-green-500 font-medium">Ukończono</p>
                  {!isDemoMode && (
                    <button
                      onClick={e => handleDeleteSession(e, session.id)}
                      disabled={deletingId === session.id}
                      className="p-1.5 rounded-lg text-red-400 hover:text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50 opacity-0 group-hover:opacity-100"
                      title="Usuń sesję"
                    >
                      {deletingId === session.id
                        ? <div className="w-4 h-4 border-2 border-red-400/30 border-t-red-400 rounded-full animate-spin" />
                        : <Trash2 className="w-4 h-4" />}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="omni-card p-8 text-center bg-slate-50 border-dashed border-2">
            <p className="text-[var(--omni-text-muted)] mb-4">Nie masz jeszcze żadnych zapisanych sesji.</p>
            <Link to="/app/upload" className="omni-btn-primary mx-auto w-fit">
              <Upload className="w-5 h-5" /> Rozpocznij naukę
            </Link>
          </div>
        )}
      </div>

      {/* Subject Progress */}
      {computedStats.subjectProgress.length > 0 && (
        <div>
          <h2 className="font-semibold text-lg text-[var(--omni-text)] mb-4">Postępy w przedmiotach</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {computedStats.subjectProgress.map((subject, index) => (
              <div key={index} className="omni-card p-4">
                <div className="flex items-center justify-between mb-3">
                  <span className="font-medium text-[var(--omni-text)] truncate pr-2">{subject.subject}</span>
                  <span className={`text-sm font-medium text-green-500`}>
                    {subject.averageScore}%
                  </span>
                </div>
                <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-full rounded-full bg-green-500" style={{ width: `${subject.averageScore}%` }} />
                </div>
                <p className="text-xs text-[var(--omni-text-muted)] mt-2">
                  {subject.totalSessions} sesji • ok. {Math.round(subject.totalTimeMinutes / 60)}h
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
