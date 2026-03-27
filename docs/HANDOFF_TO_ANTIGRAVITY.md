# Handoff to Antigravity - OmniNauka

## Executive Summary

OmniNauka is a functional MVP of an AI-powered learning platform for Polish students. The codebase is stable, typed, and ready for backend integration. This document provides technical context for continued development.

**Current Status:** Demo-ready MVP with mocked backend
**Stack:** React 18 + TypeScript + Vite + Tailwind CSS + shadcn/ui
**Live URL:** https://qeq4adso5tdyw.ok.kimi.link

---

## What Works

### ✅ Fully Functional
- **Authentication Flow** - Login, register, demo mode, logout
- **Protected Routes** - Auth guards working
- **Dashboard** - Stats, quick actions, recent sessions, progress bars
- **Upload** - Drag-drop, file validation, image cropping
- **Analysis Display** - Results page with key concepts, actions
- **Flashcards** - Flip animation, navigation, progress tracking
- **Quiz** - Multiple choice, true/false, feedback, scoring
- **AI Tutor Chat** - Streaming messages, voice mode toggle
- **History** - Session list, filtering
- **Settings/Profile** - UI forms, logout
- **Responsive Design** - Desktop, tablet, mobile layouts

### ✅ Technical Foundation
- TypeScript types for all data models
- Component architecture with shadcn/ui
- React Context for auth state
- Session storage for temporary data
- Clean folder structure

---

## What is Mocked

| Feature | Current Implementation | What to Replace |
|---------|----------------------|-----------------|
| Auth | Client-side validation only | JWT + refresh tokens |
| OCR | Static demo results | Google Vision / AWS Textract |
| AI Tutor | Random responses | OpenAI / Claude API |
| Study History | Static mock data | Database queries |
| Progress | Calculated from mock | Database aggregation |
| File Storage | sessionStorage (base64) | S3 / Cloudinary |

---

## Biggest Issues to Investigate First

### 1. Session Storage Image Limit (P1)
**Location:** `src/pages/app/UploadPage.tsx`

**Problem:** sessionStorage has ~5MB limit. Large images as base64 can exceed this.

**Reproduction:** Upload a 3MB+ image, check if analysis works.

**Fix Options:**
- Option A: Compress images client-side before storing
- Option B: Use IndexedDB instead of sessionStorage
- Option C: Upload to server immediately, store URL

**Recommended:** Implement Option A + C together.

---

### 2. Mobile Upload UX (P1)
**Location:** `src/pages/app/UploadPage.tsx`

**Problem:** Camera access not explicitly requested. Cropping interface can be clunky on mobile.

**Reproduction:** Test on iOS Safari and Android Chrome.

**Fix:**
```tsx
<input
  type="file"
  accept="image/*"
  capture="environment"  // Add this for camera
  // ...
/>
```

Also improve touch targets for cropper controls.

---

### 3. No Error Boundaries (P1)
**Location:** App-wide

**Problem:** Any error can crash the entire app.

**Fix:** Add Error Boundary around main sections:
```tsx
// src/components/error-boundary.tsx
class ErrorBoundary extends React.Component {
  // ... implementation
}

// Use in App.tsx
<ErrorBoundary>
  <AppShell>{children}</AppShell>
</ErrorBoundary>
```

---

### 4. Bundle Size (P2)
**Location:** Build output

**Problem:** All shadcn/ui components included, large bundle.

**Check:** Run `npm run build` and check bundle size.

**Fix:**
- Tree-shake unused components
- Lazy load routes:
```tsx
const DashboardPage = lazy(() => import('./pages/app/DashboardPage'));
```

---

### 5. Random AI Responses (P2)
**Location:** `src/pages/app/LessonPage.tsx` - `streamMockResponse()`

**Problem:** Tutor responses don't actually respond to user input.

**Fix:** Integrate Vercel AI SDK:
```tsx
import { useChat } from '@ai-sdk/react';

const { messages, input, handleInputChange, handleSubmit } = useChat({
  api: '/api/chat',
  body: { topic, subject },
});
```

---

## Where Bugs Are Likely Located

### High Risk Areas

1. **UploadPage.tsx** - File handling edge cases
   - Large files
   - Invalid file types
   - Cancelled uploads
   - Memory leaks from object URLs

2. **FlashcardsPage.tsx** - State management
   - Progress tracking
   - Card navigation edge cases

3. **QuizPage.tsx** - Answer handling
   - Race conditions in answer selection
   - Score calculation

4. **LessonPage.tsx** - Streaming
   - Message state updates
   - Scroll to bottom

5. **auth-context.tsx** - Auth state
   - localStorage sync issues
   - Race conditions on login/logout

### Recommended Debugging Steps

1. Add console logging to UploadPage file handling
2. Test flashcard navigation with keyboard
3. Test quiz with rapid answer clicking
4. Check memory usage during long lesson chats
5. Test auth with multiple tabs open

---

## Recommended Refactors

### 1. Extract API Layer (High Priority)

Create `src/api/` directory:
```
src/api/
├── client.ts       # Axios/fetch setup
├── auth.ts         # Auth endpoints
├── upload.ts       # Upload endpoints
├── analysis.ts     # Analysis endpoints
└── index.ts        # Exports
```

### 2. Add TanStack Query (High Priority)

Replace direct state management:
```tsx
// Before
const [sessions, setSessions] = useState([]);
useEffect(() => {
  fetchSessions().then(setSessions);
}, []);

// After
const { data: sessions } = useQuery({
  queryKey: ['sessions'],
  queryFn: fetchSessions,
});
```

### 3. Centralize Types (Medium Priority)

All types are already in `src/types/index.ts` - keep it that way.

### 4. Add Form Library (Medium Priority)

Consider React Hook Form for complex forms:
- Login/Register
- Settings

### 5. Component Documentation (Low Priority)

Add JSDoc to complex components:
```tsx
/**
 * FlashcardViewer displays interactive flashcards
 * @param flashcards - Array of flashcard data
 * @param onProgress - Callback for progress updates
 */
```

---

## Recommended Performance Optimizations

### Quick Wins (1-2 days)

1. **Image Compression**
```tsx
import imageCompression from 'browser-image-compression';

const compressed = await imageCompression(file, {
  maxSizeMB: 1,
  maxWidthOrHeight: 1920,
});
```

2. **Lazy Load Routes**
```tsx
const UploadPage = lazy(() => import('./pages/app/UploadPage'));
```

3. **Memoize Expensive Components**
```tsx
export default memo(FlashcardViewer);
```

### Medium Effort (3-5 days)

1. **Virtualize Long Lists**
   - Use `react-window` for history list

2. **Optimize Images**
   - Use WebP format
   - Implement responsive images

3. **Code Splitting**
   - Split by route
   - Split heavy components (cropper)

### High Effort (1+ weeks)

1. **Service Worker**
   - Cache assets
   - Offline support

2. **Server-Side Rendering**
   - Consider Next.js migration if SEO critical

---

## Recommended Productionization Steps

### Phase 1: Backend Foundation (Week 1-2)

1. Set up API server (Node.js/Express or similar)
2. Set up database (PostgreSQL recommended)
3. Set up file storage (S3)
4. Create API endpoints for:
   - Auth (login, register, refresh)
   - Upload (presigned URLs)
   - Analysis (trigger OCR, store results)
   - Study sessions (CRUD)

### Phase 2: OCR Integration (Week 3)

1. Choose OCR service:
   - Google Vision API (recommended)
   - AWS Textract
   - Azure Computer Vision

2. Implement OCR pipeline:
   - Upload image to S3
   - Trigger OCR
   - Parse results
   - Store in database

### Phase 3: AI Integration (Week 4)

1. Choose AI service:
   - OpenAI GPT-4 (recommended)
   - Anthropic Claude
   - Google Gemini

2. Implement AI endpoints:
   - Generate flashcards
   - Generate quiz questions
   - Tutor chat (streaming)

### Phase 4: Auth & Security (Week 5)

1. Implement JWT auth:
   - Access tokens (short-lived)
   - Refresh tokens (long-lived, httpOnly)

2. Add security measures:
   - Rate limiting
   - Input validation
   - CORS configuration
   - Helmet.js

### Phase 5: Polish (Week 6+)

1. Error tracking (Sentry)
2. Analytics (Mixpanel/Amplitude)
3. Monitoring (Datadog/New Relic)
4. CI/CD pipeline
5. Automated testing

---

## Components/Routes Needing Most Attention

### High Priority

| Component | Issue | Recommended Action |
|-----------|-------|-------------------|
| UploadPage | sessionStorage limit | Compress images, use server storage |
| LessonPage | Random responses | Integrate real AI API |
| QuizPage | No timer | Add per-question timer |
| FlashcardsPage | No progress persistence | Store progress in DB |

### Medium Priority

| Component | Issue | Recommended Action |
|-----------|-------|-------------------|
| Dashboard | Static data | Connect to real API |
| HistoryPage | Static data | Connect to real API |
| AnalysisPage | Mock results | Connect to OCR pipeline |

### Low Priority

| Component | Issue | Recommended Action |
|-----------|-------|-------------------|
| SettingsPage | UI only | Connect to user API |
| ProfilePage | UI only | Connect to user API |

---

## Environment Variables Needed

Create `.env` file:
```env
# API
VITE_API_URL=https://api.omninauka.pl

# AI
VITE_OPENAI_API_KEY=sk-...

# OCR
VITE_GOOGLE_VISION_API_KEY=...

# Storage
VITE_S3_BUCKET=omninauka-uploads
VITE_S3_REGION=eu-central-1

# Auth
VITE_JWT_SECRET=...
VITE_REFRESH_TOKEN_SECRET=...

# App
VITE_APP_URL=https://omninauka.pl
VITE_APP_NAME=OmniNauka
```

---

## First Week Action Plan

### Day 1-2: Setup & Investigation
- [x] Review codebase thoroughly
- [x] Run all test scenarios manually
- [x] Identify critical bugs
- [x] Set up local development environment

### Day 3-4: Quick Fixes (Sprint 1)
- [x] Add error boundaries (`ErrorBoundary` across main shell)
- [x] Fix mobile upload UX (added explicit camera upload button and `touch-action: none` to cropper)
- [x] Add image compression (`browser-image-compression` applied after cropping)
- [x] Fix any critical bugs found (Chunk sizes, session storage crashes)

### Day 5: Planning
- [ ] Review backend requirements
- [ ] Choose tech stack for backend
- [ ] Plan API endpoints
- [ ] Set up project structure

---

## Questions for Product Owner

1. **OCR Priority:** Which subjects should OCR prioritize? (Text-heavy like History vs formula-heavy like Math)

2. **AI Model:** Should tutor responses be in Polish only or multilingual?

3. **Pricing:** What's the free tier limit? (Currently mocked as 3 scans/day)

4. **Data Retention:** How long should uploaded images be stored?

5. **Compliance:** Any GDPR/Polish data protection requirements?

---

## Resources

- **Live Demo:** https://qeq4adso5tdyw.ok.kimi.link
- **Repository:** [Add your repo URL]
- **Design:** [Add Figma link if available]
- **API Docs:** [Add when created]

---

## Contact

For questions about this handoff:
- [Add contact info]

---

## Appendix: Key Files Reference

| File | Purpose |
|------|---------|
| `src/App.tsx` | Main app component, routing |
| `src/lib/auth-context.tsx` | Authentication state |
| `src/types/index.ts` | All TypeScript types |
| `src/mock/data.ts` | Mock data for demo |
| `src/pages/app/UploadPage.tsx` | File upload + cropper |
| `src/pages/app/AnalysisPage.tsx` | Analysis results |
| `src/pages/app/LessonPage.tsx` | AI tutor chat |

---

**Good luck, Antigravity! The foundation is solid. Focus on backend integration and the app will be production-ready.**
