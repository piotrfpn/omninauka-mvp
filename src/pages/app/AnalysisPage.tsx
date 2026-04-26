import { useState, useEffect } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
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
  FileText,
} from 'lucide-react';
import { LessonTitleEditor } from '../../components/lessons/lesson-title-editor';
import { AnalysisSkeleton } from '../../components/ui/page-skeletons';
import { ConceptDetailSheet } from '../../components/lessons/concept-detail-sheet';

export default function AnalysisPage() {
  const navigate = useNavigate();
  const { isDemoMode } = useAuth();
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [sessionImages, setSessionImages] = useState<string[]>([]);
  const [activeImageIdx, setActiveImageIdx] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [selectedConcept, setSelectedConcept] = useState<KeyConcept | null>(null);
  const [isConceptModalOpen, setIsConceptModalOpen] = useState(false);
  // Sprint 1: lesson title
  const [lessonTitle, setLessonTitle] = useState<string>('');
  const { id: routeId } = useParams();
  const currentSessionId = routeId || sessionStorage.getItem('currentSessionId') || '';

  useEffect(() => {
    const sessionId = currentSessionId;
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


  if (isLoading) {
    return <AnalysisSkeleton />;
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

          {/* Sprint 1 & 3: Lesson title editor */}
          <div className="flex flex-col gap-1">
            {!lessonTitle && !isLoading && !analysisError && (
              <p className="text-[10px] text-orange-500 font-medium animate-pulse flex items-center gap-1">
                <Sparkles className="w-3 h-3" /> Nazwij tę lekcję, aby łatwiej ją znaleźć w przyszłości
              </p>
            )}
            <LessonTitleEditor
              sessionId={currentSessionId}
              initialTitle={lessonTitle}
              onSaved={(newTitle) => setLessonTitle(newTitle)}
              isDemoMode={isDemoMode}
            />
          </div>
        </div>
        {uploadedImage && (
          <div className="flex flex-col gap-3 flex-shrink-0">
             {/* Main Preview */}
            <div className="w-24 h-24 lg:w-48 lg:h-48 rounded-xl overflow-hidden shadow-sm bg-gray-100 flex items-center justify-center border border-gray-100 relative group">
              {uploadedImage.includes('.pdf') || uploadedImage.includes('.docx') ? (
                <div 
                  className="flex flex-col items-center justify-center text-center p-2 cursor-pointer w-full h-full"
                  onClick={() => window.open(uploadedImage, '_blank')}
                  title="Kliknij, aby pobrać lub otworzyć dokument"
                >
                  <FileText className="w-8 h-8 lg:w-12 lg:h-12 text-indigo-500 mb-1 lg:mb-2" />
                  <span className="text-[10px] lg:text-xs font-medium text-gray-600 leading-tight">Dokument<br/>dodany</span>
                </div>
              ) : (
                <img
                  src={uploadedImage}
                  alt="Analyzed"
                  className="w-full h-full object-cover cursor-zoom-in"
                  onClick={() => window.open(uploadedImage, '_blank')}
                  title="Kliknij, aby otworzyć w pełnym rozmiarze"
                />
              )}
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

      {/* Action Hub - Primary Hierarchy */}
      <div className="space-y-4">
        <h3 className="font-semibold text-[var(--omni-text)] flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-[var(--omni-accent)]" />
          Rozpocznij naukę
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* Primary Action: AI Lesson */}
          <Link
            to={`/app/lesson/${currentSessionId}`}
            className="sm:col-span-2 lg:col-span-1 omni-card p-5 md:p-6 bg-indigo-600 text-white hover:bg-indigo-700 active:scale-[0.98] transition-all group flex items-center gap-4 border-none shadow-md"
          >
            <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform">
              <MessageCircle className="w-6 h-6 text-white" />
            </div>
            <div className="flex-1">
              <h4 className="font-bold text-white mb-0.5">
                Lekcja z AI (Sokratyczna)
              </h4>
              <p className="text-xs text-indigo-100 line-clamp-1">
                Rozmawiaj i zrozum materiał przez dialog
              </p>
            </div>
            <ArrowRight className="w-5 h-5 text-white/50 group-hover:translate-x-1 transition-transform" />
          </Link>

          {/* Secondary Action: Quiz */}
          <Link
            to={`/app/quiz/${currentSessionId}`}
            className="omni-card p-4 hover:shadow-md active:scale-[0.98] transition-all group flex items-center gap-3 border-l-4 border-l-red-400"
          >
            <div className="w-10 h-10 bg-[var(--omni-blush)] rounded-lg flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform">
              <HelpCircle className="w-5 h-5 text-[var(--omni-text)]" />
            </div>
            <div className="flex-1">
              <h4 className="font-semibold text-[var(--omni-text)] text-sm">
                Rozwiąż quiz
              </h4>
              <p className="text-[10px] text-[var(--omni-text-muted)]">
                {analysis.quizQuestions.length} pytań sprawdzających
              </p>
            </div>
            <ArrowRight className="w-4 h-4 text-[var(--omni-text-muted)] group-hover:translate-x-1 transition-transform" />
          </Link>

          {/* Secondary Action: Flashcards */}
          <Link
            to={`/app/flashcards/${currentSessionId}`}
            className="omni-card p-4 hover:shadow-md active:scale-[0.98] transition-all group flex items-center gap-3 border-l-4 border-l-yellow-400"
          >
            <div className="w-10 h-10 bg-[var(--omni-butter)] rounded-lg flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform">
              <BookOpen className="w-5 h-5 text-[var(--omni-text)]" />
            </div>
            <div className="flex-1">
              <h4 className="font-semibold text-[var(--omni-text)] text-sm">
                Ucz się fiszek
              </h4>
              <p className="text-[10px] text-[var(--omni-text-muted)]">
                {analysis.flashcards.length} pojęć do opanowania
              </p>
            </div>
            <ArrowRight className="w-4 h-4 text-[var(--omni-text-muted)] group-hover:translate-x-1 transition-transform" />
          </Link>
        </div>
      </div>

      {/* Summary */}
      <div className="omni-card p-4 lg:p-6 bg-[var(--omni-mint)]/30">
        <h3 className="font-semibold text-[var(--omni-text)] mb-2 flex items-center gap-2">
          <Lightbulb className="w-5 h-5 text-amber-500" />
          Podsumowanie lekcji
        </h3>
        <p className="text-sm text-[var(--omni-text-muted)] leading-relaxed">{analysis.summary}</p>
      </div>

      {/* Key Concepts */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-[var(--omni-text)]">
            Kluczowe pojęcia ({analysis.keyConcepts.length})
          </h3>
          <span className="text-[10px] text-[var(--omni-text-muted)] uppercase tracking-wider font-bold">Kliknij pojęcie, by je zgłębić</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
          {analysis.keyConcepts.map((concept) => {
            const Icon = getCategoryIcon(concept.category);
            return (
              <div 
                key={concept.id} 
                className="omni-card p-3 md:p-4 hover:border-indigo-200 cursor-pointer active:scale-[0.99] transition-all group"
                onClick={() => {
                  setSelectedConcept(concept);
                  setIsConceptModalOpen(true);
                }}
              >
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 bg-[var(--omni-lavender)] rounded-lg flex items-center justify-center flex-shrink-0 group-hover:bg-indigo-100 transition-colors">
                    <Icon className="w-4 h-4 text-[var(--omni-text)]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                      <span className="font-bold text-[var(--omni-text)] text-sm">
                        {concept.term}
                      </span>
                      <span className="text-[10px] text-[var(--omni-text-muted)] bg-gray-100 px-1.5 rounded">
                        {getCategoryLabel(concept.category)}
                      </span>
                    </div>
                    <p className="text-xs text-[var(--omni-text-muted)] line-clamp-2 leading-relaxed">
                      {concept.definition}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Stats - Final footer context */}
      <div className="omni-card p-4 dark:bg-slate-800/50 border-dashed border-2 dark:border-slate-700">
        <div className="grid grid-cols-3 gap-2">
          <div className="text-center p-2">
            <p className="text-xl font-bold text-foreground">
              {analysis.keyConcepts.length}
            </p>
            <p className="text-[9px] text-muted-foreground uppercase tracking-wider">Pojęć</p>
          </div>
          <div className="text-center p-2 border-x border-border">
            <p className="text-xl font-bold text-foreground">
              {analysis.flashcards.length}
            </p>
            <p className="text-[9px] text-muted-foreground uppercase tracking-wider">Fiszek</p>
          </div>
          <div className="text-center p-2">
            <p className="text-xl font-bold text-foreground">
              {analysis.quizQuestions.length}
            </p>
            <p className="text-[9px] text-muted-foreground uppercase tracking-wider">Pytań</p>
          </div>
        </div>
      </div>

      <ConceptDetailSheet
        concept={selectedConcept}
        isOpen={isConceptModalOpen}
        onClose={() => setIsConceptModalOpen(false)}
        sessionId={currentSessionId}
      />
    </div>
  );
}
