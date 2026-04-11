import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { mockStudySessions } from '../../mock/data';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/auth-context';
import { Calendar, Clock, Award, BookOpen, TrendingUp, ArrowRight, Trash2, Pencil, Check, X } from 'lucide-react';

// ─── Lesson title inline editor ───────────────────────────────────────────────
function LessonTitleEditor({
  sessionId,
  initialTitle,
  onSaved,
}: {
  sessionId: string;
  initialTitle: string;
  onSaved: (newTitle: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(initialTitle);
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  const handleSave = async () => {
    if (saving) return;
    const trimmed = value.trim();
    setSaving(true);
    try {
      const { error } = await supabase
        .from('study_sessions')
        .update({ lesson_title: trimmed || null })
        .eq('id', sessionId);
      if (error) throw error;
      onSaved(trimmed);
      setEditing(false);
    } catch (err) {
      console.error('Lesson title save failed:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSave();
    if (e.key === 'Escape') { setValue(initialTitle); setEditing(false); }
  };

  if (editing) {
    return (
      <div className="flex items-center gap-2 mb-2" onClick={e => e.stopPropagation()}>
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={e => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          maxLength={80}
          placeholder="Nazwa lekcji..."
          className="flex-1 text-sm border border-indigo-300 rounded-lg px-3 py-1.5 outline-none focus:ring-2 focus:ring-indigo-400 bg-white text-[var(--omni-text)]"
        />
        <button
          onClick={handleSave}
          disabled={saving}
          className="p-1.5 rounded-lg bg-indigo-100 hover:bg-indigo-200 text-indigo-700 transition-colors disabled:opacity-50"
          title="Zapisz"
        >
          <Check className="w-4 h-4" />
        </button>
        <button
          onClick={() => { setValue(initialTitle); setEditing(false); }}
          className="p-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-600 transition-colors"
          title="Anuluj"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={e => { e.stopPropagation(); setEditing(true); }}
      className="flex items-center gap-1.5 mb-2 group/title"
      title="Kliknij, aby edytować nazwę lekcji"
    >
      <span className={`text-xs font-medium ${value ? 'text-indigo-600 dark:text-indigo-400' : 'text-[var(--omni-text-muted)] italic'}`}>
        {value || 'Bez nazwy'}
      </span>
      <Pencil className="w-3 h-3 text-[var(--omni-text-muted)] opacity-0 group-hover/title:opacity-100 transition-opacity" />
    </button>
  );
}

// ─── Delete confirmation dialog ────────────────────────────────────────────────
function DeleteConfirmDialog({
  onConfirm,
  onCancel,
  isDeleting,
}: {
  onConfirm: () => void;
  onCancel: () => void;
  isDeleting: boolean;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
      onClick={onCancel}
    >
      <div
        className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl p-6 max-w-sm w-full mx-4 border border-gray-100 dark:border-slate-700"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-center w-14 h-14 rounded-full bg-red-100 mx-auto mb-4">
          <Trash2 className="w-7 h-7 text-red-600" />
        </div>
        <h3 className="text-lg font-semibold text-center text-[var(--omni-text)] mb-2">Usuń sesję?</h3>
        <p className="text-sm text-center text-[var(--omni-text-muted)] mb-6">
          Sesja zostanie usunięta z Twojego konta. Tej operacji nie można cofnąć.
        </p>
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            disabled={isDeleting}
            className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 text-[var(--omni-text)] font-medium hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            Anuluj
          </button>
          <button
            onClick={onConfirm}
            disabled={isDeleting}
            className="flex-1 px-4 py-2.5 rounded-xl bg-red-600 text-white font-medium hover:bg-red-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {isDeleting ? (
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <Trash2 className="w-4 h-4" />
            )}
            Usuń
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main HistoryPage ──────────────────────────────────────────────────────────
export default function HistoryPage() {
  const { user, isDemoMode } = useAuth();
  const navigate = useNavigate();
  const [sessions, setSessions] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  useEffect(() => {
    if (!user || isDemoMode) {
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
          .is('deleted_at', null)          // Sprint 1: filter out soft-deleted
          .order('created_at', { ascending: false });

        if (dbError) throw dbError;
        setSessions(data || []);
      } catch (err: any) {
        console.error("History fetch error:", err);
        setError(`Nie udało się załadować historii nauki: ${err.message || 'Błąd sieci.'}`);
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

  const handleDeleteConfirm = async () => {
    if (!confirmDeleteId || isDemoMode) return;

    setDeletingId(confirmDeleteId);
    setDeleteError(null);

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
        body: JSON.stringify({ sessionId: confirmDeleteId }),
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Status ${response.status}: ${errText}`);
      }

      // Optimistic removal from local state
      setSessions(prev => prev.filter(s => s.id !== confirmDeleteId));
    } catch (err: any) {
      console.error('Delete session failed:', err);
      setDeleteError('Nie udało się usunąć sesji. Spróbuj ponownie.');
    } finally {
      setDeletingId(null);
      setConfirmDeleteId(null);
    }
  };

  const handleLessonTitleSaved = (sessionId: string, newTitle: string) => {
    setSessions(prev =>
      prev.map(s => s.id === sessionId ? { ...s, lesson_title: newTitle || null } : s)
    );
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

  const uniqueSubjects = new Set(sessions.map(s => s.subject || (s.analysis && s.analysis.subject) || 'Nieznany')).size;
  const totalProxyMinutes = sessions.length * 15;

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Delete confirmation dialog */}
      {confirmDeleteId && (
        <DeleteConfirmDialog
          onConfirm={handleDeleteConfirm}
          onCancel={() => setConfirmDeleteId(null)}
          isDeleting={!!deletingId}
        />
      )}

      {/* Delete error toast */}
      {deleteError && (
        <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl flex items-center justify-between">
          <span className="text-sm">{deleteError}</span>
          <button onClick={() => setDeleteError(null)} className="ml-4 text-red-500 hover:text-red-700">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

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

      {/* Sessions List */}
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
                {/* Lesson title editor — demo mode is read-only */}
                {!isDemoMode ? (
                  <LessonTitleEditor
                    sessionId={session.id}
                    initialTitle={session.lesson_title || ''}
                    onSaved={(newTitle) => handleLessonTitleSaved(session.id, newTitle)}
                  />
                ) : (
                  <span className="text-xs font-medium text-[var(--omni-text-muted)] italic mb-2 block">
                    {session.lesson_title || 'Bez nazwy'}
                  </span>
                )}

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

                {/* Delete button — hidden in demo mode */}
                {!isDemoMode && (
                  <button
                    onClick={e => { e.stopPropagation(); setConfirmDeleteId(session.id); }}
                    disabled={deletingId === session.id}
                    className="p-2 rounded-lg text-red-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors disabled:opacity-50"
                    title="Usuń sesję"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}

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
