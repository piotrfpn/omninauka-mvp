import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import type { FlashcardData } from '../../types';
import { RotateCw, ChevronLeft, ChevronRight, BookOpen } from 'lucide-react';

export default function FlashcardsPage() {
  const navigate = useNavigate();
  const [flashcards, setFlashcards] = useState<FlashcardData[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [knownCards, setKnownCards] = useState<Set<string>>(new Set());

  useEffect(() => {
    // Get flashcards from session storage
    const analysisStr = sessionStorage.getItem('currentAnalysis');
    if (analysisStr) {
      try {
        const analysis = JSON.parse(analysisStr);
        setFlashcards(analysis.flashcards || []);
      } catch {
        setFlashcards([]);
      }
    }
  }, []);

  const currentCard = flashcards[currentIndex];
  const progress = flashcards.length > 0 
    ? Math.round((knownCards.size / flashcards.length) * 100) 
    : 0;

  const handleFlip = () => {
    setIsFlipped(!isFlipped);
  };

  const handleNext = () => {
    if (currentIndex < flashcards.length - 1) {
      setIsFlipped(false);
      setTimeout(() => setCurrentIndex(currentIndex + 1), 150);
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
      handleNext();
    }
  };

  const handleUnknown = () => {
    handleNext();
  };

  if (flashcards.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <div className="w-16 h-16 bg-[var(--omni-lavender)] rounded-2xl flex items-center justify-center mb-6">
          <BookOpen className="w-8 h-8 text-[var(--omni-text)]" />
        </div>
        <h2 className="omni-heading-3 text-[var(--omni-text)] mb-2">
          Brak fiszek
        </h2>
        <p className="text-[var(--omni-text-muted)] mb-6 text-center max-w-md">
          Najpierw prześlij swoje notatki, a AI wygeneruje fiszki do nauki.
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

  if (currentIndex >= flashcards.length) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <div className="omni-card p-8 text-center max-w-md">
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <span className="text-3xl">🎉</span>
          </div>
          <h2 className="omni-heading-3 text-[var(--omni-text)] mb-2">
            Gratulacje!
          </h2>
          <p className="text-[var(--omni-text-muted)] mb-6">
            Przerobiłeś wszystkie fiszki. Znasz {knownCards.size} z {flashcards.length} pojęć.
          </p>
          <div className="flex flex-col sm:flex-row gap-3">
            <button
              onClick={() => {
                setCurrentIndex(0);
                setKnownCards(new Set());
                setIsFlipped(false);
              }}
              className="omni-btn-primary"
            >
              Powtórz fiszki
            </button>
            <button
              onClick={() => navigate('/app/quiz')}
              className="omni-btn-secondary"
            >
              Przejdź do quizu
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="omni-heading-3 text-[var(--omni-text)] mb-1">
            Fiszki
          </h1>
          <p className="text-[var(--omni-text-muted)]">
            Ucz się kluczowych pojęć
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-[var(--omni-text-muted)]">
            Postęp:
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

      {/* Progress Counter */}
      <div className="text-center">
        <span className="text-sm text-[var(--omni-text-muted)]">
          Karta {currentIndex + 1} z {flashcards.length}
        </span>
      </div>

      {/* Flashcard */}
      <div className="flex justify-center">
        <div
          onClick={handleFlip}
          className="relative w-full max-w-lg aspect-[4/3] cursor-pointer"
          style={{ perspective: '1000px' }}
        >
          <div
            className={`relative w-full h-full transition-transform duration-500 ${
              isFlipped ? '[transform:rotateY(180deg)]' : ''
            }`}
            style={{ transformStyle: 'preserve-3d' }}
          >
            {/* Front */}
            <div
              className="absolute inset-0 omni-card flex flex-col items-center justify-center p-8"
              style={{ backfaceVisibility: 'hidden' }}
            >
              <span className="text-sm text-[var(--omni-text-muted)] uppercase tracking-wider mb-4">
                Pojęcie
              </span>
              <h3 className="text-2xl lg:text-3xl font-bold text-[var(--omni-text)] text-center">
                {currentCard.front}
              </h3>
              <div className="absolute bottom-6 right-6 flex items-center gap-2 text-[var(--omni-text-muted)]">
                <RotateCw className="w-4 h-4" />
                <span className="text-sm">Kliknij, by odwrócić</span>
              </div>
            </div>

            {/* Back */}
            <div
              className="absolute inset-0 omni-card flex flex-col items-center justify-center p-8 bg-[var(--omni-mint)]/30"
              style={{
                backfaceVisibility: 'hidden',
                transform: 'rotateY(180deg)',
              }}
            >
              <span className="text-sm text-[var(--omni-text-muted)] uppercase tracking-wider mb-4">
                Definicja
              </span>
              <p className="text-lg lg:text-xl text-[var(--omni-text)] text-center leading-relaxed">
                {currentCard.back}
              </p>
              <div className="absolute bottom-6 right-6 flex items-center gap-2 text-[var(--omni-text-muted)]">
                <RotateCw className="w-4 h-4" />
                <span className="text-sm">Kliknij, by odwrócić</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center justify-center gap-4">
        <button
          onClick={handlePrevious}
          disabled={currentIndex === 0}
          className="p-3 rounded-full bg-white shadow-lg disabled:opacity-50 disabled:cursor-not-allowed hover:shadow-xl transition-shadow"
        >
          <ChevronLeft className="w-6 h-6 text-[var(--omni-text)]" />
        </button>

        <div className="flex gap-3">
          <button
            onClick={handleUnknown}
            className="px-6 py-3 bg-red-100 text-red-600 rounded-full font-medium hover:bg-red-200 transition-colors"
          >
            Nie wiem
          </button>
          <button
            onClick={handleKnown}
            className="px-6 py-3 bg-green-100 text-green-600 rounded-full font-medium hover:bg-green-200 transition-colors"
          >
            Znam
          </button>
        </div>

        <button
          onClick={handleNext}
          disabled={currentIndex === flashcards.length - 1}
          className="p-3 rounded-full bg-white shadow-lg disabled:opacity-50 disabled:cursor-not-allowed hover:shadow-xl transition-shadow"
        >
          <ChevronRight className="w-6 h-6 text-[var(--omni-text)]" />
        </button>
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
          Poziom:{' '}
          {currentCard.difficulty === 'easy'
            ? 'Łatwy'
            : currentCard.difficulty === 'medium'
            ? 'Średni'
            : 'Trudny'}
        </span>
      </div>
    </div>
  );
}
