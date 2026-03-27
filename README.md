# OmniNauka

AI-powered EdTech web application for students in Poland.

## What is OmniNauka?

OmniNauka is a learning platform that allows students to:
1. Upload photos of their notes or textbook pages
2. Have AI analyze the content using OCR
3. Generate personalized learning materials:
   - Flashcards for memorization
   - Quizzes for self-testing
   - AI tutor for interactive learning
   - Progress tracking and history

## Tech Stack

- **Framework:** React 18 + TypeScript + Vite
- **Routing:** React Router v6 (with `React.lazy` and `Suspense`)
- **Styling:** Tailwind CSS 3.4 + shadcn/ui components
- **Frontend State:** React Context API
- **Backend Services:** Supabase (Auth, Postgres DB, Storage)
- **File Upload & Image Handling:** react-dropzone, react-easy-crop, browser-image-compression
- **AI SDK:** Vercel AI SDK (installed, ready for integration)
- **Icons:** Lucide React

## Project Structure

```
src/
├── components/
│   ├── layout/          # AppShell, navigation components
│   └── ui/              # shadcn/ui components (40+)
├── pages/
│   ├── HomePage.tsx     # Public marketing homepage
│   ├── LoginPage.tsx    # Authentication
│   ├── RegisterPage.tsx # User registration
│   └── app/             # Protected app pages
│       ├── DashboardPage.tsx
│       ├── UploadPage.tsx
│       ├── AnalysisPage.tsx
│       ├── FlashcardsPage.tsx
│       ├── QuizPage.tsx
│       ├── LessonPage.tsx
│       ├── ResultsPage.tsx
│       ├── HistoryPage.tsx
│       ├── ProfilePage.tsx
│       └── SettingsPage.tsx
├── lib/
│   ├── auth-context.tsx # Authentication state management
│   └── utils.ts         # Utility functions
├── types/
│   └── index.ts         # TypeScript type definitions
├── mock/
│   └── data.ts          # Mock data for demo mode
├── hooks/               # Custom React hooks
└── utils/               # Helper utilities
```

## Installation

```bash
npm install
```

## Running Locally

```bash
npm run dev
```

The app will be available at `http://localhost:5173`

## Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build

## Demo Mode

The app includes a demo mode that works without backend:

1. Click "Tryb demo - wejdź bez logowania" on the login page
2. Or use any email/password combination (min 4 chars for password)

Demo mode uses:
- Mock user data (Kacper, Premium plan)
- Mock analysis results (Biology, History subjects)
- Session storage for uploaded images
- Simulated AI responses with streaming effect

## Known Limitations

- No real OCR service (mocked analysis)
- No real AI service (mocked responses)
- Demo Mode bypasses actual database integration for data mapping

## Next Steps for Production

1. Connect to backend API
2. Integrate OCR service (e.g., Google Vision, AWS Textract)
3. Connect to AI service (OpenAI, Claude, etc.)
4. Add real authentication (Supabase Auth, Firebase Auth, etc.)
5. Add database for user data and study history
6. Add file storage for uploaded images
7. Add error tracking and analytics

## Documentation

See `/docs/` directory for comprehensive documentation:
- `PRODUCT_REQUIREMENTS.md` - Product specifications
- `ARCHITECTURE.md` - Technical architecture
- `TYPES.md` - Data models
- `KNOWN_ISSUES.md` - Known bugs and limitations
- `IMPROVEMENT_BACKLOG.md` - Prioritized backlog
- `TEST_SCENARIOS.md` - Manual test cases
- `HANDOFF_TO_ANTIGRAVITY.md` - Technical handoff
- `FILE_MANIFEST.md` - File reference
