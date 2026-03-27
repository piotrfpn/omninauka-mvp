# OmniNauka - Known Issues

## Critical Issues (P0)

### 1. No Real Backend Integration for History/Profile [PARTIALLY RESOLVED]
**Status:** App is mapped to Supabase for Core Analysis. History Arrays still mocked.
**Impact:** High
**Description:** All data is mocked. No real OCR, AI, or persistence.
**Workaround:** Demo mode works for testing UI/UX
**Fix:** Removed OCR/AI mocks in Sprint 2B. Awaiting Dashboard replacement in 2C.

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

### 14. No Password Visibility Toggle
**File:** `LoginPage.tsx`, `RegisterPage.tsx`
**Impact:** Low
**Description:** Can't show/hide password
**Fix:** Add eye icon toggle

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

### 19. Touch Targets Too Small
**Impact:** Medium
**Description:** Some buttons may be hard to tap
**Fix:** Ensure minimum 44x44px touch targets

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
