import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import type { QuizQuestion, QuizAnswer } from '../../types';
import { Check, X, ArrowRight, HelpCircle, Trophy } from 'lucide-react';

export default function QuizPage() {
  const navigate = useNavigate();
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<QuizAnswer[]>([]);
  const [selectedAnswer, setSelectedAnswer] = useState<string | number | null>(null);
  const [showFeedback, setShowFeedback] = useState(false);
  const [isFinished, setIsFinished] = useState(false);
  const [startTime, setStartTime] = useState<number>(Date.now());

  useEffect(() => {
    // Get questions from session storage
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
  }, []);

  const currentQuestion = questions[currentIndex];
  const progress = questions.length > 0 
    ? Math.round((currentIndex / questions.length) * 100) 
    : 0;

  const handleAnswer = (answer: string | number) => {
    if (showFeedback) return;
    
    setSelectedAnswer(answer);
    setShowFeedback(true);

    const isCorrect = answer === currentQuestion.correctAnswer;
    const timeSpent = Math.round((Date.now() - startTime) / 1000);

    setAnswers(prev => [...prev, {
      questionId: currentQuestion.id,
      selectedAnswer: answer,
      isCorrect,
      timeSpentSeconds: timeSpent,
    }]);
  };

  const handleNext = () => {
    if (currentIndex < questions.length - 1) {
      setCurrentIndex(currentIndex + 1);
      setSelectedAnswer(null);
      setShowFeedback(false);
      setStartTime(Date.now());
    } else {
      setIsFinished(true);
      // Store results
      const correctCount = answers.filter(a => a.isCorrect).length;
      sessionStorage.setItem('quizResults', JSON.stringify({
        totalQuestions: questions.length,
        correctAnswers: correctCount,
        answers: answers,
      }));
    }
  };

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

          <div className="flex flex-col sm:flex-row gap-3">
            <button
              onClick={() => navigate('/app/results')}
              className="omni-btn-primary"
            >
              Zobacz szczegóły
              <ArrowRight className="w-5 h-5" />
            </button>
            <button
              onClick={() => navigate('/app/dashboard')}
              className="omni-btn-secondary"
            >
              Wróć do dashboardu
            </button>
          </div>
        </div>
      </div>
    );
  }

  const isCorrect = selectedAnswer === currentQuestion.correctAnswer;

  return (
    <div className="space-y-6">
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
        <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
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
        <div className="space-y-3">
          {currentQuestion.type === 'single_choice' && currentQuestion.options?.map((option, index) => {
            const isSelected = selectedAnswer === index;
            const isCorrectAnswer = currentQuestion.correctAnswer === index;
            const showCorrect = showFeedback && isCorrectAnswer;
            const showWrong = showFeedback && isSelected && !isCorrectAnswer;

            return (
              <button
                key={index}
                onClick={() => handleAnswer(index)}
                disabled={showFeedback}
                className={`w-full p-4 rounded-xl text-left font-medium transition-all ${
                  showCorrect
                    ? 'bg-green-100 text-green-700 border-2 border-green-300'
                    : showWrong
                    ? 'bg-red-100 text-red-700 border-2 border-red-300'
                    : isSelected
                    ? 'bg-[var(--omni-lavender)] text-[var(--omni-text)] border-2 border-[var(--omni-accent)]'
                    : 'bg-gray-50 text-[var(--omni-text)] border-2 border-transparent hover:bg-gray-100'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span>{option}</span>
                  {showCorrect && <Check className="w-5 h-5 text-green-600" />}
                  {showWrong && <X className="w-5 h-5 text-red-500" />}
                </div>
              </button>
            );
          })}

          {currentQuestion.type === 'true_false' && (
            <div className="grid grid-cols-2 gap-4">
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
                    className={`p-4 rounded-xl text-center font-medium transition-all ${
                      showCorrect
                        ? 'bg-green-100 text-green-700 border-2 border-green-300'
                        : showWrong
                        ? 'bg-red-100 text-red-700 border-2 border-red-300'
                        : isSelected
                        ? 'bg-[var(--omni-lavender)] text-[var(--omni-text)] border-2 border-[var(--omni-accent)]'
                        : 'bg-gray-50 text-[var(--omni-text)] border-2 border-transparent hover:bg-gray-100'
                    }`}
                  >
                    {option}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Feedback */}
        {showFeedback && (
          <div className={`mt-6 p-4 rounded-xl ${isCorrect ? 'bg-green-50' : 'bg-red-50'}`}>
            <div className="flex items-center gap-2 mb-2">
              {isCorrect ? (
                <>
                  <Check className="w-5 h-5 text-green-600" />
                  <span className="font-medium text-green-700">Poprawna odpowiedź!</span>
                </>
              ) : (
                <>
                  <X className="w-5 h-5 text-red-500" />
                  <span className="font-medium text-red-700">Niepoprawna odpowiedź</span>
                </>
              )}
            </div>
            <p className="text-sm text-[var(--omni-text-muted)]">
              {currentQuestion.explanation}
            </p>
          </div>
        )}

        {/* Next Button */}
        {showFeedback && (
          <button
            onClick={handleNext}
            className="w-full mt-6 omni-btn-primary"
          >
            {currentIndex < questions.length - 1 ? (
              <>
                Następne pytanie
                <ArrowRight className="w-5 h-5" />
              </>
            ) : (
              <>
                Zakończ quiz
                <Trophy className="w-5 h-5" />
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
