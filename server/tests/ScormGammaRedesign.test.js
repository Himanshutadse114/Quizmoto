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
  const authorRoute = read('routes/scorm/author.js');
  const gammaFinalizer = read('services/scorm/ScormGammaEditorialFinalizer.js');
  const gammaLayoutFinalizer = read('services/scorm/ScormGammaLayoutFinalizer.js');
  const answerFinalizer = read('services/scorm/ScormAnswerTrackingPackageFinalizer.js');
  const visualStudio = read('../client/src/pages/Scorm/VisualStudio.jsx');
  const visualStudioRoute = read('routes/scorm/visualStudio.js');

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

  it('exposes Gamma Editorial as the only new authoring template while keeping the legacy server catalog readable', () => {
    expect(courseThemes.match(/slug: 'gamma-editorial'/g)).to.have.length(1);
    expect(courseThemes).to.not.include("slug: 'violet-future'");
    expect(courseThemes).to.include("primary: '#282824'");
    expect(courseThemes).to.include("bg: '#E7E7E4'");
    expect(courseThemes).to.include("bg2: '#E5DFD2'");
    expect(courseThemes).to.include("accent: '#CBC5B8'");
    expect(serverThemes).to.include("slug: 'gamma-editorial'");
    expect(serverThemes).to.include("name: 'Gamma Editorial'");
    expect(authorRoute).to.include('const AUTHOR_THEME_ID = 1;');
    expect(authorRoute).to.include('singleTemplate: true');
  });

  it('applies a final Gamma layout layer that contains Smart SVG artwork instead of cropping it', () => {
    expect(gammaFinalizer).to.include('scorm-ai-gamma-editorial-v1');
    expect(gammaLayoutFinalizer).to.include('scorm-ai-gamma-layout-v2');
    expect(gammaLayoutFinalizer).to.include('object-fit:contain!important');
    expect(gammaLayoutFinalizer).to.include('aspect-ratio:8 / 5!important');
    expect(gammaLayoutFinalizer).to.include('max-width:20ch!important');
    expect(answerFinalizer).to.include("require('./ScormGammaLayoutFinalizer')");
  });

  it('uses the server Smart SVG renderer in Visual Studio instead of the legacy fake artwork preview', () => {
    expect(visualStudioRoute).to.include("renderSmartSvg");
    expect(visualStudioRoute).to.include("fallbackSpec");
    expect(visualStudio).to.include("/api/scorm/visual-studio/render");
    expect(visualStudio).to.include('object-contain object-center');
    expect(visualStudio).to.not.include('function PreviewArtwork');
    expect(visualStudio).to.include('Single course template · locked');
  });
});
