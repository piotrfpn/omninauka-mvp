# OmniNauka - Known Issues

## Critical Issues (P0)

### 1. No Real Backend Integration [RESOLVED - SPRINT 2A/2B/2C]
**Fix:** Connected Supabase Auth, Storage, Edge Functions (OCR+AI) and fully migrated Dashboard and History views to pull real `study_sessions` instead of hardcoded mock data.
---

## High Priority Issues (P1)

### 2. Session Storage Limitations [RESOLVED - SPRINT 1]
**File:** `UploadPage.tsx`, `AnalysisPage.tsx`
**Impact:** Medium
**Description:** 
- sessionStorage has ~5MB limit
- Images stored as base64 can exceed limit quickly
- Data lost on tab close
**Fix:** Successfully deployed `browser-image-compression` after cropping to shrink the payload mathematically below the storage quota.

### 3. Mobile Upload UX Issues
**File:** `UploadPage.tsx`
**Impact:** Medium
**Description:**
- File picker may not work consistently on all mobile browsers
- Camera access not explicitly requested
- Cropping interface can be clunky on small screens
**Reproduction:** Test on iOS Safari, Android Chrome
**Fix:** Add camera capture attribute, improve touch targets

### 4. No Error Boundaries [RESOLVED - SPRINT 1]
**Impact:** Medium
**Description:** App can crash completely on errors
**Fix:** React Error Boundaries implemented globally.

---

## Medium Priority Issues (P2)

### 5. Flashcard State Not Persisted
**File:** `FlashcardsPage.tsx`
**Impact:** Low-Medium
**Description:** Flashcard progress lost on page refresh
**Reproduction:** Study flashcards, refresh page
**Fix:** Store progress in localStorage or database

### 6. Quiz Timer Not Implemented
**File:** `QuizPage.tsx`
**Impact:** Low
**Description:** No time tracking per question
**Fix:** Add timer state, track time per answer

### 7. AI Tutor Responses Are Random
**File:** `LessonPage.tsx`
**Impact:** Low
**Description:** Mock responses don't actually respond to user input
**Reproduction:** Ask specific question, get generic response
**Fix:** Integrate real AI service

### 8. No Loading States for Navigation
**Impact:** Low
**Description:** No visual feedback when navigating between pages
**Fix:** Add loading indicators or skeleton screens

### 9. Accessibility Issues
**Impact:** Medium
**Description:**
- Missing aria-labels on buttons
- No focus management
- Color contrast may not meet WCAG standards
**Fix:** Audit with axe, add ARIA attributes

---

## Low Priority Issues (P3)

### 10. No Image Compression [RESOLVED - SPRINT 1]
**File:** `UploadPage.tsx`
**Impact:** Low
**Description:** Large images uploaded as-is, slow performance
**Fix:** Added `browser-image-compression` usage before base64 stringification.

### 11. No Offline Support
**Impact:** Low
**Description:** App doesn't work offline
**Fix:** Add service worker, cache assets

### 12. No Analytics
**Impact:** Low
**Description:** No tracking of user behavior
**Fix:** Add Google Analytics, Mixpanel, or similar

### 13. Missing Form Validation Messages
**File:** `LoginPage.tsx`, `RegisterPage.tsx`
**Impact:** Low
**Description:** Validation errors not clearly displayed
**Fix:** Add error message components

### 14. No Password Visibility Toggle [RESOLVED - SPRINT PF-03.1]
**File:** `LoginPage.tsx`, `RegisterPage.tsx`
**Impact:** Low
**Description:** Can't show/hide password
**Fix:** Eye icon toggle implemented with minimum 44x44px touch target area in PF-03.1.

---

## Performance Concerns

### 15. Large Bundle Size
**Impact:** Medium
**Description:** All shadcn/ui components included
**Fix:** Tree-shake unused components, lazy load routes

### 16. No Image Optimization
**Impact:** Medium
**Description:** Images displayed at full resolution
**Fix:** Use responsive images, implement lazy loading

### 17. Re-render Issues
**Impact:** Low
**Description:** Some components may re-render unnecessarily
**Fix:** Profile with React DevTools, add memo where needed

---

## Mobile-Specific Issues

### 18. Sidebar Not Collapsible on Tablet
**File:** `app-shell.tsx`
**Impact:** Low
**Description:** Sidebar takes space on medium screens
**Fix:** Add collapsible sidebar for tablet

### 19. Touch Targets Too Small [POLISHED - SPRINT PF-03.1]
**Impact:** Medium
**Description:** Some buttons may be hard to tap
**Fix:** Enforced >= 40-44px touch targets across login password toggle (44x44px), upload thumbnail remove (42x42px), history folder action (40x40px), and history search/sort controls (44px height).

### 20. Zoom on Input Focus (iOS)
**Impact:** Low
**Description:** iOS zooms in on input focus
**Fix:** Set appropriate font-size (16px minimum)

---

## Security Issues

### 21. No CSRF Protection
**Impact:** High (when backend added)
**Description:** Forms vulnerable to CSRF
**Fix:** Add CSRF tokens when backend implemented

### 22. Client-Side Auth Only
**Impact:** High
**Description:** Auth can be bypassed by modifying localStorage
**Fix:** Implement server-side session validation

### 23. No Input Sanitization
**Impact:** Medium
**Description:** User inputs not sanitized
**Fix:** Sanitize all inputs, use DOMPurify for HTML

---

## Browser Compatibility

### 24. CSS Custom Properties
**Impact:** Low
**Description:** Older browsers may not support CSS variables
**Fix:** Add fallbacks or use PostCSS

### 25. ES6+ Features
**Impact:** Low
**Description:** May not work in older browsers
**Fix:** Configure Babel for broader support

---

## Documentation Issues

### 26. Missing JSDoc Comments
**Impact:** Low
**Description:** Functions lack documentation
**Fix:** Add JSDoc comments to complex functions

### 27. No API Documentation
**Impact:** Medium (when backend added)
**Description:** No API specs
**Fix:** Create OpenAPI/Swagger docs

---

## Temporary Shortcuts

These are intentional shortcuts for MVP that need fixing:

1. **Mock data instead of API calls** - All data is static
2. **Session storage for images** - Should use proper file storage
3. **Client-side auth validation** - Should use server-side validation
4. **Random AI responses** - Should use real AI service
5. **No rate limiting** - Should limit API calls

---

## Assumptions Made

1. Single user per browser session
2. Modern browser support (ES2020+)
3. Stable internet connection
4. Images are reasonable size (<10MB)
5. Users won't manipulate localStorage
6. Demo mode is sufficient for testing

---

## PF-03 / PF-03.1 Status & Deferred Issues

### 28. Login Background Transition
- **Status:** DEFERRED
- **Impact:** Low (Cosmetic UX)
- **Observed:** Nowe tło logowania (background image) może być widoczne przez krótką chwilę podczas ładowania strony `/login`, a następnie wizualnie znikać / ulegać zmianie po załadowaniu.
- **Diagnoza / Hipoteza:** Dokładna przyczyna nie została jeszcze potwierdzona. Możliwa interakcja pomiędzy przekierowaniem sesji, inicjalizacją motywu (theme) a cyklem renderowania formularza logowania pozostaje wyłącznie hipotezą roboczą. Nie wprowadzano zmian w kodzie w sprincie PF-03.1.

### 29. Demo Session State After Hard Refresh
- **Status:** DEFERRED
- **Impact:** Low-Medium
- **Observed:** W trybie demonstracyjnym (`isDemoMode`) sesja demo oraz stan ćwiczeń są tracone po twardym odświeżeniu strony (hard refresh), ponieważ stan demo jest przechowywany w pamięci kontekstu aplikacji (`auth-context`), a nie w trwałym magazynie.
- **Decyzja:** Zgodnie z założeniami PF-03.1, nie modyfikowano architektury `auth-context`. Utrwalanie sesji demo zostało odłożone na późniejszy etap.

### 30. Favicon SVG Declaration
- **Status:** REJECTED AS ISSUE
- **Impact:** N/A (Wymaganie odrzucone)
- **Kontekst:** W audycie PF-03 rozważano dodanie deklaracji favicon.svg.
- **Decyzja:** Odrzucono. Obecna konfiguracja favicon w formatach PNG/ICO (`apple-touch-icon.png`, `pwa-*.png`, favicony rastrowe) jest w pełni zamierzona i wynika z wcześniejszych prac nad assetami PWA. Wymóg SVG nie jest reintrodukowany.

### 31. Vercel Automated Deployment Workflow (INFRA-01B)
- **Status:** INFRA-01B = DEFERRED / MANUAL DEPLOY WORKFLOW ACCEPTED
- **Impact:** Low (Operational)
- **Kontekst:** Automatyczny deploy z webhooka GitHub na Vercel został odłożony w ramach INFRA-01B.
- **Zaakceptowany proces wdrożeniowy:**
  1. Commit zmian lokalnie
  2. Push do gałęzi `main` na GitHubie
  3. Weryfikacja czystego stanu drzewa roboczego (`git status` clean)
  4. Weryfikacja zgodności `HEAD == origin/main`
  5. Ręczne wywołanie produkcyjnego wdrożenia: `npx vercel --prod`
  6. Weryfikacja statusu wdrożenia Vercel: `READY` oraz przypisania aliasu produkcyjnego `omninauka-mvp.vercel.app`
- **Decyzja:** W sprincie dokumentacyjnym nie podejmowano prób rekonfiguracji połączenia GitHub/Vercel. Workflow manualny pozostaje oficjalnie zaakceptowany.
