import { useState, useEffect, useRef, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { mockStudySessions } from '../../mock/data';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/auth-context';
import { 
  Calendar, Clock, Award, BookOpen, TrendingUp, ArrowRight, Trash2, 
  Check, X, Search, Filter, Folder, 
  Home, ChevronRight, FolderPlus, ArrowRightLeft, 
  ChevronDown
} from 'lucide-react';
import { LessonTitleEditor } from '../../components/lessons/lesson-title-editor';
import { toast } from 'sonner';
import { HistorySkeleton } from '../../components/ui/page-skeletons';

// ─── Delete confirmation dialog ────────────────────────────────────────────────
function ConfirmDialog({
  title,
  message,
  confirmLabel,
  onConfirm,
  onCancel,
  isProcessing,
  variant = 'danger'
}: {
  title: string;
  message: string;
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
  isProcessing: boolean;
  variant?: 'danger' | 'info';
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
        <div className={`flex items-center justify-center w-14 h-14 rounded-full mx-auto mb-4 ${
          variant === 'danger' ? 'bg-red-100' : 'bg-indigo-100'
        }`}>
          {variant === 'danger' ? <Trash2 className="w-7 h-7 text-red-600" /> : <Folder className="w-7 h-7 text-indigo-600" />}
        </div>
        <h3 className="text-lg font-semibold text-center text-[var(--omni-text)] mb-2">{title}</h3>
        <p className="text-sm text-center text-[var(--omni-text-muted)] mb-6">{message}</p>
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            disabled={isProcessing}
            className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 text-[var(--omni-text)] font-medium hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors disabled:opacity-50"
          >
            Anuluj
          </button>
          <button
            onClick={onConfirm}
            disabled={isProcessing}
            className={`flex-1 px-4 py-2.5 rounded-xl text-white font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2 ${
              variant === 'danger' ? 'bg-red-600 hover:bg-red-700' : 'bg-indigo-600 hover:bg-indigo-700'
            }`}
          >
            {isProcessing ? (
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              variant === 'danger' ? <Trash2 className="w-4 h-4" /> : <Check className="w-4 h-4" />
            )}
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Recursive Folder Tree ────────────────────────────────────────────────────
function FolderTreeItem({
  folder,
  allFolders,
  level,
  onSelect,
  selectedId,
  currentLocationId
}: {
  folder: any;
  allFolders: any[];
  level: number;
  onSelect: (id: string | null) => void;
  selectedId: string | null;
  currentLocationId: string | null;
}) {
  const [isOpen, setIsOpen] = useState(true);
  const children = allFolders.filter(f => f.parent_id === folder.id);
  const isSelected = selectedId === folder.id;
  const isCurrent = currentLocationId === folder.id;

  return (
    <div className="space-y-1">
      <button
        onClick={() => !isCurrent && onSelect(folder.id)}
        disabled={isCurrent}
        className={`w-full flex items-center gap-2 p-2 rounded-xl transition-all ${
          isSelected ? 'bg-indigo-600 text-white shadow-md' : 
          isCurrent ? 'opacity-50 cursor-not-allowed bg-slate-100 dark:bg-slate-800' :
          'hover:bg-slate-100 dark:hover:bg-slate-800 text-[var(--omni-text)]'
        }`}
        style={{ paddingLeft: `${level * 1.25 + 0.5}rem` }}
      >
        <div className="flex items-center gap-2 flex-1 min-w-0">
          {children.length > 0 ? (
            <ChevronDown 
              className={`w-4 h-4 transition-transform ${!isOpen ? '-rotate-90' : ''}`} 
              onClick={(e) => { e.stopPropagation(); setIsOpen(!isOpen); }}
            />
          ) : (
            <div className="w-4 h-4" />
          )}
          <Folder className={`w-4 h-4 flex-shrink-0 ${isSelected ? 'fill-current' : 'text-indigo-500'}`} />
          <span className="truncate text-sm font-medium">{folder.name}</span>
        </div>
        {isCurrent && <span className="text-[10px] uppercase font-bold px-1.5 py-0.5 bg-slate-200 dark:bg-slate-700 rounded text-slate-500">Obecnie</span>}
      </button>

      {isOpen && children.map(child => (
        <FolderTreeItem
          key={child.id}
          folder={child}
          allFolders={allFolders}
          level={level + 1}
          onSelect={onSelect}
          selectedId={selectedId}
          currentLocationId={currentLocationId}
        />
      ))}
    </div>
  );
}

// ─── Move to Folder Modal ─────────────────────────────────────────────────────
function MoveModal({
  allFolders,
  currentLocationId,
  onConfirm,
  onCancel,
  isProcessing
}: {
  allFolders: any[];
  currentLocationId: string | null;
  onConfirm: (targetId: string | null) => void;
  onCancel: () => void;
  isProcessing: boolean;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(currentLocationId);
  const rootFolders = allFolders.filter(f => !f.parent_id);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={onCancel}>
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl p-6 max-w-sm w-full mx-4 border border-gray-100 dark:border-slate-700 flex flex-col max-h-[80vh]" onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-indigo-100 dark:bg-indigo-900/40 flex items-center justify-center">
            <ArrowRightLeft className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-[var(--omni-text)] leading-tight">Przenieś lekcję</h3>
            <p className="text-xs text-[var(--omni-text-muted)]">Wybierz docelowe miejsce</p>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto space-y-1 mb-6 pr-2 custom-scrollbar">
          {/* Root Option */}
          <button
            onClick={() => currentLocationId !== null && setSelectedId(null)}
            disabled={currentLocationId === null}
            className={`w-full flex items-center gap-2 p-3 rounded-xl transition-all ${
              selectedId === null && currentLocationId !== null ? 'bg-indigo-600 text-white shadow-md' : 
              currentLocationId === null ? 'opacity-50 cursor-not-allowed bg-slate-100 dark:bg-slate-800' :
              'hover:bg-slate-100 dark:hover:bg-slate-800 text-[var(--omni-text)]'
            }`}
          >
            <Home className={`w-4 h-4 ${selectedId === null && currentLocationId !== null ? 'text-white' : 'text-indigo-500'}`} />
            <span className="text-sm font-medium">Wszystkie lekcje (Root)</span>
            {currentLocationId === null && <span className="ml-auto text-[10px] uppercase font-bold px-1.5 py-0.5 bg-slate-200 dark:bg-slate-700 rounded text-slate-500">Obecnie</span>}
          </button>

          <div className="w-full h-px bg-slate-100 dark:bg-slate-800 my-2" />

          {/* Folder Tree */}
          {rootFolders.map(folder => (
            <FolderTreeItem
              key={folder.id}
              folder={folder}
              allFolders={allFolders}
              level={0}
              onSelect={setSelectedId}
              selectedId={selectedId}
              currentLocationId={currentLocationId}
            />
          ))}

          {allFolders.length === 0 && (
            <p className="text-center text-xs text-slate-400 py-4 italic">Brak folderów</p>
          )}
        </div>

        <div className="flex gap-3">
          <button onClick={onCancel} className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 text-[var(--omni-text)] font-medium">Anuluj</button>
          <button
            onClick={() => onConfirm(selectedId)}
            disabled={isProcessing || selectedId === currentLocationId}
            className="flex-1 px-4 py-2.5 rounded-xl bg-indigo-600 text-white font-medium hover:bg-indigo-700 disabled:opacity-50 transition-all flex items-center justify-center gap-2"
          >
            {isProcessing ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Check className="w-4 h-4" />}
            Przenieś
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Create Folder Modal ──────────────────────────────────────────────────────
function CreateFolderModal({
  onConfirm,
  onCancel,
  isProcessing
}: {
  onConfirm: (name: string) => void;
  onCancel: () => void;
  isProcessing: boolean;
}) {
  const [name, setName] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={onCancel}>
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl p-6 max-w-sm w-full mx-4 border border-gray-100 dark:border-slate-700" onClick={e => e.stopPropagation()}>
        <h3 className="text-lg font-semibold text-[var(--omni-text)] mb-4">Nowy folder</h3>
        <input
          ref={inputRef}
          type="text"
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="Nazwa folderu..."
          onKeyDown={e => e.key === 'Enter' && name.trim() && onConfirm(name.trim())}
          className="w-full px-4 py-2.5 bg-gray-50 dark:bg-slate-800 rounded-xl mb-6 outline-none ring-2 ring-transparent focus:ring-indigo-500/20 text-[var(--omni-text)]"
        />
        <div className="flex gap-3">
          <button onClick={onCancel} className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 text-[var(--omni-text)] font-medium">Anuluj</button>
          <button
            onClick={() => onConfirm(name.trim())}
            disabled={isProcessing || !name.trim()}
            className="flex-1 px-4 py-2.5 rounded-xl bg-indigo-600 text-white font-medium disabled:opacity-50"
          >
            {isProcessing ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin mx-auto" /> : 'Utwórz'}
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
  const [confirmDeleteFolderId, setConfirmDeleteFolderId] = useState<string | null>(null);
  const [movingSessionId, setMovingSessionId] = useState<string | null>(null);
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);
  const [isMutatingFolder, setIsMutatingFolder] = useState(false);
  const [isMoving, setIsMoving] = useState(false);
  const [_deleteError, setDeleteError] = useState<string | null>(null);

  // Sprint 4: Explorer state
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [allFolders, setAllFolders] = useState<any[]>([]);

  // Sprint 3: Search and Sort state
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('date_desc');

  const filteredAndSortedSessions = useMemo(() => {
    // Sprint 4: Filter sessions by folder context
    // UNLESS searching globally (if we want global search, we ignore folder_id when query is present)
    // For now, let's keep it scoped to current folder as requested
    let result = sessions.filter(s => (s.folder_id || null) === currentFolderId);

    // Sprint 3: Search
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = sessions.filter(s => // Global search across all folders if searching
        (s.lesson_title?.toLowerCase().includes(q)) ||
        (s.topic?.toLowerCase().includes(q)) ||
        (s.subject?.toLowerCase().includes(q)) ||
        (s.analysis?.topic?.toLowerCase().includes(q)) ||
        (s.analysis?.subject?.toLowerCase().includes(q))
      );
    }

    // Sprint 3: Sort
    result.sort((a, b) => {
      const dateA = new Date(a.created_at || a.startedAt || 0).getTime();
      const dateB = new Date(b.created_at || b.startedAt || 0).getTime();
      const titleA = (a.lesson_title || a.topic || a.analysis?.topic || '').toLowerCase();
      const titleB = (b.lesson_title || b.topic || b.analysis?.topic || '').toLowerCase();

      switch (sortBy) {
        case 'date_asc': return dateA - dateB;
        case 'title_asc': return titleA.localeCompare(titleB);
        case 'title_desc': return titleB.localeCompare(titleA);
        default: return dateB - dateA; // date_desc
      }
    });

    return result;
  }, [sessions, searchQuery, sortBy, currentFolderId]);

  // Sprint 4: Filter folders for current context
  const currentFolders = useMemo(() => {
    if (searchQuery.trim()) return []; // Hide folders during global search
    return allFolders.filter(f => (f.parent_id || null) === currentFolderId);
  }, [allFolders, currentFolderId, searchQuery]);

  // Sprint 4: Breadcrumb path
  const breadcrumbPath = useMemo(() => {
    if (!currentFolderId) return [];
    const path = [];
    let currentId: string | null = currentFolderId;
    while (currentId) {
      const folder = allFolders.find(f => f.id === currentId);
      if (folder) {
        path.unshift(folder);
        currentId = folder.parent_id || null;
      } else {
        currentId = null;
      }
    }
    return path;
  }, [allFolders, currentFolderId]);

  const groupedSessions = useMemo(() => {
    // Only group by date if sorting by date
    if (!sortBy.startsWith('date')) {
      return { 'Wszystkie sesje': filteredAndSortedSessions };
    }

    const groups: { [key: string]: any[] } = {
      'Dzisiaj': [],
      'Wczoraj': [],
      'Ostatnie 7 dni': [],
      'Starsze': []
    };

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const lastWeek = new Date(today);
    lastWeek.setDate(lastWeek.getDate() - 7);

    filteredAndSortedSessions.forEach(s => {
      const date = new Date(s.created_at || s.startedAt);
      if (date >= today) groups['Dzisiaj'].push(s);
      else if (date >= yesterday) groups['Wczoraj'].push(s);
      else if (date >= lastWeek) groups['Ostatnie 7 dni'].push(s);
      else groups['Starsze'].push(s);
    });

    // Remove empty groups
    return Object.fromEntries(Object.entries(groups).filter(([_, items]) => items.length > 0));
  }, [filteredAndSortedSessions, sortBy]);

  useEffect(() => {
    if (!user || isDemoMode) {
      setSessions(mockStudySessions);
      setAllFolders([]);
      setIsLoading(false);
      return;
    }

    const fetchData = async () => {
      try {
        // Fetch sessions
        const { data: sessionData, error: sessError } = await supabase
          .from('study_sessions')
          .select('*')
          .eq('user_id', user.id)
          .is('deleted_at', null)
          .order('created_at', { ascending: false });

        if (sessError) throw sessError;
        setSessions(sessionData || []);

        // Fetch folders
        const { data: folderData, error: foldError } = await supabase
          .from('folders')
          .select('*')
          .eq('user_id', user.id)
          .order('name', { ascending: true });

        if (foldError) throw foldError;
        setAllFolders(folderData || []);
      } catch (err: any) {
        console.error("History fetch error:", err);
        setError(`Nie udało się załadować historii nauki: ${err.message || 'Błąd sieci.'}`);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [user]);

  const formatDate = (dateString: string) => {
    return new Intl.DateTimeFormat('pl-PL', {
      day: 'numeric', month: 'long', year: 'numeric',
    }).format(new Date(dateString));
  };

  const handleOpenSession = (sessionId: string) => {
    sessionStorage.setItem('currentSessionId', sessionId);
    navigate(`/app/analysis/${sessionId}`);
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

  const handleFolderTitleSaved = (folderId: string, newName: string) => {
    setAllFolders(prev =>
      prev.map(f => f.id === folderId ? { ...f, name: newName } : f)
    );
  };

  const handleCreateFolder = async (name: string) => {
    if (!user || isDemoMode) {
      toast.error('Tryb demo: nie można utworzyć folderu');
      return;
    }
    setIsMutatingFolder(true);
    try {
      const { data, error } = await supabase
        .from('folders')
        .insert({ name, user_id: user.id, parent_id: currentFolderId })
        .select()
        .single();
      
      if (error) throw error;
      setAllFolders(prev => [...prev, data]);
      setIsCreatingFolder(false);
      toast.success('Folder został utworzony');
    } catch (err: any) {
      toast.error(`Błąd: ${err.message}`);
    } finally {
      setIsMutatingFolder(false);
    }
  };

  const handleDeleteFolder = async () => {
    if (!confirmDeleteFolderId || isDemoMode) return;
    setIsMutatingFolder(true);
    try {
      const { error } = await supabase
        .from('folders')
        .delete()
        .eq('id', confirmDeleteFolderId);
      
      if (error) throw error;
      
      // Update local state: remove folder and move its sessions to root
      setAllFolders(prev => prev.filter(f => f.id !== confirmDeleteFolderId));
      setSessions(prev => prev.map(s => s.folder_id === confirmDeleteFolderId ? { ...s, folder_id: null } : s));
      
      toast.success('Folder usunięty');
    } catch (err: any) {
      toast.error(`Błąd: ${err.message}`);
    } finally {
      setIsMutatingFolder(false);
      setConfirmDeleteFolderId(null);
    }
  };

  const handleMoveSession = async (targetFolderId: string | null) => {
    if (!movingSessionId || isDemoMode) return;
    setIsMoving(true);
    try {
      const { error } = await supabase
        .from('study_sessions')
        .update({ folder_id: targetFolderId })
        .eq('id', movingSessionId);
      
      if (error) throw error;
      
      // Optimistic locally update session
      setSessions(prev => 
        prev.map(s => s.id === movingSessionId ? { ...s, folder_id: targetFolderId } : s)
      );
      
      toast.success('Sesja przeniesiona');
      setMovingSessionId(null);
    } catch (err: any) {
      toast.error(`Błąd: ${err.message}`);
    } finally {
      setIsMoving(false);
    }
  };

  if (isLoading) {
    return <HistorySkeleton />;
  }

  if (error) {
    return (
      <div className="p-6 bg-red-50 text-red-600 rounded-lg text-center">
        <p>{error}</p>
      </div>
    );
  }

  // Sprint 4: Root Empty State (No sessions and no folders)
  if (sessions.length === 0 && allFolders.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <div className="w-16 h-16 bg-[var(--omni-lavender)] rounded-2xl flex items-center justify-center mb-6">
          <Calendar className="w-8 h-8 text-[var(--omni-text)]" />
        </div>
        <h2 className="omni-heading-3 text-[var(--omni-text)] mb-2">Brak historii</h2>
        <p className="text-[var(--omni-text-muted)] mb-6 text-center max-w-md">
          Nie masz jeszcze żadnych przeanalizowanych sesji ani folderów.
        </p>
        <Link to="/app/upload" className="omni-btn-primary">
          <BookOpen className="w-5 h-5" /> Rozpocznij naukę
        </Link>
      </div>
    );
  }

  const uniqueSubjects = new Set(filteredAndSortedSessions.map(s => s.subject || 'Nieznany')).size;
  const totalProxyMinutes = sessions.length * 15;

  const quizScores = sessions
    .filter(s => s.quiz_result?.percentage !== undefined)
    .map(s => s.quiz_result.percentage);
  
  const averageQuizScore = quizScores.length > 0
    ? Math.round(quizScores.reduce((a, b) => a + b, 0) / quizScores.length)
    : null;

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="omni-heading-3 text-[var(--omni-text)] mb-1">Historia nauki</h1>
          <p className="text-[var(--omni-text-muted)]">Twoje wszystkie sesje analizy</p>
        </div>
        <div className="flex items-center gap-2 sm:gap-3 flex-wrap sm:flex-nowrap">
          <button 
            onClick={() => setIsCreatingFolder(true)}
            className="omni-btn-primary py-2 px-4 text-sm flex items-center gap-2"
          >
            <FolderPlus className="w-4 h-4" /> Nowy folder
          </button>
          <div className="flex items-center gap-2">
            <span className="text-xs sm:text-sm text-[var(--omni-text-muted)] font-medium bg-slate-100 dark:bg-slate-800 px-3 py-2 rounded-xl whitespace-nowrap">
              {sessions.length} sesji
            </span>
            {averageQuizScore !== null && (
              <span className="text-xs sm:text-sm text-green-600 font-bold bg-green-50 dark:bg-green-950/30 px-3 py-2 rounded-xl border border-green-100 dark:border-green-900/30 whitespace-nowrap">
                Śr. wynik: {averageQuizScore}%
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Delete confirmation dialog for sessions */}
      {confirmDeleteId && (
        <ConfirmDialog
          title="Usuń sesję?"
          message="Sesja zostanie usunięta z Twojego konta. Tej operacji nie można cofnąć."
          confirmLabel="Usuń"
          onConfirm={handleDeleteConfirm}
          onCancel={() => setConfirmDeleteId(null)}
          isProcessing={!!deletingId}
        />
      )}

      {/* Delete confirmation dialog for folders */}
      {confirmDeleteFolderId && (
        <ConfirmDialog
          title="Usuń folder?"
          message="Folder zostanie usunięty. Wszystkie lekcje znajdujące się w środku zostaną przeniesione do strony głównej."
          confirmLabel="Usuń"
          onConfirm={handleDeleteFolder}
          onCancel={() => setConfirmDeleteFolderId(null)}
          isProcessing={isMutatingFolder}
        />
      )}

      {/* Create folder modal */}
      {isCreatingFolder && (
        <CreateFolderModal
          onConfirm={handleCreateFolder}
          onCancel={() => setIsCreatingFolder(false)}
          isProcessing={isMutatingFolder}
        />
      )}

      {/* Move session modal */}
      {movingSessionId && (
        <MoveModal
          allFolders={allFolders}
          currentLocationId={sessions.find(s => s.id === movingSessionId)?.folder_id || null}
          onConfirm={handleMoveSession}
          onCancel={() => setMovingSessionId(null)}
          isProcessing={isMoving}
        />
      )}

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

      {/* Sprint 4: Explorer Header & Breadcrumbs */}
      <div className="flex flex-col gap-4">
        {/* Breadcrumb Trail */}
        <nav className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1">
          <button
            onClick={() => setCurrentFolderId(null)}
            className={`flex items-center gap-1 text-sm font-medium transition-colors ${
              !currentFolderId ? 'text-indigo-600' : 'text-slate-400 hover:text-slate-600'
            }`}
          >
            <Home className="w-4 h-4" />
            <span>Wszystkie lekcje</span>
          </button>
          
          {breadcrumbPath.map((folder, idx) => (
            <div key={folder.id} className="flex items-center gap-2">
              <ChevronRight className="w-4 h-4 text-slate-300 flex-shrink-0" />
              <button
                onClick={() => setCurrentFolderId(folder.id)}
                className={`text-sm font-medium transition-colors whitespace-nowrap ${
                  idx === breadcrumbPath.length - 1 ? 'text-indigo-600' : 'text-slate-400 hover:text-slate-600'
                }`}
              >
                {folder.name}
              </button>
            </div>
          ))}
        </nav>

        {/* Folder Context Indicator (Consistency Awareness) */}
        {currentFolderId && !searchQuery.trim() && (
          <div className="bg-indigo-50 dark:bg-indigo-950/40 p-3 rounded-xl border border-indigo-100 dark:border-indigo-900/30 flex items-center justify-between animate-in fade-in slide-in-from-top-2 duration-300">
             <div className="flex items-center gap-2 overflow-hidden">
               <Folder className="w-4 h-4 text-indigo-500 flex-shrink-0" />
               <span className="text-sm font-medium text-indigo-700 dark:text-indigo-400 truncate">
                 Folder: <span className="font-bold">{breadcrumbPath[breadcrumbPath.length - 1]?.name}</span>
               </span>
             </div>
             <button 
               onClick={() => setCurrentFolderId(null)}
               className="text-xs text-indigo-600 dark:text-indigo-400 font-bold hover:underline px-2 py-1 whitespace-nowrap"
             >
               Pokaż wszystkie (Root)
             </button>
          </div>
        )}

        {/* Sprint 3: Search & Sort Controls */}
        <div className="flex flex-col md:flex-row gap-4 items-center bg-white dark:bg-slate-900 p-4 rounded-2xl border border-gray-100 dark:border-slate-800 shadow-sm transition-colors">
          <div className="relative flex-1 w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder={currentFolderId ? "Szukaj w tym folderze..." : "Szukaj we wszystkich lekcjach..."}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-gray-50 dark:bg-slate-800 border-none rounded-xl text-sm focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all text-[var(--omni-text)]"
            />
            {searchQuery && (
               <button 
                 onClick={() => setSearchQuery('')}
                 className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
               >
                 <X className="w-4 h-4" />
               </button>
            )}
          </div>
          
          <div className="flex items-center gap-3 w-full md:w-auto">
            <div className="flex items-center gap-2 text-sm text-[var(--omni-text-muted)] whitespace-nowrap">
              <Filter className="w-4 h-4" />
              <span>Sortuj:</span>
            </div>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="flex-1 md:w-48 bg-gray-50 dark:bg-slate-800 border-none rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-indigo-500/20 outline-none cursor-pointer appearance-none text-[var(--omni-text)]"
            >
              <option value="date_desc">Data (najnowsze)</option>
              <option value="date_asc">Data (najstarsze)</option>
              <option value="title_asc">Nazwa (A-Z)</option>
              <option value="title_desc">Nazwa (Z-A)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Sprint 4: Folders Grid (only if not searching globally) */}
      {!searchQuery && currentFolders.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {currentFolders.map(folder => (
            <div
              key={folder.id}
              className="omni-card p-4 flex flex-col items-center gap-3 group/folder hover:border-indigo-300 dark:hover:border-indigo-800 transition-all text-center relative"
              onClick={() => setCurrentFolderId(folder.id)}
            >
              <div className="absolute top-2 right-2 flex items-center gap-1 opacity-0 group-hover/folder:opacity-100 transition-opacity">
                 <button 
                   onClick={e => { e.stopPropagation(); setConfirmDeleteFolderId(folder.id); }}
                   className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
                 >
                   <Trash2 className="w-3.5 h-3.5" />
                 </button>
              </div>

              <div className="w-12 h-12 bg-indigo-50 dark:bg-indigo-950 rounded-2xl flex items-center justify-center text-indigo-500 group-hover/folder:scale-110 transition-transform cursor-pointer">
                <Folder className="w-6 h-6 fill-current" />
              </div>
              <div className="flex-1 min-w-0 w-full cursor-pointer">
                <div onClick={e => e.stopPropagation()}>
                  <LessonTitleEditor
                    sessionId={folder.id}  // Shared component works fine for folders id too
                    initialTitle={folder.name}
                    onSaved={(newName) => handleFolderTitleSaved(folder.id, newName)}
                    isDemoMode={isDemoMode}
                    className="text-center justify-center"
                  />
                </div>
                <p className="text-[10px] text-[var(--omni-text-muted)] mt-1 uppercase tracking-wider">
                  {sessions.filter(s => s.folder_id === folder.id).length} Sesji
                </p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Sessions List - Grouped Rendering */}
      <div className="space-y-8">
        {Object.entries(groupedSessions).length > 0 ? (
          Object.entries(groupedSessions).map(([groupName, groupItems]) => (
            <div key={groupName} className="space-y-4">
              <h2 className="text-sm font-bold text-gray-400 uppercase tracking-widest px-2 flex items-center gap-2">
                <div className="w-1 h-4 bg-indigo-500 rounded-full" />
                {groupName}
              </h2>
              <div className="space-y-3">
                {groupItems.map((session) => (
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
                        <LessonTitleEditor
                          sessionId={session.id}
                          initialTitle={session.lesson_title || ''}
                          onSaved={(newTitle) => handleLessonTitleSaved(session.id, newTitle)}
                          isDemoMode={isDemoMode}
                          className="mb-2"
                        />

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
                          {session.quiz_result && (
                            <div className={`ml-auto px-2 py-0.5 rounded-lg text-[10px] font-bold border ${
                              session.quiz_result.percentage >= 80 
                                ? 'bg-green-50 text-green-700 border-green-100' 
                                : session.quiz_result.percentage >= 50 
                                  ? 'bg-amber-50 text-amber-700 border-amber-100' 
                                  : 'bg-red-50 text-red-700 border-red-100'
                            }`}>
                              {session.quiz_result.percentage}%
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 mt-4 lg:mt-0">
                        <span className="px-3 py-1 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 rounded-full text-xs font-medium uppercase tracking-wider">
                          Ukończono
                        </span>

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

                        {!isDemoMode && (
                          <button
                            onClick={e => { e.stopPropagation(); setMovingSessionId(session.id); }}
                            className="p-2 rounded-lg text-indigo-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 transition-colors"
                            title="Przenieś lekcję"
                          >
                            <ArrowRightLeft className="w-4 h-4" />
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
          ))
        ) : (
          <div className="text-center py-16 omni-card bg-gray-50/50 dark:bg-slate-900/50 border-dashed border-2 flex flex-col items-center">
            {searchQuery ? (
              <>
                <Search className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-1">Brak wyników</h3>
                <p className="text-gray-500">
                  Nie znaleźliśmy sesji pasujących do Twojego wyszukiwania.
                </p>
                <button 
                  onClick={() => setSearchQuery('')}
                  className="mt-4 text-[var(--omni-accent)] font-medium hover:underline"
                >
                  Wyczyść wyszukiwanie
                </button>
              </>
            ) : (
              <>
                <Folder className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-1">Pusty folder</h3>
                <p className="text-gray-500">
                  Ten folder nie zawiera jeszcze żadnych lekcji.
                </p>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
