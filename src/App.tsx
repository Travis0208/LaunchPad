import { lazy, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './hooks/useAuth';
import { NotificationProvider } from './hooks/useNotifications';
import { Layout } from './components/Layout';
import { ErrorBoundary } from './components/ErrorBoundary';
import { Spinner } from './components/ui';
import { useAuth } from './hooks/useAuth';

// ─── Lazy-loaded page components ──────────────────────────────────────────────
// Each chunk is loaded on first navigation — keeps the initial bundle lean.

const AuthPage              = lazy(() => import('./components/Auth').then(m => ({ default: m.AuthPage })));
const Dashboard             = lazy(() => import('./components/Dashboard').then(m => ({ default: m.Dashboard })));
const VacanciesPage         = lazy(() => import('./components/Vacancies').then(m => ({ default: m.VacanciesPage })));
const VacancyForm           = lazy(() => import('./components/VacancyForm').then(m => ({ default: m.VacancyForm })));
const CandidatesPage        = lazy(() => import('./components/Candidates').then(m => ({ default: m.CandidatesPage })));
const AIReviewPage          = lazy(() => import('./components/AIReview').then(m => ({ default: m.AIReviewPage })));
const PipelinePage          = lazy(() => import('./components/Pipeline').then(m => ({ default: m.PipelinePage })));
const VideoAssessmentConfig = lazy(() => import('./components/VideoAssessmentConfig').then(m => ({ default: m.VideoAssessmentConfig })));
const VideoAssessmentPage   = lazy(() => import('./components/VideoAssessmentPage').then(m => ({ default: m.VideoAssessmentPage })));
const VideoReviewPage       = lazy(() => import('./components/VideoReviewPage').then(m => ({ default: m.VideoReviewPage })));
const InterviewRsvpPage     = lazy(() => import('./components/InterviewRsvpPage').then(m => ({ default: m.InterviewRsvpPage })));
const InterviewsPage        = lazy(() => import('./components/Interviews').then(m => ({ default: m.InterviewsPage })));
const OffersPage            = lazy(() => import('./components/Offers').then(m => ({ default: m.OffersPage })));
const RegretPage            = lazy(() => import('./components/Regret').then(m => ({ default: m.RegretPage })));
const ReportsPage           = lazy(() => import('./components/Reports').then(m => ({ default: m.ReportsPage })));
const SettingsPage          = lazy(() => import('./components/Settings').then(m => ({ default: m.SettingsPage })));
const ApplyPage             = lazy(() => import('./components/ApplyPage').then(m => ({ default: m.ApplyPage })));

// ─── Route fallback ────────────────────────────────────────────────────────────

function PageLoader() {
  return (
    <div className="flex items-center justify-center h-64">
      <Spinner size="lg" />
    </div>
  );
}

// ─── App routes ────────────────────────────────────────────────────────────────

function AppRoutes() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <Suspense fallback={<PageLoader />}>
      <Routes>
        {/* Public routes */}
        <Route path="/login"                                   element={user ? <Navigate to="/dashboard" replace /> : <AuthPage />} />
        <Route path="/apply/:vacancyId"                        element={<ApplyPage />} />
        <Route path="/video/:vacancyId/:candidateId/:token"    element={<VideoAssessmentPage />} />
        <Route path="/interview-rsvp/:token"                   element={<InterviewRsvpPage />} />

        {/* Authenticated app shell */}
        <Route path="/" element={<Layout />}>
          <Route index                                         element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard"                              element={<Dashboard />} />

          {/* Vacancies */}
          <Route path="vacancies"                              element={<VacanciesPage />} />
          <Route path="vacancies/new"                          element={<VacancyForm />} />
          <Route path="vacancies/:id"                          element={<VacancyForm />} />
          <Route path="vacancies/:id/edit"                     element={<VacancyForm />} />
          <Route path="vacancies/:id/video-assessment"         element={<VideoAssessmentConfig />} />

          {/* Candidates & pipeline */}
          <Route path="candidates"                             element={<CandidatesPage />} />
          <Route path="pipeline"                               element={<PipelinePage />} />
          <Route path="ai-review"                              element={<AIReviewPage />} />
          <Route path="video-review/:sessionId"                element={<VideoReviewPage />} />

          {/* Interviews */}
          <Route path="interviews"                             element={<InterviewsPage />} />

          {/* Offers & regret */}
          <Route path="offers"                                 element={<OffersPage />} />
          <Route path="regret"                                 element={<RegretPage />} />

          {/* Analytics & admin */}
          <Route path="reports"                                element={<ReportsPage />} />
          <Route path="settings"                               element={<SettingsPage />} />
        </Route>

        <Route path="*"                                        element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </Suspense>
  );
}

// ─── Root ──────────────────────────────────────────────────────────────────────

export default function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <NotificationProvider>
          <Router>
            <AppRoutes />
          </Router>
        </NotificationProvider>
      </AuthProvider>
    </ErrorBoundary>
  );
}
