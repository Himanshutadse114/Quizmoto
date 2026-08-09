import React, { Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { SocketProvider } from './context/SocketContext';
import LiveQuizAudioDirector from './components/LiveQuizAudioDirector';

// Route-level code splitting keeps Live Quiz, learner and SCORM admin screens out
// of each other's initial bundles.
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

        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/create-quiz" element={<CreateQuiz />} />
        <Route path="/edit-quiz/:id" element={<EditQuiz />} />
        <Route path="/reports" element={<Reports />} />
        <Route path="/host/lobby/:pin" element={<Lobby />} />
        <Route path="/host/game/:pin" element={<GameView />} />

        <Route path="/scorm" element={<ScormPlatformShell />}>
          <Route index element={<ScormHome />} />
          <Route path="courses" element={<ScormCourses />} />
          <Route path="courses/:id" element={<ScormCourseDetail />} />
          <Route path="tracking" element={<ScormTracking />} />
          <Route path="library" element={<ScormLibrary />} />
          <Route path="author" element={<ScormAuthor />} />
          <Route path="visual-studio" element={<ScormVisualStudio />} />
          <Route path="reports" element={<ScormReports />} />
        </Route>

        <Route path="/scorm/learn/:inviteCode" element={<ScormLearnLanding />} />
        <Route path="/scorm/player/:registrationId" element={<ScormPlayerShell />} />

        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </Suspense>
  );
}

function App() {
  return (
    <AuthProvider>
      <Router basename={import.meta.env.VITE_APP_BASENAME || '/'}>
        <SocketProvider>
          <LiveQuizAudioDirector />
          <div className="min-h-screen bg-quizmoto-darkPurple text-white relative">
            <div className="bg-shape shape-1 w-64 h-64 border-[32px] border-white rounded-full" />
            <div className="bg-shape shape-2 w-48 h-48 border-[24px] border-quizmoto-yellow rotate-45" />
            <div className="bg-shape shape-3 w-32 h-32 bg-quizmoto-blue rounded-xl" />
            <div className="bg-shape shape-4 w-56 h-56 border-[28px] border-quizmoto-red rounded-lg -rotate-12" />
            <AppRoutes />
          </div>
        </SocketProvider>
      </Router>
    </AuthProvider>
  );
}

export default App;
