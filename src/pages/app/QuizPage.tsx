import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import type { QuizQuestion, QuizAnswer } from '../../types';
import { Check, X, ArrowRight, HelpCircle, Trophy, RotateCw } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/auth-context';

export default function QuizPage() {
  const navigate = useNavigate();
  const { id: routeId } = useParams();
  const { isDemoMode } = useAuth();
  
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<QuizAnswer[]>([]);
  const [selectedAnswer, setSelectedAnswer] = useState<string | number | null>(null);
  const [showFeedback, setShowFeedback] = useState(false);
  const [isFinished, setIsFinished] = useState(false);
  const [startTime, setStartTime] = useState<number>(Date.now());
  const [isLoading, setIsLoading] = useState(true);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [regenerationMessage, setRegenerationMessage] = useState<string | null>(null);
  
  // Randomization state
  const [attemptId, setAttemptId] = useState<string | null>(null);
  const [orderMaps, setOrderMaps] = useState<Record<string, number[]>>({}); // questionId -> originalIndices[]

  useEffect(() => {
    const fetchQuiz = async () => {
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
            setQuestions(analysis.quizQuestions || []);
            setStartTime(Date.now());
          } catch {
            setQuestions([]);
          }
        }
        setIsLoading(false);
        return;
      }

      try {
        const { data, error } = await supabase
          .from('study_sessions')
          .select('quiz_questions')
          .eq('id', sessionId)
          .single();

        if (error) throw error;

        const mappedQuestions = (data?.quiz_questions || []).map((q: any) => ({
          ...q,
          id: q.id || crypto.randomUUID(),
          type: q.type || 'single_choice',
          correctAnswer: q.correctAnswer ?? q.correctIndex
        }));

        setQuestions(mappedQuestions);
        setStartTime(Date.now());

        // Restore Progress or Initialize New Attempt
        const progressStr = localStorage.getItem(`quiz-progress-${sessionId}`);
        let restoredProgress = null;
        if (progressStr) {
          try {
            restoredProgress = JSON.parse(progressStr);
          } catch (e) {
            console.error("Failed to parse quiz progress", e);
          }
        }

        if (restoredProgress && restoredProgress.attemptId && !restoredProgress.isFinished) {
          // Resume existing attempt
          setAttemptId(restoredProgress.attemptId);
          if (typeof restoredProgress.currentIndex === 'number') setCurrentIndex(restoredProgress.currentIndex);
          if (Array.isArray(restoredProgress.answers)) setAnswers(restoredProgress.answers);
          if (restoredProgress.orderMaps) setOrderMaps(restoredProgress.orderMaps);
        } else {
          // Start fresh attempt
          const newAttemptId = crypto.randomUUID();
          setAttemptId(newAttemptId);
          
          // Generate order maps for all questions
          const newOrderMaps: Record<string, number[]> = {};
          mappedQuestions.forEach((q: QuizQuestion) => {
            if (q.type === 'single_choice' && q.options) {
              const indices = q.options.map((_: unknown, i: number) => i);
              for (let i = indices.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [indices[i], indices[j]] = [indices[j], indices[i]];
              }
              newOrderMaps[q.id] = indices;
            }
          });
          setOrderMaps(newOrderMaps);
        }
      } catch (err) {
        console.error("Failed to load quiz from DB:", err);
        setQuestions([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchQuiz();
  }, [routeId, navigate, isDemoMode]);

  // Persist progress when it changes
  useEffect(() => {
    const sessionId = routeId || sessionStorage.getItem('currentSessionId');
    if (!sessionId || questions.length === 0 || !attemptId) return;
    
    localStorage.setItem(`quiz-progress-${sessionId}`, JSON.stringify({
      attemptId,
      currentIndex,
      answers,
      isFinished,
      orderMaps
    }));
  }, [currentIndex, answers, isFinished, routeId, questions.length, attemptId, orderMaps]);

  const handleRegenerate = async () => {
    const sessionId = routeId || sessionStorage.getItem('currentSessionId');
    if (!sessionId) return;

    if (!confirm("Czy na pewno chcesz wygenerować nowy quiz? Obecne pytania zostaną zastąpione nowymi wyzwaniami z Twoich notatek.")) {
      return;
    }

    setIsRegenerating(true);
    setRegenerationMessage("Magia AI: Generowanie nowego quizu...");

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
        body: JSON.stringify({ sessionId, module: 'quiz' })
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errText}`);
      }

      const result = await response.json();

      // 1. Update state with new data
      const mappedQuestions = (result.data || []).map((qq: any) => ({
        ...qq,
        id: qq.id || crypto.randomUUID(),
        type: 'single_choice',
        correctAnswer: qq.correctIndex
      }));
      setQuestions(mappedQuestions);

      // 2. Reset progress and start new attempt
      const newAttemptId = crypto.randomUUID();
      const newOrderMaps: Record<string, number[]> = {};
      mappedQuestions.forEach((q: any) => {
        if (q.type === 'single_choice' && q.options) {
          const indices = q.options.map((_: unknown, i: number) => i);
          for (let i = indices.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [indices[i], indices[j]] = [indices[j], indices[i]];
          }
          newOrderMaps[q.id] = indices;
        }
      });

      setAttemptId(newAttemptId);
      setOrderMaps(newOrderMaps);
      setCurrentIndex(0);
      setAnswers([]);
      setIsFinished(false);
      setShowFeedback(false);
      localStorage.removeItem(`quiz-progress-${sessionId}`);

      setRegenerationMessage("Quiz zaktualizowany pomyślnie!");
      setTimeout(() => setRegenerationMessage(null), 3000);
    } catch (err: any) {
      console.error("Regeneration failed:", err);
      alert("Błąd regeneracji: " + err.message);
    } finally {
      setIsRegenerating(false);
    }
  };

  const currentQuestion = questions[currentIndex];
  const progress = questions.length > 0 
    ? Math.round((currentIndex / questions.length) * 100) 
    : 0;

  const handleAnswer = (shuffledIndex: number) => {
    if (showFeedback) return;
    
    const orderMap = orderMaps[currentQuestion.id];
    const originalIndex = orderMap ? orderMap[shuffledIndex] : shuffledIndex;
    
    setSelectedAnswer(shuffledIndex);
    setShowFeedback(true);

    const isCorrect = originalIndex === currentQuestion.correctAnswer;
    const timeSpent = Math.round((Date.now() - startTime) / 1000);

    setAnswers(prev => [...prev, {
      questionId: currentQuestion.id,
      selectedAnswer: originalIndex, // Store the original answer for persistence
      isCorrect,
      timeSpentSeconds: timeSpent,
    }]);
  };

  const handleNext = async () => {
    if (currentIndex < questions.length - 1) {
      setCurrentIndex(currentIndex + 1);
      setSelectedAnswer(null);
      setShowFeedback(false);
      setStartTime(Date.now());
    } else {
      setIsFinished(true);
      // Store results
      const correctCount = answers.filter(a => a.isCorrect).length;
      const totalCount = questions.length;
      const percentage = totalCount > 0 ? Math.round((correctCount / totalCount) * 100) : 0;
      const completedAt = new Date().toISOString();

      sessionStorage.setItem('quizResults', JSON.stringify({
        totalQuestions: totalCount,
        correctAnswers: correctCount,
        answers: answers,
      }));

      // Phase 8A: Persist to DB (Isolated update)
      const sessionId = routeId || sessionStorage.getItem('currentSessionId');
      if (sessionId) {
        try {
          await supabase
            .from('study_sessions')
            .update({ 
              quiz_result: {
                score: correctCount,
                total: totalCount,
                percentage: percentage,
                completed_at: completedAt
              }
            })
            .eq('id', sessionId);
          console.log("[Quiz] Progress persisted successfully.");
        } catch (dbErr) {
          // Non-blocking catch as per guardrails
          console.error("[Quiz] DB Persist error:", dbErr);
        }
      }
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (questions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <div className="w-16 h-16 bg-[var(--omni-blush)] rounded-2xl flex items-center justify-center mb-6">
          <HelpCircle className="w-8 h-8 text-[var(--omni-text)]" />
        </div>
        <h2 className="omni-heading-3 text-[var(--omni-text)] mb-2">
          Brak pytań
        </h2>
        <p className="text-[var(--omni-text-muted)] mb-6 text-center max-w-md">
          Najpierw prześlij swoje notatki, a AI wygeneruje pytania do quizu.
        </p>
        <button
          onClick={() => navigate('/app/upload')}
          className="omni-btn-primary"
        >
          Prześlij notatki
        </button>
      </div>
    );
  }

  if (isFinished) {
    const correctCount = answers.filter(a => a.isCorrect).length;
    const score = questions.length > 0 ? Math.min(100, Math.max(0, Math.round((correctCount / questions.length) * 100))) : 0;

    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <div className="omni-card p-8 text-center max-w-md w-full">
          <div className="w-20 h-20 bg-[var(--omni-butter)] rounded-full flex items-center justify-center mx-auto mb-6">
            <Trophy className="w-10 h-10 text-[var(--omni-text)]" />
          </div>
          <h2 className="omni-heading-3 text-[var(--omni-text)] mb-2">
            Quiz ukończony!
          </h2>
          <p className="text-[var(--omni-text-muted)] mb-6">
            Twój wynik: {correctCount} z {questions.length} poprawnych odpowiedzi
          </p>
          
          <div className="text-5xl font-bold text-[var(--omni-accent)] mb-8">
            {score}%
          </div>

          <div className="flex flex-col gap-3">
            <button
              onClick={() => {
                const sessionId = routeId || sessionStorage.getItem('currentSessionId');
                if (sessionId) {
                  localStorage.removeItem(`quiz-progress-${sessionId}`);
                  
                  // Start new attempt
                  const newAttemptId = crypto.randomUUID();
                  const newOrderMaps: Record<string, number[]> = {};
                  questions.forEach((q) => {
                    if (q.type === 'single_choice' && q.options) {
                      const indices = q.options.map((_: unknown, i: number) => i);
                      for (let i = indices.length - 1; i > 0; i--) {
                        const j = Math.floor(Math.random() * (i + 1));
                        [indices[i], indices[j]] = [indices[j], indices[i]];
                      }
                      newOrderMaps[q.id] = indices;
                    }
                  });
                  setAttemptId(newAttemptId);
                  setOrderMaps(newOrderMaps);
                }
                setCurrentIndex(0);
                setAnswers([]);
                setIsFinished(false);
                setShowFeedback(false);
              }}
              className="omni-btn-primary"
            >
              Rozwiąż ten sam quiz
            </button>
            <button
              onClick={handleRegenerate}
              disabled={isRegenerating}
              className="omni-btn-secondary border-2 border-[var(--omni-accent)]/20 hover:border-[var(--omni-accent)] text-[var(--omni-accent)] flex items-center justify-center gap-2"
            >
              {isRegenerating ? (
                <div className="w-4 h-4 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
              ) : (
                <RotateCw className="w-4 h-4" />
              )}
              Wygeneruj nowy quiz
            </button>
            <button
              onClick={() => navigate('/app/analysis/' + (routeId || ''))}
              className="omni-btn-secondary"
            >
              Wróć do analizy
            </button>
          </div>
        </div>
      </div>
    );
  }

  const orderMap = orderMaps[currentQuestion.id];
  const originalSelectedIdx = orderMap && typeof selectedAnswer === 'number' 
    ? orderMap[selectedAnswer] 
    : selectedAnswer;
  const isCorrect = originalSelectedIdx === currentQuestion.correctAnswer;

  return (
    <div className="relative space-y-6">
      {/* Regeneration Overlay */}
      {isRegenerating && (
        <div className="absolute inset-0 z-50 bg-background/80 backdrop-blur-sm flex flex-col items-center justify-center rounded-3xl transition-opacity animate-in fade-in duration-300">
          <div className="w-12 h-12 border-4 border-[var(--omni-accent)] border-t-transparent rounded-full animate-spin mb-4" />
          <p className="text-lg font-bold text-foreground animate-pulse">
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
      <div>
        <h1 className="omni-heading-3 text-[var(--omni-text)] mb-2">
          Quiz
        </h1>
        <p className="text-[var(--omni-text-muted)]">
          Sprawdź swoją wiedzę
        </p>
      </div>

      {/* Progress */}
      <div className="flex items-center gap-4">
        <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
          <div
            className="h-full bg-[var(--omni-accent)] rounded-full transition-all"
            style={{ width: `${progress}%` }}
          />
        </div>
        <span className="text-sm text-[var(--omni-text-muted)]">
          {currentIndex + 1} / {questions.length}
        </span>
      </div>

      {/* Question */}
      <div className="omni-card p-6 lg:p-8">
        <h3 className="text-xl lg:text-2xl font-medium text-[var(--omni-text)] mb-6">
          {currentQuestion.question}
        </h3>
        {/* Options */}
        <div className="space-y-4">
          {currentQuestion.type === 'single_choice' && currentQuestion.options?.map((_, shuffledIndex) => {
            const orderMap = orderMaps[currentQuestion.id];
            const originalIndex = orderMap ? orderMap[shuffledIndex] : shuffledIndex;
            const option = currentQuestion.options![originalIndex];

            const isSelected = selectedAnswer === shuffledIndex;
            const isCorrectAnswer = currentQuestion.correctAnswer === originalIndex;
            const showCorrect = showFeedback && isCorrectAnswer;
            const showWrong = showFeedback && isSelected && !isCorrectAnswer;

            return (
              <button
                key={shuffledIndex}
                onClick={() => handleAnswer(shuffledIndex)}
                disabled={showFeedback}
                className={`w-full p-5 md:p-6 rounded-2xl text-left font-semibold transition-all shadow-sm active:scale-[0.98] border-2 ${
                  showCorrect
                    ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 border-green-500 dark:border-green-600 shadow-green-100 dark:shadow-none'
                    : showWrong
                    ? 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 border-red-500 dark:border-red-600 shadow-red-100 dark:shadow-none'
                    : isSelected
                    ? 'bg-[var(--omni-lavender)] dark:bg-[var(--omni-accent)]/10 text-foreground border-[var(--omni-accent)]'
                    : 'bg-card dark:bg-slate-800/60 text-foreground border-border dark:border-slate-700 hover:border-[var(--omni-accent)]/50 hover:bg-muted dark:hover:bg-slate-800'
                }`}
              >
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-4 flex-1">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 flex-shrink-0 transition-colors ${
                      showCorrect ? 'bg-green-500 border-green-500' :
                      showWrong ? 'bg-red-500 border-red-500' :
                      isSelected ? 'bg-[var(--omni-accent)] border-[var(--omni-accent)]' :
                      'bg-muted dark:bg-slate-700 border-border dark:border-slate-600'
                    }`}>
                      {showCorrect ? <Check className="w-5 h-5 text-white" /> :
                       showWrong ? <X className="w-5 h-5 text-white" /> :
                       <span className={`text-sm font-bold ${isSelected ? 'text-white' : 'text-muted-foreground'}`}>{String.fromCharCode(65 + shuffledIndex)}</span>}
                    </div>
                    <span className="text-base md:text-lg leading-snug">{option}</span>
                  </div>
                </div>
              </button>
            );
          })}

          {currentQuestion.type === 'true_false' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {['Prawda', 'Fałsz'].map((option, index) => {
                const isSelected = selectedAnswer === (index === 0 ? 0 : 1);
                const isCorrectAnswer = currentQuestion.correctAnswer === (index === 0 ? 0 : 1);
                const showCorrect = showFeedback && isCorrectAnswer;
                const showWrong = showFeedback && isSelected && !isCorrectAnswer;

                return (
                  <button
                    key={index}
                    onClick={() => handleAnswer(index === 0 ? 0 : 1)}
                    disabled={showFeedback}
                    className={`p-6 md:p-8 rounded-2xl text-center font-bold text-lg transition-all shadow-sm active:scale-[0.98] border-2 ${
                      showCorrect
                        ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 border-green-500 dark:border-green-600 shadow-green-100 dark:shadow-none'
                        : showWrong
                        ? 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 border-red-500 dark:border-red-600 shadow-red-100 dark:shadow-none'
                        : isSelected
                        ? 'bg-[var(--omni-lavender)] dark:bg-[var(--omni-accent)]/10 text-foreground border-[var(--omni-accent)]'
                        : 'bg-card dark:bg-slate-800/60 text-foreground border-border dark:border-slate-700 hover:border-[var(--omni-accent)]/50 hover:bg-muted'
                    }`}
                  >
                    <div className="flex flex-col items-center gap-3">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center border-2 transition-colors ${
                        showCorrect ? 'bg-green-500 border-green-500' :
                        showWrong ? 'bg-red-500 border-red-500' :
                        isSelected ? 'bg-[var(--omni-accent)] border-[var(--omni-accent)]' :
                        'bg-muted dark:bg-slate-700 border-border dark:border-slate-600'
                      }`}>
                        {showCorrect ? <Check className="w-6 h-6 text-white" /> :
                         showWrong ? <X className="w-6 h-6 text-white" /> :
                         <div className={`w-3 h-3 rounded-full transition-colors ${isSelected ? 'bg-white' : 'bg-transparent'}`} />}
                      </div>
                      <span>{option}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Feedback */}
        {showFeedback && (
          <div className={`mt-6 p-4 rounded-xl border ${
            isCorrect
              ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
              : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
          }`}>
            <div className="flex items-center gap-2 mb-2">
              {isCorrect ? (
                <>
                  <Check className="w-5 h-5 text-green-600 dark:text-green-400" />
                  <span className="font-medium text-green-700 dark:text-green-400">Poprawna odpowiedź!</span>
                </>
              ) : (
                <>
                  <X className="w-5 h-5 text-red-500 dark:text-red-400" />
                  <span className="font-medium text-red-700 dark:text-red-400">Niepoprawna odpowiedź</span>
                </>
              )}
            </div>
            <p className="text-sm text-muted-foreground">
              {currentQuestion.explanation}
            </p>
          </div>
        )}

        {/* Next Button */}
        {showFeedback && (
          <button
            onClick={handleNext}
            className="w-full mt-10 py-5 lg:py-6 omni-btn-primary flex items-center justify-center gap-3 text-lg font-bold shadow-xl active:scale-[0.98] transition-all"
          >
            {currentIndex < questions.length - 1 ? (
              <>
                Następne pytanie
                <ArrowRight className="w-6 h-6" />
              </>
            ) : (
              <>
                Zakończ quiz i zobacz wynik
                <Trophy className="w-6 h-6" />
              </>
            )}
          </button>
        )}
      </div>


      {/* Difficulty */}
      <div className="text-center">
        <span
          className={`text-sm ${
            currentQuestion.difficulty === 'easy'
              ? 'text-green-500'
              : currentQuestion.difficulty === 'medium'
              ? 'text-yellow-500'
              : 'text-orange-500'
          }`}
        >
          Poziom trudności:{' '}
          {currentQuestion.difficulty === 'easy'
            ? 'Łatwy'
            : currentQuestion.difficulty === 'medium'
            ? 'Średni'
            : 'Trudny'}
        </span>
      </div>
    </div>
  );
}
