import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import type { QuizAnswer } from '../../types';
import { Trophy, Target, TrendingUp, Clock, ArrowRight, BookOpen, RotateCw } from 'lucide-react';

interface QuizResults {
  totalQuestions: number;
  correctAnswers: number;
  answers: QuizAnswer[];
}

export default function ResultsPage() {
  const navigate = useNavigate();
  const [results, setResults] = useState<QuizResults | null>(null);
  const [topic, setTopic] = useState('');

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
          Brak wyników
        </h2>
        <p className="text-[var(--omni-text-muted)] mb-6 text-center max-w-md">
          Rozwiąż quiz, aby zobaczyć swoje wyniki.
        </p>
        <button
          onClick={() => navigate('/app/quiz')}
          className="omni-btn-primary"
        >
          Rozpocznij quiz
        </button>
      </div>
    );
  }

  const score = results.totalQuestions > 0 ? Math.min(100, Math.max(0, Math.round((results.correctAnswers / results.totalQuestions) * 100))) : 0;
  const incorrectAnswers = Math.max(0, results.totalQuestions - results.correctAnswers);

  const getScoreColor = () => {
    if (score >= 80) return 'text-green-500';
    if (score >= 60) return 'text-yellow-500';
    return 'text-orange-500';
  };

  const getScoreMessage = () => {
    if (score >= 80) return 'Świetny wynik! 🎉';
    if (score >= 60) return 'Dobry wynik! 👍';
    return 'Wymaga poprawy 📚';
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="omni-heading-3 text-[var(--omni-text)] mb-2">
          Wyniki quizu
        </h1>
        <p className="text-[var(--omni-text-muted)]">
          {topic}
        </p>
      </div>

      {/* Score Card */}
      <div className="omni-card p-6 lg:p-8 text-center">
        <div className="w-20 h-20 bg-[var(--omni-butter)] rounded-full flex items-center justify-center mx-auto mb-4">
          <Trophy className="w-10 h-10 text-[var(--omni-text)]" />
        </div>
        <h2 className={`text-5xl lg:text-6xl font-bold ${getScoreColor()} mb-2`}>
          {score}%
        </h2>
        <p className="text-lg text-[var(--omni-text-muted)] mb-2">
          {getScoreMessage()}
        </p>
        <p className="text-sm text-[var(--omni-text-muted)]">
          {results.correctAnswers} poprawnych z {results.totalQuestions} pytań
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="omni-card p-4 text-center">
          <Target className="w-6 h-6 text-[var(--omni-accent)] mx-auto mb-2" />
          <p className="text-2xl font-bold text-[var(--omni-text)]">
            {results.totalQuestions}
          </p>
          <p className="text-sm text-[var(--omni-text-muted)]">Wszystkich pytań</p>
        </div>
        <div className="omni-card p-4 text-center">
          <TrendingUp className="w-6 h-6 text-green-500 mx-auto mb-2" />
          <p className="text-2xl font-bold text-green-500">
            {results.correctAnswers}
          </p>
          <p className="text-sm text-[var(--omni-text-muted)]">Poprawnych</p>
        </div>
        <div className="omni-card p-4 text-center">
          <div className="w-6 h-6 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-2">
            <span className="text-red-500 text-sm font-bold">✕</span>
          </div>
          <p className="text-2xl font-bold text-red-500">
            {incorrectAnswers}
          </p>
          <p className="text-sm text-[var(--omni-text-muted)]">Błędnych</p>
        </div>
        <div className="omni-card p-4 text-center">
          <Clock className="w-6 h-6 text-blue-500 mx-auto mb-2" />
          <p className="text-2xl font-bold text-[var(--omni-text)]">
            ~{Math.round(results.answers.reduce((acc, a) => acc + a.timeSpentSeconds, 0) / 60)}m
          </p>
          <p className="text-sm text-[var(--omni-text-muted)]">Czas</p>
        </div>
      </div>

      {/* Recommendations */}
      <div className="omni-card p-6">
        <h3 className="font-semibold text-[var(--omni-text)] mb-4 flex items-center gap-2">
          <BookOpen className="w-5 h-5" />
          Rekomendacje
        </h3>
        <div className="space-y-3">
          {score < 80 && (
            <div className="p-4 bg-yellow-50 rounded-xl">
              <p className="text-yellow-700">
                <strong>Powtórz materiał:</strong> Spróbuj przejść przez fiszki 
                jeszcze raz, zanim podejdziesz do quizu ponownie.
              </p>
            </div>
          )}
          <div className="p-4 bg-[var(--omni-lavender)]/30 rounded-xl">
            <p className="text-[var(--omni-text)]">
              <strong>Twoje mocne strony:</strong> Dobrze radzisz sobie z 
              podstawowymi pojęciami. Kontynuuj naukę!
            </p>
          </div>
          {incorrectAnswers > 0 && (
            <div className="p-4 bg-red-50 rounded-xl">
              <p className="text-red-700">
                <strong>Do poprawy:</strong> Masz {incorrectAnswers} błędnych 
                odpowiedzi. Przejrzyj wyjaśnienia do tych pytań.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="flex flex-col sm:flex-row gap-4">
        <button
          onClick={() => navigate('/app/quiz')}
          className="flex-1 omni-btn-primary"
        >
          <RotateCw className="w-5 h-5" />
          Powtórz quiz
        </button>
        <Link to="/app/flashcards" className="flex-1 omni-btn-secondary">
          <BookOpen className="w-5 h-5" />
          Ucz się fiszek
        </Link>
        <Link to="/app/dashboard" className="flex-1 omni-btn-secondary">
          Dashboard
          <ArrowRight className="w-5 h-5" />
        </Link>
      </div>
    </div>
  );
}
