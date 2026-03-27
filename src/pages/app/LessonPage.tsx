import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import type { LessonMessage } from '../../types';
import { Send, Bot, User, Sparkles, BookOpen, Mic, MicOff } from 'lucide-react';

// Mock streaming function that simulates AI responses
async function* streamMockResponse(_message: string, topic: string): AsyncGenerator<string> {
  const responses: Record<string, string[]> = {
    default: [
      `Cześć! Jestem Twoim AI korepetytorem z ${topic}. Z czego dzisiaj się uczymy?`,
      `To świetne pytanie! ${topic} to fascynujący temat. Pozwól, że wyjaśnię to krok po kroku.`,
      `Dokładnie tak! Rozumiesz już podstawy. Chcesz, żebym wyjaśnił coś bardziej szczegółowo?`,
      `Świetnie sobie radzisz! Twoje zrozumienie tematu rośnie.`,
      `To wszystko na teraz. Czy masz jeszcze jakieś pytania do ${topic}?`,
    ],
  };

  const responseList = responses[topic.toLowerCase()] || responses.default;
  const response = responseList[Math.floor(Math.random() * responseList.length)];
  
  // Stream character by character
  for (let i = 0; i < response.length; i++) {
    await new Promise(resolve => setTimeout(resolve, 30));
    yield response[i];
  }
}

export default function LessonPage() {
  const navigate = useNavigate();
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
        // Add initial AI message
        setMessages([
          {
            id: 'msg-0',
            role: 'assistant',
            content: `Cześć! Jestem Twoim AI korepetytorem z ${analysis.topic}. Z czego dzisiaj się uczymy?`,
            timestamp: new Date(),
          },
        ]);
      } catch {
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

    // Create placeholder for AI response
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

    // Stream the response
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
          <BookOpen className="w-8 h-8 text-[var(--omni-text)]" />
        </div>
        <h2 className="omni-heading-3 text-[var(--omni-text)] mb-2">
          Brak materiału
        </h2>
        <p className="text-[var(--omni-text-muted)] mb-6 text-center max-w-md">
          Najpierw prześlij swoje notatki, a AI przygotuje lekcję.
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

  return (
    <div className="h-[calc(100vh-120px)] flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="omni-heading-3 text-[var(--omni-text)] mb-1">
            Lekcja z AI
          </h1>
          <p className="text-[var(--omni-text-muted)]">
            {topic}
          </p>
        </div>
        <button
          onClick={toggleVoiceMode}
          className={`p-3 rounded-full transition-colors ${
            isVoiceMode
              ? 'bg-[var(--omni-accent)] text-white'
              : 'bg-gray-100 text-[var(--omni-text-muted)] hover:bg-gray-200'
          }`}
        >
          {isVoiceMode ? <Mic className="w-5 h-5" /> : <MicOff className="w-5 h-5" />}
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto space-y-4 mb-4 pr-2">
        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex items-start gap-3 ${
              message.role === 'user' ? 'flex-row-reverse' : ''
            }`}
          >
            <div
              className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                message.role === 'user'
                  ? 'bg-[var(--omni-accent)]'
                  : 'bg-[var(--omni-lavender)]'
              }`}
            >
              {message.role === 'user' ? (
                <User className="w-5 h-5 text-white" />
              ) : (
                <Bot className="w-5 h-5 text-[var(--omni-text)]" />
              )}
            </div>
            <div
              className={`max-w-[80%] p-4 rounded-2xl ${
                message.role === 'user'
                  ? 'bg-[var(--omni-accent)] text-white rounded-tr-sm'
                  : 'bg-white rounded-tl-sm'
              }`}
            >
              <p className={message.role === 'user' ? 'text-white' : 'text-[var(--omni-text)]'}>
                {message.content}
                {message.isStreaming && (
                  <span className="inline-block w-2 h-4 ml-1 bg-current animate-pulse" />
                )}
              </p>
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="flex items-center gap-3 p-4 bg-white rounded-2xl shadow-lg">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Zadaj pytanie..."
          disabled={isStreaming}
          className="flex-1 bg-transparent border-none outline-none text-[var(--omni-text)] placeholder:text-gray-400"
        />
        <button
          onClick={handleSend}
          disabled={!input.trim() || isStreaming}
          className="p-3 bg-[var(--omni-accent)] text-white rounded-xl disabled:opacity-50 disabled:cursor-not-allowed hover:scale-105 transition-transform"
        >
          {isStreaming ? (
            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : (
            <Send className="w-5 h-5" />
          )}
        </button>
      </div>

      {/* Voice Mode Indicator */}
      {isVoiceMode && (
        <div className="mt-4 p-4 bg-[var(--omni-lavender)]/30 rounded-xl flex items-center gap-3">
          <Sparkles className="w-5 h-5 text-[var(--omni-accent)]" />
          <p className="text-sm text-[var(--omni-text-muted)]">
            Tryb głosowy aktywny. Mów do mikrofonu, a AI odpowie.
          </p>
        </div>
      )}
    </div>
  );
}
