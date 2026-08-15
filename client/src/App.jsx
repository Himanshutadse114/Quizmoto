import React, { Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useParams, useLocation } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { SocketProvider } from './context/SocketContext';
import LiveQuizAudioDirector from './components/LiveQuizAudioDirector';
import './pages/Host/liveQuizTheme.css';
import './pages/Host/classicQuizmoto.css';
import './pages/Host/quizmotoHostWorkbench.css';
import './pages/Host/quizmotoEditWorkbench.css';
import './pages/Host/quizmotoCreateWorkbench.css';
import './pages/Host/quizmotoElectricArena.css';
import './pages/Host/quizmotoArenaPolish.css';
import './pages/Scorm/scormVisualStudioFixes.css';

const Login = lazy(() => import('./pages/Host/Login'));
const Dashboard = lazy(() => import('./pages/Host/Dashboard'));
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

function LegacyQuizRedirect({ kind }) {
  const { id, pin } = useParams();
  const targets = {
    dashboard: '/host',
    create: '/host/create',
    reports: '/host/reports',
    edit: `/host/edit/${id || ''}`,
    lobby: `/host/lobby/${pin || ''}`,
    game: `/host/game/${pin || ''}`
  };
  return <Navigate to={targets[kind] || '/host'} replace />;
}

function AppRoutes() {
  return (
    <Suspense fallback={<RouteFallback />}>
      <Routes>
        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="/login" element={<Login />} />

        <Route path="/player/login" element={<PlayerLogin />} />
        <Route path="/player/dashboard" element={<PlayerDashboard />} />
        <Route path="/join" element={<Join />} />
        <Route path="/player/lobby" element={<PlayerLobby />} />
        <Route path="/player/game" element={<PlayerGame />} />

        <Route path="/host" element={<Dashboard />} />
        <Route path="/host/create" element={<CreateQuiz />} />
        <Route path="/host/edit/:id" element={<EditQuiz />} />
        <Route path="/host/reports" element={<Reports />} />
        <Route path="/host/lobby/:pin" element={<Lobby />} />
        <Route path="/host/game/:pin" element={<GameView />} />

        <Route path="/scorm/login" element={<ScormAuth />} />
        <Route path="/scorm" element={<ScormPlatformShell />}>
          <Route index element={<ScormHome />} />
          <Route path="courses" element={<ScormCourses />} />
          <Route path="courses/:id" element={<ScormCourseDetail />} />
          <Route path="tracking" element={<ScormTracking />} />
          <Route path="library" element={<ScormLibrary />} />
          <Route path="author" element={<ScormAuthor />} />
          <Route path="visual-studio" element={<ScormVisualStudio />} />
          <Route path="reports" element={<ScormReports />} />
          <Route path="access" element={<ScormAccessAdmin />} />
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

        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </Suspense>
  );
}

function AppSurface() {
  const { pathname } = useLocation();
  const isHostDashboard = pathname === '/host';
  const isClassicHost = pathname === '/' || pathname === '/login' || isHostDashboard || pathname.startsWith('/host/create') || pathname.startsWith('/host/edit') || pathname.startsWith('/host/reports');
  const isQuizGameStage = pathname.startsWith('/host/lobby') || pathname.startsWith('/host/game') || pathname === '/join' || pathname.startsWith('/player/');
  const showQuizBackdrop = isClassicHost || isQuizGameStage;
  const surfaceClass = !showQuizBackdrop
    ? 'bg-[#11100e]'
    : isQuizGameStage
      ? 'bg-[#080719] live-quiz-stage'
      : isHostDashboard
        ? 'bg-[#080719]'
        : 'bg-[#080719] classic-quizmoto-host';

  return (
    <div className={`min-h-screen text-white relative ${surfaceClass}`}>
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