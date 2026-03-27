import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import type { StudySession } from '../../types';
import { mockStudySessions } from '../../mock/data';
import { Calendar, Clock, Award, BookOpen, TrendingUp, ArrowRight } from 'lucide-react';

export default function HistoryPage() {
  const [sessions, setSessions] = useState<StudySession[]>([]);

  useEffect(() => {
    // In a real app, this would fetch from an API
    setSessions(mockStudySessions);
  }, []);

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('pl-PL', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }).format(new Date(date));
  };

  if (sessions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <div className="w-16 h-16 bg-[var(--omni-lavender)] rounded-2xl flex items-center justify-center mb-6">
          <Calendar className="w-8 h-8 text-[var(--omni-text)]" />
        </div>
        <h2 className="omni-heading-3 text-[var(--omni-text)] mb-2">
          Brak historii
        </h2>
        <p className="text-[var(--omni-text-muted)] mb-6 text-center max-w-md">
          Nie masz jeszcze żadnych sesji nauki. Rozpocznij naukę już teraz!
        </p>
        <Link to="/app/upload" className="omni-btn-primary">
          <BookOpen className="w-5 h-5" />
          Rozpocznij naukę
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="omni-heading-3 text-[var(--omni-text)] mb-1">
            Historia nauki
          </h1>
          <p className="text-[var(--omni-text-muted)]">
            Twoje ostatnie sesje nauki
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-[var(--omni-text-muted)]">
            Łącznie: {sessions.length} sesji
          </span>
        </div>
      </div>

      {/* Stats Summary */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="omni-card p-4">
          <Calendar className="w-5 h-5 text-[var(--omni-accent)] mb-2" />
          <p className="text-2xl font-bold text-[var(--omni-text)]">
            {sessions.length}
          </p>
          <p className="text-sm text-[var(--omni-text-muted)]">Sesji</p>
        </div>
        <div className="omni-card p-4">
          <Clock className="w-5 h-5 text-blue-500 mb-2" />
          <p className="text-2xl font-bold text-[var(--omni-text)]">
            {Math.round(sessions.reduce((acc, s) => acc + s.totalTimeMinutes, 0) / 60)}h
          </p>
          <p className="text-sm text-[var(--omni-text-muted)]">Czas nauki</p>
        </div>
        <div className="omni-card p-4">
          <Award className="w-5 h-5 text-green-500 mb-2" />
          <p className="text-2xl font-bold text-[var(--omni-text)]">
            {Math.round(sessions.reduce((acc, s) => acc + s.totalTimeMinutes, 0) / sessions.length)}m
          </p>
          <p className="text-sm text-[var(--omni-text-muted)]">Średnio/sesję</p>
        </div>
        <div className="omni-card p-4">
          <TrendingUp className="w-5 h-5 text-orange-500 mb-2" />
          <p className="text-2xl font-bold text-[var(--omni-text)]">
            {new Set(sessions.map(s => s.analysis.subject)).size}
          </p>
          <p className="text-sm text-[var(--omni-text-muted)]">Przedmiotów</p>
        </div>
      </div>

      {/* Sessions List */}
      <div className="space-y-3">
        {sessions.map((session) => (
          <div
            key={session.id}
            className="omni-card p-4 lg:p-6 hover:shadow-lg transition-shadow"
          >
            <div className="flex flex-col lg:flex-row lg:items-center gap-4">
              {/* Subject Icon */}
              <div className="w-12 h-12 bg-[var(--omni-lavender)] rounded-xl flex items-center justify-center flex-shrink-0">
                <BookOpen className="w-6 h-6 text-[var(--omni-text)]" />
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2 mb-1">
                  <span className="omni-chip bg-[var(--omni-lavender)] text-[var(--omni-text)] text-xs">
                    {session.analysis.subject}
                  </span>
                  <span className="text-sm text-[var(--omni-text-muted)]">
                    {formatDate(session.startedAt)}
                  </span>
                </div>
                <h3 className="font-medium text-[var(--omni-text)] truncate">
                  {session.analysis.topic}
                </h3>
                <div className="flex items-center gap-4 mt-2 text-sm text-[var(--omni-text-muted)]">
                  <span className="flex items-center gap-1">
                    <Clock className="w-4 h-4" />
                    {session.totalTimeMinutes} min
                  </span>
                  <span className="flex items-center gap-1">
                    <Award className="w-4 h-4" />
                    {session.analysis.flashcards.length} fiszek
                  </span>
                  <span className="flex items-center gap-1">
                    <TrendingUp className="w-4 h-4" />
                    {session.analysis.quizQuestions.length} pytań
                  </span>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2">
                <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm font-medium">
                  Ukończono
                </span>
                <Link
                  to="/app/flashcards"
                  className="p-2 text-[var(--omni-accent)] hover:bg-[var(--omni-lavender)] rounded-lg transition-colors"
                >
                  <ArrowRight className="w-5 h-5" />
                </Link>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
