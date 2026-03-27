# OmniNauka - Product Requirements Document

## App Purpose

OmniNauka is an AI-powered learning platform designed for Polish students. It transforms handwritten notes and textbook pages into interactive study materials using OCR and AI.

## Target Users

**Primary:** Polish high school students (liceum, technikum) preparing for exams

**Secondary:**
- University students
- Students preparing for matura (Polish high school exit exam)
- Adult learners studying Polish subjects

## MVP Scope

### Implemented Features

#### Public Area
- [x] Marketing homepage with hero, features, pricing
- [x] Login page with form validation
- [x] Registration page
- [x] Demo mode entry

#### Authentication
- [x] Mock authentication system
- [x] Demo mode (no login required)
- [x] Session persistence via localStorage
- [x] Protected routes

#### Dashboard
- [x] Welcome section with user stats
- [x] Quick action cards (Upload, Flashcards, Quiz, Lesson)
- [x] Recent study sessions list
- [x] Subject progress bars
- [x] Study statistics (sessions, hours, average score, streak)

#### Upload Flow
- [x] Drag-and-drop file upload
- [x] File type validation (JPG, PNG, WEBP)
- [x] File size validation (max 10MB)
- [x] Image preview
- [x] Image cropping interface
- [x] Upload tips and guidance

#### Analysis
- [x] Loading state with progress indication
- [x] Subject detection display
- [x] Topic extraction
- [x] Key concepts list with categories
- [x] Summary generation
- [x] Action buttons to learning modules

#### Flashcards
- [x] Flip card interaction
- [x] Previous/Next navigation
- [x] Progress counter
- [x] Difficulty indicators
- [x] Empty state when no flashcards

#### Quiz
- [x] Multiple choice questions
- [x] True/False questions
- [x] Progress bar
- [x] Answer feedback
- [x] Explanation display
- [x] Final score summary

#### AI Lesson/Tutor
- [x] Chat interface
- [x] Streaming message display
- [x] User message input
- [x] Voice mode toggle (UI only)
- [x] Message history

#### Results/History
- [x] Session history list
- [x] Score display
- [x] Time spent tracking
- [x] Subject filtering

#### Settings/Profile
- [x] User profile display
- [x] Settings form (UI only)
- [x] Logout functionality

### Mocked Features (Demo Mode)

| Feature | Status | Notes |
|---------|--------|-------|
| User Authentication | Mocked | Any email/password works |
| OCR Analysis | Mocked | Returns pre-defined results |
| AI Tutor Responses | Mocked | Simulated streaming |
| Study History | Mocked | Static demo data |
| Progress Tracking | Mocked | Calculated from demo data |

### Not Implemented (Requires Backend)

| Feature | Priority | Notes |
|---------|----------|-------|
| Real user accounts | P0 | Requires auth service |
| Real OCR service | P0 | Google Vision, AWS Textract |
| Real AI responses | P0 | OpenAI, Claude integration |
| Database persistence | P0 | PostgreSQL, MongoDB |
| File storage | P0 | S3, Cloudinary |
| Payment integration | P1 | Stripe for subscriptions |
| Email notifications | P2 | SendGrid, Postmark |
| Social login | P2 | Google, Facebook OAuth |

## Core User Journeys

### Journey 1: First-Time User
1. Lands on homepage
2. Clicks "Wypróbuj za darmo"
3. Enters demo mode
4. Sees dashboard
5. Clicks "Nowy upload"
6. Uploads and crops image
7. Views analysis results
8. Starts flashcards/quiz/lesson

### Journey 2: Returning User
1. Logs in with credentials
2. Sees dashboard with recent activity
3. Continues from last session
4. Views progress in subjects

### Journey 3: Study Session
1. User uploads notes
2. System analyzes content
3. User reviews key concepts
4. User studies flashcards
5. User takes quiz
6. User reviews results

## What is Already Implemented

- Complete UI/UX for all major flows
- Responsive design (desktop, tablet, mobile)
- TypeScript types for all data models
- Mock authentication system
- File upload with cropping
- Simulated analysis flow
- Flashcard interactions
- Quiz with feedback
- AI tutor chat interface
- Session history display

## What is Mocked

- All AI/OCR responses (using static data)
- User authentication (client-side only)
- Study history (static demo data)
- Progress calculations (from static data)

## What Still Needs Real Backend Integration

1. **Authentication Service**
   - User registration/login
   - Password reset
   - Session management
   - OAuth providers

2. **OCR Service**
   - Image preprocessing
   - Text extraction
   - Content classification

3. **AI Service**
   - Key concept extraction
   - Flashcard generation
   - Quiz question generation
   - Tutor responses

4. **Database**
   - User profiles
   - Study sessions
   - Uploaded files metadata
   - Progress tracking
   - Quiz results

5. **File Storage**
   - Image upload
   - Image retrieval
   - CDN delivery

## Technical Assumptions

- Single-user demo mode is sufficient for MVP
- Mock data represents realistic outputs
- Session storage is adequate for image handling
- Client-side state management is sufficient for demo
