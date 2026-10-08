const fs = require('fs');
const path = require('path');
const { expect } = require('chai');

function source(relative) {
    return fs.readFileSync(path.join(__dirname, '..', relative), 'utf8');
}

describe('SCORM AI platform product structure', () => {
    const app = source('../client/src/App.jsx');
    const shell = source('../client/src/pages/Scorm/ScormPlatformShell.jsx');
    const auth = source('../client/src/pages/Scorm/ScormAuth.jsx');
    const catalog = source('../client/src/pages/Scorm/scormFeatureCatalog.js');
    const author = source('../client/src/pages/Scorm/AuthorVisual.jsx');
    const quizEditor = source('../client/src/pages/Scorm/AuthorQuizEditor.jsx');

    it('uses LMSGEN authentication as the protected product entry', () => {
        expect(app).to.include('<Route path="/login" element={<PlatformEntry />} />');
        expect(app).to.include('return <ScormAuth />');
        expect(auth).to.include('Sign in to continue to your workspace.');
        expect(auth).to.not.include('sa-product-preview');
        expect(auth).to.not.include('Assigned identities open their tenant and role');
    });

    it('gates Quizmoto inside LMSGEN while preserving approved live stages', () => {
        expect(app).to.include('<ScormFeatureGate featureId="quizmoto"><ScormOperationalGate><QuizmotoModule />');
        expect(app).to.include('<ScormFeatureGate featureId="quizmoto"><ScormOperationalGate><CreateQuiz embedded />');
        expect(app).to.include('<Route path="/host/lobby/:pin" element={<Lobby />} />');
        expect(app).to.include('<Route path="/host/game/:pin" element={<GameView />} />');
        expect(app).to.include('<Route path="/join" element={<Join />} />');
    });

    it('keeps the complete platform visible while paid modules remain locked in demo mode', () => {
        expect(app).to.include('function ScormFeatureGate');
        expect(app).to.include('if (!scormAccess) return demoAllowed ? children : <ScormFeatureLocked featureId={featureId} />');
        expect(app).to.include('<ScormFeatureGate featureId="courses" demoAllowed><ScormCourses />');
        expect(shell).to.include("{ to: '/scorm/quizmoto', label: 'Quizmoto', icon: Gamepad2, requiresScorm: true }");
        expect(shell).to.include("{ to: '/scorm/author', label: 'AI Course Author', icon: Sparkles, requiresScorm: true }");
        expect(shell).to.include("{ to: '/scorm/roster', label: 'Learner Roster', icon: UserCheck, requiresScorm: true }");
        expect(shell).to.include("{ to: '/scorm/courses', label: 'Demo Course', icon: BookOpen, unlocked: true }");
        expect(shell).to.include('Demo mode');
        expect(catalog).to.include("label: 'Authentication & SSO'");
        expect(catalog).to.include('Import CSV or TXT files with Name and Email columns');
    });

    it('provides an editable knowledge-check authoring surface before generation', () => {
        expect(author).to.include("import AuthorQuizEditor from './AuthorQuizEditor'");
        expect(author).to.include('<AuthorQuizEditor quiz={analysis.quiz || []} onChange={updateQuiz} />');
        expect(author).to.include('correctAnswer: Number(question.correctAnswer)');
        expect(author).to.include('validateQuiz(analysis.quiz)');
        expect(quizEditor).to.include('Edit the generated quiz');
        expect(quizEditor).to.include('correctAnswer');
        expect(quizEditor).to.include('Add question');
        expect(quizEditor).to.include('Move question up');
        expect(quizEditor).to.include('Move question down');
    });
});
