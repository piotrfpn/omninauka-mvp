# OmniNauka - Test Scenarios

## Manual Test Cases

### 1. Login Flow

#### TC-001: Successful Login
**Steps:**
1. Navigate to `/login`
2. Enter email: `test@example.com`
3. Enter password: `password123`
4. Click "Zaloguj się"

**Expected:**
- User redirected to `/app/dashboard`
- Dashboard shows welcome message
- User name displayed in sidebar

#### TC-002: Demo Mode Entry
**Steps:**
1. Navigate to `/login`
2. Click "Tryb demo - wejdź bez logowania"

**Expected:**
- User redirected to `/app/dashboard`
- Demo user "Kacper" shown
- Full app access granted

#### TC-003: Invalid Login
**Steps:**
1. Navigate to `/login`
2. Enter email: `invalid`
3. Enter password: `123`
4. Click "Zaloguj się"

**Expected:**
- Error message displayed
- User stays on login page

#### TC-004: Logout
**Steps:**
1. Login as any user
2. Click logout button in sidebar

**Expected:**
- User redirected to homepage
- localStorage cleared
- Protected routes inaccessible

---

### 2. Upload Flow

#### TC-005: Drag and Drop Upload
**Steps:**
1. Navigate to `/app/upload`
2. Drag image file to upload area

**Expected:**
- File accepted
- Preview displayed
- Cropping interface shown

#### TC-006: Click to Upload
**Steps:**
1. Navigate to `/app/upload`
2. Click upload area
3. Select image from file picker

**Expected:**
- File accepted
- Preview displayed
- Cropping interface shown

#### TC-006A: Camera Explicit Upload (Sprint 1)
**Steps:**
1. Navigate to `/app/upload` on mobile or desktop with webcam
2. Click "Zrób zdjęcie teraz" button
3. Accept camera permissions if asked and take a picture

**Expected:**
- Photo is captured perfectly
- File accepted
- Cropping UI initialized automatically

#### TC-007: Invalid File Type
**Steps:**
1. Navigate to `/app/upload`
2. Try to upload PDF file

**Expected:**
- Error message: "Nieprawidłowy format pliku"
- File rejected

#### TC-008: File Too Large
**Steps:**
1. Navigate to `/app/upload`
2. Try to upload 15MB image

**Expected:**
- Error message: "Plik jest za duży"
- File rejected

#### TC-009: Image Cropping
**Steps:**
1. Upload image
2. Adjust crop area
3. Adjust zoom slider
4. Click "Potwierdź wycięcie"

**Expected:**
- Cropped image displayed
- Preview updated

#### TC-010: Skip Cropping
**Steps:**
1. Upload image
2. Click "Pomiń przycinanie"

**Expected:**
- Original image used
- Preview displayed

#### TC-011: Reset Upload
**Steps:**
1. Upload image
2. Click X button

**Expected:**
- Upload area reset
- File removed from state

---

### 3. Analysis Flow

#### TC-012: Start Analysis
**Steps:**
1. Upload and crop image
2. Click "Analizuj zdjęcie"

**Expected:**
- Loading spinner shown
- "Analizuję Twoje notatki..." message
- Redirect to analysis page after ~2 seconds

#### TC-013: Analysis Results Display
**Steps:**
1. Complete analysis

**Expected:**
- Subject displayed (e.g., "Biologia")
- Topic displayed (e.g., "Budowa komórki")
- Key concepts list shown
- Summary displayed
- Action cards visible

#### TC-014: Navigate to Flashcards
**Steps:**
1. View analysis results
2. Click "Ucz się fiszek"

**Expected:**
- Redirect to `/app/flashcards`
- Flashcards loaded

#### TC-015: Navigate to Quiz
**Steps:**
1. View analysis results
2. Click "Rozwiąż quiz"

**Expected:**
- Redirect to `/app/quiz`
- Quiz started

#### TC-016: Navigate to Lesson
**Steps:**
1. View analysis results
2. Click "Lekcja z AI"

**Expected:**
- Redirect to `/app/lesson`
- Chat interface loaded

---

### 4. Flashcards

#### TC-017: Flip Card
**Steps:**
1. Navigate to `/app/flashcards` (after analysis)
2. Click on flashcard

**Expected:**
- Card flips to show back
- Smooth animation

#### TC-018: Navigate Cards
**Steps:**
1. View flashcards
2. Click "Następna"
3. Click "Poprzednia"

**Expected:**
- Card changes
- Progress counter updates

#### TC-019: Mark Known/Unknown
**Steps:**
1. View flashcard
2. Click "Znam" or "Nie znam"

**Expected:**
- Progress updated
- Next card shown

#### TC-020: Empty State
**Steps:**
1. Navigate to `/app/flashcards` without analysis

**Expected:**
- "Brak fiszek" message
- "Prześlij notatki" button

---

### 5. Quiz

#### TC-021: Answer Question
**Steps:**
1. Navigate to `/app/quiz` (after analysis)
2. Click on answer option

**Expected:**
- Answer selected
- Feedback shown
- Explanation displayed

#### TC-022: Correct Answer
**Steps:**
1. Answer question correctly

**Expected:**
- Green checkmark
- "Poprawna odpowiedź!" message
- Explanation shown

#### TC-023: Wrong Answer
**Steps:**
1. Answer question incorrectly

**Expected:**
- Red X
- "Niepoprawna odpowiedź" message
- Correct answer shown
- Explanation shown

#### TC-024: Complete Quiz
**Steps:**
1. Answer all questions

**Expected:**
- Results page shown
- Score displayed
- Correct/incorrect count
- Recommendations shown

#### TC-025: Quiz Progress Bar
**Steps:**
1. Answer questions

**Expected:**
- Progress bar updates
- Question counter updates

---

### 6. AI Lesson/Tutor

#### TC-026: Send Message
**Steps:**
1. Navigate to `/app/lesson` (after analysis)
2. Type message in input
3. Press Enter or click send

**Expected:**
- Message appears in chat
- AI response streams in
- Typing indicator shown

#### TC-027: Streaming Response
**Steps:**
1. Send message

**Expected:**
- Response appears character by character
- Cursor blinks during streaming
- Smooth animation

#### TC-028: Voice Mode Toggle
**Steps:**
1. Navigate to lesson
2. Click microphone button

**Expected:**
- Voice mode activated
- UI indicates active state

#### TC-029: Empty State
**Steps:**
1. Navigate to `/app/lesson` without analysis

**Expected:**
- "Brak materiału" message
- "Prześlij notatki" button

---

### 7. Dashboard

#### TC-030: Stats Display
**Steps:**
1. Login and view dashboard

**Expected:**
- Study sessions count shown
- Hours studied shown
- Average score shown
- Streak shown

#### TC-031: Quick Actions
**Steps:**
1. View dashboard
2. Click "Nowy upload"

**Expected:**
- Redirect to upload page

#### TC-032: Recent Sessions
**Steps:**
1. View dashboard

**Expected:**
- Recent study sessions listed
- Subject, topic, time shown
- Status shown

#### TC-033: Subject Progress
**Steps:**
1. View dashboard

**Expected:**
- Progress bars for each subject
- Percentage shown
- Session count shown

---

### 8. History

#### TC-034: View History
**Steps:**
1. Navigate to `/app/history`

**Expected:**
- List of study sessions
- Details for each session

#### TC-035: Filter by Subject
**Steps:**
1. View history
2. Click subject filter

**Expected:**
- Only sessions for selected subject shown

---

### 9. Mobile Responsiveness

#### TC-036: Mobile Navigation
**Steps:**
1. Open app on mobile device
2. Click hamburger menu

**Expected:**
- Mobile menu opens
- Navigation links visible
- Can navigate to all pages

#### TC-037: Mobile Upload
**Steps:**
1. Open upload page on mobile
2. Click upload area

**Expected:**
- File picker opens
- Can select from gallery or camera

#### TC-038: Mobile Flashcards
**Steps:**
1. View flashcards on mobile
2. Swipe between cards

**Expected:**
- Swipe gesture works
- Cards fit screen

#### TC-039: Mobile Quiz
**Steps:**
1. Take quiz on mobile

**Expected:**
- Questions readable
- Answer buttons tappable
- No horizontal scroll

---

### 10. Edge Cases

#### TC-040: Refresh During Analysis
**Steps:**
1. Start analysis
2. Refresh page

**Expected:**
- Analysis may be lost (known limitation)
- Or redirected to upload

#### TC-041: Back Button Navigation
**Steps:**
1. Navigate through multiple pages
2. Click browser back

**Expected:**
- Previous page shown
- State preserved where possible

#### TC-042: Multiple Tabs
**Steps:**
1. Open app in multiple tabs
2. Login in one tab

**Expected:**
- Each tab has independent session
- localStorage shared (may cause sync issues)

#### TC-043: Network Disconnect
**Steps:**
1. Start using app
2. Disconnect internet

**Expected:**
- App continues working (demo mode)
- No error messages

---

## Automated Test Recommendations

### Unit Tests (Jest/Vitest)
- Auth context functions
- Utility functions
- Type guards

### Integration Tests (React Testing Library)
- Login flow
- Upload flow
- Quiz flow

### E2E Tests (Playwright/Cypress)
- Full user journey
- Critical paths
- Mobile responsiveness

### Performance Tests (Lighthouse)
- Page load times
- Bundle size
- Accessibility score
