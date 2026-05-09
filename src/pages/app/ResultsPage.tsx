import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import type { QuizAnswer } from '../../types';
import { Trophy, Target, TrendingUp, Clock, ArrowRight, RotateCw, Bot, Check } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../lib/auth-context';
import { getEffectivePlan } from '../../lib/plan-utils';
import { getFeatureAccess } from '../../lib/feature-access';

interface QuizResults {
  totalQuestions: number;
  correctAnswers: number;
  answers: QuizAnswer[];
}

export default function ResultsPage() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [results, setResults] = useState<QuizResults | null>(null);
  const [topic, setTopic] = useState('');
  const [fullAnalysis, setFullAnalysis] = useState<any>(null);

  const { user } = useAuth();
  const effectivePlan = getEffectivePlan(user);
  const { mistakeReview } = getFeatureAccess(effectivePlan);

  const handleExplainMistakes = () => {
    if (!results || !fullAnalysis) return;
    
    const incorrectAnswersData = results.answers
      .filter(a => !a.isCorrect)
      .map(a => {
        // We now rely on the pre-filled text fields from QuizPage. 
        // If they are missing (e.g. old session), we just pass them through so LessonPage can handle the fallback gently.
        return {
          question: a.questionText || '',
          selectedAnswer: a.selectedAnswerText || String(a.selectedAnswer),
          correctAnswer: a.correctAnswerText || '',
          explanation: a.explanation || ''
        };
      });

    const mistakesToPass = mistakeReview === 'preview' 
      ? incorrectAnswersData.slice(0, 1) 
      : incorrectAnswersData;

    if (mistakesToPass.length > 0) {
      sessionStorage.setItem('omninauka_mistake_review_context', JSON.stringify({
        reviewId: Date.now().toString(),
        mistakes: mistakesToPass
      }));
      navigate('/app/lesson', { state: { mistakeReview: true } });
    }
  };

  useEffect(() => {
    const resultsStr = sessionStorage.getItem('quizResults');
    const analysisStr = sessionStorage.getItem('currentAnalysis');
    
    if (resultsStr) {
      try {
        setResults(JSON.parse(resultsStr));
      } catch {
        setResults(null);
      }
    }

    if (analysisStr) {
      try {
        const analysis = JSON.parse(analysisStr);
        setTopic(analysis.topic);
        setFullAnalysis(analysis);
      } catch {
        setTopic('');
      }
    }
  }, []);

  if (!results) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <div className="w-16 h-16 bg-[var(--omni-peach)] rounded-2xl flex items-center justify-center mb-6">
          <Trophy className="w-8 h-8 text-[var(--omni-text)]" />
        </div>
        <h2 className="omni-heading-3 text-[var(--omni-text)] mb-2">
          {t('results.empty.title')}
        </h2>
        <p className="text-[var(--omni-text-muted)] mb-6 text-center max-w-md">
          {t('results.empty.desc')}
        </p>
        <button
          onClick={() => navigate('/app/quiz')}
          className="omni-btn-primary"
        >
          {t('results.empty.cta')}
        </button>
      </div>
    );
  }

  const score = results.totalQuestions > 0 ? Math.min(100, Math.max(0, Math.round((results.correctAnswers / results.totalQuestions) * 100))) : 0;
  const incorrectAnswers = Math.max(0, results.totalQuestions - results.correctAnswers);
  const correctAnswers = results.answers.filter(a => a.isCorrect);
  const mistakes = results.answers.filter(a => !a.isCorrect);

  const getScoreColor = () => {
    if (score >= 80) return 'text-green-500';
    if (score >= 60) return 'text-yellow-500';
    return 'text-orange-500';
  };

  const getScoreMessage = () => {
    if (score >= 80) return t('results.messages.excellent');
    if (score >= 60) return t('results.messages.good');
    return t('results.messages.improve');
  };

  const isPremium = effectivePlan !== 'free';

  return (
    <div className="space-y-8 pb-12">
      {/* Header */}
      <div>
        <h1 className="omni-heading-3 text-[var(--omni-text)] mb-2">
          {isPremium ? t('results.report.title') : t('quiz.titleFree')}
        </h1>
        <p className="text-[var(--omni-text-muted)]">
          {topic}
        </p>
      </div>

      {/* Score Card */}
      <div className="omni-card p-6 lg:p-8 text-center bg-white dark:bg-slate-800/50">
        <div className="w-16 h-16 bg-[var(--omni-butter)] rounded-full flex items-center justify-center mx-auto mb-4">
          <Trophy className="w-8 h-8 text-[var(--omni-text)]" />
        </div>
        <h2 className={`text-5xl lg:text-6xl font-bold ${getScoreColor()} mb-2`}>
          {score}%
        </h2>
        <p className="text-lg font-semibold text-[var(--omni-text)] mb-2">
          {getScoreMessage()}
        </p>
        <p className="text-sm text-[var(--omni-text-muted)]">
          {t('results.stats.correctFromTotal', { correct: results.correctAnswers, total: results.totalQuestions })}
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="omni-card p-4 text-center bg-white dark:bg-slate-800/50">
          <Target className="w-5 h-5 text-[var(--omni-accent)] mx-auto mb-2" />
          <p className="text-xl font-bold text-[var(--omni-text)]">
            {results.totalQuestions}
          </p>
          <p className="text-[10px] uppercase tracking-wider font-bold text-[var(--omni-text-muted)]">{t('results.stats.totalQuestions')}</p>
        </div>
        <div className="omni-card p-4 text-center bg-white dark:bg-slate-800/50">
          <TrendingUp className="w-5 h-5 text-green-500 mx-auto mb-2" />
          <p className="text-xl font-bold text-green-500">
            {results.correctAnswers}
          </p>
          <p className="text-[10px] uppercase tracking-wider font-bold text-[var(--omni-text-muted)]">{t('results.stats.correct')}</p>
        </div>
        <div className="omni-card p-4 text-center bg-white dark:bg-slate-800/50">
          <div className="w-5 h-5 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center mx-auto mb-2">
            <span className="text-red-500 text-[10px] font-bold">✕</span>
          </div>
          <p className="text-xl font-bold text-red-500">
            {incorrectAnswers}
          </p>
          <p className="text-[10px] uppercase tracking-wider font-bold text-[var(--omni-text-muted)]">{t('results.stats.incorrect')}</p>
        </div>
        <div className="omni-card p-4 text-center bg-white dark:bg-slate-800/50">
          <Clock className="w-5 h-5 text-blue-500 mx-auto mb-2" />
          <p className="text-xl font-bold text-[var(--omni-text)]">
            ~{Math.max(1, Math.round(results.answers.reduce((acc, a) => acc + a.timeSpentSeconds, 0) / 60))}m
          </p>
          <p className="text-[10px] uppercase tracking-wider font-bold text-[var(--omni-text-muted)]">{t('results.stats.time')}</p>
        </div>
      </div>

      {isPremium ? (
        <>
          {/* Premium Report: Strengths */}
          <div className="space-y-4">
            <h3 className="text-lg font-bold text-[var(--omni-text)] px-1">
              {t('results.report.strengths.title')}
            </h3>
            <div className="omni-card p-6 bg-green-50/50 dark:bg-green-950/10 border-green-100 dark:border-green-900/30">
              {correctAnswers.length > 0 ? (
                <div className="space-y-4">
                  <p className="text-sm text-green-800/80 dark:text-green-200/80 mb-4">
                    {t('results.report.strengths.desc')}
                  </p>
                  <ul className="space-y-3">
                    {correctAnswers.map((ans, idx) => (
                      <li key={idx} className="flex items-start gap-3 text-sm text-green-900 dark:text-green-100">
                        <div className="w-5 h-5 rounded-full bg-green-500 flex items-center justify-center flex-shrink-0 mt-0.5">
                          <Check className="w-3 h-3 text-white" />
                        </div>
                        <span>{ans.questionText || `Pytanie ${idx + 1}`}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground italic">
                  {t('results.report.strengths.empty')}
                </p>
              )}
            </div>
          </div>

          {/* Premium Report: To Improve */}
          {mistakes.length > 0 && (
            <div className="space-y-4">
              <h3 className="text-lg font-bold text-[var(--omni-text)] px-1">
                {t('results.report.toImprove.title')}
              </h3>
              <div className="space-y-4">
                {mistakes.map((ans, idx) => (
                  <div key={idx} className="omni-card p-5 border-l-4 border-l-red-500 bg-white dark:bg-slate-800/50">
                    <div className="space-y-4">
                      <div>
                        <span className="text-[10px] uppercase tracking-widest font-bold text-red-500 mb-1 block">
                          {t('results.report.toImprove.question')}
                        </span>
                        <p className="text-base font-semibold text-[var(--omni-text)]">
                          {ans.questionText || t('results.report.toImprove.fallback')}
                        </p>
                      </div>
                      
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="p-3 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-900/30">
                          <span className="text-[10px] uppercase font-bold text-red-600 dark:text-red-400 block mb-1">
                            {t('results.report.toImprove.yourAnswer')}
                          </span>
                          <p className="text-sm font-medium text-red-800 dark:text-red-200">
                            {ans.selectedAnswerText || String(ans.selectedAnswer)}
                          </p>
                        </div>
                        <div className="p-3 rounded-xl bg-green-50 dark:bg-green-950/30 border border-green-100 dark:border-green-900/30">
                          <span className="text-[10px] uppercase font-bold text-green-600 dark:text-green-400 block mb-1">
                            {t('results.report.toImprove.correctAnswer')}
                          </span>
                          <p className="text-sm font-medium text-green-800 dark:text-green-200">
                            {ans.correctAnswerText || "Poprawna odpowiedź"}
                          </p>
                        </div>
                      </div>

                      {ans.explanation && (
                        <div className="pt-3 border-t border-border/50">
                          <span className="text-[10px] uppercase font-bold text-muted-foreground block mb-1">
                            {t('results.report.toImprove.explanation')}
                          </span>
                          <p className="text-sm text-[var(--omni-text-muted)] italic">
                            {ans.explanation}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Next Steps */}
          <div className="omni-card p-6 bg-indigo-50/30 dark:bg-indigo-950/10 border-indigo-100 dark:border-indigo-900/30">
            <h3 className="font-bold text-[var(--omni-text)] mb-4 flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-indigo-500" />
              {t('results.report.nextSteps.title')}
            </h3>
            <ul className="space-y-3">
              <li className="flex items-center gap-3 text-sm text-[var(--omni-text)]">
                <div className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
                {t('results.report.nextSteps.discuss')}
              </li>
              <li className="flex items-center gap-3 text-sm text-[var(--omni-text)]">
                <div className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
                {t('results.report.nextSteps.repeatFlashcards')}
              </li>
              <li className="flex items-center gap-3 text-sm text-[var(--omni-text)]">
                <div className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
                {t('results.report.nextSteps.retryTest')}
              </li>
            </ul>
          </div>
        </>
      ) : (
        /* Free View Upsell */
        <div className="omni-card p-6 border-2 border-dashed border-indigo-200 dark:border-indigo-900/50 bg-indigo-50/20 dark:bg-indigo-950/10 text-center">
          <Bot className="w-10 h-10 text-indigo-500 mx-auto mb-4" />
          <h3 className="text-lg font-bold text-[var(--omni-text)] mb-2">
            {t('results.report.upsell.title')}
          </h3>
          <p className="text-sm text-[var(--omni-text-muted)] mb-6 max-w-sm mx-auto">
            {t('results.report.upsell.desc')}
          </p>
          <Link to="/app/payments" className="omni-btn-primary inline-flex">
            {t('results.report.upsell.cta')}
          </Link>
        </div>
      )}

      {/* Primary Actions */}
      <div className="flex flex-col gap-4">
        {incorrectAnswers > 0 && (
          <button
            onClick={handleExplainMistakes}
            className="w-full p-5 bg-gradient-to-r from-indigo-600 to-violet-600 text-white font-bold rounded-2xl hover:opacity-90 transition-all flex items-center justify-center gap-3 shadow-lg shadow-indigo-200 dark:shadow-none"
          >
            <Bot className="w-6 h-6" />
            <div className="text-left">
              <p className="text-base leading-none mb-1">
                {isPremium ? t('results.report.actions.discuss') : 'Wyjaśnij pierwszy błąd (Preview)'}
              </p>
              {!isPremium && <p className="text-[10px] font-medium opacity-80">W Premium omówisz wszystkie błędy</p>}
            </div>
          </button>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <button
            onClick={() => navigate('/app/quiz')}
            className="omni-btn-secondary py-4 flex items-center justify-center gap-2"
          >
            <RotateCw className="w-5 h-5" />
            {isPremium ? t('results.report.actions.repeatTest') : t('results.actions.repeatQuiz')}
          </button>
          
          <Link to="/app/dashboard" className="omni-btn-secondary py-4 flex items-center justify-center gap-2">
            <ArrowRight className="w-5 h-5 order-last" />
            {t('results.report.actions.dashboard')}
          </Link>
        </div>
      </div>
    </div>
  );
}
