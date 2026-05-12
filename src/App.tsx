import { lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './lib/auth-context';
import { ErrorBoundary } from './components/error-boundary';

import HomePage from './pages/HomePage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import ContactPage from './pages/ContactPage';
import TermsPage from './pages/legal/TermsPage';
import PrivacyPage from './pages/legal/PrivacyPage';
import CookiesPage from './pages/legal/CookiesPage';
import AIDisclaimerPage from './pages/legal/AIDisclaimerPage';
import ContentPolicyPage from './pages/legal/ContentPolicyPage';
import ParentConsentPage from './pages/legal/ParentConsentPage';
import PendingConsentPage from './pages/app/PendingConsentPage';
import ForgotPasswordPage from './pages/ForgotPasswordPage';
import ResetPasswordPage from './pages/ResetPasswordPage';
import { ConsentGuard } from './components/auth/ConsentGuard';
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
const CompleteProfilePage = lazy(() => import('./pages/app/CompleteProfilePage'));
const ParentDashboardPage = lazy(() => import('./pages/app/ParentDashboardPage'));
const PaymentSuccessPage = lazy(() => import('./pages/app/PaymentSuccessPage'));
const PaymentsPage = lazy(() => import('./pages/app/PaymentsPage'));
const AdminPage = lazy(() => import('./pages/app/AdminPage'));

// A fallback component for Suspense
const SuspenseFallback = () => (
  <div className="min-h-screen flex items-center justify-center bg-[var(--omni-bg)]">
    <div className="w-12 h-12 border-4 border-[var(--omni-accent)]/30 border-t-[var(--omni-accent)] rounded-full animate-spin" />
  </div>
);

// Protected route wrapper
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading, isProfileLoading } = useAuth();

  if (isLoading || isProfileLoading) {
    return <SuspenseFallback />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}

// App routes with shell
function AppRoutes() {
  const { user, isProfileLoading } = useAuth();
  
  const needsConsent = 
    !isProfileLoading && 
    user?.ageBand === '13_15' && 
    user?.accountStatus === 'pending_parent_consent';

  console.log('[app-debug] rendering AppRoutes', {
    pathname: window.location.pathname,
    isAuthenticated: !!user,
    isProfileLoading
  });

  return (
    <Routes>
      {/* Public routes */}
      <Route path="/" element={<HomePage />} />
      <Route path="/kontakt" element={<ContactPage />} />
      <Route path="/regulamin" element={<TermsPage />} />
      <Route path="/polityka-prywatnosci" element={<PrivacyPage />} />
      <Route path="/polityka-cookies" element={<CookiesPage />} />
      <Route path="/ai-disclaimer" element={<AIDisclaimerPage />} />
      <Route path="/polityka-zglaszania-naruszen" element={<ContentPolicyPage />} />
      <Route path="/consent/:token" element={<ParentConsentPage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />

      {/* Consent state route */}
      <Route 
        path="/pending-consent" 
        element={
          <ProtectedRoute>
            {needsConsent ? <PendingConsentPage /> : <Navigate to="/app/dashboard" replace />}
          </ProtectedRoute>
        } 
      />

      {/* Protected app routes */}
      <Route
        path="/app/*"
        element={
          <ProtectedRoute>
            <ConsentGuard>
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
                    <Route path="complete-profile" element={<CompleteProfilePage />} />
                    <Route path="parent" element={<ParentDashboardPage />} />
                    <Route path="payment-success" element={<PaymentSuccessPage />} />
                    <Route path="payments" element={<PaymentsPage />} />
                    <Route path="admin" element={<AdminPage />} />
                    <Route path="*" element={<Navigate to={user?.userRole === 'parent' || user?.userRole === 'guardian' ? "parent" : "dashboard"} replace />} />
                   </Routes>
                </Suspense>
              </AppShell>
            </ConsentGuard>
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
