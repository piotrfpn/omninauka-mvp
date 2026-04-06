import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Send, Bot, User, Mic, MicOff, AlertCircle, RefreshCw } from 'lucide-react';
import type { LessonMessage } from '../../types';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/auth-context';

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
    <div className="h-[calc(100vh-120px)] flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="omni-heading-3 text-[var(--omni-text)] mb-1">
            Lekcja z AI <span className="text-sm font-medium bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full ml-2">Tryb Demo</span>
          </h1>
          <p className="text-[var(--omni-text-muted)]">
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
      <div className="flex-1 overflow-y-auto space-y-4 mb-4 pr-2">
        {messages.map((message) => (
          <div key={message.id} className={`flex items-start gap-3 ${message.role === 'user' ? 'flex-row-reverse' : ''}`}>
             <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${message.role === 'user' ? 'bg-[var(--omni-accent)]' : 'bg-[var(--omni-lavender)]'}`}>
              {message.role === 'user' ? <User className="w-5 h-5 text-white" /> : <Bot className="w-5 h-5 text-[var(--omni-text)]" />}
             </div>
             <div className={`max-w-[80%] p-4 rounded-2xl ${message.role === 'user' ? 'bg-[var(--omni-accent)] text-white rounded-tr-sm' : 'bg-white rounded-tl-sm shadow-sm border border-gray-100'}`}>
                <p className={message.role === 'user' ? 'text-white' : 'text-[var(--omni-text)]'}>
                  {message.content}
                  {message.isStreaming && <span className="inline-block w-2 h-4 ml-1 bg-current animate-pulse" />}
                </p>
             </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="flex items-center gap-3 p-4 bg-white rounded-2xl shadow-lg border border-gray-100">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Zadaj pytanie (Symulowane opóźnienie)..."
          disabled={isStreaming}
          className="flex-1 bg-transparent border-none outline-none text-[var(--omni-text)] placeholder:text-gray-400"
        />
        <button
          onClick={handleSend}
          disabled={!input.trim() || isStreaming}
          className="p-3 bg-[var(--omni-accent)] text-white rounded-xl disabled:opacity-50 disabled:cursor-not-allowed hover:scale-105 transition-transform"
        >
          {isStreaming ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Send className="w-5 h-5" />}
        </button>
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
  const [topic, setTopic] = useState('');
  const [sessionContext, setSessionContext] = useState<any>(null);
  const [isInitializing, setIsInitializing] = useState(true);
  const [contextError, setContextError] = useState<string | null>(null);
  const [authToken, setAuthToken] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [isVoiceMode, setIsVoiceMode] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'msg-welcome',
      role: 'assistant',
      content: 'Cześć! Jestem Twoim AI korepetytorem z zapisanego tematu. Oczekuję na Twoje pytania!'
    }
  ]);

  useEffect(() => {
    const initSession = async () => {
      try {
        const sessionId = sessionStorage.getItem('currentSessionId');
        if (!sessionId) {
          navigate('/app/upload');
          return;
        }

        const { data: dbData, error: dbError } = await supabase
          .from('study_sessions')
          .select('subject, topic, summary')
          .eq('id', sessionId)
          .single();

        if (dbError) throw dbError;
        if (!dbData) throw new Error("Sesja nie istnieje.");

        setTopic(dbData.topic || 'Sekcji bez tytułu');
        setSessionContext(dbData);

        const { data: authData } = await supabase.auth.getSession();
        if (authData.session) {
          setAuthToken(authData.session.access_token);
        }

      } catch (err: any) {
        console.error("Failed to init secure lesson DB context:", err);
        setContextError("Nie udało się załadować danych o sesji z Bazy Danych. Skontaktuj się z obsługą.");
      } finally {
        setIsInitializing(false);
      }
    };
    initSession();
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const toggleVoiceMode = () => setIsVoiceMode(!isVoiceMode);

  const handleChatSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage: ChatMessage = {
      id: `msg-${Date.now()}`,
      role: 'user',
      content: input.trim()
    };

    // Build history to send (last 5 messages for cost control)
    const historyToSend = [...messages, userMessage]
      .slice(-5)
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
          context: sessionContext
        })
      });

      if (!response.ok) {
        const errText = await response.text();
        console.error(`[chat-tutor] HTTP ${response.status}:`, errText);
        setChatError(`Błąd serwera (${response.status}). Spróbuj ponownie.`);
        // Remove the empty assistant placeholder
        setMessages(prev => prev.filter(m => m.id !== assistantId));
        return;
      }

      // Parse plain JSON response — backend now returns { success, reply }
      const data = await response.json();
      const replyText = data.reply || '';

      if (replyText) {
        setMessages(prev =>
          prev.map(m => m.id === assistantId ? { ...m, content: replyText } : m)
        );
      } else {
        setMessages(prev =>
          prev.map(m => m.id === assistantId ? { ...m, content: '...' } : m)
        );
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
        <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-[var(--omni-text-muted)] font-medium">Ładowanie kontekstu lekcji z serwera...</p>
      </div>
    );
  }

  if (contextError) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
         <div className="p-6 bg-red-50 text-red-600 rounded-2xl max-w-md text-center shadow-sm border border-red-100">
           <AlertCircle className="w-10 h-10 mx-auto mb-4" />
           <p className="font-semibold">{contextError}</p>
         </div>
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-120px)] flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="omni-heading-3 text-[var(--omni-text)] mb-1">
            Lekcja z AI <span className="text-xs font-medium text-emerald-600 bg-emerald-100 px-2 py-0.5 rounded-full ml-1 align-middle">Live</span>
          </h1>
          <p className="text-[var(--omni-text-muted)]">
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
      <div className="flex-1 overflow-y-auto space-y-4 mb-4 pr-2">
        {messages.map((message) => (
          <div key={message.id} className={`flex items-start gap-3 ${message.role === 'user' ? 'flex-row-reverse' : ''}`}>
             <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${message.role === 'user' ? 'bg-[var(--omni-accent)]' : 'bg-[var(--omni-lavender)]'}`}>
              {message.role === 'user' ? <User className="w-5 h-5 text-white" /> : <Bot className="w-5 h-5 text-[var(--omni-text)]" />}
             </div>
             <div className={`max-w-[80%] p-4 rounded-2xl ${message.role === 'user' ? 'bg-[var(--omni-accent)] text-white rounded-tr-sm' : 'bg-white rounded-tl-sm shadow-sm border border-gray-100'}`}>
                <p className={`whitespace-pre-wrap ${message.role === 'user' ? 'text-white' : 'text-[var(--omni-text)]'}`}>
                  {message.content}
                  {isLoading && message.id.startsWith('msg-assistant-') && message.content === '' && (
                    <span className="inline-flex gap-1 ml-1">
                      <span className="inline-block w-2 h-2 bg-gray-300 rounded-full animate-bounce" />
                      <span className="inline-block w-2 h-2 bg-gray-400 rounded-full animate-bounce delay-75" />
                      <span className="inline-block w-2 h-2 bg-gray-500 rounded-full animate-bounce delay-150" />
                    </span>
                  )}
                </p>
             </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Error UI */}
      {chatError && (
        <div className="mb-4 p-4 bg-red-50 rounded-xl flex items-center justify-between border border-red-100 shadow-sm">
           <div className="flex items-center gap-3">
              <AlertCircle className="w-5 h-5 text-red-600" />
              <p className="text-sm font-medium text-red-800">{chatError}</p>
           </div>
           <button onClick={() => setChatError(null)} className="flex items-center gap-1 text-sm bg-red-100 hover:bg-red-200 text-red-700 px-3 py-1.5 rounded-lg transition-colors">
              <RefreshCw className="w-4 h-4" /> Zamknij
           </button>
        </div>
      )}

      {/* Input Form */}
      <form onSubmit={handleChatSubmit} className="flex items-center gap-3 p-4 bg-white rounded-2xl shadow-lg border border-gray-100">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Zadaj pytanie korepetytorowi..."
          disabled={isLoading}
          className="flex-1 bg-transparent border-none outline-none text-[var(--omni-text)] placeholder:text-gray-400"
        />
        <button
          type="submit"
          disabled={!input.trim() || isLoading}
          className="p-3 bg-[var(--omni-accent)] text-white rounded-xl disabled:opacity-50 disabled:cursor-not-allowed hover:scale-105 transition-transform"
        >
          {isLoading ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Send className="w-5 h-5" />}
        </button>
      </form>
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
