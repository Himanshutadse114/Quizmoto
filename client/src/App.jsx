import React, { Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useParams, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { SocketProvider } from './context/SocketContext';
import LiveQuizAudioDirector from './components/LiveQuizAudioDirector';
import './pages/Host/liveQuizTheme.css';
import './pages/Host/classicQuizmoto.css';
import './pages/Host/quizmotoHostWorkbench.css';
import './pages/Host/quizmotoEditWorkbench.css';
import './pages/Host/quizmotoCreateWorkbench.css';
import './pages/Host/quizmotoElectricArena.css';
import './pages/Host/quizmotoArenaPolish.css';
import './pages/Host/quizmotoClassicBoundary.css';
import './pages/Scorm/scormVisualStudioFixes.css';

const CreateQuiz = lazy(() => import('./pages/Host/CreateQuiz'));
const EditQuiz = lazy(() => import('./pages/Host/EditQuiz'));
const Reports = lazy(() => import('./pages/Host/Reports'));
const Lobby = lazy(() => import('./pages/Host/Lobby'));
const GameView = lazy(() => import('./pages/Host/GameView'));
const Join = lazy(() => import('./pages/Player/Join'));
const PlayerLobby = lazy(() => import('./pages/Player/PlayerLobby'));
const PlayerGame = lazy(() => import('./pages/Player/PlayerGame'));
const PlayerLogin = lazy(() => import('./pages/Player/PlayerLogin'));
const PlayerDashboard = lazy(() => import('./pages/Player/PlayerDashboard'));

const ScormAuth = lazy(() => import('./pages/Scorm/ScormAuth'));
const ScormPlatformShell = lazy(() => import('./pages/Scorm/ScormPlatformShell'));
const ScormHome = lazy(() => import('./pages/Scorm/Home'));
const PendingScormHome = lazy(() => import('./pages/Scorm/PendingHome'));
const ScormFeatureLocked = lazy(() => import('./pages/Scorm/FeatureLocked'));
const QuizmotoModule = lazy(() => import('./pages/Scorm/QuizmotoModule'));
const ScormCourses = lazy(() => import('./pages/Scorm/Courses'));
const ScormTracking = lazy(() => import('./pages/Scorm/Tracking'));
const ScormLibrary = lazy(() => import('./pages/Scorm/Library'));
const ScormCourseDetail = lazy(() => import('./pages/Scorm/CourseDetail'));
const ScormLearnLanding = lazy(() => import('./pages/Scorm/LearnLanding'));
const ScormPlayerShell = lazy(() => import('./pages/Scorm/PlayerShell'));
const ScormAuthor = lazy(() => import('./pages/Scorm/AuthorVisual'));
const ScormReports = lazy(() => import('./pages/Scorm/Reports'));
const ScormVisualStudio = lazy(() => import('./pages/Scorm/VisualStudio'));
const ScormAccessAdmin = lazy(() => import('./pages/Scorm/AccessAdmin'));

function RouteFallback() {
  return (
    <div className="min-h-[55vh] grid place-items-center relative z-20">
      <div className="text-center">
        <div className="w-9 h-9 rounded-full border-2 border-white/20 border-t-white animate-spin mx-auto" />
        <div className="mt-3 text-xs font-semibold text-white/60">Loading…</div>
      </div>
    </div>
  );
}

function PlatformEntry() {
  const { token, platformAccess, loading } = useAuth();
  if (loading) return <RouteFallback />;
  if (token && platformAccess) return <Navigate to="/scorm" replace />;
  return <ScormAuth />;
}

function PlatformProtected({ children }) {
  const { token, platformAccess, loading } = useAuth();
  if (loading) return <RouteFallback />;
  if (!token || !platformAccess) return <Navigate to="/" replace />;
  return children;
}

function ScormFeatureGate({ featureId, children }) {
  const { scormAccess } = useAuth();
  return scormAccess ? children : <ScormFeatureLocked featureId={featureId} />;
}

function ScormHomeGate() {
  const { scormAccess } = useAuth();
  return scormAccess ? <ScormHome /> : <PendingScormHome />;
}

function AccessAdminGate() {
  const { scormAccess, user } = useAuth();
  const isSuperAdmin = Boolean(scormAccess && (user?.isSuperAdmin || user?.role === 'super_admin'));
  return isSuperAdmin ? <ScormAccessAdmin /> : <Navigate to="/scorm" replace />;
}

function LegacyQuizRedirect({ kind }) {
  const { id, pin } = useParams();
  const targets = {
    dashboard: '/scorm/quizmoto',
    create: '/scorm/quizmoto/create',
    reports: '/scorm/quizmoto/reports',
    edit: `/scorm/quizmoto/edit/${id || ''}`,
    lobby: `/host/lobby/${pin || ''}`,
    game: `/host/game/${pin || ''}`
  };
  return <Navigate to={targets[kind] || '/scorm/quizmoto'} replace />;
}

function AppRoutes() {
  return (
    <Suspense fallback={<RouteFallback />}>
      <Routes>
        <Route path="/" element={<PlatformEntry />} />
        <Route path="/login" element={<Navigate to="/" replace />} />
        <Route path="/scorm/login" element={<Navigate to="/" replace />} />

        <Route path="/player/login" element={<PlayerLogin />} />
        <Route path="/player/dashboard" element={<PlayerDashboard />} />
        <Route path="/join" element={<Join />} />
        <Route path="/player/lobby" element={<PlayerLobby />} />
        <Route path="/player/game" element={<PlayerGame />} />

        <Route path="/host" element={<LegacyQuizRedirect kind="dashboard" />} />
        <Route path="/host/create" element={<LegacyQuizRedirect kind="create" />} />
        <Route path="/host/edit/:id" element={<LegacyQuizRedirect kind="edit" />} />
        <Route path="/host/reports" element={<LegacyQuizRedirect kind="reports" />} />
        <Route path="/host/lobby/:pin" element={<Lobby />} />
        <Route path="/host/game/:pin" element={<GameView />} />

        <Route path="/scorm" element={<PlatformProtected><ScormPlatformShell /></PlatformProtected>}>
          <Route index element={<ScormHomeGate />} />

          <Route path="quizmoto" element={<QuizmotoModule />} />
          <Route path="quizmoto/create" element={<CreateQuiz embedded />} />
          <Route path="quizmoto/edit/:id" element={<EditQuiz embedded />} />
          <Route path="quizmoto/reports" element={<Reports embedded />} />

          <Route path="courses" element={<ScormFeatureGate featureId="courses"><ScormCourses /></ScormFeatureGate>} />
          <Route path="courses/:id" element={<ScormFeatureGate featureId="courses"><ScormCourseDetail /></ScormFeatureGate>} />
          <Route path="tracking" element={<ScormFeatureGate featureId="tracking"><ScormTracking /></ScormFeatureGate>} />
          <Route path="library" element={<ScormFeatureGate featureId="library"><ScormLibrary /></ScormFeatureGate>} />
          <Route path="author" element={<ScormFeatureGate featureId="author"><ScormAuthor /></ScormFeatureGate>} />
          <Route path="visual-studio" element={<ScormFeatureGate featureId="visualStudio"><ScormVisualStudio /></ScormFeatureGate>} />
          <Route path="reports" element={<ScormFeatureGate featureId="reports"><ScormReports /></ScormFeatureGate>} />
          <Route path="access" element={<AccessAdminGate />} />
        </Route>

        <Route path="/scorm/live-quiz" element={<LegacyQuizRedirect kind="dashboard" />} />
        <Route path="/scorm/live-quiz/create" element={<LegacyQuizRedirect kind="create" />} />
        <Route path="/scorm/live-quiz/edit/:id" element={<LegacyQuizRedirect kind="edit" />} />
        <Route path="/scorm/live-quiz/reports" element={<LegacyQuizRedirect kind="reports" />} />
        <Route path="/scorm/live-quiz/lobby/:pin" element={<LegacyQuizRedirect kind="lobby" />} />
        <Route path="/scorm/live-quiz/game/:pin" element={<LegacyQuizRedirect kind="game" />} />

        <Route path="/dashboard" element={<LegacyQuizRedirect kind="dashboard" />} />
        <Route path="/create-quiz" element={<LegacyQuizRedirect kind="create" />} />
        <Route path="/edit-quiz/:id" element={<LegacyQuizRedirect kind="edit" />} />
        <Route path="/reports" element={<LegacyQuizRedirect kind="reports" />} />
        <Route path="/host/lobby-old/:pin" element={<LegacyQuizRedirect kind="lobby" />} />
        <Route path="/host/game-old/:pin" element={<LegacyQuizRedirect kind="game" />} />

        <Route path="/scorm/learn/:inviteCode" element={<ScormLearnLanding />} />
        <Route path="/scorm/player/:registrationId" element={<ScormPlayerShell />} />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}

function AppSurface() {
  const { pathname } = useLocation();
  const isQuizGameStage = pathname.startsWith('/host/lobby') || pathname.startsWith('/host/game') || pathname === '/join' || pathname.startsWith('/player/');
  const surfaceClass = isQuizGameStage
    ? 'bg-quizmoto-darkPurple live-quiz-stage quizmoto-classic-live-stage'
    : 'bg-[#11100e]';

  return (
    <div className={`min-h-screen text-white relative ${surfaceClass}`}>
      {isQuizGameStage && (
        <>
          <div className="bg-shape shape-1 w-64 h-64 border-[32px] border-white rounded-full" />
          <div className="bg-shape shape-2 w-48 h-48 border-[24px] border-quizmoto-yellow rotate-45" />
          <div className="bg-shape shape-3 w-32 h-32 bg-quizmoto-blue rounded-xl" />
          <div className="bg-shape shape-4 w-56 h-56 border-[28px] border-quizmoto-red rounded-lg -rotate-12" />
        </>
      )}
      <AppRoutes />
    </div>
  );
}

function App() {
  return (
    <AuthProvider>
      <Router basename={import.meta.env.VITE_APP_BASENAME || '/'}>
        <SocketProvider>
          <LiveQuizAudioDirector />
          <AppSurface />
        </SocketProvider>
      </Router>
    </AuthProvider>
  );
}

export default App;