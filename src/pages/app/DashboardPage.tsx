import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
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
  ChevronRight,
} from 'lucide-react';
import { LessonTitleEditor } from '../../components/lessons/lesson-title-editor';
import { DashboardSkeleton } from '../../components/ui/page-skeletons';
import { useTranslation } from 'react-i18next';

export default function DashboardPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user, isDemoMode } = useAuth();
  
  useEffect(() => {
    if (user?.userRole === 'parent' || user?.userRole === 'guardian') {
      navigate('/app/parent', { replace: true });
    }
  }, [user, navigate]);
  
  const [sessions, setSessions] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Stats derived from actual user data
  const [computedStats, setComputedStats] = useState({
    totalSessions: 0,
    totalTimeMinutes: 0,
    averageScore: null as number | null,
    currentStreak: 0,
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
          .is('deleted_at', null)
          .order('created_at', { ascending: false });

        if (dbError) throw dbError;

        const allSessions = data || [];
        setSessions(allSessions.slice(0, 8)); 

        // Streak Calculation Logic (Local Day)
        const calculateStreak = (sessionsList: any[]) => {
          const completedDates = sessionsList
            .filter(s => s.quiz_result?.completed_at)
            .map(s => new Date(s.quiz_result.completed_at).toLocaleDateString('en-CA'));
          
          const uniqueDates = [...new Set(completedDates)].sort((a, b) => b.localeCompare(a));
          if (uniqueDates.length === 0) return 0;

          const today = new Date().toLocaleDateString('en-CA');
          const yesterday = new Date(Date.now() - 86400000).toLocaleDateString('en-CA');

          if (uniqueDates[0] !== today && uniqueDates[0] !== yesterday) return 0;

          let streak = 0;
          let checkDate = new Date(uniqueDates[0]);
          
          const dateSet = new Set(uniqueDates);
          while (dateSet.has(checkDate.toLocaleDateString('en-CA'))) {
            streak++;
            checkDate.setDate(checkDate.getDate() - 1);
          }
          return streak;
        };

        // Aggregate actual data logically
        const groupedSubjects = allSessions.reduce((acc, sess) => {
          const sub = sess.subject || t('dashboard.processing', 'W trakcie analizy');
          if (!acc[sub]) acc[sub] = { count: 0 };
          acc[sub].count += 1;
          return acc;
        }, {} as Record<string, { count: number }>);

        const progressMap = Object.entries(groupedSubjects).map(([subject, info]: [string, any]) => {
          const subjectSessions = allSessions.filter(s => (s.subject || t('dashboard.processing', 'W trakcie analizy')) === subject);
          const quizScores = subjectSessions
            .filter(s => s.quiz_result?.percentage !== undefined)
            .map(s => s.quiz_result.percentage);
          
          return {
            subject,
            averageScore: quizScores.length > 0 ? Math.round(quizScores.reduce((a, b) => a + b, 0) / quizScores.length) : null,
            totalSessions: info.count,
            totalTimeMinutes: info.count * 15
          };
        });

        const allQuizScores = allSessions
          .filter(s => s.quiz_result?.percentage !== undefined)
          .map(s => s.quiz_result.percentage);

        setComputedStats({
          totalSessions: allSessions.length,
          totalTimeMinutes: allSessions.length * 15,
          averageScore: allQuizScores.length > 0 ? Math.round(allQuizScores.reduce((a, b) => a + b, 0) / allQuizScores.length) : null,
          currentStreak: calculateStreak(allSessions),
          subjectProgress: progressMap
        });

      } catch (err: any) {
        console.error("Dashboard DB fetch error:", err);
        setError(t('dashboard.error', 'Nie udało się pobrać danych z chmury.'));
      } finally {
        setIsLoading(false);
      }
    };

    fetchDashboard();
  }, [user, t]);

  const handleDeleteSession = async (e: React.MouseEvent, sessionId: string) => {
    e.stopPropagation();
    if (isDemoMode) return;
    if (!window.confirm(t('dashboard.confirmDelete', 'Czy na pewno chcesz usunąć tę sesję?'))) return;

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
    { label: t('dashboard.quickActions.newUpload', 'Nowy upload'), href: '/app/upload', icon: Upload, color: 'bg-[var(--omni-lavender)]' },
    { label: t('appShell.nav.flashcards', 'Fiszki'), href: '/app/flashcards', icon: BookOpen, color: 'bg-[var(--omni-mint)]' },
    { label: t('appShell.nav.quiz', 'Quiz'), href: '/app/quiz', icon: HelpCircle, color: 'bg-[var(--omni-blush)]' },
    { label: t('appShell.nav.lesson', 'Lekcja AI'), href: '/app/lesson', icon: MessageCircle, color: 'bg-[var(--omni-sky)]' }
  ];

  const statCards = [
    { label: t('dashboard.stats.sessions', 'Sesje nauki'), value: computedStats.totalSessions, icon: Calendar, color: 'text-[var(--omni-accent)]' },
    { label: t('dashboard.stats.hours', 'Godziny nauki'), value: Math.round(computedStats.totalTimeMinutes / 60), icon: Clock, color: 'text-blue-500' },
    { 
      label: t('dashboard.stats.avgScore', 'Średni wynik quizów'), 
      value: computedStats.averageScore !== null ? `${computedStats.averageScore}%` : '—', 
      icon: TrendingUp, 
      color: 'text-green-500' 
    },
    { label: t('dashboard.stats.streak', 'Streak'), value: computedStats.currentStreak, icon: Flame, color: 'text-orange-500' }
  ];

  if (isLoading) {
    return <DashboardSkeleton />;
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
            {t('dashboard.welcome', 'Cześć')}, {user?.name?.split(' ')[0] || t('appShell.user', 'Użytkownik')}! 👋
          </h1>
          <p className="text-[var(--omni-text-muted)]">
            {t('dashboard.subtitle', 'Gotowy na kolejną sesję nauki?')}
          </p>
        </div>
        <Link to="/app/upload" className="omni-btn-primary self-start">
          <Upload className="w-5 h-5" /> {t('dashboard.newUpload', 'Nowy upload')}
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
        <h2 className="font-semibold text-lg text-[var(--omni-text)] mb-3">
          {t('dashboard.quickActions.title', 'Szybkie akcje')}
        </h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {quickActions.map((action, index) => (
            <Link
              key={index}
              to={action.href}
              className="omni-card p-4 lg:p-6 flex flex-col items-start gap-3 hover:shadow-lg active:scale-[0.97] transition-all group"
            >
              <div className={`w-12 h-12 ${action.color} rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform flex-shrink-0`}>
                <action.icon className="w-6 h-6 text-[var(--omni-text)]" />
              </div>
              <span className="font-semibold text-[var(--omni-text)] text-sm leading-tight">{action.label}</span>
            </Link>
          ))}
        </div>
      </div>

      {/* Recent Sessions List */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-lg text-[var(--omni-text)]">
            {t('dashboard.recentSessions', 'Ostatnie sesje')}
          </h2>
          <Link to="/app/history" className="text-sm text-[var(--omni-accent)] hover:underline flex items-center gap-1">
            {t('dashboard.seeAll', 'Zobacz wszystkie')} <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

        {sessions.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {Object.entries(
              sessions.reduce((acc, sess) => {
                const sub = sess.subject || (sess.analysis && sess.analysis.subject) || t('dashboard.other', 'Inne');
                if (!acc[sub]) acc[sub] = [];
                acc[sub].push(sess);
                return acc;
              }, {} as Record<string, any[]>)
            ).map(([subject, subjectSessions]: any) => (
              <div key={subject} className="space-y-4">
                <div className="flex items-center gap-2 px-1">
                   <div className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
                   <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider">{subject}</h3>
                </div>
                <div className="space-y-3">
                  {subjectSessions.map((session: any) => (
                    <div 
                      key={session.id} 
                      className="omni-card p-4 md:p-5 flex items-center justify-between group cursor-pointer hover:border-indigo-200 active:scale-[0.99] transition-all" 
                      onClick={() => {
                        sessionStorage.setItem('currentSessionId', session.id);
                        navigate('/app/analysis/' + session.id);
                      }}
                    >
                      <div className="flex items-center gap-3 md:gap-4 flex-1 min-w-0">
                        <div className="w-11 h-11 md:w-10 md:h-10 bg-[var(--omni-lavender)] rounded-xl md:rounded-lg flex items-center justify-center flex-shrink-0">
                          <Award className="w-5 h-5 text-[var(--omni-text)] group-hover:scale-110 transition-transform" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <LessonTitleEditor
                            sessionId={session.id}
                            initialTitle={session.lesson_title || ''}
                            onSaved={(newTitle) => {
                              setSessions(prev => prev.map(s => s.id === session.id ? { ...s, lesson_title: newTitle } : s));
                            }}
                            isDemoMode={isDemoMode}
                            className="mb-0.5"
                          />
                          <p className="text-xs text-[var(--omni-text-muted)] truncate">
                             {session.topic || (session.analysis && session.analysis.topic) || t('dashboard.processing', 'Przetwarzanie...')}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 ml-3">
                        {session.quiz_result && (
                          <div className={`px-2 py-0.5 rounded-lg text-xs font-bold border ${
                            session.quiz_result.percentage >= 80 
                              ? 'bg-green-50 text-green-700 border-green-100' 
                              : session.quiz_result.percentage >= 50 
                                ? 'bg-amber-50 text-amber-700 border-amber-100' 
                                : 'bg-red-50 text-red-700 border-red-100'
                          }`}>
                            {session.quiz_result.percentage}%
                          </div>
                        )}
                        {!isDemoMode && (
                          <button
                            onClick={e => handleDeleteSession(e, session.id)}
                            disabled={deletingId === session.id}
                            className="p-2.5 rounded-xl text-red-400 hover:text-red-600 hover:bg-red-50 active:scale-95 transition-all disabled:opacity-50 opacity-100 md:opacity-0 md:group-hover:opacity-100"
                            title={t('dashboard.deleteSession', 'Usuń sesję')}
                          >
                            {deletingId === session.id
                              ? <div className="w-4 h-4 border-2 border-red-400/30 border-t-red-400 rounded-full animate-spin" />
                              : <Trash2 className="w-4 h-4" />}
                          </button>
                        )}
                        <ChevronRight className="w-5 h-5 text-gray-300 group-hover:text-indigo-400 transition-colors flex-shrink-0" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="omni-card p-8 text-center bg-slate-50 border-dashed border-2">
            <p className="text-[var(--omni-text-muted)] mb-4">
              {t('dashboard.empty.title', 'Nie masz jeszcze żadnych zapisanych sesji.')}
            </p>
            <Link to="/app/upload" className="omni-btn-primary mx-auto w-fit">
              <Upload className="w-5 h-5" /> {t('dashboard.empty.cta', 'Rozpocznij naukę')}
            </Link>
          </div>
        )}
      </div>

      {/* Subject Progress */}
      {computedStats.subjectProgress.length > 0 && (
        <div>
          <h2 className="font-semibold text-lg text-[var(--omni-text)] mb-4">
            {t('dashboard.subjectProgress', 'Postępy w przedmiotach')}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {computedStats.subjectProgress.map((subject, index) => (
              <div key={index} className="omni-card p-4">
                <div className="flex items-center justify-between mb-3">
                  <span className="font-medium text-[var(--omni-text)] truncate pr-2">{subject.subject}</span>
                  <span className={`text-sm font-medium ${subject.averageScore !== null ? 'text-green-500' : 'text-gray-400'}`}>
                    {subject.averageScore !== null ? `${subject.averageScore}%` : '—'}
                  </span>
                </div>
                <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div 
                    className="h-full rounded-full bg-green-500 transition-all duration-1000" 
                    style={{ width: `${subject.averageScore || 0}%` }} 
                  />
                </div>
                <p className="text-xs text-[var(--omni-text-muted)] mt-2">
                  {subject.totalSessions} {t('dashboard.sessions', 'sesji')} • ok. {Math.round(subject.totalTimeMinutes / 60)}h
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
