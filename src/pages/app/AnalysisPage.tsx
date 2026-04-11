import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import type { AnalysisResult, KeyConcept } from '../../types';
import { getDemoAnalysis } from '../../mock/data';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/auth-context';

import {
  BookOpen,
  HelpCircle,
  MessageCircle,
  ArrowRight,
  Sparkles,
  Lightbulb,
  Calendar,
  User,
  Hash,
  CheckCircle,
  Pencil,
  Check,
  X,
  Image as ImageIcon,
} from 'lucide-react';

export default function AnalysisPage() {
  const navigate = useNavigate();
  const { isDemoMode } = useAuth();
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [sessionImages, setSessionImages] = useState<string[]>([]);
  const [activeImageIdx, setActiveImageIdx] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  // Sprint 1: lesson title
  const [lessonTitle, setLessonTitle] = useState<string>('');
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleInput, setTitleInput] = useState<string>('');
  const [savingTitle, setSavingTitle] = useState(false);
  const currentSessionId = sessionStorage.getItem('currentSessionId') ?? '';

  useEffect(() => {
    const sessionId = sessionStorage.getItem('currentSessionId');
    if (!sessionId) {
      navigate('/app/upload');
      return;
    }

    // DEMO BYPASS: We retrieve the explicitly mocked base64
    if (sessionId === 'demo-session') {
      const demoImg = sessionStorage.getItem('demoImageBase64');
      if (demoImg) {
        setUploadedImage(demoImg);
        setSessionImages([demoImg]);
      }
      
      const timer = setTimeout(() => {
        const result = getDemoAnalysis();
        setAnalysis(result);
        sessionStorage.setItem('currentAnalysis', JSON.stringify(result));
        setIsLoading(false);
      }, 1500);
      
      return () => clearTimeout(timer);
    }

    // REAL DB FLOW (Private Bucket + Signed URLs + DB Sessions)
    const fetchSession = async () => {
      try {
        const { data: sessionData } = await supabase
          .from('study_sessions')
          .select('*')
          .eq('id', sessionId)
          .single();

        // 1. Fetch all associated images from session_images
        const { data: imagesData } = await supabase
          .from('session_images')
          .select('image_url, position')
          .eq('session_id', sessionId)
          .order('position', { ascending: true });

        // 2. Logic for paths (including fallback for Sprint 1 sessions)
        let paths: string[] = [];
        if (imagesData && imagesData.length > 0) {
          paths = imagesData.map(img => img.image_url);
        } else if (sessionData && sessionData.image_url) {
          // Backward compatibility fallback
          paths = [sessionData.image_url];
        }

        // 3. Batch generate signed URLs
        if (paths.length > 0) {
          const { data: signedResults, error: signError } = await supabase.storage
            .from('study-materials')
            .createSignedUrls(paths, 3600);

          if (signError) {
            console.error("Failed to sign URLs:", signError);
          } else if (signedResults) {
            const urls = signedResults.map(s => s.signedUrl);
            setSessionImages(urls);
            setUploadedImage(urls[0]); // Default to first image
          }
        }
        if (sessionData && !sessionData.subject) {
          // Retrieve session explicitly to ensure token is fresh
          const { data: { session } } = await supabase.auth.getSession();
          
          const functionUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/analyze-notes`;
          
          const rawResponse = await fetch(functionUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
              ...(session ? { 'Authorization': `Bearer ${session.access_token}` } : {})
            },
            body: JSON.stringify({ sessionId })
          });

          let backendPayload = "";
          try {
            backendPayload = await rawResponse.text();
          } catch (e) {
            backendPayload = "Failed to parse body text";
          }

          if (!rawResponse.ok || (backendPayload.includes("error") && !rawResponse.ok)) {
            let errorMsg = "Wystąpił problem z serwerem analizy AI. Spróbuj ponownie lub skontaktuj się ze wsparciem.";
            
            if (rawResponse.status === 422 || backendPayload.includes("Nie wykryto") || backendPayload.includes("no text")) {
               errorMsg = "Nie udało się odczytać tekstu ze zdjęcia. Spróbuj zrobić zdjęcie bliżej, przy lepszym świetle i tak, aby tekst był wyraźny.";
            } else if (rawResponse.status === 401 || rawResponse.status === 403 || backendPayload.includes("Unauthorized") || backendPayload.includes("validation failed")) {
               errorMsg = "Uwierzytelnienie sesji wygasło. Odśwież stronę i w razie potrzeby zaloguj się ponownie.";
            } else if (rawResponse.status === 404 || backendPayload.includes("Session not found")) {
               errorMsg = "Sesja analizy wygasła lub nie została poprawnie zapisana. Prześlij notatkę ponownie.";
            } else if (backendPayload.includes("Failed to download image")) {
               errorMsg = "Błąd uprawnień do wczytania obrazu. Spróbuj powtórzyć wgranie pliku.";
            } else if (backendPayload.includes("interpretacji tekstu") || backendPayload.includes("OpenAI")) {
               errorMsg = "Model AI miał problem ze zrozumieniem tych notatek. Spróbuj wyraźniejszego ujęcia.";
            } else if (rawResponse.status >= 500) {
               errorMsg = "Wystąpił tymczasowy błąd serwera. Spróbuj za chwilę.";
            }

            // Developer diagnostic logging kept strictly inside the console
            console.error(`Edge function analysis failed (Status ${rawResponse.status}):`, backendPayload);
            
            // Clean UX message mapping returned to the UI instead of raw debug strings
            setAnalysisError(errorMsg);
            setIsLoading(false);
            return;
          }

          // Fetch the updated row post-analysis
          const { data: updatedSession } = await supabase
            .from('study_sessions')
            .select('*')
            .eq('id', sessionId)
            .single();

          if (updatedSession && updatedSession.subject) {
            applySessionToState(updatedSession);
            setLessonTitle(updatedSession.lesson_title || '');
          }
          
        } else if (sessionData && sessionData.subject) {
          // Session already generated, just read it
          applySessionToState(sessionData);
          setLessonTitle(sessionData.lesson_title || '');
        }

        setIsLoading(false);
      } catch (err: any) {
        console.error("Failed to resolve active DB session:", err);
        setAnalysisError(err?.message || "Wystąpił nieoczekiwany błąd sieci.");
        setIsLoading(false);
      }
    };

    // Helper mapping DB JSON back to strong React TypeScript Interfaces
    const applySessionToState = (dbRow: any) => {
      const result: AnalysisResult = {
        id: dbRow.id,
        subject: dbRow.subject,
        topic: dbRow.topic,
        confidence: dbRow.confidence,
        summary: dbRow.summary,
        sourceFileId: dbRow.image_url,
        createdAt: new Date(dbRow.created_at),
        // Inject randomized UUIDs for React mapping since payload omits them to save GPT tokens
        keyConcepts: (dbRow.key_concepts || []).map((kc: any) => ({ ...kc, id: crypto.randomUUID() })),
        flashcards: (dbRow.flashcards || []).map((fc: any) => ({ ...fc, id: crypto.randomUUID() })),
        quizQuestions: (dbRow.quiz_questions || []).map((qq: any) => ({
          ...qq,
          id: crypto.randomUUID(),
          type: 'single_choice',
          correctAnswer: qq.correctIndex
        }))
      };
      setAnalysis(result);
      sessionStorage.setItem('currentAnalysis', JSON.stringify(result));
    };

    fetchSession();

  }, [navigate]);

  const getCategoryIcon = (category: KeyConcept['category']) => {
    switch (category) {
      case 'date':
        return Calendar;
      case 'person':
        return User;
      case 'formula':
        return Hash;
      default:
        return Lightbulb;
    }
  };

  const getCategoryLabel = (category: KeyConcept['category']) => {
    switch (category) {
      case 'definition': return 'Definicja';
      case 'date': return 'Data';
      case 'formula': return 'Wzór';
      case 'person': return 'Osoba';
      case 'event': return 'Wydarzenie';
      default: return 'Pojęcie';
    }
  };

  // Sprint 1: save lesson title to DB
  const handleSaveLessonTitle = async () => {
    if (savingTitle || isDemoMode || !currentSessionId) return;
    const trimmed = titleInput.trim();
    setSavingTitle(true);
    try {
      const { error } = await supabase
        .from('study_sessions')
        .update({ lesson_title: trimmed || null })
        .eq('id', currentSessionId);
      if (error) throw error;
      setLessonTitle(trimmed);
      setEditingTitle(false);
    } catch (err) {
      console.error('Lesson title save failed:', err);
    } finally {
      setSavingTitle(false);
    }
  };

  const startEditingTitle = () => {
    if (isDemoMode) return;
    setTitleInput(lessonTitle);
    setEditingTitle(true);
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <div className="w-16 h-16 border-4 border-[var(--omni-accent)]/30 border-t-[var(--omni-accent)] rounded-full animate-spin mb-6" />
        <h2 className="omni-heading-3 text-[var(--omni-text)] mb-2">
          Analizuję Twoje notatki...
        </h2>
        <p className="text-[var(--omni-text-muted)]">
          To może potrwać kilka sekund
        </p>
        <div className="mt-8 flex items-center gap-2 text-sm text-[var(--omni-text-muted)]">
          <Sparkles className="w-4 h-4" />
          <span>AI wykrywa kluczowe pojęcia, daty i definicje</span>
        </div>
      </div>
    );
  }

  if (analysisError) {
    return (
      <div className="text-center py-12 mt-12 bg-red-50/50 dark:bg-red-950/20 rounded-2xl border border-red-100 dark:border-red-900 mx-auto max-w-lg p-8">
        <h2 className="text-xl font-semibold text-red-600 dark:text-red-400 mb-2">Błąd analizy</h2>
        <p className="text-red-800/80 dark:text-red-200/80 mb-6">{analysisError}</p>
        <Link to="/app/upload" className="omni-btn-primary inline-flex">
          Spróbuj ponownie z innym zdjęciem
        </Link>
      </div>
    );
  }

  if (!analysis) {
    return (
      <div className="text-center py-12">
        <p className="text-[var(--omni-text-muted)]">Nie znaleziono analizy</p>
        <Link to="/app/upload" className="omni-btn-primary mt-4 inline-flex">
          Wróć do uploadu
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="omni-chip bg-[var(--omni-lavender)] text-[var(--omni-text)]">
              {analysis.subject}
            </span>
            <span className="text-sm text-[var(--omni-text-muted)]">
              Pewność: {Math.round(analysis.confidence * 100)}%
            </span>
            {isDemoMode && (
              <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium">
                Tryb Demo
              </span>
            )}
          </div>
          <h1 className="omni-heading-3 text-[var(--omni-text)] mb-3">
            {analysis.topic}
          </h1>

          {/* Sprint 1: Lesson title editor */}
          {!isDemoMode && (
            <div className="flex items-center gap-2">
              {editingTitle ? (
                <>
                  <input
                    autoFocus
                    type="text"
                    value={titleInput}
                    onChange={e => setTitleInput(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') handleSaveLessonTitle();
                      if (e.key === 'Escape') setEditingTitle(false);
                    }}
                    maxLength={80}
                    placeholder="Nazwa lekcji..."
                    className="text-sm border border-indigo-300 rounded-lg px-3 py-1.5 outline-none focus:ring-2 focus:ring-indigo-400 bg-white text-[var(--omni-text)] min-w-[200px]"
                  />
                  <button
                    onClick={handleSaveLessonTitle}
                    disabled={savingTitle}
                    className="p-1.5 rounded-lg bg-indigo-100 hover:bg-indigo-200 text-indigo-700 transition-colors disabled:opacity-50"
                    title="Zapisz"
                  >
                    {savingTitle
                      ? <div className="w-4 h-4 border-2 border-indigo-400/30 border-t-indigo-600 rounded-full animate-spin" />
                      : <Check className="w-4 h-4" />}
                  </button>
                  <button
                    onClick={() => setEditingTitle(false)}
                    className="p-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-600 transition-colors"
                    title="Anuluj"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </>
              ) : (
                <button
                  onClick={startEditingTitle}
                  className="flex items-center gap-1.5 text-sm group/title"
                  title="Kliknij aby nadać nazwę lekcji"
                >
                  <span className={lessonTitle ? 'text-indigo-600 font-medium' : 'text-[var(--omni-text-muted)] italic'}>
                    {lessonTitle || 'Dodaj nazwę lekcji...'}
                  </span>
                  <Pencil className="w-3.5 h-3.5 text-[var(--omni-text-muted)] opacity-0 group-hover/title:opacity-100 transition-opacity" />
                </button>
              )}
            </div>
          )}
        </div>
        {uploadedImage && (
          <div className="flex flex-col gap-3 flex-shrink-0">
             {/* Main Preview */}
            <div className="w-24 h-24 lg:w-48 lg:h-48 rounded-xl overflow-hidden shadow-sm bg-gray-100 flex items-center justify-center border border-gray-100">
              <img
                src={uploadedImage}
                alt="Analyzed"
                className="w-full h-full object-cover cursor-zoom-in"
                onClick={() => window.open(uploadedImage, '_blank')}
                title="Kliknij, aby otworzyć w pełnym rozmiarze"
              />
            </div>
            
            {/* Thumbnail Gallery (only show if > 1 images) */}
            {sessionImages.length > 1 && (
              <div className="flex gap-2 p-1 overflow-x-auto max-w-[200px] lg:max-w-[300px] no-scrollbar">
                {sessionImages.map((url, idx) => (
                  <button
                    key={idx}
                    onClick={() => {
                      setUploadedImage(url);
                      setActiveImageIdx(idx);
                    }}
                    className={`relative w-10 h-10 lg:w-12 lg:h-12 rounded-lg overflow-hidden flex-shrink-0 border-2 transition-all 
                      ${uploadedImage === url ? 'border-[var(--omni-accent)] scale-105' : 'border-transparent opacity-60 hover:opacity-100'}`}
                  >
                    <img src={url} alt={`Strona ${idx + 1}`} className="w-full h-full object-cover" />
                    <div className="absolute bottom-0 right-0 bg-black/50 text-white text-[8px] px-1 rounded-tl">
                      {idx + 1}
                    </div>
                  </button>
                ))}
              </div>
            )}
            
            {sessionImages.length > 1 && (
              <p className="text-[10px] text-[var(--omni-text-muted)] text-center">
                Strona {activeImageIdx + 1} z {sessionImages.length}
              </p>
            )}
          </div>
        )}
      </div>

      {/* Summary */}
      <div className="omni-card p-4 lg:p-6 bg-[var(--omni-mint)]/30">
        <h3 className="font-semibold text-[var(--omni-text)] mb-2 flex items-center gap-2">
          <Sparkles className="w-5 h-5" />
          Podsumowanie
        </h3>
        <p className="text-[var(--omni-text-muted)]">{analysis.summary}</p>
      </div>

      {/* Key Concepts */}
      <div>
        <h3 className="font-semibold text-[var(--omni-text)] mb-4">
          Kluczowe pojęcia ({analysis.keyConcepts.length})
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {analysis.keyConcepts.map((concept) => {
            const Icon = getCategoryIcon(concept.category);
            return (
              <div key={concept.id} className="omni-card p-4">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 bg-[var(--omni-lavender)] rounded-lg flex items-center justify-center flex-shrink-0">
                    <Icon className="w-5 h-5 text-[var(--omni-text)]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium text-[var(--omni-text)]">
                        {concept.term}
                      </span>
                      <span className="text-xs text-[var(--omni-text-muted)]">
                        ({getCategoryLabel(concept.category)})
                      </span>
                    </div>
                    <p className="text-sm text-[var(--omni-text-muted)]">
                      {concept.definition}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Actions */}
      <div>
        <h3 className="font-semibold text-[var(--omni-text)] mb-4">
          Co chcesz zrobić?
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Link
            to="/app/flashcards"
            className="omni-card p-6 hover:shadow-lg transition-shadow group"
          >
            <div className="w-14 h-14 bg-[var(--omni-butter)] rounded-2xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
              <BookOpen className="w-7 h-7 text-[var(--omni-text)]" />
            </div>
            <h4 className="font-semibold text-[var(--omni-text)] mb-1">
              Ucz się fiszek
            </h4>
            <p className="text-sm text-[var(--omni-text-muted)] mb-4">
              {analysis.flashcards.length} fiszek do nauki
            </p>
            <span className="text-[var(--omni-accent)] font-medium flex items-center gap-1">
              Rozpocznij
              <ArrowRight className="w-4 h-4" />
            </span>
          </Link>

          <Link
            to="/app/quiz"
            className="omni-card p-6 hover:shadow-lg transition-shadow group"
          >
            <div className="w-14 h-14 bg-[var(--omni-blush)] rounded-2xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
              <HelpCircle className="w-7 h-7 text-[var(--omni-text)]" />
            </div>
            <h4 className="font-semibold text-[var(--omni-text)] mb-1">
              Rozwiąż quiz
            </h4>
            <p className="text-sm text-[var(--omni-text-muted)] mb-4">
              {analysis.quizQuestions.length} pytań
            </p>
            <span className="text-[var(--omni-accent)] font-medium flex items-center gap-1">
              Rozpocznij
              <ArrowRight className="w-4 h-4" />
            </span>
          </Link>

          <Link
            to="/app/lesson"
            className="omni-card p-6 hover:shadow-lg transition-shadow group"
          >
            <div className="w-14 h-14 bg-[var(--omni-sky)] rounded-2xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
              <MessageCircle className="w-7 h-7 text-[var(--omni-text)]" />
            </div>
            <h4 className="font-semibold text-[var(--omni-text)] mb-1">
              Lekcja z AI
            </h4>
            <p className="text-sm text-[var(--omni-text-muted)] mb-4">
              Rozmawiaj i ucz się przez dialog
            </p>
            <span className="text-[var(--omni-accent)] font-medium flex items-center gap-1">
              Rozpocznij
              <ArrowRight className="w-4 h-4" />
            </span>
          </Link>
        </div>
      </div>

      {/* Stats */}
      <div className="omni-card p-4 lg:p-6">
        <div className="flex items-center gap-2 mb-4">
          <CheckCircle className="w-5 h-5 text-green-500" />
          <h3 className="font-semibold text-[var(--omni-text)]">
            Wygenerowano materiał
          </h3>
        </div>
        <div className="grid grid-cols-3 gap-4">
          <div className="text-center p-4 bg-gray-50 rounded-xl">
            <p className="text-2xl font-bold text-[var(--omni-text)]">
              {analysis.keyConcepts.length}
            </p>
            <p className="text-sm text-[var(--omni-text-muted)]">
              Kluczowych pojęć
            </p>
          </div>
          <div className="text-center p-4 bg-gray-50 rounded-xl">
            <p className="text-2xl font-bold text-[var(--omni-text)]">
              {analysis.flashcards.length}
            </p>
            <p className="text-sm text-[var(--omni-text-muted)]">Fiszek</p>
          </div>
          <div className="text-center p-4 bg-gray-50 rounded-xl">
            <p className="text-2xl font-bold text-[var(--omni-text)]">
              {analysis.quizQuestions.length}
            </p>
            <p className="text-sm text-[var(--omni-text-muted)]">Pytań</p>
          </div>
        </div>
      </div>
    </div>
  );
}
