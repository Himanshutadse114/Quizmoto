import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { SocketProvider } from './context/SocketContext';

// Pages
import Home from './pages/Home';
import Login from './pages/Host/Login';
import Dashboard from './pages/Host/Dashboard';
import CreateQuiz from './pages/Host/CreateQuiz';
import EditQuiz from './pages/Host/EditQuiz';
import Reports from './pages/Host/Reports';
import Lobby from './pages/Host/Lobby';
import GameView from './pages/Host/GameView';
import Join from './pages/Player/Join';
import PlayerLobby from './pages/Player/PlayerLobby';
import PlayerGame from './pages/Player/PlayerGame';
import PlayerLogin from './pages/Player/PlayerLogin';
import PlayerDashboard from './pages/Player/PlayerDashboard';

// SCORM World (flag-gated on backend; routes always registered)
import ScormHome from './pages/Scorm/Home';
import ScormLibrary from './pages/Scorm/Library';
import ScormCourseDetail from './pages/Scorm/CourseDetail';
import ScormLearnLanding from './pages/Scorm/LearnLanding';
import ScormPlayerShell from './pages/Scorm/PlayerShell';

function App() {
  return (
    <AuthProvider>
      <SocketProvider>
        <Router basename={import.meta.env.VITE_APP_BASENAME || '/'}>
          <div className="min-h-screen bg-quizmoto-darkPurple text-white relative">
            {/* Background Shapes */}
            <div className="bg-shape shape-1 w-64 h-64 border-[32px] border-white rounded-full" />
            <div className="bg-shape shape-2 w-48 h-48 border-[24px] border-quizmoto-yellow rotate-45" />
            <div className="bg-shape shape-3 w-32 h-32 bg-quizmoto-blue rounded-xl" />
            <div className="bg-shape shape-4 w-56 h-56 border-[28px] border-quizmoto-red rounded-lg -rotate-12" />

            <Routes>
              {/* Public Routes */}
              <Route path="/" element={<Home />} />
              <Route path="/login" element={<Login />} />

              {/* Player Routes */}
              <Route path="/player/login" element={<PlayerLogin />} />
              <Route path="/player/dashboard" element={<PlayerDashboard />} />
              <Route path="/join" element={<Join />} />
              <Route path="/player/lobby" element={<PlayerLobby />} />
              <Route path="/player/game" element={<PlayerGame />} />

              {/* Protected Host Routes */}
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/create-quiz" element={<CreateQuiz />} />
              <Route path="/edit-quiz/:id" element={<EditQuiz />} />
              <Route path="/reports" element={<Reports />} />
              <Route path="/host/lobby/:pin" element={<Lobby />} />
              <Route path="/host/game/:pin" element={<GameView />} />

              {/* SCORM World */}
              <Route path="/scorm" element={<ScormHome />} />
              <Route path="/scorm/library" element={<ScormLibrary />} />
              <Route path="/scorm/courses/:id" element={<ScormCourseDetail />} />
              <Route path="/scorm/learn/:inviteCode" element={<ScormLearnLanding />} />
              <Route path="/scorm/player/:registrationId" element={<ScormPlayerShell />} />

              {/* Fallback */}
              <Route path="*" element={<Navigate to="/" />} />
            </Routes>
          </div>
        </Router>
      </SocketProvider>
    </AuthProvider>
  );
}

export default App;
