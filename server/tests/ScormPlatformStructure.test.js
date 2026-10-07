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

    it('routes the marketing site at root and guards the platform behind authentication', () => {
        expect(app).to.include('<Route path="/" element={<MarketingSite');
        expect(app).to.include('<Route path="/login" element={<PlatformEntry />} />');
        expect(app).to.include('<Route path="/scorm" element={<PlatformProtected>');
        expect(auth).to.include('alt="LMSGEN"');
    });

    it('nests Quizmoto inside the SCORM AI platform while preserving classic live stages', () => {
        expect(app).to.include('<Route path="quizmoto" element={<ScormOperationalGate><QuizmotoModule /></ScormOperationalGate>} />');
        expect(app).to.include('<Route path="quizmoto/create" element={<ScormOperationalGate><CreateQuiz embedded /></ScormOperationalGate>} />');
        expect(app).to.include('<Route path="/host/lobby/:pin" element={<Lobby />} />');
        expect(app).to.include('<Route path="/host/game/:pin" element={<GameView />} />');
        expect(app).to.include('<Route path="/join" element={<Join />} />');
    });

    it('keeps SCORM AI features visible but gates them independently of Quizmoto', () => {
        expect(app).to.include('function ScormFeatureGate');
        expect(app).to.include('if (!scormAccess) return <ScormFeatureLocked featureId={featureId} />;');
        expect(shell).to.include("{ to: '/scorm/quizmoto', label: 'Quizmoto', icon: Gamepad2, unlocked: true }");
        expect(shell).to.include("{ to: '/scorm/author', label: 'AI Course Author', icon: Sparkles, requiresScorm: true }");
        expect(shell).to.include('Quizmoto and LMSGEN Publica are unlocked. LMSGEN features unlock after administrator approval and tenant assignment.');
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
