# OmniNauka - TypeScript Data Models

## Core Types

### User
```typescript
interface User {
  id: string;                    // Unique user ID
  email: string;                 // User email
  name: string;                  // Display name
  avatar?: string;               // Avatar URL (optional)
  createdAt: Date;               // Account creation date
  plan: 'free' | 'premium' | 'family';  // Subscription plan
}
```

**Usage:** Auth state, profile display, plan-based feature gating

### AuthState
```typescript
interface AuthState {
  user: User | null;             // Current user or null
  isAuthenticated: boolean;      // Auth status
  isLoading: boolean;            // Loading state for auth checks
}
```

**Usage:** AuthContext state, protected route checks

---

## Upload Types

### UploadedFile
```typescript
interface UploadedFile {
  id: string;                    // File ID
  file: File;                    // Original File object
  previewUrl: string;            // Object URL for preview
  croppedUrl?: string;           // Cropped image URL (optional)
  name: string;                  // File name
  size: number;                  // File size in bytes
  type: string;                  // MIME type
  uploadedAt: Date;              // Upload timestamp
}
```

**Usage:** UploadPage state, file management

### UploadState
```typescript
interface UploadState {
  files: UploadedFile[];         // Array of uploaded files
  isUploading: boolean;          // Upload in progress
  error: string | null;          // Error message
}
```

**Usage:** Upload form state management

---

## Analysis Types

### AnalysisResult
```typescript
interface AnalysisResult {
  id: string;                    // Analysis ID
  subject: string;               // Detected subject (e.g., "Biologia")
  topic: string;                 // Detected topic
  confidence: number;            // OCR confidence (0-1)
  keyConcepts: KeyConcept[];     // Extracted concepts
  flashcards: FlashcardData[];   // Generated flashcards
  quizQuestions: QuizQuestion[]; // Generated questions
  summary: string;               // AI-generated summary
  createdAt: Date;               // Analysis timestamp
  sourceFileId: string;          // Reference to source file
}
```

**Usage:** Analysis results display, data for learning modules

### KeyConcept
```typescript
interface KeyConcept {
  id: string;                    // Concept ID
  term: string;                  // Term/concept name
  definition: string;            // Definition/explanation
  category: 'definition' | 'date' | 'formula' | 'person' | 'event' | 'concept';
}
```

**Usage:** Key concepts display, categorization

---

## Flashcard Types

### FlashcardData
```typescript
interface FlashcardData {
  id: string;                    // Flashcard ID
  front: string;                 // Question/prompt
  back: string;                  // Answer/explanation
  difficulty: 'easy' | 'medium' | 'hard';
}
```

**Usage:** FlashcardsPage, study session data

---

## Quiz Types

### QuizQuestion
```typescript
interface QuizQuestion {
  id: string;                    // Question ID
  type: 'single_choice' | 'true_false' | 'short_answer';
  question: string;              // Question text
  options?: string[];            // Options (for single_choice)
  correctAnswer: string | number; // Correct answer
  explanation: string;           // Explanation after answering
  difficulty: 'easy' | 'medium' | 'hard';
}
```

**Usage:** QuizPage, question display

### QuizAnswer
```typescript
interface QuizAnswer {
  questionId: string;            // Reference to question
  selectedAnswer: string | number; // User's answer
  isCorrect: boolean;            // Whether correct
  timeSpentSeconds: number;      // Time spent on question
}
```

**Usage:** QuizPage state, results calculation

---

## Lesson/Tutor Types

### LessonMessage
```typescript
interface LessonMessage {
  id: string;                    // Message ID
  role: 'user' | 'assistant';    // Message sender
  content: string;               // Message text
  timestamp: Date;               // Message time
  isStreaming?: boolean;         // Currently streaming
}
```

**Usage:** LessonPage chat interface

---

## Study Session Types

### StudySession
```typescript
interface StudySession {
  id: string;                    // Session ID
  userId: string;                // User reference
  analysisId: string;            // Analysis reference
  analysis: AnalysisResult;      // Full analysis data
  status: 'in_progress' | 'completed' | 'abandoned';
  startedAt: Date;               // Start time
  completedAt?: Date;            // Completion time (optional)
  totalTimeMinutes: number;      // Total time spent
}
```

**Usage:** HistoryPage, progress tracking

---

## Progress Types

### SubjectProgress
```typescript
interface SubjectProgress {
  subject: string;               // Subject name
  totalSessions: number;         // Number of sessions
  averageScore: number;          // Average quiz score
  totalTimeMinutes: number;      // Total study time
  lastStudiedAt?: Date;          // Last study date
  masteryLevel: 'beginner' | 'intermediate' | 'advanced' | 'expert';
}
```

**Usage:** Dashboard progress bars, subject tracking

### StudyResult
```typescript
interface StudyResult {
  id: string;                    // Result ID
  userId: string;                // User reference
  sessionId: string;             // Session reference
  subject: string;               // Subject name
  topic: string;                 // Topic name
  score: number;                 // Score (0-100)
  totalQuestions: number;        // Total questions
  correctAnswers: number;        // Correct answers
  timeSpentMinutes: number;      // Time spent
  weakAreas: string[];           // Areas needing improvement
  strongAreas: string[];         // Strong areas
  recommendations: string[];     // Study recommendations
  createdAt: Date;               // Result timestamp
}
```

**Usage:** ResultsPage, performance analysis

---

## Dashboard Types

### DashboardSummary
```typescript
interface DashboardSummary {
  totalStudySessions: number;    // Total sessions
  totalStudyTimeMinutes: number; // Total time
  averageScore: number;          // Average score
  currentStreak: number;         // Current day streak
  longestStreak: number;         // Longest streak
  recentSessions: StudySession[]; // Recent sessions
  subjectProgress: SubjectProgress[]; // Progress by subject
  recentUploads: UploadedFile[]; // Recent uploads
}
```

**Usage:** DashboardPage statistics display

---

## Type Usage Patterns

### Creating New Types
When adding new features, follow these patterns:

1. **Use strict typing:**
```typescript
// Good
interface Props {
  user: User;
  onUpdate: (user: User) => void;
}

// Avoid
interface Props {
  user: any;
  onUpdate: Function;
}
```

2. **Use discriminated unions for state:**
```typescript
type QuizState = 
  | { status: 'idle' }
  | { status: 'in_progress'; currentQuestion: number }
  | { status: 'completed'; score: number };
```

3. **Use optional fields sparingly:**
```typescript
// Good - completion date is truly optional
interface Session {
  startedAt: Date;
  completedAt?: Date;
}

// Avoid - make required if always present
interface User {
  name: string;
  email?: string; // Should be required
}
```

## Type Locations

All types are defined in `src/types/index.ts`.

When adding new types:
1. Add to `src/types/index.ts`
2. Export from the file
3. Import where needed with `type` keyword:
   ```typescript
   import type { User, AnalysisResult } from '../types';
   ```
