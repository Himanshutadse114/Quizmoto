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
    const author = source('../client/src/pages/Scorm/AuthorVisual.jsx');
    const quizEditor = source('../client/src/pages/Scorm/AuthorQuizEditor.jsx');
    const previewRedirect = source('../client/src/pages/Scorm/CoursePreviewRedirect.jsx');

    it('uses SCORM AI authentication as the root product entry', () => {
        expect(app).to.include('<Route path="/" element={<PlatformEntry />} />');
        expect(app).to.include('return <ScormAuth />');
        expect(app).to.include('<Route path="/login" element={<Navigate to="/" replace />} />');
        expect(auth).to.include('SCORM AI Platform · Quizmoto included');
    });

    it('nests Quizmoto inside the SCORM AI platform while preserving classic live stages', () => {
        expect(app).to.include('<Route path="quizmoto" element={<QuizmotoModule />} />');
        expect(app).to.include('<Route path="quizmoto/create" element={<CreateQuiz embedded />} />');
        expect(app).to.include('<Route path="/host/lobby/:pin" element={<Lobby />} />');
        expect(app).to.include('<Route path="/host/game/:pin" element={<GameView />} />');
        expect(app).to.include('<Route path="/join" element={<Join />} />');
    });

    it('keeps SCORM AI features visible but gates them independently of Quizmoto', () => {
        expect(app).to.include('function ScormFeatureGate');
        expect(app).to.include('return scormAccess ? children : <ScormFeatureLocked featureId={featureId} />');
        expect(shell).to.include("{ to: '/scorm/quizmoto', label: 'Quizmoto', icon: Gamepad2, unlocked: true }");
        expect(shell).to.include("{ to: '/scorm/author', label: 'AI Course Author', icon: Sparkles, requiresScorm: true }");
        expect(shell).to.include('Quizmoto is unlocked. SCORM AI features unlock after administrator approval.');
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

    it('recovers legacy course preview URLs instead of leaving a blank dark screen', () => {
        expect(app).to.include('ScormCoursePreviewRedirect');
        expect(app).to.include('<Route path="/scorm/course/:id/preview"');
        expect(app).to.include('<Route path="/scorm/courses/:id/preview"');
        expect(previewRedirect).to.include('/api/scorm/courses/${encodeURIComponent(id || \'\')}/preview');
        expect(previewRedirect).to.include('/api/scorm/play/${encodeURIComponent(registrationId)}');
        expect(previewRedirect).to.include('window.location.replace');
        expect(previewRedirect).to.include('Opening course preview');
        expect(previewRedirect).to.include('Preview could not be opened');
    });
});
