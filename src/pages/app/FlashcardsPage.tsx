import { useState, useEffect, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import type { FlashcardData } from '../../types';
import { RotateCw, ChevronLeft, ChevronRight, BookOpen } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/auth-context';
import { getEffectivePlan } from '../../lib/plan-utils';
import { getFeatureAccess } from '../../lib/feature-access';

type FlashcardProgressState = Record<string, {
  status: 'know' | 'dont_know';
  last_reviewed_at: string;
  know_count: number;
  dont_know_count: number;
}>;

export default function FlashcardsPage() {
  const navigate = useNavigate();
  const { id: routeId } = useParams();
  const { isDemoMode } = useAuth();
  const { t } = useTranslation();
  
  const [flashcards, setFlashcards] = useState<FlashcardData[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [knownCards, setKnownCards] = useState<Set<string>>(new Set());
  const [hasHiddenCards, setHasHiddenCards] = useState(false);
  const [flashcardProgress, setFlashcardProgress] = useState<FlashcardProgressState>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [regenerationMessage, setRegenerationMessage] = useState<string | null>(null);

  const { user } = useAuth();
  const effectivePlan = getEffectivePlan(user);
  const { maxFlashcardsPerLesson } = getFeatureAccess(effectivePlan);

  useEffect(() => {
    const fetchFlashcards = async () => {
      const sessionId = routeId || sessionStorage.getItem('currentSessionId');
      
      if (!sessionId) {
        navigate('/app/dashboard');
        return;
      }

      if (isDemoMode || sessionId === 'demo-session') {
        const analysisStr = sessionStorage.getItem('currentAnalysis');
        if (analysisStr) {
          try {
            const analysis = JSON.parse(analysisStr);
            setFlashcards(analysis.flashcards || []);
          } catch {
            setFlashcards([]);
          }
        }
        setIsLoading(false);
        return;
      }

      try {
        const { data, error } = await supabase
          .from('study_sessions')
          .select('flashcards, flashcard_progress')
          .eq('id', sessionId)
          .single();

        if (error) throw error;
        
        // Ensure standard object formatting for React iteration with deterministic IDs
        const mappedCards = (data?.flashcards || []).map((fc: any, i: number) => ({
          ...fc,
          id: fc.id || `card-${i}`
        }));
        const prog = data?.flashcard_progress || {};
        
        // Phase 9B: Priority sorting (dont_know -> unseen -> know)
        mappedCards.sort((a: any, b: any) => {
          const wA = prog[a.id]?.status === 'dont_know' ? 0 : prog[a.id]?.status === 'know' ? 2 : 1;
          const wB = prog[b.id]?.status === 'dont_know' ? 0 : prog[b.id]?.status === 'know' ? 2 : 1;
          return wA - wB;
        });
        
        // Feature Gate: Limit flashcards based on plan
        const limitedCards = mappedCards.slice(0, maxFlashcardsPerLesson);
        setHasHiddenCards(mappedCards.length > maxFlashcardsPerLesson);
        
        setFlashcards(limitedCards);
        setFlashcardProgress(prog);

        // Restore progress
        const progressStr = localStorage.getItem(`flashcards-progress-${sessionId}`);
        if (progressStr) {
          try {
            const progress = JSON.parse(progressStr);
            if (typeof progress.currentIndex === 'number') setCurrentIndex(progress.currentIndex);
            if (Array.isArray(progress.knownCards)) setKnownCards(new Set(progress.knownCards));
          } catch (e) {
            console.error("Failed to parse flashcards progress", e);
          }
        }
      } catch (err) {
        console.error("Failed to load flashcards from DB:", err);
        setFlashcards([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchFlashcards();
  }, [routeId, navigate, isDemoMode]);

  // Persist progress when it changes
  useEffect(() => {
    const sessionId = routeId || sessionStorage.getItem('currentSessionId');
    if (!sessionId || flashcards.length === 0) return;
    
    localStorage.setItem(`flashcards-progress-${sessionId}`, JSON.stringify({
      currentIndex,
      knownCards: Array.from(knownCards)
    }));
  }, [currentIndex, knownCards, routeId, flashcards.length]);

  const handleRegenerate = async () => {
    const sessionId = routeId || sessionStorage.getItem('currentSessionId');
    if (!sessionId) return;

    if (!confirm(t('flashcards.notifications.regenerateConfirm'))) {
      return;
    }

    setIsRegenerating(true);
    setRegenerationMessage(t('flashcards.notifications.regenerating'));

    try {
      const { data: { session: authSession } } = await supabase.auth.getSession();
      const functionUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/regenerate-module`;
      const response = await fetch(functionUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
          ...(authSession ? { 'Authorization': `Bearer ${authSession.access_token}` } : {})
        },
        body: JSON.stringify({ sessionId, module: 'flashcards' })
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errText}`);
      }

      const result = await response.json();

      // 1. Update state with new data, ensuring deterministic IDs
      const mappedCards = (result.data || []).map((fc: any, i: number) => ({
        ...fc,
        id: fc.id || `card-${i}`
      }));
      setFlashcards(mappedCards);

      // 2. Reset progress
      setCurrentIndex(0);
      setKnownCards(new Set());
      setFlashcardProgress({});
      setIsFlipped(false);
      localStorage.removeItem(`flashcards-progress-${sessionId}`);

      setRegenerationMessage(t('flashcards.notifications.success'));
      setTimeout(() => setRegenerationMessage(null), 3000);
    } catch (err: any) {
      console.error("Regeneration failed:", err);
      alert(t('flashcards.notifications.error') + ": " + err.message);
    } finally {
      setIsRegenerating(false);
    }
  };

  const currentCard = flashcards[currentIndex];
  const progress = flashcards.length > 0 
    ? Math.round((knownCards.size / flashcards.length) * 100) 
    : 0;

  const bucketCounts = useMemo(() => {
    let toReview = 0; let difficult = 0; let mastered = 0;
    flashcards.forEach(fc => {
      const status = flashcardProgress[fc.id]?.status;
      if (status === 'know') mastered++;
      else if (status === 'dont_know') difficult++;
      else toReview++;
    });
    return { toReview, difficult, mastered };
  }, [flashcards, flashcardProgress]);

  const updateProgress = (cardId: string, status: 'know' | 'dont_know') => {
    const sessionId = routeId || sessionStorage.getItem('currentSessionId');
    if (!sessionId || isDemoMode || sessionId === 'demo-session') return;

    const now = new Date().toISOString();
    setFlashcardProgress(prev => {
      const existing = prev[cardId] || { know_count: 0, dont_know_count: 0 };
      const nextProgress = {
        ...prev,
        [cardId]: {
          status,
          last_reviewed_at: now,
          know_count: existing.know_count + (status === 'know' ? 1 : 0),
          dont_know_count: existing.dont_know_count + (status === 'dont_know' ? 1 : 0)
        }
      };

      // Optimistic persistence without blocking the UX loop
      supabase
        .from('study_sessions')
        .update({ flashcard_progress: nextProgress })
        .eq('id', sessionId)
        .then(({ error }) => {
          if (error) console.error("Failed to update flashcard progress", error);
        });

      return nextProgress;
    });
  };

  const handleFlip = () => {
    setIsFlipped(!isFlipped);
  };

  const handleNext = () => {
    if (currentIndex < flashcards.length - 1) {
      setIsFlipped(false);
      setTimeout(() => setCurrentIndex(currentIndex + 1), 150);
    } else {
      // Move to completion screen
      setCurrentIndex(flashcards.length);
    }
  };

  const handlePrevious = () => {
    if (currentIndex > 0) {
      setIsFlipped(false);
      setTimeout(() => setCurrentIndex(currentIndex - 1), 150);
    }
  };

  const handleKnown = () => {
    if (currentCard) {
      setKnownCards(prev => new Set([...prev, currentCard.id]));
      updateProgress(currentCard.id, 'know');
      handleNext();
    }
  };

  const handleUnknown = () => {
    if (currentCard) {
      updateProgress(currentCard.id, 'dont_know');
      handleNext();
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (flashcards.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <div className="w-16 h-16 bg-[var(--omni-lavender)] rounded-2xl flex items-center justify-center mb-6">
          <BookOpen className="w-8 h-8 text-[var(--omni-text)]" />
        </div>
        <h2 className="omni-heading-3 text-[var(--omni-text)] mb-2">
          {t('flashcards.empty.title')}
        </h2>
        <p className="text-[var(--omni-text-muted)] mb-6 text-center max-w-md">
          {t('flashcards.empty.desc')}
        </p>
        <button
          onClick={() => navigate('/app/upload')}
          className="omni-btn-primary"
        >
          {t('flashcards.empty.cta')}
        </button>
      </div>
    );
  }

  if (currentIndex >= flashcards.length) {
    const hasDifficult = flashcards.some(c => flashcardProgress[c.id]?.status === 'dont_know');
    const gridColsClass = hasDifficult 
      ? "grid-cols-2 md:grid-cols-3 lg:grid-cols-5" 
      : "grid-cols-2 md:grid-cols-4";

    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] w-full px-4">
        <div className="omni-card p-6 md:p-8 text-center max-w-3xl w-full mx-auto shadow-sm">
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <span className="text-3xl">🎉</span>
          </div>
          <h2 className="omni-heading-3 text-[var(--omni-text)] mb-2">
            {t('flashcards.completion.title')}
          </h2>
          <p className="text-[var(--omni-text-muted)]">
            {t('flashcards.completion.desc', { known: knownCards.size, total: flashcards.length })}
          </p>
          <div className={`grid w-full max-w-2xl mx-auto mt-6 gap-3 justify-items-stretch ${gridColsClass}`}>
            {hasDifficult && (
              <button
                onClick={() => {
                  const difficult = flashcards.filter(c => flashcardProgress[c.id]?.status === 'dont_know');
                  setFlashcards(difficult);
                  setCurrentIndex(0);
                  setKnownCards(new Set());
                  setIsFlipped(false);
                  const sessionId = routeId || sessionStorage.getItem('currentSessionId');
                  if (sessionId) localStorage.removeItem(`flashcards-progress-${sessionId}`);
                }}
                className="omni-btn-primary bg-orange-500 hover:bg-orange-600 border-none w-full min-h-[72px] px-3 py-3 text-center whitespace-normal break-words rounded-xl flex items-center justify-center text-sm"
              >
                {t('flashcards.completion.repeatDifficult', { count: flashcards.filter(c => flashcardProgress[c.id]?.status === 'dont_know').length })}
              </button>
            )}
            <button
              onClick={() => {
                setCurrentIndex(0);
                setKnownCards(new Set());
                setIsFlipped(false);
                const sessionId = routeId || sessionStorage.getItem('currentSessionId');
                if (sessionId) {
                  localStorage.removeItem(`flashcards-progress-${sessionId}`);
                }
              }}
              className="omni-btn-secondary w-full min-h-[72px] px-3 py-3 text-center whitespace-normal break-words rounded-xl flex items-center justify-center text-sm"
            >
              {hasDifficult 
                ? t('flashcards.completion.repeatAll') 
                : t('flashcards.completion.repeatSame')}
            </button>
            <button
              onClick={handleRegenerate}
              disabled={isRegenerating}
              className="omni-btn-secondary border-2 border-[var(--omni-accent)]/20 hover:border-[var(--omni-accent)] text-[var(--omni-accent)] w-full min-h-[72px] px-3 py-3 text-center whitespace-normal break-words rounded-xl flex items-center justify-center gap-2 text-sm"
            >
              {isRegenerating ? (
                <div className="w-4 h-4 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin flex-shrink-0" />
              ) : (
                <RotateCw className="w-4 h-4 flex-shrink-0" />
              )}
              {t('flashcards.completion.regenerate')}
            </button>
            <button
              onClick={() => {
                const currentId = routeId || sessionStorage.getItem('currentSessionId');
                if (currentId) {
                  navigate(`/app/quiz/${currentId}`);
                } else {
                  navigate('/app/history');
                }
              }}
              className="omni-btn-secondary w-full min-h-[72px] px-3 py-3 text-center whitespace-normal break-words rounded-xl flex items-center justify-center text-sm"
            >
              {t('flashcards.completion.goToQuiz')}
            </button>
            <button
              onClick={() => {
                const currentId = routeId || sessionStorage.getItem('currentSessionId');
                if (currentId) {
                  sessionStorage.setItem('currentSessionId', currentId);
                  navigate('/app/results');
                } else {
                  navigate('/app/results');
                }
              }}
              className="omni-btn-secondary w-full min-h-[72px] px-3 py-3 text-center whitespace-normal break-words rounded-xl flex items-center justify-center text-sm"
            >
              {t('flashcards.completion.backToResults')}
            </button>
          </div>
          
          {hasHiddenCards && effectivePlan === 'free' && (
            <div className="mt-8 p-4 bg-indigo-50 border border-indigo-100 rounded-xl max-w-lg mx-auto">
              <p className="text-indigo-800 font-medium mb-3">
                Odblokuj więcej fiszek i powtórki w Premium.
              </p>
              <button
                onClick={() => navigate('/app/payments')}
                className="omni-btn-primary w-full py-2.5 text-sm"
              >
                Sprawdź Premium
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="relative space-y-6">
      {/* Regeneration Overlay */}
      {isRegenerating && (
        <div className="absolute inset-0 z-50 bg-white/80 backdrop-blur-sm flex flex-col items-center justify-center rounded-3xl transition-opacity animate-in fade-in duration-300">
          <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mb-4" />
          <p className="text-lg font-bold text-[var(--omni-text)] animate-pulse">
            {regenerationMessage}
          </p>
        </div>
      )}

      {/* Success Notification */}
      {regenerationMessage && !isRegenerating && (
        <div className="fixed top-24 left-1/2 -translate-x-1/2 z-[60] bg-green-500 text-white px-6 py-3 rounded-full shadow-lg font-bold animate-in slide-in-from-top duration-300">
          {regenerationMessage}
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="omni-heading-3 text-[var(--omni-text)] mb-1">
            {t('flashcards.title')}
          </h1>
          <p className="text-[var(--omni-text-muted)]">
            {t('flashcards.subtitle')}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-[var(--omni-text-muted)]">
            {t('flashcards.progress')}:
          </span>
          <div className="w-32 h-2 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-[var(--omni-accent)] rounded-full transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
          <span className="text-sm font-medium text-[var(--omni-text)]">
            {progress}%
          </span>
        </div>
      </div>

      {/* Revision Buckets */}
      <div className="flex items-center justify-between bg-white dark:bg-slate-900 rounded-2xl p-3 md:p-4 shadow-sm border border-gray-100 dark:border-slate-800">
        <div className="flex flex-col items-center flex-1 border-r border-gray-100 dark:border-slate-800">
          <span className="text-xl md:text-2xl font-bold text-gray-700 dark:text-gray-200">{bucketCounts.toReview}</span>
          <span className="text-[10px] md:text-xs text-gray-400 uppercase tracking-wider font-semibold mt-1">{t('flashcards.buckets.toReview')}</span>
        </div>
        <div className="flex flex-col items-center flex-1 border-r border-gray-100 dark:border-slate-800">
          <span className="text-xl md:text-2xl font-bold text-orange-500">{bucketCounts.difficult}</span>
          <span className="text-[10px] md:text-xs text-orange-500/70 uppercase tracking-wider font-semibold mt-1">{t('flashcards.buckets.difficult')}</span>
        </div>
        <div className="flex flex-col items-center flex-1">
          <span className="text-xl md:text-2xl font-bold text-green-500">{bucketCounts.mastered}</span>
          <span className="text-[10px] md:text-xs text-green-500/70 uppercase tracking-wider font-semibold mt-1">{t('flashcards.buckets.mastered')}</span>
        </div>
      </div>

      {/* Progress Counter */}
      <div className="text-center">
        <span className="text-sm text-[var(--omni-text-muted)]">
          {t('flashcards.cardCounter', { current: currentIndex + 1, total: flashcards.length })}
        </span>
      </div>

      {/* Flashcard */}
      <div className="flex justify-center px-4">
        <div
          onClick={handleFlip}
          className="relative w-full max-w-lg min-h-[350px] md:min-h-[400px] cursor-pointer group active:scale-[0.98] transition-transform"
          style={{ perspective: '1000px' }}
        >
          <div
            className={`relative w-full h-full transition-transform duration-700 ease-in-out ${
              isFlipped ? '[transform:rotateY(180deg)]' : ''
            }`}
            style={{ transformStyle: 'preserve-3d', height: '100%' }}
          >
            {/* Front */}
            <div
              className={`absolute inset-0 omni-card flex flex-col p-6 md:p-8 border-2 transition-colors ${isFlipped ? 'border-transparent' : 'border-[var(--omni-accent)]/20 group-hover:border-[var(--omni-accent)]/40'}`}
              style={{ backfaceVisibility: 'hidden' }}
            >
              {/* Header Zone */}
              <div className="flex-none text-center mb-4">
                <span className="text-[10px] md:text-xs lg:text-sm text-muted-foreground uppercase tracking-widest font-bold">
                  {t('flashcards.card.term')}
                </span>
              </div>

              {/* Main Content Zone */}
              <div className="flex-1 flex items-center justify-center text-center px-2 py-4 overflow-y-auto custom-scrollbar">
                <h3 className="text-xl md:text-2xl lg:text-3xl font-bold text-[var(--omni-text)] leading-tight">
                  {currentCard.front}
                </h3>
              </div>

              {/* Footer/Helper Zone */}
              <div className="flex-none flex items-center justify-center gap-2 pt-4 border-t border-border mt-auto">
                <RotateCw className="w-3.5 h-3.5 text-muted-foreground" />
                <span className="text-[10px] md:text-xs font-medium text-muted-foreground">
                  {t('flashcards.card.clickToFlip')}
                </span>
              </div>
            </div>

            {/* Back */}
            <div
              className={`absolute inset-0 omni-card flex flex-col p-6 md:p-8 bg-[var(--omni-mint)]/10 border-2 transition-colors ${isFlipped ? 'border-[var(--omni-mint)]' : 'border-transparent'}`}
              style={{
                backfaceVisibility: 'hidden',
                transform: 'rotateY(180deg)',
                height: '100%'
              }}
            >
              {/* Header Zone */}
              <div className="flex-none text-center mb-4">
                <span className="text-[10px] md:text-xs lg:text-sm text-muted-foreground uppercase tracking-widest font-bold">
                  {t('flashcards.card.definition')}
                </span>
              </div>

              {/* Main Content Zone */}
              <div className="flex-1 flex items-center justify-center text-center px-2 py-4 overflow-y-auto custom-scrollbar">
                <p className="text-base md:text-lg lg:text-xl text-[var(--omni-text)] leading-relaxed font-medium">
                  {currentCard.back}
                </p>
              </div>

              {/* Footer/Helper Zone */}
              <div className="flex-none flex items-center justify-center gap-2 pt-4 border-t border-border mt-auto">
                <RotateCw className="w-3.5 h-3.5 text-muted-foreground" />
                <span className="text-[10px] md:text-xs font-medium text-muted-foreground">
                  Kliknij, by odwrócić
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="flex flex-col items-center gap-8 py-4">
        <div className="flex items-center justify-center gap-6 w-full max-w-sm">
          <button
            onClick={(e) => { e.stopPropagation(); handlePrevious(); }}
            disabled={currentIndex === 0}
            className="p-5 rounded-full bg-card shadow-md border border-border disabled:opacity-30 disabled:cursor-not-allowed hover:shadow-lg active:scale-95 transition-all"
            aria-label={t('flashcards.controls.prev')}
          >
            <ChevronLeft className="w-7 h-7 text-[var(--omni-text)]" />
          </button>

          <div className="flex-1 flex gap-4">
            <button
              onClick={(e) => { e.stopPropagation(); handleUnknown(); }}
              className="flex-1 py-5 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-2xl font-bold shadow-sm hover:bg-red-100 dark:hover:bg-red-900/30 active:scale-[0.97] transition-all border border-red-200/50 dark:border-red-800/50"
            >
              {t('flashcards.controls.dontKnow')}
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); handleKnown(); }}
              className="flex-1 py-5 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 rounded-2xl font-bold shadow-sm hover:bg-green-100 dark:hover:bg-green-900/30 active:scale-[0.97] transition-all border border-green-200/50 dark:border-green-800/50"
            >
              {t('flashcards.controls.know')}
            </button>
          </div>

          <button
            onClick={(e) => { e.stopPropagation(); handleNext(); }}
            disabled={currentIndex === flashcards.length - 1}
            className="p-5 rounded-full bg-card shadow-md border border-border disabled:opacity-30 disabled:cursor-not-allowed hover:shadow-lg active:scale-95 transition-all"
            aria-label={t('flashcards.controls.next')}
          >
            <ChevronRight className="w-7 h-7 text-[var(--omni-text)]" />
          </button>
        </div>
      </div>


      {/* Difficulty indicator */}
      <div className="text-center">
        <span
          className={`text-sm ${
            currentCard.difficulty === 'easy'
              ? 'text-green-500'
              : currentCard.difficulty === 'medium'
              ? 'text-yellow-500'
              : 'text-orange-500'
          }`}
        >
          {t('flashcards.difficulty.label')}:{' '}
          {currentCard.difficulty === 'easy'
            ? t('flashcards.difficulty.easy')
            : currentCard.difficulty === 'medium'
            ? t('flashcards.difficulty.medium')
            : t('flashcards.difficulty.hard')}
        </span>
      </div>
    </div>
  );
}
