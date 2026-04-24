// User Types
export interface User {
  id: string;
  email: string;
  name: string;
  avatar?: string;
  createdAt: Date;
  plan: 'free' | 'premium' | 'family';
}

export interface Folder {
  id: string;
  userId: string;
  parentId: string | null;
  name: string;
  createdAt: Date;
}

export interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

// Upload Types
export interface UploadedFile {
  id: string;
  file: File;
  previewUrl: string;
  croppedUrl?: string;
  name: string;
  size: number;
  type: string;
  uploadedAt: Date;
}

export interface UploadState {
  files: UploadedFile[];
  isUploading: boolean;
  error: string | null;
}

// Analysis Types
export interface KeyConcept {
  id: string;
  term: string;
  definition: string;
  category: 'definition' | 'date' | 'formula' | 'person' | 'event' | 'concept';
}

export interface FlashcardData {
  id: string;
  front: string;
  back: string;
  difficulty: 'easy' | 'medium' | 'hard';
}

export interface QuizQuestion {
  id: string;
  type: 'single_choice' | 'true_false' | 'short_answer';
  question: string;
  options?: string[];
  correctAnswer: string | number;
  explanation: string;
  difficulty: 'easy' | 'medium' | 'hard';
}

export interface AnalysisResult {
  id: string;
  subject: string;
  topic: string;
  confidence: number;
  keyConcepts: KeyConcept[];
  flashcards: FlashcardData[];
  quizQuestions: QuizQuestion[];
  summary: string;
  createdAt: Date;
  sourceFileId: string;
}

// DB Study Session row (as returned from Supabase)
export interface DbStudySession {
  id: string;
  user_id: string;
  image_url: string;
  raw_ocr_text?: string;
  subject?: string;
  topic?: string;
  summary?: string;
  confidence?: number;
  key_concepts: any[];
  flashcards: any[];
  quiz_questions: any[];
  lesson_title?: string;
  deleted_at?: string | null;
  folder_id?: string | null;      // Sprint 4: explorer positioning
  created_at: string;
}

// Sprint 2: child image row for multi-image sessions
export interface SessionImage {
  id: string;
  session_id: string;
  image_url: string;
  position: number;
  created_at: string;
}

// Study Session Types
export interface StudySession {
  id: string;
  userId: string;
  analysisId: string;
  analysis: AnalysisResult;
  status: 'in_progress' | 'completed' | 'abandoned';
  startedAt: Date;
  completedAt?: Date;
  totalTimeMinutes: number;
  folderId?: string | null;      // Sprint 4: explorer positioning
}


// Quiz Session Types
export interface QuizAnswer {
  questionId: string;
  selectedAnswer: string | number;
  isCorrect: boolean;
  timeSpentSeconds: number;
}

// Lesson/Tutor Types
export interface LessonMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  isStreaming?: boolean;
}

// Results Types
export interface SubjectProgress {
  subject: string;
  totalSessions: number;
  averageScore: number;
  totalTimeMinutes: number;
  lastStudiedAt?: Date;
  masteryLevel: 'beginner' | 'intermediate' | 'advanced' | 'expert';
}

export interface StudyResult {
  id: string;
  userId: string;
  sessionId: string;
  subject: string;
  topic: string;
  score: number;
  totalQuestions: number;
  correctAnswers: number;
  timeSpentMinutes: number;
  weakAreas: string[];
  strongAreas: string[];
  recommendations: string[];
  createdAt: Date;
}

// Dashboard Types
export interface DashboardSummary {
  totalStudySessions: number;
  totalStudyTimeMinutes: number;
  averageScore: number;
  currentStreak: number;
  longestStreak: number;
  recentSessions: StudySession[];
  subjectProgress: SubjectProgress[];
  recentUploads: UploadedFile[];
}
