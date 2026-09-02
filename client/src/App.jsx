import React, { Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useParams, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { SocketProvider } from './context/SocketContext';
import LiveQuizAudioDirector from './components/LiveQuizAudioDirector';
import MarketingSite from './pages/Marketing/MarketingSite';
import './pages/Host/liveQuizTheme.css';
import './pages/Host/classicQuizmoto.css';
import './pages/Host/quizmotoHostWorkbench.css';
import './pages/Host/quizmotoEditWorkbench.css';
import './pages/Host/quizmotoCreateWorkbench.css';
import './pages/Host/quizmotoElectricArena.css';
import './pages/Host/quizmotoArenaPolish.css';
import './pages/Host/quizmotoClassicBoundary.css';
import './pages/Scorm/scormVisualStudioFixes.css';
import './pages/Scorm/scormReferenceTheme.css';
import './pages/Scorm/scormReferencePolish.css';

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
const MicrosoftDiscovery = lazy(() => import('./pages/Scorm/MicrosoftDiscovery'));
const ScormPlatformShell = lazy(() => import('./pages/Scorm/ScormPlatformShell'));
const ScormHome = lazy(() => import('./pages/Scorm/Home'));
const PendingScormHome = lazy(() => import('./pages/Scorm/PendingHome'));
const ScormFeatureLocked = lazy(() => import('./pages/Scorm/FeatureLocked'));
const QuizmotoModule = lazy(() => import('./pages/Scorm/QuizmotoModule'));
const ScormCourses = lazy(() => import('./pages/Scorm/Courses'));
const ScormTracking = lazy(() => import('./pages/Scorm/Tracking'));
const ScormLearnerRoster = lazy(() => import('./pages/Scorm/LearnerRoster'));
const ScormAssignments = lazy(() => import('./pages/Scorm/Assignments'));
const ScormCampaignCreate = lazy(() => import('./pages/Scorm/CampaignCreate'));
const ScormCampaignDetail = lazy(() => import('./pages/Scorm/CampaignDetail'));
const ScormCampaignLearners = lazy(() => import('./pages/Scorm/CampaignLearners'));
const ScormCampaignAnalytics = lazy(() => import('./pages/Scorm/CampaignAnalytics'));
const ScormLearnerAccessSettings = lazy(() => import('./pages/Scorm/LearnerAccessSettings'));
const ScormLearnerPortal = lazy(() => import('./pages/Scorm/LearnerPortal'));
const ScormUniversalLearnerPortal = lazy(() => import('./pages/Scorm/UniversalLearnerPortal'));
const ScormCampaignPortal = lazy(() => import('./pages/Scorm/CampaignPortal'));
const ScormMicrosoftLearnerCallback = lazy(() => import('./pages/Scorm/MicrosoftLearnerCallback'));
const ScormMicrosoftCampaignCallback = lazy(() => import('./pages/Scorm/MicrosoftCampaignCallback'));
const ScormMicrosoftStaffCallback = lazy(() => import('./pages/Scorm/MicrosoftStaffCallback'));
const ScormMicrosoftUniversalCallback = lazy(() => import('./pages/Scorm/MicrosoftUniversalCallback'));
const ScormLibrary = lazy(() => import('./pages/Scorm/Library'));
const ScormPublishingGuide = lazy(() => import('./pages/Scorm/ScormPublishingGuide'));
const ScormCourseDetail = lazy(() => import('./pages/Scorm/CourseDetail'));
const ScormLearnLanding = lazy(() => import('./pages/Scorm/LearnLanding'));
const ScormPlayerShell = lazy(() => import('./pages/Scorm/PlayerShell'));
const ScormAuthor = lazy(() => import('./pages/Scorm/CourseGenerator'));
const ScormReports = lazy(() => import('./pages/Scorm/Reports'));
const ScormVisualStudio = lazy(() => import('./pages/Scorm/VisualStudio'));
const ScormAccessAdmin = lazy(() => import('./pages/Scorm/AccessAdmin'));
const ScormTeamAccess = lazy(() => import('./pages/Scorm/TeamAccess'));

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
  const { token, platformAccess, loading, user } = useAuth();
  if (loading) return <RouteFallback />;
  if (token && platformAccess) return <Navigate to={user?.quizmotoOnly ? '/scorm/quizmoto' : '/scorm'} replace />;
  return <ScormAuth />;
}

function PlatformProtected({ children }) {
  const { token, platformAccess, loading } = useAuth();
  if (loading) return <RouteFallback />;
  if (!token || !platformAccess) return <Navigate to="/login" replace />;
  return children;
}

function isAnalyticsViewer(user) {
  return user?.role === 'analytics_viewer';
}

function ScormFeatureGate({ featureId, analyticsAllowed = false, children }) {
  const { scormAccess, user } = useAuth();
  if (user?.quizmotoOnly) return <Navigate to="/scorm/quizmoto" replace />;
  if (!scormAccess) return <ScormFeatureLocked featureId={featureId} />;
  if (isAnalyticsViewer(user) && !analyticsAllowed) return <Navigate to="/scorm/tracking" replace />;
  return children;
}

function ScormOperationalGate({ children }) {
  const { user } = useAuth();
  return isAnalyticsViewer(user) ? <Navigate to="/scorm/tracking" replace /> : children;
}

function ScormHomeGate() {
  const { scormAccess, user } = useAuth();
  if (user?.quizmotoOnly) return <Navigate to="/scorm/quizmoto" replace />;
  if (scormAccess && isAnalyticsViewer(user)) return <Navigate to="/scorm/tracking" replace />;
  return scormAccess ? <ScormHome /> : <PendingScormHome />;
}

function AccessAdminGate() {
  const { scormAccess, user } = useAuth();
  const isSuperAdmin = Boolean(scormAccess && (user?.isSuperAdmin || user?.role === 'super_admin'));
  return isSuperAdmin ? <ScormAccessAdmin /> : <Navigate to="/scorm" replace />;
}

function WorkspaceAdminGate({ children }) {
  const { scormAccess, user } = useAuth();
  return scormAccess && (user?.role === 'admin' || user?.role === 'super_admin')
    ? children
    : <Navigate to={isAnalyticsViewer(user) ? '/scorm/tracking' : '/scorm'} replace />;
}

const BLOG_POST_TITLES = {
  'why-scorm-courses-go-unfinished': 'Why Most SCORM Courses Go Unfinished (And How to Fix It)',
  'live-quizzes-vs-static-assessments': 'Live Quizzes vs. Static Assessments: What Actually Improves Retention',
  'scorm-1-2-vs-scorm-2004': 'SCORM 1.2 vs. SCORM 2004: What Actually Matters for Course Authors',
  'ai-assisted-authoring-course-timeline': 'How AI-Assisted Authoring Changes the Course Creation Timeline',
  'signs-security-awareness-training-needs-refresh': '5 Signs Your Security Awareness Training Needs a Refresh',
  'slide-deck-to-scorm-migration-guide': 'From Slide Deck to SCORM Package: A Practical Migration Guide',
  'quizmoto-as-a-full-learning-platform': 'What We Learned Building Quizmoto Into a Full Learning Platform',
  'designing-knowledge-checks-that-dont-feel-like-a-test': "Designing Knowledge Checks That Don't Feel Like a Test",
};

function BlogPost() {
  const { slug } = useParams();
  if (!Object.prototype.hasOwnProperty.call(BLOG_POST_TITLES, slug)) return <Navigate to="/blog" replace />;
  const title = BLOG_POST_TITLES[slug];
  return <MarketingSite src={`/landing/blog/${slug}.html`} title={title} tabTitle={`${title} | LMSGEN Blog`} />;
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
        <Route path="/" element={<MarketingSite src="/landing/index.html" title="LMSGEN" tabTitle="LMSGEN | AI-Powered Learning Platform" />} />
        <Route path="/solutions" element={<MarketingSite src="/landing/solutions/index.html" title="LMSGEN solutions" tabTitle="AI Course Authoring, SCORM & Live Quizzes | LMSGEN" />} />
        <Route path="/about" element={<MarketingSite src="/landing/about/index.html" title="About LMSGEN" tabTitle="About LMSGEN: Learning Platform for L&D and Security Awareness Teams" />} />
        <Route path="/blog" element={<MarketingSite src="/landing/blog/index.html" title="LMSGEN blog" tabTitle="LMSGEN Blog: Insights on Learning, SCORM & Security Awareness" />} />
        <Route path="/blog/:slug" element={<BlogPost />} />
        <Route path="/contact" element={<MarketingSite src="/landing/contact/index.html" title="Contact LMSGEN" tabTitle="Contact LMSGEN | Learning Platform" />} />
        <Route path="/login" element={<PlatformEntry />} />
        <Route path="/login/microsoft" element={<MicrosoftDiscovery />} />
        <Route path="/auth/microsoft/callback" element={<ScormMicrosoftUniversalCallback />} />
        <Route path="/login/workspace/:workspaceId/microsoft/callback" element={<ScormMicrosoftStaffCallback />} />
        <Route path="/scorm/login" element={<Navigate to="/login" replace />} />

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
          <Route path="quizmoto" element={<ScormOperationalGate><QuizmotoModule /></ScormOperationalGate>} />
          <Route path="quizmoto/create" element={<ScormOperationalGate><CreateQuiz embedded /></ScormOperationalGate>} />
          <Route path="quizmoto/edit/:id" element={<ScormOperationalGate><EditQuiz embedded /></ScormOperationalGate>} />
          <Route path="quizmoto/reports" element={<ScormOperationalGate><Reports embedded /></ScormOperationalGate>} />
          <Route path="courses" element={<ScormFeatureGate featureId="courses"><ScormCourses /></ScormFeatureGate>} />
          <Route path="courses/:id" element={<ScormFeatureGate featureId="courses"><ScormCourseDetail /></ScormFeatureGate>} />
          <Route path="roster" element={<ScormFeatureGate featureId="tracking"><ScormLearnerRoster /></ScormFeatureGate>} />
          <Route path="assignments" element={<ScormFeatureGate featureId="tracking"><ScormAssignments /></ScormFeatureGate>} />
          <Route path="campaigns" element={<Navigate to="/scorm/assignments" replace />} />
          <Route path="campaigns/new" element={<ScormFeatureGate featureId="tracking"><ScormCampaignCreate /></ScormFeatureGate>} />
          <Route path="campaigns/:campaignId" element={<ScormFeatureGate featureId="tracking"><ScormCampaignDetail /></ScormFeatureGate>} />
          <Route path="campaigns/:campaignId/learners" element={<ScormFeatureGate featureId="tracking"><ScormCampaignLearners /></ScormFeatureGate>} />
          <Route path="campaigns/:campaignId/analytics" element={<ScormFeatureGate featureId="reports" analyticsAllowed><ScormCampaignAnalytics /></ScormFeatureGate>} />
          <Route path="tracking" element={<ScormFeatureGate featureId="tracking" analyticsAllowed><ScormTracking /></ScormFeatureGate>} />
          <Route path="library" element={<ScormFeatureGate featureId="library"><ScormLibrary /></ScormFeatureGate>} />
          <Route path="library/publishing-guide" element={<ScormFeatureGate featureId="library"><ScormPublishingGuide /></ScormFeatureGate>} />
          <Route path="author" element={<ScormFeatureGate featureId="author"><ScormAuthor /></ScormFeatureGate>} />
          <Route path="visual-studio" element={<ScormFeatureGate featureId="visualStudio"><ScormVisualStudio /></ScormFeatureGate>} />
          <Route path="reports" element={<ScormFeatureGate featureId="reports" analyticsAllowed><ScormReports /></ScormFeatureGate>} />
          <Route path="team" element={<WorkspaceAdminGate><ScormTeamAccess /></WorkspaceAdminGate>} />
          <Route path="learner-access" element={<WorkspaceAdminGate><ScormLearnerAccessSettings /></WorkspaceAdminGate>} />
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

        <Route path="/learn" element={<ScormUniversalLearnerPortal />} />
        <Route path="/learn/microsoft" element={<MicrosoftDiscovery />} />
        <Route path="/learn/:workspaceId" element={<ScormLearnerPortal />} />
        <Route path="/learn/:workspaceId/microsoft/callback" element={<ScormMicrosoftLearnerCallback />} />
        <Route path="/campaign/:campaignId" element={<ScormCampaignPortal />} />
        <Route path="/campaign/:campaignId/microsoft/callback" element={<ScormMicrosoftCampaignCallback />} />
        <Route path="/scorm/learn/:inviteCode" element={<ScormLearnLanding />} />
        <Route path="/scorm/player/:registrationId" element={<ScormPlayerShell />} />

        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </Suspense>
  );
}

function AppSurface() {
  const { pathname } = useLocation();
  const isQuizGameStage = pathname.startsWith('/host/lobby') || pathname.startsWith('/host/game') || pathname === '/join' || pathname.startsWith('/player/');
  const surfaceClass = isQuizGameStage ? 'bg-quizmoto-darkPurple live-quiz-stage quizmoto-classic-live-stage' : 'bg-[#0A0F0E]';

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
