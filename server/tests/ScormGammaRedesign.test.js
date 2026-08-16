const fs = require('fs');
const path = require('path');
const { expect } = require('chai');

function read(relative) {
  return fs.readFileSync(path.join(__dirname, '..', relative), 'utf8');
}

describe('SCORM AI Gamma-inspired redesign', () => {
  const app = read('../client/src/App.jsx');
  const platformTheme = read('../client/src/pages/Scorm/scormReferenceTheme.css');
  const platformPolish = read('../client/src/pages/Scorm/scormReferencePolish.css');
  const courseThemes = read('../client/src/pages/Scorm/courseExperienceV5.js');
  const serverThemes = read('services/scorm/ScormThemeCatalog.js');
  const gammaFinalizer = read('services/scorm/ScormGammaEditorialFinalizer.js');
  const answerFinalizer = read('services/scorm/ScormAnswerTrackingPackageFinalizer.js');

  it('loads the reference platform theme after the legacy management styles', () => {
    expect(app).to.include("import './pages/Scorm/scormReferenceTheme.css';");
    expect(app).to.include("import './pages/Scorm/scormReferencePolish.css';");
    expect(platformTheme).to.include('--sai-paper: #0A0F0E');
    expect(platformTheme).to.include('--sai-brand: #4FC9BF');
    expect(platformTheme).to.include('--sai-ink: #EDF4F2');
  });

  it('keeps the classic Quizmoto lobby and live game routes outside the SCORM management shell', () => {
    expect(app).to.include('<Route path="/host/lobby/:pin" element={<Lobby />} />');
    expect(app).to.include('<Route path="/host/game/:pin" element={<GameView />} />');
    expect(app).to.include("'bg-quizmoto-darkPurple live-quiz-stage quizmoto-classic-live-stage'");
    expect(platformTheme).to.include('Preserve the original full-screen Quizmoto live-game visual system');
  });

  it('uses the uploaded-reference teal state system across hard-coded management surfaces', () => {
    expect(platformPolish).to.include('var(--sai-pending-soft)');
    expect(platformPolish).to.include('var(--sai-unlocked)');
    expect(platformPolish).to.include('scorm-author-dropzone');
  });

  it('makes Gamma Editorial the default authoring theme using the PPT palette on client and server', () => {
    expect(courseThemes).to.include("slug: 'gamma-editorial'");
    expect(courseThemes).to.include("primary: '#282824'");
    expect(courseThemes).to.include("bg: '#E7E7E4'");
    expect(courseThemes).to.include("bg2: '#E5DFD2'");
    expect(courseThemes).to.include("accent: '#CBC5B8'");
    expect(serverThemes).to.include("slug: 'gamma-editorial'");
    expect(serverThemes).to.include("name: 'Gamma Editorial'");
    expect(serverThemes).to.include("bg: '#E7E7E4'");
    expect(serverThemes).to.include("text: '#282824'");
  });

  it('injects the Gamma editorial learner layer before answer tracking is finalized', () => {
    expect(gammaFinalizer).to.include('scorm-ai-gamma-editorial-v1');
    expect(gammaFinalizer).to.include("font-family:'Lato'");
    expect(gammaFinalizer).to.include('--gamma-paper:#E7E7E4');
    expect(gammaFinalizer).to.include('--gamma-ink:#282824');
    expect(gammaFinalizer).to.include("grid-template-columns:minmax(0,1.62fr) minmax(300px,.98fr)");
    expect(answerFinalizer).to.include("require('./ScormGammaEditorialFinalizer')");
  });
});
