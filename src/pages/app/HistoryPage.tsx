import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { mockStudySessions } from '../../mock/data';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/auth-context';
import { Calendar, Clock, Award, BookOpen, TrendingUp, ArrowRight } from 'lucide-react';

export default function HistoryPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [sessions, setSessions] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user || user.id === '1') {
      setSessions(mockStudySessions);
      setIsLoading(false);
      return;
    }

    const fetchHistory = async () => {
      try {
        const { data, error: dbError } = await supabase
          .from('study_sessions')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false });

        if (dbError) throw dbError;
        setSessions(data || []);
      } catch (err: any) {
        console.error("History fetch error:", err);
        setError("Nie udało się załadować historii nauki.");
      } finally {
        setIsLoading(false);
      }
    };

    fetchHistory();
  }, [user]);

  const formatDate = (dateString: string) => {
    return new Intl.DateTimeFormat('pl-PL', {
      day: 'numeric', month: 'long', year: 'numeric',
    }).format(new Date(dateString));
  };

  const handleOpenSession = (sessionId: string) => {
    sessionStorage.setItem('currentSessionId', sessionId);
    navigate('/app/analysis');
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
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

  if (sessions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <div className="w-16 h-16 bg-[var(--omni-lavender)] rounded-2xl flex items-center justify-center mb-6">
          <Calendar className="w-8 h-8 text-[var(--omni-text)]" />
        </div>
        <h2 className="omni-heading-3 text-[var(--omni-text)] mb-2">Brak historii</h2>
        <p className="text-[var(--omni-text-muted)] mb-6 text-center max-w-md">
          Nie masz jeszcze żadnych przeanalizowanych sesji.
        </p>
        <Link to="/app/upload" className="omni-btn-primary">
          <BookOpen className="w-5 h-5" /> Rozpocznij naukę
        </Link>
      </div>
    );
  }

  // Pre-calculations for Top HUD stats
  const uniqueSubjects = new Set(sessions.map(s => s.subject || (s.analysis && s.analysis.subject) || 'Nieznany')).size;
  const totalProxyMinutes = sessions.length * 15;

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="omni-heading-3 text-[var(--omni-text)] mb-1">Historia nauki</h1>
          <p className="text-[var(--omni-text-muted)]">Twoje wszystkie sesje analizy</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-[var(--omni-text-muted)] font-medium bg-slate-100 dark:bg-slate-800 px-3 py-1 rounded-full">
            Łącznie: {sessions.length} sesji
          </span>
        </div>
      </div>

      {/* Stats Summary Area */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="omni-card p-4">
          <Calendar className="w-5 h-5 text-[var(--omni-accent)] mb-2" />
          <p className="text-2xl font-bold text-[var(--omni-text)]">{sessions.length}</p>
          <p className="text-sm text-[var(--omni-text-muted)]">Sesji</p>
        </div>
        <div className="omni-card p-4">
          <Clock className="w-5 h-5 text-blue-500 mb-2" />
          <p className="text-2xl font-bold text-[var(--omni-text)]">{Math.round(totalProxyMinutes / 60)}h</p>
          <p className="text-sm text-[var(--omni-text-muted)]">Czas nauki</p>
        </div>
        <div className="omni-card p-4">
          <Award className="w-5 h-5 text-green-500 mb-2" />
          <p className="text-2xl font-bold text-[var(--omni-text)]">15m</p>
          <p className="text-sm text-[var(--omni-text-muted)]">Średnio/sesję</p>
        </div>
        <div className="omni-card p-4">
          <TrendingUp className="w-5 h-5 text-orange-500 mb-2" />
          <p className="text-2xl font-bold text-[var(--omni-text)]">{uniqueSubjects}</p>
          <p className="text-sm text-[var(--omni-text-muted)]">Przedmiotów</p>
        </div>
      </div>

      {/* Sessions Table Mapping */}
      <div className="space-y-3">
        {sessions.map((session) => (
          <div
            key={session.id}
            onClick={() => handleOpenSession(session.id)}
            className="omni-card p-4 lg:p-6 hover:shadow-lg hover:border-indigo-200 dark:hover:border-indigo-800 transition-all cursor-pointer group"
          >
            <div className="flex flex-col lg:flex-row lg:items-center gap-4">
              <div className="w-12 h-12 bg-[var(--omni-lavender)] rounded-xl flex items-center justify-center flex-shrink-0">
                <BookOpen className="w-6 h-6 text-[var(--omni-text)] group-hover:scale-110 transition-transform" />
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2 mb-1">
                  <span className="omni-chip bg-[var(--omni-lavender)] text-[var(--omni-text)] text-xs font-semibold">
                    {session.subject || (session.analysis && session.analysis.subject) || "Brak przedmiotu"}
                  </span>
                  <span className="text-sm text-[var(--omni-text-muted)]">
                    {formatDate(session.created_at || session.startedAt)}
                  </span>
                </div>
                <h3 className="font-medium text-[var(--omni-text)] truncate text-lg">
                  {session.topic || (session.analysis && session.analysis.topic) || "Aplikacja generuje tytuł..."}
                </h3>
                {session.summary && (
                  <p className="text-sm text-slate-500 mt-1 line-clamp-1">{session.summary}</p>
                )}
                
                <div className="flex items-center gap-4 mt-3 text-sm text-[var(--omni-text-muted)]">
                  <span className="flex items-center gap-1">
                    <Award className="w-4 h-4 text-emerald-500" />
                    {(session.flashcards || (session.analysis && session.analysis.flashcards) || []).length} fiszek
                  </span>
                  <span className="flex items-center gap-1">
                    <TrendingUp className="w-4 h-4 text-orange-500" />
                    {(session.quiz_questions || (session.analysis && session.analysis.quizQuestions) || []).length} pytań
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2 mt-4 lg:mt-0">
                <span className="px-3 py-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded-full text-xs font-medium uppercase tracking-wider">
                  Ukończono
                </span>
                <div className="p-2 text-[var(--omni-accent)] bg-slate-50 dark:bg-slate-800 group-hover:bg-indigo-100 dark:group-hover:bg-indigo-900 rounded-lg transition-colors">
                  <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
