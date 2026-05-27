import { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { Send, Bot, User, Mic, MicOff, AlertCircle, AlertTriangle, RefreshCw, MessageCircle, LayoutDashboard, History, Target, Lightbulb, X } from 'lucide-react';
import type { LessonMessage } from '../../types';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/auth-context';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useTranslation } from 'react-i18next';
import { Alert, AlertTitle, AlertDescription } from '../../components/ui/alert';

// ==========================================
// MOCK LESSON CHAT (For Demo Mode Zero-Cost)
// ==========================================

async function* streamMockResponse(_message: string, topic: string): AsyncGenerator<string> {
  const lowerMsg = _message.toLowerCase();
  let response = '';

  if (lowerMsg.includes('?') || lowerMsg.includes('dlaczego') || lowerMsg.includes('co to') || lowerMsg.includes('jak')) {
    response = `To bardzo dobre pytanie dotyczące tematu "${topic}". Pozwól, że wyjaśnię: kluczem do zrozumienia tego zagadnienia jest poprawne rozłożenie go na czynniki pierwsze. Czy chcesz abym podał Ci praktyczny przykład?`;
  } else if (lowerMsg.includes('tak') || lowerMsg.includes('poproszę') || lowerMsg.includes('przykład')) {
    response = `Oczywiście! Wyobraź sobie, że analizujesz to na prostym przykładzie - wtedy złożona koncepcja z obszaru "${topic}" staje się bardzo logiczna i łatwa do zapamiętania. Zrozumiałe?`;
  } else if (lowerMsg.includes('nie') || lowerMsg.includes('rozumiem') || lowerMsg.includes('jasne')) {
    response = `Doskonale! Skoro to jest już jasne, możemy gładko przejść do kolejnego zagadnienia. Zadaj mi kolejne pytanie, kiedy tylko będziesz gotów.`;
  } else {
    const fallbacks = [
      `Dokładnie tak! Widzę, że dobrze orientujesz się w temacie ${topic}. Chcesz, żebym wyjaśnił jakiś szczegół?`,
      `Świetnie sobie radzisz! Twoje wnioski są trafne.`,
      `Zgadzam się z Tobą. W szerszym kontekście ma to duży sens. Masz do tego kolejne wątpliwości?`
    ];
    response = fallbacks[Math.floor(Math.random() * fallbacks.length)];
  }
  
  // Stream character by character
  for (let i = 0; i < response.length; i++) {
    await new Promise(resolve => setTimeout(resolve, 30));
    yield response[i];
  }
}

function MockLessonChat() {

  const [messages, setMessages] = useState<LessonMessage[]>([]);
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [topic, setTopic] = useState('');
  const [isVoiceMode, setIsVoiceMode] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Get topic from session storage
    const analysisStr = sessionStorage.getItem('currentAnalysis');
    if (analysisStr) {
      try {
        const analysis = JSON.parse(analysisStr);
        setTopic(analysis.topic);
        setMessages([
          {
            id: 'msg-0',
            role: 'assistant',
            content: `Cześć! Jestem Twoim wirtualnym korepetytorem z ${analysis.topic} (Demo). Z czego dzisiaj się uczymy?`,
            timestamp: new Date(),
          },
        ]);
      } catch {
        setTopic('Twojego przedmiotu');
      }
    } else {
        setTopic('Twojego przedmiotu');
        setMessages([
          {
            id: 'msg-0',
            role: 'assistant',
            content: 'Cześć! Jestem Twoim AI korepetytorem. Z czego dzisiaj się uczymy?',
            timestamp: new Date(),
          },
        ]);
    }
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || isStreaming) return;

    const userMessage: LessonMessage = {
      id: `msg-${Date.now()}`,
      role: 'user',
      content: input,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsStreaming(true);

    const aiMessageId = `msg-${Date.now() + 1}`;
    setMessages(prev => [
      ...prev,
      {
        id: aiMessageId,
        role: 'assistant',
        content: '',
        timestamp: new Date(),
        isStreaming: true,
      },
    ]);

    let fullContent = '';
    try {
      for await (const char of streamMockResponse(input, topic)) {
        fullContent += char;
        setMessages(prev =>
          prev.map(msg =>
            msg.id === aiMessageId
              ? { ...msg, content: fullContent }
              : msg
          )
        );
      }
    } catch (error) {
      console.error('Streaming error:', error);
    } finally {
      setMessages(prev =>
        prev.map(msg =>
          msg.id === aiMessageId
            ? { ...msg, isStreaming: false }
            : msg
        )
      );
      setIsStreaming(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const toggleVoiceMode = () => {
    setIsVoiceMode(!isVoiceMode);
  };

  if (messages.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <div className="w-16 h-16 bg-[var(--omni-sky)] rounded-2xl flex items-center justify-center mb-6">
           <div className="w-8 h-8 border-4 border-[var(--omni-accent)]/30 border-t-[var(--omni-accent)] rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-full bg-[var(--omni-bg)] overflow-hidden">
      {/* Header - Mobile First */}
      <div className="px-4 py-3 bg-white border-b border-gray-100 flex items-center justify-between">
        <div className="min-w-0">
          <h1 className="text-base font-bold text-[var(--omni-text)] truncate">
            Lekcja z AI <span className="text-[10px] font-medium bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full ml-1">Demo</span>
          </h1>
          <p className="text-xs text-[var(--omni-text-muted)] truncate">
            {topic}
          </p>
        </div>
        <button
          onClick={toggleVoiceMode}
          className={`p-3 rounded-full transition-colors ${
            isVoiceMode ? 'bg-[var(--omni-accent)] text-white' : 'bg-gray-100 text-[var(--omni-text-muted)] hover:bg-gray-200'
          }`}
        >
          {isVoiceMode ? <Mic className="w-5 h-5" /> : <MicOff className="w-5 h-5" />}
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-6 custom-scrollbar">
        <div className="max-w-4xl mx-auto w-full space-y-6">
          {messages.map((message) => (
            <div key={message.id} className={`flex items-start gap-2.5 ${message.role === 'user' ? 'flex-row-reverse' : ''}`}>
               <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 shadow-sm ${message.role === 'user' ? 'bg-[var(--omni-accent)]' : 'bg-white border border-gray-100'}`}>
                {message.role === 'user' ? <User className="w-4 h-4 text-white" /> : <Bot className="w-4 h-4 text-[var(--omni-accent)]" />}
               </div>
               <div className={`max-w-[85%] md:max-w-[75%] p-3.5 rounded-2xl text-sm leading-relaxed ${
                 message.role === 'user' 
                   ? 'bg-[var(--omni-accent)] text-white rounded-tr-sm' 
                   : 'bg-white text-[var(--omni-text)] rounded-tl-sm shadow-sm border border-gray-100'
               } break-words min-w-0`}>
                  <p className="whitespace-pre-wrap">
                    {message.content}
                    {message.isStreaming && <span className="inline-block w-1.5 h-3.5 ml-1 bg-current animate-pulse align-middle" />}
                  </p>
               </div>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input - Full Width on Mobile */}
      <div className="bg-white border-t border-gray-100 pb-safe shadow-[0_-4px_12px_rgba(0,0,0,0.03)]">
        <div className="max-w-4xl mx-auto w-full p-3 md:p-4 flex items-center gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Zadaj pytanie..."
            disabled={isStreaming}
            className="flex-1 bg-gray-50 border-none outline-none text-sm text-[var(--omni-text)] placeholder:text-gray-400 px-4 py-3 rounded-xl focus:ring-1 focus:ring-[var(--omni-accent)]/20 transition-all"
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || isStreaming}
            className="w-11 h-11 flex items-center justify-center bg-[var(--omni-accent)] text-white rounded-xl disabled:opacity-50 hover:scale-105 active:scale-95 transition-all shadow-sm shadow-indigo-200 flex-shrink-0"
          >
            {isStreaming ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Send className="w-5 h-5" />}
          </button>
        </div>
      </div>
    </div>
  );
}

// ==========================================
// REAL LESSON CHAT (Direct fetch streaming)
// ==========================================

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

function RealLessonChat() {
  const navigate = useNavigate();
  const { id: routeId } = useParams();
  const location = useLocation();
  const [topic, setTopic] = useState('');
  const [isInitializing, setIsInitializing] = useState(true);
  const [contextError, setContextError] = useState<string | null>(null);
  const [isEmptyState, setIsEmptyState] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);
  const [usageLimitInfo, setUsageLimitInfo] = useState<{
    limit: number;
    plan: string;
    message: string;
  } | null>(null);
  const [authToken, setAuthToken] = useState<string | null>(null);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [isVoiceMode, setIsVoiceMode] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [threadId, setThreadId] = useState<string | null>(null);
  const [contextSnapshot, setContextSnapshot] = useState<any>(null);
  const [isMistakeReview, setIsMistakeReview] = useState(false);
  const [mistakeCount, setMistakeCount] = useState(0);
  const { t } = useTranslation();
  const [showTutorGuidance, setShowTutorGuidance] = useState(() => {
    try {
      return sessionStorage.getItem('omninauka_tutor_guidance_dismissed') !== 'true';
    } catch {
      return true;
    }
  });

  const handleDismissGuidance = () => {
    setShowTutorGuidance(false);
    try {
      sessionStorage.setItem('omninauka_tutor_guidance_dismissed', 'true');
    } catch { /* ignore */ }
  };

  useEffect(() => {
    const initSession = async () => {
      try {
        const sessionId = routeId || sessionStorage.getItem('currentSessionId');
        
        // Product Rule: Plain route without any stored context = Immediate Empty State
        if (!sessionId) {
          setIsEmptyState(true);
          setIsInitializing(false);
          return;
        }

        const { data: dbData, error: dbError } = await supabase
          .from('study_sessions')
          .select('subject, topic, summary, key_concepts, flashcards, quiz_result, flashcard_progress, folder_id, updated_at')
          .eq('id', sessionId)
          .single();

        // If loading failed but we are on the base route, fallback to empty state instead of error banner
        if (dbError || !dbData) {
          if (!routeId) {
            setIsEmptyState(true);
            setIsInitializing(false);
            return;
          }
          throw dbError || new Error("Sesja nie została znaleziona.");
        }

        setTopic(dbData.topic || 'Sekcji bez tytułu');
        
        const { data: authData } = await supabase.auth.getSession();
        const currentToken = authData.session?.access_token || null;
        setAuthToken(currentToken);


        // Phase 10A: Detect Score Drop (Self-Referential)
        let prevScore = null;
        if (dbData.folder_id) {
          const { data: prevData } = await supabase
            .from('study_sessions')
            .select('quiz_result')
            .eq('folder_id', dbData.folder_id)
            .neq('id', sessionId)
            .not('quiz_result', 'is', null)
            .order('created_at', { ascending: false })
            .limit(1);
          
          if (prevData && prevData[0]?.quiz_result) {
            prevScore = prevData[0].quiz_result.percentage;
          }
        }

        const buildMasterySummary = () => {
          const quizResult = dbData.quiz_result;
          const flashcardProgress = dbData.flashcard_progress || {};
          const flashcards = dbData.flashcards || [];

          const difficultCardFronts = Object.entries(flashcardProgress)
            .filter(([_, prog]: [string, any]) => prog.status === 'dont_know')
            .map(([id, _]) => flashcards.find((fc: any) => fc.id === id)?.front)
            .filter(Boolean);

          const repeatingStruggles = Object.entries(flashcardProgress)
            .filter(([_, prog]: [string, any]) => prog.dont_know_count >= 2)
            .map(([id, _]) => flashcards.find((fc: any) => fc.id === id)?.front)
            .filter(Boolean);

          let summary = `POSTĘPY UCZNIA:`;
          if (quizResult) {
            summary += `\n- Wynik quizu: ${quizResult.percentage}%.`;
            if (prevScore !== null && quizResult.percentage <= prevScore - 20) {
              summary += ` (UWAGA: Wynik spadł o ${prevScore - quizResult.percentage} pkt względem poprzedniej sesji).`;
            }
          }
          if (difficultCardFronts.length > 0) {
            summary += `\n- Trudne pojęcia (${difficultCardFronts.length}): ${difficultCardFronts.slice(0, 5).join(', ')}.`;
          }
          if (repeatingStruggles.length > 0) {
            summary += `\n- Pojęcia sprawiające powracający problem: ${repeatingStruggles.join(', ')}.`;
          }
          return summary;
        };

        let masterySummary = buildMasterySummary();
        
        // --- Mistake Review Logic ---
        let isMistakeModeActive = false;
        let mistakeContextObj: any = null;
        const stateContext = (location.state as any)?.mistakeReview;
        const storageContextStr = sessionStorage.getItem('omninauka_mistake_review_context');

        if (stateContext && storageContextStr) {
          try {
            mistakeContextObj = JSON.parse(storageContextStr);
            isMistakeModeActive = true;
          } catch (e) {}
        }

        if (isMistakeModeActive) {
          setIsMistakeReview(true);
          setMistakeCount(mistakeContextObj.mistakes?.length || 0);
          masterySummary += "\n\nCONTEXT INSTRUCTION: The user is currently in a Mistake Review mode. Guide them through their incorrect quiz answers one by one. Ask questions to help them understand their mistake. Do not give the answer immediately.";
        }

        const latestContext = {
          topic: dbData.topic,
          summary: dbData.summary,
          subject: dbData.subject,
          key_concepts: dbData.key_concepts,
          mastery_summary: masterySummary
        };

        // --- Sprint 5 / Stabilized: Idempotent thread bootstrap ---
        // Strategy: attempt upsert (ignore conflict on unique_session_thread),
        // then always SELECT the existing row. This is race-safe regardless of
        // how many concurrent calls hit this code (React Strict Mode, mobile
        // fast-refresh, etc).
        const upsertResult = await supabase
          .from('tutor_threads')
          .upsert(
            {
              session_id: sessionId,
              user_id: authData.session?.user.id,
              context_snapshot: latestContext,
              snapshot_updated_at: new Date().toISOString()
            },
            {
              onConflict: 'session_id',
              ignoreDuplicates: true   // if row exists, skip — don't overwrite history
            }
          );

        if (upsertResult.error) {
          // Only throw for non-conflict errors
          const isConflict = upsertResult.error.code === '23505';
          if (!isConflict) throw upsertResult.error;
          console.warn('[Tutor] Upsert conflict on unique_session_thread — row already exists, continuing.');
        }

        // Always select the now-guaranteed existing thread
        const { data: thread, error: selectError } = await supabase
          .from('tutor_threads')
          .select('*')
          .eq('session_id', sessionId)
          .single();

        if (selectError) throw selectError;
        if (!thread) throw new Error('Thread not found after upsert.');

        // Fetch existing chat history for this thread
        const { data: existingMessages } = await supabase
          .from('tutor_messages')
          .select('id, role, content')
          .eq('thread_id', thread.id)
          .order('created_at', { ascending: true });

        // Check if snapshot needs refreshing (existing thread may be stale)
        if (thread) {
          const sessionUpdatedAt = dbData.updated_at ? new Date(dbData.updated_at) : new Date(0);
          const snapshotUpdatedAt = new Date(thread.snapshot_updated_at);

          if (sessionUpdatedAt > snapshotUpdatedAt) {
            console.log('[Tutor] Snapshot stale, refreshing...');
            const { error: updateError } = await supabase
              .from('tutor_threads')
              .update({
                context_snapshot: latestContext,
                snapshot_updated_at: new Date().toISOString()
              })
              .eq('id', thread.id);

            if (updateError) console.error('Failed to refresh snapshot:', updateError);
          }

          setThreadId(thread.id);
          setContextSnapshot(thread.context_snapshot);

          const currentMessages: ChatMessage[] = [];

          if (existingMessages && existingMessages.length > 0) {
            currentMessages.push(...existingMessages.map(m => ({
              id: m.id,
              role: m.role as 'user' | 'assistant',
              content: m.content
            })));
          } else {
            // Phase 10B: Proactive Coaching Welcome
            const quizResult = dbData.quiz_result;
            const flashcardProgress = dbData.flashcard_progress || {};
            const difficultCount = Object.values(flashcardProgress).filter((p: any) => p.status === 'dont_know').length;
            const hasRepeatedDifficulty = Object.values(flashcardProgress).some((p: any) => p.dont_know_count >= 2);

            let proactiveMsg = 'Cześć! Jestem Twoim Osobistym Korepetytorem. W czym mogę Ci dzisiaj pomóc?';

            // Struggle Logic
            if (quizResult && quizResult.percentage < 60) {
              proactiveMsg = `Cześć! Widzę, że ostatni quiz był sporym wyzwaniem (${quizResult.percentage}%). Chcesz, żebyśmy wspólnie przejrzeli te trudniejsze pytania?`;
            } else if (difficultCount >= 3) {
              proactiveMsg = `Cześć! Widzę, że kilka pojęć (${difficultCount}) sprawiło Ci dzisiaj trudność. Może przećwiczymy je teraz razem?`;
            } else if (hasRepeatedDifficulty) {
              proactiveMsg = `Cześć! Zauważyłem, że niektóre tematy powracają jako trudne. Chcesz, żebym spróbował wyjaśnić je w inny, prostszy sposób?`;
            } else if (prevScore !== null && quizResult && quizResult.percentage <= prevScore - 20) {
              proactiveMsg = `Cześć! Widzę, że dzisiejszy temat sprawił Ci trochę więcej trudności niż poprzednio. Zrobimy krótką i spokojną powtórkę?`;
            } 
            // Success Logic (Quiet Reinforcement - 30% chance)
            else if (quizResult && quizResult.percentage >= 90 && difficultCount === 0 && Math.random() < 0.3) {
              proactiveMsg = `Cześć! Świetnie Ci dzisiaj idzie! Quiz poszedł wzorowo (${quizResult.percentage}%). Chcesz zgłębić jakiś konkretny, trudniejszy szczegół z tego tematu?`;
            }
            // Neutral
            else if (quizResult && quizResult.percentage >= 60) {
              proactiveMsg = `Cześć! Masz za sobą solidną powtórkę. Od czego dzisiaj zaczynamy naszą rozmowę?`;
            }

            currentMessages.push({
              id: 'msg-welcome',
              role: 'assistant',
              content: proactiveMsg
            });
          }

          // Mistake Review Message Insertion (Appended at the end of whatever history we have)
          if (isMistakeModeActive && mistakeContextObj && thread) {
            const reviewId = mistakeContextObj.reviewId;
            const doneKey = `omninauka_mistake_review_done_${reviewId}`;
            if (!sessionStorage.getItem(doneKey)) {
              sessionStorage.setItem(doneKey, 'true');
              const firstMistake = mistakeContextObj.mistakes[0];
              
              let mistakeStartMsg = '';
              if (!firstMistake.question) {
                // Soft fallback — data was from an old quiz session before the enrichment patch
                mistakeStartMsg = `Cześć! Widzę, że w quizie kilka pytań sprawiło Ci trudność. Przejdziemy przez nie krok po kroku.\n\nNie mam pełnych danych pierwszego pytania z tego quizu, więc najlepiej uruchomić quiz ponownie albo przejść do nowego zestawu pytań.`;
              } else {
                const parts = [
                  `Cześć! Widzę, że w quizie kilka pytań sprawiło Ci trudność. Przejdziemy przez nie krok po kroku.\n\nZacznijmy od pierwszego błędu.`,
                  `**Pytanie:**\n»${firstMistake.question}«`,
                  `**Twoja odpowiedź:**\n»${firstMistake.selectedAnswer}«`,
                ];
                if (firstMistake.correctAnswer) {
                  parts.push(`**Poprawna odpowiedź:**\n»${firstMistake.correctAnswer}«`);
                }
                if (firstMistake.explanation) {
                  parts.push(`**Wyjaśnienie:**\n${firstMistake.explanation}`);
                }
                const remaining = mistakeContextObj.mistakes.length - 1;
                if (remaining > 0) {
                  parts.push(`Chcesz, żebym omówił kolejny błąd? (zostało ${remaining})`);
                } else {
                  parts.push(`To był jedyny błąd w tym quizie. Jeśli chcesz, możemy porozmawiać o tym zagadnieniu szerzej.`);
                }
                mistakeStartMsg = parts.join('\n\n');
              }
              currentMessages.push({
                id: `msg-mistake-${Date.now()}`,
                role: 'assistant',
                content: mistakeStartMsg
              });
              
              // Persist to DB since this is auto-generated and we want Edge Function to see it as part of thread
              if (authData.session?.user.id) {
                // Background insert, fire and forget
                supabase.from('tutor_messages').insert([
                  { thread_id: thread.id, user_id: authData.session.user.id, role: 'assistant', content: mistakeStartMsg }
                ]).then(({ error }) => {
                  if (error) console.error("Mistake insert failed", error);
                });
              }
            }
          }

          setMessages(currentMessages);
        }

      } catch (err: any) {
        console.error('Failed to init secure lesson DB context:', err);
        // Fallback to empty state only if we aren't on an explicit /:id route
        if (!routeId) {
          setIsEmptyState(true);
        } else {
          setContextError('Nie udało się załadować danych o sesji. Spróbuj ponownie lub wybierz lekcję z Historii.');
        }
      } finally {
        setIsInitializing(false);
      }
    };
    initSession();
  }, []);

  useEffect(() => {
    // Determine if user is near the bottom
    const container = messagesEndRef.current?.parentElement;
    if (container) {
      const isNearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 150;
      if (isNearBottom || isLoading) {
         messagesEndRef.current?.scrollIntoView({ behavior: isLoading ? 'auto' : 'smooth' });
      }
    } else {
      messagesEndRef.current?.scrollIntoView({ behavior: 'auto' });
    }
  }, [messages, isLoading]);

  // Phase 11: Keyboard-safe viewport handling
  useEffect(() => {
    if (!window.visualViewport) return;

    const handleVisualViewportChange = () => {
      // If viewport height changed (likely keyboard open)
      // only scroll to bottom if the user is already near the bottom
      if (messagesEndRef.current) {
        const container = messagesEndRef.current.parentElement;
        if (container) {
           const isNearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 150;
           if (isNearBottom) {
             // We use a small timeout to allow the browser to finish its internal layout shift
             setTimeout(() => {
               messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
             }, 100);
           }
        }
      }
    };

    window.visualViewport.addEventListener('resize', handleVisualViewportChange);
    
    return () => {
      window.visualViewport?.removeEventListener('resize', handleVisualViewportChange);
    };
  }, []);

  const recognitionRef = useRef<any>(null);
  const [baseInput, setBaseInput] = useState('');

  useEffect(() => {
    if (isVoiceMode) {
      setBaseInput(input); // Snapshot what they typed before pressing mic
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (!SpeechRecognition) {
        alert("Twoja przeglądarka nie obsługuje technologii rozpoznawania mowy.");
        setIsVoiceMode(false);
        return;
      }
      
      const recognition = new SpeechRecognition();
      recognition.lang = 'pl-PL';
      recognition.continuous = true;
      recognition.interimResults = true;
      recognitionRef.current = recognition;

      recognition.onresult = (event: any) => {
        let transcript = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          transcript += event.results[i][0].transcript;
        }

        // Lightweight post-processing normalization layer for Polish dictation
        const normalizePolishPunctuation = (text: string) => {
          return text
            .replace(/\bznak zapytania\b/gi, '?')
            .replace(/\bkropka\b/gi, '.')
            .replace(/\bprzecinek\b/gi, ',')
            .replace(/\bdwukropek\b/gi, ':')
            .replace(/\bśrednik\b/gi, ';')
            .replace(/\bwykrzyknik\b/gi, '!')
            .replace(/\bmyślnik\b/gi, '-')
            .replace(/\bnowa linia\b/gi, '\n')
            // Clean up accidental leading spaces resulting from mapping (e.g. "tekst ?" -> "tekst?")
            .replace(/\s+([?.!,:;-])/g, '$1');
        };

        const normalizedTranscript = normalizePolishPunctuation(transcript);

        // Capture a clean version appending strictly onto the base
        const previousInput = baseInput ? baseInput + (baseInput.endsWith('\n') ? '' : ' ') : '';
        setInput(previousInput + normalizedTranscript);
      };

      recognition.onerror = (event: any) => {
        console.error("[chat-tutor] Speech recognition error:", event.error);
        if (event.error !== 'no-speech') setIsVoiceMode(false);
      };

      recognition.onend = () => {
        // Only flip state if we didn't manually stop it
        if (recognitionRef.current) setIsVoiceMode(false);
      };

      try {
        recognition.start();
      } catch (e) {
        console.error("[chat-tutor] Speech recognition start error", e);
      }
    } else {
      if (recognitionRef.current) {
        try { 
           recognitionRef.current.stop(); 
           recognitionRef.current = null;
        } catch(e) {}
      }
    }
    
    return () => {
      if (recognitionRef.current) {
         try { recognitionRef.current.stop(); } catch(e){}
      }
    };
  }, [isVoiceMode]); // Intentionally leaving input/baseInput out to avoid restart loops

  const toggleVoiceMode = () => setIsVoiceMode(prev => !prev);

  // handleSend is the click-friendly wrapper used by the send button and chips
  const handleSend = () => {
    if (!input.trim() || isLoading) return;
    handleChatSubmit({ preventDefault: () => {} } as React.FormEvent);
  };

  // handleKeyDown submits on Enter (without Shift) for desktop convenience
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleChatSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const currentSessionId = routeId || sessionStorage.getItem('currentSessionId');
    if (!currentSessionId) {
      setChatError('Błąd: Brak identyfikatora sesji.');
      return;
    }

    const userMessage: ChatMessage = {
      id: `msg-${Date.now()}`,
      role: 'user',
      content: input.trim()
    };

    // Build history to send (backend will slice further based on plan)
    const historyToSend = [...messages, userMessage]
      .slice(-15)
      .map(m => ({ role: m.role, content: m.content }));

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);
    setChatError(null);

    // Placeholder for assistant response
    const assistantId = `msg-assistant-${Date.now()}`;
    setMessages(prev => [...prev, { id: assistantId, role: 'assistant', content: '' }]);

    try {
      const functionUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat-tutor`;
      const response = await fetch(functionUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
          ...(authToken ? { 'Authorization': `Bearer ${authToken}` } : {})
        },
        body: JSON.stringify({
          messages: historyToSend,
          context: contextSnapshot,
          sessionId: currentSessionId, // Sprint 20B.2: Required for usage counting
          stream: true
        })
      });

      if (!response.ok) {
        const errText = await response.text();
        
        // Handle Usage Limits (Sprint 20B.2)
        if (response.status === 403) {
          try {
            const errorData = JSON.parse(errText);
            if (errorData.error === 'usage_limit_reached') {
              setUsageLimitInfo({
                limit: errorData.limit,
                plan: errorData.plan,
                message: errorData.message
              });
              setMessages(prev => prev.filter(m => m.id !== assistantId));
              return;
            }
          } catch (e) {}
        }

        console.error(`[chat-tutor] HTTP ${response.status}:`, errText);
        setChatError(`Błąd serwera (${response.status}). Spróbuj ponownie.`);
        // Remove the empty assistant placeholder
        setMessages(prev => prev.filter(m => m.id !== assistantId));
        return;
      }

      // Parse response handling streaming vs plain text/JSON
      let replyText = '';
      const contentType = response.headers.get('content-type') || '';

      if (contentType.includes('text/event-stream')) {
        const reader = response.body?.getReader();
        const decoder = new TextDecoder();
        if (reader) {
          try {
            let buffer = '';
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;
              const chunk = decoder.decode(value, { stream: true });
              buffer += chunk;
              
              const lines = buffer.split('\n');
              // Keep the last segment in the buffer because it might be an incomplete line
              buffer = lines.pop() || '';
              
              for (const line of lines) {
                const trimmedLine = line.trim();
                if (trimmedLine.startsWith('data: ')) {
                  const dataStr = trimmedLine.slice(6).trim();
                  if (dataStr === '[DONE]') continue;
                  if (!dataStr) continue;
                  try {
                    const data = JSON.parse(dataStr);
                    // Extract payload correctly whether it's OpenAI structured or raw generic format
                    replyText += data.choices?.[0]?.delta?.content || data.reply || data.text || data.content || '';
                  } catch (e) {
                    console.warn("[chat-tutor] SSE JSON parse warning:", dataStr);
                  }
                }
              }
              
              // Update UI incrementally without '...' jumps
              const currentReplyText = replyText;
              setMessages(prev =>
                prev.map(m => m.id === assistantId ? { ...m, content: currentReplyText } : m)
              );
            }
          } finally {
            reader.releaseLock();
          }
        }
      } else {
        const text = await response.text();
        try {
          const responseData = JSON.parse(text);
          if (responseData.error) {
            throw new Error(responseData.error.message || responseData.error || 'Wystąpił błąd serwera');
          }
          replyText = responseData.reply || responseData.message || responseData.content || text;
        } catch (e: any) {
           if (e.message !== 'Wystąpił błąd serwera' && text.trim()) {
             // Not JSON, but valid text
             replyText = text;
           } else {
             throw e;
           }
        }
      }

      if (!replyText || !replyText.trim()) {
         replyText = 'Przepraszam, otrzymałem pustą odpowiedź.';
      }

      setMessages(prev =>
        prev.map(m => m.id === assistantId ? { ...m, content: replyText } : m)
      );

      // Save history to DB client-side for Phase II persistence only AFTER stream is fully closed
      if (threadId) {
        const { data: userData } = await supabase.auth.getUser();
        if (userData.user?.id) {
          await supabase.from('tutor_messages').insert([
            { thread_id: threadId, user_id: userData.user.id, role: 'user', content: userMessage.content },
            { thread_id: threadId, user_id: userData.user.id, role: 'assistant', content: replyText }
          ]);
        }
      }

    } catch (err: any) {
      console.error('[chat-tutor] Fetch error:', err);
      setChatError('Wystąpił problem z połączeniem. Sprawdź sieć i spróbuj ponownie.');
      setMessages(prev => prev.filter(m => m.id !== assistantId));
    } finally {
      setIsLoading(false);
    }
  };

  if (isInitializing) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <div className="w-12 h-12 border-4 border-[var(--omni-accent)]/20 border-t-[var(--omni-accent)] rounded-full animate-spin"></div>
        <p className="text-[var(--omni-text-muted)] font-medium animate-pulse">Inicjowanie korepetytora...</p>
      </div>
    );
  }

  if (isEmptyState) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh] p-6 text-center animate-in fade-in zoom-in duration-500">
        <div className="w-20 h-20 bg-[var(--omni-accent)]/10 dark:bg-slate-800 rounded-3xl flex items-center justify-center mb-6">
          <MessageCircle className="w-10 h-10 text-[var(--omni-accent)]" />
        </div>
        <h1 className="omni-heading-3 text-[var(--omni-text)] mb-3">
          Wybierz lekcję, aby zacząć naukę z AI
        </h1>
        <p className="text-[var(--omni-text-muted)] max-w-sm mb-8 leading-relaxed">
          Otwórz lekcję z Dashboardu lub Historii, aby korepetytor mógł pracować na Twoich materiałach.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 w-full max-w-xs sm:max-w-md">
          <button 
            onClick={() => navigate('/app/dashboard')}
            className="flex-1 px-6 py-3.5 bg-[var(--omni-accent)] text-white rounded-2xl font-bold shadow-lg shadow-indigo-500/20 hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-2"
          >
            <LayoutDashboard className="w-5 h-5" /> Przejdź do Dashboardu
          </button>
          <button 
            onClick={() => navigate('/app/history')}
            className="flex-1 px-6 py-3.5 bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-700 text-[var(--omni-text)] rounded-2xl font-bold shadow-sm hover:bg-gray-50 dark:hover:bg-slate-700 active:scale-95 transition-all flex items-center justify-center gap-2"
          >
            <History className="w-5 h-5" /> Przejdź do Historii
          </button>
        </div>
      </div>
    );
  }

  if (contextError) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] p-6 text-center">
         <div className="w-16 h-16 bg-red-50 text-red-500 rounded-2xl flex items-center justify-center mb-4 border border-red-100">
           <AlertCircle className="w-8 h-8" />
         </div>
         <h2 className="text-xl font-bold text-[var(--omni-text)] mb-2">Błąd ładowania sesji</h2>
         <p className="text-[var(--omni-text-muted)] mb-6 max-w-sm mx-auto">{contextError}</p>
         <button 
           onClick={() => window.location.reload()}
           className="px-6 py-2.5 bg-gray-100 text-[var(--omni-text)] rounded-xl font-medium hover:bg-gray-200 transition-all flex items-center gap-2 mx-auto"
         >
           <RefreshCw className="w-4 h-4" /> Spróbuj ponownie
         </button>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-full bg-[var(--omni-bg)] overflow-hidden">
      {/* Header - Mobile First */}
      <div className="px-4 py-3 bg-card border-b border-border flex items-center justify-between">
        <div className="min-w-0">
          <h1 className="text-base font-bold text-foreground truncate">
            Lekcja z AI <span className="text-[10px] font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-900/40 px-2 py-0.5 rounded-full ml-1 align-middle">Live</span>
          </h1>
          <p className="text-xs text-muted-foreground truncate">
            {topic}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={toggleVoiceMode}
            className={`p-2.5 rounded-full transition-all ${
              isVoiceMode ? 'bg-red-500 animate-pulse text-white shadow-md' : 'bg-muted text-muted-foreground hover:bg-muted/80'
            }`}
          >
            {isVoiceMode ? <Mic className="w-4 h-4" /> : <MicOff className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Mistake Review Banner */}
      {isMistakeReview && (
        <div className="px-4 py-2 bg-yellow-50 dark:bg-yellow-900/20 border-b border-yellow-100 dark:border-yellow-900/50 flex items-center gap-2">
          <Target className="w-4 h-4 text-yellow-600 dark:text-yellow-500" />
          <span className="text-xs font-semibold text-yellow-800 dark:text-yellow-400">
            Tryb: Omówienie błędów z quizu ({mistakeCount} do poprawy)
          </span>
        </div>
      )}

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-6 custom-scrollbar">
        <div className="max-w-4xl mx-auto w-full space-y-6">
          {!isMistakeReview && showTutorGuidance && (
            <Alert className="bg-[var(--omni-lavender)]/20 border-[var(--omni-accent)]/20 dark:border-slate-700 relative p-4 flex gap-3 items-start pr-10 animate-in fade-in slide-in-from-top-4 duration-300">
              <Lightbulb className="w-5 h-5 text-[var(--omni-accent)] shrink-0 mt-0.5" />
              <div className="flex-1">
                <AlertTitle className="font-bold text-[var(--omni-text)] text-sm mb-1">
                  {t('lessonPage.tutor.guidance.title', 'AI Tutor działa najlepiej po ćwiczeniach')}
                </AlertTitle>
                <AlertDescription className="text-xs text-[var(--omni-text-muted)] leading-relaxed">
                  {t('lessonPage.tutor.guidance.bodyBeforeStrong', 'Najpierw przejdź ')}
                  <strong>
                    {t('lessonPage.tutor.guidance.bodyStrong', 'fiszki i quiz')}
                  </strong>
                  {t('lessonPage.tutor.guidance.bodyAfterStrong', ', a wtedy AI Tutor lepiej zobaczy, które pojęcia są już opanowane, a które wymagają wyjaśnienia. Możesz pisać od razu, ale po quizie odpowiedzi będą trafniejsze.')}
                </AlertDescription>
              </div>
              <button
                type="button"
                onClick={handleDismissGuidance}
                className="absolute top-3 right-3 text-muted-foreground hover:text-foreground hover:bg-muted p-1 rounded-lg transition-all"
                title={t('lessonPage.tutor.guidance.dismissLabel', 'Zamknij')}
              >
                <X className="w-4 h-4" />
              </button>
            </Alert>
          )}
          {messages.map((message) => (
            <div key={message.id} className={`flex items-start gap-2.5 ${message.role === 'user' ? 'flex-row-reverse' : ''}`}>
               <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 shadow-sm ${
                 message.role === 'user'
                   ? 'bg-[var(--omni-accent)]'
                   : 'bg-card border border-border'
               }`}>
                {message.role === 'user' ? <User className="w-4 h-4 text-white" /> : <Bot className="w-4 h-4 text-[var(--omni-accent)]" />}
               </div>
               <div className={`max-w-[85%] md:max-w-[75%] p-3.5 rounded-2xl text-sm leading-relaxed ${
                 message.role === 'user'
                   ? 'bg-[var(--omni-accent)] text-white rounded-tr-sm'
                   : 'bg-card dark:bg-slate-800 text-foreground rounded-tl-sm shadow-sm border border-border dark:border-slate-700'
               } break-words min-w-0`}>
                  {message.role === 'user' ? (
                    <p className="whitespace-pre-wrap text-white">
                      {message.content}
                    </p>
                  ) : (
                    <div className="text-foreground prose prose-sm dark:prose-invert max-w-none prose-p:leading-[1.6] prose-p:mb-3 last:prose-p:mb-0 prose-ul:list-disc prose-ul:pl-5 prose-ul:mb-3 prose-ul:space-y-1 prose-li:leading-[1.6] prose-strong:font-semibold prose-headings:font-bold prose-headings:mb-2 prose-headings:mt-4 first:prose-headings:mt-0">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>
                        {isLoading && message.id.startsWith('msg-assistant-')
                          ? message.content.replace(/([*_~`#\[\]()]+)$/, '') + (message.content ? ' ▍' : '')
                          : message.content}
                      </ReactMarkdown>
                      {isLoading && message.id.startsWith('msg-assistant-') && message.content === '' && (
                        <span className="inline-flex gap-1 ml-1 mt-1">
                          <span className="inline-block w-1.5 h-1.5 bg-muted-foreground/40 rounded-full animate-bounce" />
                          <span className="inline-block w-1.5 h-1.5 bg-muted-foreground/60 rounded-full animate-bounce delay-75" />
                          <span className="inline-block w-1.5 h-1.5 bg-muted-foreground/80 rounded-full animate-bounce delay-150" />
                        </span>
                      )}
                    </div>
                  )}
               </div>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Error UI */}
      {chatError && (
        <div className="px-4 py-2 bg-red-50 border-y border-red-100 flex items-center justify-between">
           <div className="flex items-center gap-2 min-w-0">
              <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0" />
              <p className="text-xs font-medium text-red-800 truncate">{chatError}</p>
           </div>
           <button onClick={() => setChatError(null)} className="text-[10px] bg-red-100 text-red-700 px-2 py-1 rounded transition-colors flex-shrink-0">
              Zamknij
           </button>
        </div>
      )}

      {/* Quick Actions Row */}
      {!isLoading && messages.length > 0 && (
        <div className="bg-card border-t border-border">
          <div className="max-w-4xl mx-auto w-full px-4 py-2.5">
            <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">

              {/* --- Quiz Navigation Chip (always visible when session is loaded) --- */}
              {routeId && (
                <button
                  onClick={() => navigate(`/app/quiz/${routeId}`)}
                  className="whitespace-nowrap flex-shrink-0 px-3.5 py-1.5 bg-emerald-50 dark:bg-emerald-900/30 border border-emerald-200 dark:border-emerald-700 rounded-full text-[10px] font-bold text-emerald-700 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 hover:border-emerald-400 active:scale-95 transition-all"
                >
                  🎯 Przejdź do quizu
                </button>
              )}

              {/* --- Conversation Chips (context-aware, sent as chat messages) --- */}
              {(() => {
                const chips = [];
                const contextSummary = contextSnapshot?.mastery_summary || '';
                const quizResult = contextSummary.includes('Wynik quizu');
                const lowScoreMatch = contextSummary.match(/Wynik quizu: (\d+)%/);
                const lowScore = lowScoreMatch ? parseInt(lowScoreMatch[1]) : 100;
                const difficultCountMatch = contextSummary.match(/Trudne pojęcia \((\d+)\)/);
                const difficultCount = difficultCountMatch ? parseInt(difficultCountMatch[1]) : 0;

                if (quizResult && lowScore < 80) chips.push("🔍 Wyjaśnij błędy");
                if (difficultCount > 0) chips.push("🧠 Przećwicz trudne pojęcia");
                chips.push("📝 Powtórz kluczowe punkty");
                chips.push("💡 Wyjaśnij prościej");

                return chips.slice(0, 3).map((chipText) => (
                  <button
                    key={chipText}
                    onClick={() => {
                      setInput(chipText.replace(/^[^ ]+ /, ''));
                      setTimeout(() => document.getElementById('chat-send-btn')?.click(), 50);
                    }}
                    className="whitespace-nowrap px-3.5 py-1.5 bg-muted dark:bg-slate-800 border border-border dark:border-slate-700 rounded-full text-[10px] font-bold text-foreground dark:text-slate-100 hover:border-[var(--omni-accent)] transition-all active:scale-95 flex-shrink-0"
                  >
                    {chipText}
                  </button>
                ));
              })()}
            </div>
          </div>
        </div>
      )}

      {/* Usage Limit Info Panel (Sprint 20B.2) */}
      {usageLimitInfo && (
        <div className="mx-4 mb-4 p-4 bg-orange-50 dark:bg-orange-900/20 border border-orange-100 dark:border-orange-900/40 rounded-2xl animate-in slide-in-from-bottom-4 duration-300">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 bg-orange-100 dark:bg-orange-900/40 rounded-xl flex items-center justify-center flex-shrink-0">
              <AlertTriangle className="w-5 h-5 text-orange-600 dark:text-orange-400" />
            </div>
            <div className="flex-1 min-w-0">
              <h4 className="text-sm font-bold text-orange-900 dark:text-orange-300 mb-1">
                Limit wiadomości AI
              </h4>
              <p className="text-xs text-orange-800 dark:text-orange-400 leading-relaxed mb-3">
                {usageLimitInfo.message}
              </p>
              <div className="flex gap-2">
                {usageLimitInfo.plan === 'free' ? (
                  <button
                    onClick={() => navigate('/app/payments')}
                    className="px-4 py-2 bg-orange-500 text-white text-xs font-bold rounded-lg hover:bg-orange-600 transition-colors shadow-sm"
                  >
                    Odblokuj Premium
                  </button>
                ) : null}
                <button
                  onClick={() => navigate('/app/results')}
                  className="px-4 py-2 bg-white dark:bg-slate-800 border border-orange-200 dark:border-orange-900/40 text-orange-700 dark:text-orange-400 text-xs font-bold rounded-lg hover:bg-orange-100 dark:hover:bg-orange-900/20 transition-colors"
                >
                  Podsumowanie lekcji
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Input Area */}
      <div className="bg-card border-t border-border pb-safe shadow-[0_-4px_12px_rgba(0,0,0,0.06)]">
        <div className="max-w-4xl mx-auto w-full p-3 md:p-4 flex items-center gap-2">
          <button
            onClick={toggleVoiceMode}
            disabled={usageLimitInfo !== null}
            className={`w-11 h-11 flex items-center justify-center rounded-xl transition-all ${
              isVoiceMode 
                ? 'bg-red-500 text-white animate-pulse' 
                : 'bg-muted dark:bg-slate-700 text-muted-foreground hover:bg-muted/80'
            } disabled:opacity-30`}
          >
            {isVoiceMode ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
          </button>
          <textarea
            rows={1}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={usageLimitInfo ? "Osiągnięto limit wiadomości" : "Zadaj pytanie..."}
            disabled={isLoading || usageLimitInfo !== null}
            className="flex-1 bg-muted dark:bg-slate-800 border-none outline-none text-sm text-foreground placeholder:text-muted-foreground px-4 py-3 rounded-xl focus:ring-1 focus:ring-[var(--omni-accent)]/30 transition-all resize-none max-h-32 disabled:opacity-50"
          />
          <button
            id="chat-send-btn"
            onClick={handleSend}
            disabled={!input.trim() || isLoading || usageLimitInfo !== null}
            className="w-11 h-11 flex items-center justify-center bg-[var(--omni-accent)] text-white rounded-xl disabled:opacity-50 hover:scale-105 active:scale-95 transition-all shadow-sm shadow-indigo-200 flex-shrink-0"
          >
            {isLoading ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Send className="w-5 h-5" />}
          </button>
        </div>
      </div>
    </div>
  );
}


// ==========================================

// EXPORT AGGREGATOR
// ==========================================

export default function LessonPage() {
  const { isDemoMode } = useAuth();
  
  if (isDemoMode) {
    return <MockLessonChat />;
  }

  return <RealLessonChat />;
}
