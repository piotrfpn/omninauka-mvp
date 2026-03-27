# OmniNauka - File Manifest

## Configuration Files

| File | Purpose |
|------|---------|
| `package.json` | NPM dependencies and scripts |
| `tsconfig.json` | TypeScript configuration |
| `vite.config.ts` | Vite build configuration |
| `tailwind.config.js` | Tailwind CSS configuration |
| `postcss.config.js` | PostCSS configuration |
| `components.json` | shadcn/ui configuration |
| `eslint.config.js` | ESLint rules |
| `.env.example` | Environment variables template |

---

## Entry Points

| File | Purpose |
|------|---------|
| `index.html` | HTML entry point |
| `src/main.tsx` | React application entry |
| `src/App.tsx` | Root component with routing |
| `src/App.css` | Global app styles |
| `src/index.css` | Tailwind + custom CSS |

---

## Core Application

### Routing & Layout
| File | Purpose | Key Exports |
|------|---------|-------------|
| `src/App.tsx` | Main router, protected routes | `App`, `ProtectedRoute` |
| `src/components/layout/app-shell.tsx` | App layout with sidebar | `AppShell` |

### Authentication
| File | Purpose | Key Exports |
|------|---------|-------------|
| `src/lib/auth-context.tsx` | Auth state management | `AuthProvider`, `useAuth` |

### Types
| File | Purpose | Key Types |
|------|---------|-----------|
| `src/types/index.ts` | All TypeScript definitions | `User`, `AnalysisResult`, `FlashcardData`, `QuizQuestion`, etc. |

### Mock Data
| File | Purpose | Key Exports |
|------|---------|-------------|
| `src/mock/data.ts` | Demo data | `mockUser`, `mockAnalysisResults`, `getDemoAnalysis` |

### Utilities
| File | Purpose | Key Exports |
|------|---------|-------------|
| `src/lib/utils.ts` | Utility functions | `cn` (className merger) |

---

## Pages (Routes)

### Public Pages
| File | Route | Purpose |
|------|-------|---------|
| `src/pages/HomePage.tsx` | `/` | Marketing homepage |
| `src/pages/LoginPage.tsx` | `/login` | Login form |
| `src/pages/RegisterPage.tsx` | `/register` | Registration form |

### Protected App Pages
| File | Route | Purpose |
|------|-------|---------|
| `src/pages/app/DashboardPage.tsx` | `/app/dashboard` | Main dashboard with stats |
| `src/pages/app/UploadPage.tsx` | `/app/upload` | File upload + image cropper |
| `src/pages/app/AnalysisPage.tsx` | `/app/analysis` | Analysis results display |
| `src/pages/app/FlashcardsPage.tsx` | `/app/flashcards` | Flashcard study mode |
| `src/pages/app/QuizPage.tsx` | `/app/quiz` | Quiz interface |
| `src/pages/app/LessonPage.tsx` | `/app/lesson` | AI tutor chat |
| `src/pages/app/ResultsPage.tsx` | `/app/results` | Quiz results |
| `src/pages/app/HistoryPage.tsx` | `/app/history` | Study history |
| `src/pages/app/ProfilePage.tsx` | `/app/profile` | User profile |
| `src/pages/app/SettingsPage.tsx` | `/app/settings` | App settings |

---

## UI Components (shadcn/ui)

Located in `src/components/ui/` - 40+ pre-built components:

| Component | Purpose |
|-----------|---------|
| `button.tsx` | Button variants |
| `card.tsx` | Card container |
| `input.tsx` | Text input |
| `label.tsx` | Form labels |
| `dialog.tsx` | Modal dialogs |
| `dropdown-menu.tsx` | Dropdown menus |
| `tabs.tsx` | Tab navigation |
| `progress.tsx` | Progress bars |
| `badge.tsx` | Status badges |
| `avatar.tsx` | User avatars |
| `separator.tsx` | Visual separators |
| `skeleton.tsx` | Loading skeletons |
| `scroll-area.tsx` | Custom scrollbars |
| `toast.tsx` | Notifications |
| `tooltip.tsx` | Hover tooltips |
| ...and 25+ more | See directory for full list |

---

## Documentation

| File | Purpose |
|------|---------|
| `README.md` | Project overview and setup |
| `docs/PRODUCT_REQUIREMENTS.md` | Product specifications |
| `docs/ARCHITECTURE.md` | Technical architecture |
| `docs/TYPES.md` | Data models documentation |
| `docs/KNOWN_ISSUES.md` | Known bugs and limitations |
| `docs/IMPROVEMENT_BACKLOG.md` | Prioritized backlog |
| `docs/TEST_SCENARIOS.md` | Manual test cases |
| `docs/HANDOFF_TO_ANTIGRAVITY.md` | Technical handoff |
| `docs/FILE_MANIFEST.md` | This file |

---

## Key File Relationships

```
main.tsx
  └── App.tsx
        ├── AuthProvider (lib/auth-context.tsx)
        │     └── uses mock/data.ts for demo
        ├── ProtectedRoute
        │     └── redirects to /login if not auth
        ├── Public Routes
        │     ├── HomePage.tsx
        │     ├── LoginPage.tsx
        │     └── RegisterPage.tsx
        └── Protected Routes (with AppShell)
              ├── DashboardPage.tsx
              │     └── uses types/index.ts
              ├── UploadPage.tsx
              │     ├── react-dropzone
              │     ├── react-easy-crop
              │     └── stores to sessionStorage
              ├── AnalysisPage.tsx
              │     └── reads from sessionStorage
              ├── FlashcardsPage.tsx
              │     └── flip card animations
              ├── QuizPage.tsx
              │     └── answer tracking
              ├── LessonPage.tsx
              │     └── streaming messages
              ├── ResultsPage.tsx
              ├── HistoryPage.tsx
              ├── ProfilePage.tsx
              └── SettingsPage.tsx
```

---

## Adding New Features

### To add a new page:
1. Create `src/pages/app/NewPage.tsx`
2. Add route in `src/App.tsx`
3. Add nav link in `src/components/layout/app-shell.tsx`

### To add a new type:
1. Add to `src/types/index.ts`
2. Export from file
3. Import with `type` keyword

### To add a new API:
1. Create `src/api/newFeature.ts`
2. Use types from `src/types/index.ts`
3. Call from page component

---

## File Size Reference

```
src/
├── components/ui/     ~ 50 files, ~100KB
├── pages/             ~ 12 files, ~50KB
│   └── app/           ~ 10 files
├── lib/               ~ 2 files, ~5KB
├── types/             ~ 1 file, ~5KB
├── mock/              ~ 1 file, ~10KB
└── hooks/             ~ 0 files (add as needed)
```

---

## Important Notes

- **Never edit files in `src/components/ui/` directly** - these are auto-generated by shadcn/ui
- **Always use `type` keyword for type imports** - required by TypeScript strict mode
- **Keep pages focused** - business logic should be in hooks or API layer
- **Use sessionStorage for temp data** - cleared when tab closes
- **Use localStorage for persistence** - survives tab close
