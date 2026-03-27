# OmniNauka - Improvement Backlog

## P0 - Critical (Blockers)

| # | Item | Description | Effort | Dependencies |
|---|------|-------------|--------|--------------|
| 1 | Backend API | Create Supabase Edge Functions for OCR | [DONE] | Database, Auth service |
| 2 | Real Authentication | Implement JWT-based auth with refresh tokens | [DONE] | Backend API |
| 3 | OCR Integration | Connect to Google Vision or AWS Textract | [DONE] | Backend API |
| 4 | AI Service Integration | Connect to OpenAI/Claude for content generation | [DONE] | Backend API |
| 5 | Database Setup | PostgreSQL or MongoDB for data persistence | [DONE] | Backend API |
| 6 | File Storage | Supabase Storage for images | [DONE] | Backend API |

---

## P1 - Important (UX/Performance)

| # | Item | Description | Effort | Dependencies |
|---|------|-------------|--------|--------------|
| 7 | Image Compression | Compress images client-side before upload | [DONE] | None |
| 8 | Error Boundaries | Add React Error Boundaries | [DONE] | None |
| 9 | Loading States | Add skeleton screens and loading indicators | 2 days | None |
| 10 | Form Validation | Improve validation with clear error messages | 1-2 days | None |
| 11 | Mobile Camera | Add camera capture for mobile uploads | [DONE] | None |
| 12 | Persistent Images | Use Supabase Storage instead of sessionStorage | [DONE] | None |
| 13 | Bundle Optimization | Tree-shake and lazy load routes | [DONE] | None |
| 14 | Accessibility Audit | Fix WCAG issues, add ARIA labels | 2-3 days | None |
| 15 | Quiz Timer | Add per-question timer | 1 day | None |
| 16 | Progress Persistence | Save flashcard/quiz progress | 1-2 days | Database |

---

## P2 - Product Improvements

| # | Item | Description | Effort | Dependencies |
|---|------|-------------|--------|--------------|
| 17 | Study Plans | Create structured study plans | 1 week | Backend API |
| 18 | Spaced Repetition | Implement SM-2 algorithm for flashcards | 3-5 days | Database |
| 19 | Gamification | Add badges, achievements, leaderboards | 1 week | Database |
| 20 | Sharing | Allow sharing flashcards/quizzes | 3-5 days | Backend API |
| 21 | Export | Export flashcards to Anki, PDF | 2-3 days | None |
| 22 | Import | Import notes from other apps | 3-5 days | None |
| 23 | Dark Mode | Add dark theme | 2-3 days | None |
| 24 | Notifications | Push notifications for study reminders | 2-3 days | Backend API |
| 25 | Offline Mode | Basic offline functionality | 1 week | Service Worker |
| 26 | Voice Input | Speech-to-text for tutor | 2-3 days | AI Service |
| 27 | Math Support | LaTeX rendering for math formulas | 1-2 days | None |
| 28 | Multiple Images | Upload multiple pages at once | 2-3 days | OCR Integration |

---

## P3 - Future Nice-to-Have

| # | Item | Description | Effort | Dependencies |
|---|------|-------------|--------|--------------|
| 29 | Mobile App | React Native or Capacitor app | 2-4 weeks | Stable web app |
| 30 | Browser Extension | Quick capture extension | 1 week | Backend API |
| 31 | Collaborative Study | Group study sessions | 2 weeks | Backend API |
| 32 | Teacher Dashboard | For educators to track students | 2 weeks | Backend API |
| 33 | AI Study Coach | Personalized study recommendations | 1 week | AI Service |
| 34 | CKE Integration | Official CKE (Polish exam) materials | 1-2 weeks | Partnership |
| 35 | Video Lessons | AI-generated video explanations | 2-3 weeks | AI Service |
| 36 | Community | Forum for students | 1-2 weeks | Backend API |
| 37 | Analytics Dashboard | Detailed learning analytics | 1 week | Database |
| 38 | API for Developers | Public API for integrations | 1 week | Backend API |
| 39 | White-label | Custom branding for schools | 1-2 weeks | Backend API |
| 40 | Multi-language | Support for other languages | 1 week | None |

---

## Technical Debt

| # | Item | Description | Effort |
|---|------|-------------|--------|
| 41 | TypeScript Strict Mode | Enable strict mode, fix all errors | 2-3 days |
| 42 | Unit Tests | Add Jest/Vitest tests | 1-2 weeks |
| 43 | E2E Tests | Add Playwright/Cypress tests | 1 week |
| 44 | CI/CD Pipeline | GitHub Actions for deploy | 2-3 days |
| 45 | Code Splitting | Implement route-based splitting | 1 day |
| 46 | State Management | Evaluate Redux/Zustand vs Context | 2-3 days |
| 47 | API Client | Create typed API client | 2-3 days |
| 48 | Logging | Add structured logging | 1 day |
| 49 | Monitoring | Add Sentry for error tracking | 1 day |
| 50 | Performance Monitoring | Add Web Vitals tracking | 1 day |

---

## Quick Wins (1-2 days each)

These can be done quickly for immediate improvement:

1. ✅ Add password visibility toggle
2. ✅ Improve form validation messages
3. ✅ Add loading spinners to buttons
4. ✅ Add hover states to interactive elements
5. ✅ Add empty states to all lists
6. ✅ Add confirmation dialogs for destructive actions
7. ✅ Add keyboard shortcuts (Space to flip flashcard)
8. ✅ Add page titles
9. ✅ Add favicon
10. ✅ Add meta tags for SEO

---

## Suggested Sprint Planning

### Sprint 1 (Week 1-2): Foundation
- P0 items 1-2 (Backend API, Auth)
- P1 items 7-9 (Image compression, Error boundaries, Loading states)

### Sprint 2 (Week 3-4): Core Features
- P0 items 3-4 (OCR, AI integration)
- P1 items 10-12 (Form validation, Mobile camera, IndexedDB)

### Sprint 3 (Week 5-6): Polish
- P0 items 5-6 (Database, File storage)
- P1 items 13-16 (Bundle optimization, Accessibility, Timer, Progress)
- P2 items 17-20 (Study plans, Spaced repetition, Gamification, Sharing)

### Sprint 4+ (Ongoing): Enhancements
- P2 items 21-28
- P3 items as prioritized
- Technical debt items

---

## Priority Matrix

```
High Impact + Low Effort = Do First (Quick Wins)
High Impact + High Effort = Plan Carefully (P0, P1)
Low Impact + Low Effort = Do When Free (P3)
Low Impact + High Effort = Avoid (Deprioritize)
```

---

## Success Metrics

Track these metrics to measure improvement:

1. **User Engagement**
   - Daily active users
   - Session duration
   - Features used per session

2. **Learning Effectiveness**
   - Quiz scores improvement
   - Flashcards mastered
   - Study streaks

3. **Performance**
   - Page load time
   - Time to interactive
   - API response time

4. **User Satisfaction**
   - NPS score
   - App store rating
   - Support tickets
