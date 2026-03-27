# OmniNauka - Architecture Documentation

## Folder Structure

```
src/
├── components/
│   ├── layout/
│   │   └── app-shell.tsx       # Main app layout with sidebar
│   └── ui/                      # shadcn/ui components (auto-generated)
│       ├── button.tsx
│       ├── card.tsx
│       ├── input.tsx
│       └── ... (40+ components)
├── pages/
│   ├── HomePage.tsx            # Public marketing page
│   ├── LoginPage.tsx           # Login form
│   ├── RegisterPage.tsx        # Registration form
│   └── app/                    # Protected routes
│       ├── DashboardPage.tsx   # Main dashboard
│       ├── UploadPage.tsx      # File upload + cropper
│       ├── AnalysisPage.tsx    # Analysis results display
│       ├── FlashcardsPage.tsx  # Flashcard study mode
│       ├── QuizPage.tsx        # Quiz interface
│       ├── LessonPage.tsx      # AI tutor chat
│       ├── ResultsPage.tsx     # Quiz results
│       ├── HistoryPage.tsx     # Study history
│       ├── ProfilePage.tsx     # User profile
│       └── SettingsPage.tsx    # App settings
├── lib/
│   ├── auth-context.tsx        # Auth state management
│   └── utils.ts                # Utility functions (cn, etc.)
├── types/
│   └── index.ts                # All TypeScript types
├── mock/
│   └── data.ts                 # Mock data for demo
├── hooks/                      # Custom React hooks
└── utils/                      # Helper utilities
```

## Routing Structure

```
/                    -> HomePage (public)
/login               -> LoginPage (public)
/register            -> RegisterPage (public)
/app/*               -> Protected routes (requires auth)
  /app/dashboard     -> DashboardPage
  /app/upload        -> UploadPage
  /app/analysis      -> AnalysisPage
  /app/flashcards    -> FlashcardsPage
  /app/quiz          -> QuizPage
  /app/lesson        -> LessonPage
  /app/results       -> ResultsPage
  /app/history       -> HistoryPage
  /app/profile       -> ProfilePage
  /app/settings      -> SettingsPage
```

## State Structure

### Authentication State
```typescript
interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}
```

Managed by `AuthContext` in `lib/auth-context.tsx`:
- Persists to localStorage
- Provides login/logout/register methods
- Demo mode bypasses real auth

### Upload State
```typescript
interface UploadState {
  files: UploadedFile[];
  isUploading: boolean;
  error: string | null;
}
```

Managed locally in `UploadPage`:
- Uses react-dropzone for file handling
- Stores cropped image in sessionStorage
- Passes to AnalysisPage via sessionStorage

### Analysis State
```typescript
interface AnalysisResult {
  id: string;
  subject: string;
  topic: string;
  confidence: number;
  keyConcepts: KeyConcept[];
  flashcards: FlashcardData[];
  quizQuestions: QuizQuestion[];
  summary: string;
}
```

Stored in sessionStorage:
- `uploadedImage` - base64 of cropped image
- `currentAnalysis` - JSON string of analysis result

### Quiz State
```typescript
interface QuizState {
  currentQuestionIndex: number;
  answers: QuizAnswer[];
  isCompleted: boolean;
  score: number;
}
```

Managed locally in `QuizPage`:
- Tracks user answers
- Calculates score
- Shows feedback per question

## Component Organization

### Layout Components
- `AppShell` - Main layout with sidebar, handles responsive nav

### Page Components
- Each route has its own page component
- Pages are responsible for data fetching (currently mock)
- Pages manage their own local state

### Shared Components
- All UI components from shadcn/ui
- Custom components in `components/` directory

## How Auth/Demo Auth Works

### Authentication Flow
1. User submits login form
2. `AuthContext.login()` validates (min requirements)
3. Sets user in state and localStorage
4. Redirects to dashboard

### Demo Mode
1. User clicks "Tryb demo"
2. `AuthContext.loginAsDemo()` sets mock user
3. Bypasses all validation
4. Full app access with mock data

### Protected Routes
```typescript
function ProtectedRoute({ children }) {
  const { isAuthenticated, isLoading } = useAuth();
  
  if (isLoading) return <LoadingSpinner />;
  if (!isAuthenticated) return <Navigate to="/login" />;
  
  return children;
}
```

## How Upload/Crop/Analysis Flow Works

### 1. Upload
```
User drops file -> react-dropzone validates -> 
File stored in state -> Preview displayed -> 
Cropping interface shown
```

### 2. Crop
```
User adjusts crop -> Cropper component captures area -> 
Canvas crops image -> Cropped image saved to state
```

### 3. Analysis
```
User clicks "Analizuj" -> Loading state shown -> 
Mock analysis generated -> Stored in sessionStorage -> 
Redirect to /app/analysis
```

### 4. Display
```
AnalysisPage reads sessionStorage -> 
Displays subject, topic, key concepts -> 
Shows action cards for flashcards/quiz/lesson
```

## Future Integration Points

### OCR Service Integration
**Location:** `UploadPage.tsx` - `handleAnalyze()` method

**Current:**
```typescript
const handleAnalyze = async () => {
  setIsAnalyzing(true);
  await new Promise(resolve => setTimeout(resolve, 2000));
  const result = getDemoAnalysis();
  // ...
};
```

**Future:**
```typescript
const handleAnalyze = async () => {
  setIsAnalyzing(true);
  const result = await ocrService.analyze(croppedImage);
  // ...
};
```

### AI Service Integration
**Location:** `LessonPage.tsx` - `streamMockResponse()` function

**Current:** Mock character-by-character streaming

**Future:** Use Vercel AI SDK:
```typescript
import { useChat } from '@ai-sdk/react';

const { messages, input, handleInputChange, handleSubmit } = useChat({
  api: '/api/chat',
});
```

### Database Integration
**Locations:** `DashboardPage`, `HistoryPage`, `AnalysisPage`

**Current:** Directly utilizing `@supabase/supabase-js` to select, insert, and query real `study_sessions` and `users` tables securely using proper row isolation policies. Fallbacks only trigger inside demo states.

### Authentication Service Integration
**Location:** `lib/auth-context.tsx`

**Current:** Client-side validation only

**Future:**
```typescript
const login = async (email: string, password: string) => {
  const response = await api.post('/api/auth/login', { email, password });
  setUser(response.data.user);
  localStorage.setItem('token', response.data.token);
};
```

## State Management Recommendations

### Current (Demo)
- React Context for auth
- Local state for pages
- sessionStorage for temporary data

### Production
Consider adding:
- **TanStack Query (React Query)** - Server state management
- **Zustand** - Global client state if needed
- **React Hook Form** - Form state management

## Performance Considerations

### Current Optimizations
- Code splitting via React Router
- Lazy loading of page components (recommended)
- Image optimization via cropping

### Recommended Optimizations
1. Add React.lazy() for route-based code splitting
2. Implement virtual scrolling for long lists
3. Add image compression before upload
4. Use React.memo for expensive components
5. Debounce search inputs

## Security Considerations

### Current (Demo)
- No real security (client-side only)

### Production Requirements
1. HTTPS only
2. JWT tokens with refresh
3. CSRF protection
4. Input sanitization
5. Rate limiting
6. File upload validation (server-side)
7. Content Security Policy
