import { lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './lib/auth-context';
import { ErrorBoundary } from './components/error-boundary';

import HomePage from './pages/HomePage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import { AppShell } from './components/layout/app-shell';
import './App.css';

// Lazy load protected app pages
const DashboardPage = lazy(() => import('./pages/app/DashboardPage'));
const UploadPage = lazy(() => import('./pages/app/UploadPage'));
const AnalysisPage = lazy(() => import('./pages/app/AnalysisPage'));
const FlashcardsPage = lazy(() => import('./pages/app/FlashcardsPage'));
const QuizPage = lazy(() => import('./pages/app/QuizPage'));
const LessonPage = lazy(() => import('./pages/app/LessonPage'));
const ResultsPage = lazy(() => import('./pages/app/ResultsPage'));
const HistoryPage = lazy(() => import('./pages/app/HistoryPage'));
const ProfilePage = lazy(() => import('./pages/app/ProfilePage'));
const SettingsPage = lazy(() => import('./pages/app/SettingsPage'));

// A fallback component for Suspense
const SuspenseFallback = () => (
  <div className="min-h-screen flex items-center justify-center bg-[var(--omni-bg)]">
    <div className="w-12 h-12 border-4 border-[var(--omni-accent)]/30 border-t-[var(--omni-accent)] rounded-full animate-spin" />
  </div>
);

// Protected route wrapper
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return <SuspenseFallback />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}

// App routes with shell
function AppRoutes() {
  return (
    <Routes>
      {/* Public routes */}
      <Route path="/" element={<HomePage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />

      {/* Protected app routes */}
      <Route
        path="/app/*"
        element={
          <ProtectedRoute>
            <AppShell>
              <Suspense fallback={<SuspenseFallback />}>
                <Routes>
                  <Route path="dashboard" element={<DashboardPage />} />
                  <Route path="upload" element={<UploadPage />} />
                  <Route path="analysis" element={<AnalysisPage />} />
                  <Route path="analysis/:id" element={<AnalysisPage />} />
                  <Route path="flashcards" element={<FlashcardsPage />} />
                  <Route path="flashcards/:id" element={<FlashcardsPage />} />
                  <Route path="quiz" element={<QuizPage />} />
                  <Route path="quiz/:id" element={<QuizPage />} />
                  <Route path="lesson" element={<LessonPage />} />
                  <Route path="lesson/:id" element={<LessonPage />} />
                  <Route path="results" element={<ResultsPage />} />
                  <Route path="history" element={<HistoryPage />} />
                  <Route path="profile" element={<ProfilePage />} />
                  <Route path="settings" element={<SettingsPage />} />
                  <Route path="*" element={<Navigate to="dashboard" replace />} />
                 </Routes>
              </Suspense>
            </AppShell>
          </ProtectedRoute>
        }
      />

      {/* Catch all */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </ErrorBoundary>
  );
}

export default App;
