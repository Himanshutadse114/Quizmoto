const JSZip = require('jszip');
const { buildScormPackageZip: buildTrackedPackage } = require('./ScormTrackingPackageFinalizer');

const GAMMA_EDITORIAL_CSS = `
<style id="scorm-ai-gamma-editorial-v1">
@import url('https://fonts.googleapis.com/css2?family=Lato:wght@400;700;900&display=swap');

:root{
  --gamma-paper:#E7E7E4;
  --gamma-paper-2:#E5DFD2;
  --gamma-paper-3:#CBC5B8;
  --gamma-ink:#282824;
  --gamma-ink-soft:#4A4A45;
  --gamma-highlight:#FCF2B5;
  --gamma-white:#FFFFFF;
  --gamma-line:#CBC5B8;
  --gamma-shadow:0 1px 2px rgba(40,40,36,.05),0 10px 28px rgba(40,40,36,.08);
}

html,body,#app{
  background:var(--gamma-paper)!important;
  color:var(--gamma-ink)!important;
  font-family:'Lato','Helvetica Neue',Arial,sans-serif!important;
}
body{margin:0!important}
#app{background:var(--gamma-paper)!important}

header,footer{
  background:rgba(231,231,228,.96)!important;
  color:var(--gamma-ink)!important;
  border-color:var(--gamma-line)!important;
  box-shadow:none!important;
  backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px)
}
header{height:60px!important;padding:0 26px!important}
footer{height:64px!important;padding:0 26px!important}
header h1{
  color:var(--gamma-ink)!important;
  font-family:'Lato','Helvetica Neue',Arial,sans-serif!important;
  font-size:13px!important;
  font-weight:700!important;
  letter-spacing:0!important
}
.brand-mark{
  width:34px!important;height:34px!important;border-radius:7px!important;
  background:var(--gamma-ink)!important;color:var(--gamma-white)!important;
  border:0!important;box-shadow:none!important
}
.progress-shell{height:5px!important;background:var(--gamma-paper-3)!important;border:0!important;border-radius:999px!important}
.progress-fill{background:var(--gamma-ink)!important;box-shadow:none!important}
.progress-text,.part{color:var(--gamma-ink-soft)!important;font-size:10.5px!important;font-weight:700!important;letter-spacing:.02em!important}

.slide{
  background:var(--gamma-paper)!important;
  padding:28px 34px!important;
  scrollbar-color:var(--gamma-paper-3) var(--gamma-paper)!important
}
.stage,.qmx-stage{width:min(1180px,100%)!important;margin:auto!important}

.eyebrow,.qmx-kicker,.step-no,.hub-item b{
  color:var(--gamma-ink-soft)!important;
  font-family:'Lato','Helvetica Neue',Arial,sans-serif!important;
  font-size:10px!important;font-weight:900!important;letter-spacing:.075em!important;text-transform:uppercase!important
}
.title,.qmx-copy h2,.final-card h1,.quiz-card h2{
  color:var(--gamma-ink)!important;
  font-family:'Lato','Helvetica Neue',Arial,sans-serif!important;
  font-weight:900!important;
  letter-spacing:-.035em!important;
  line-height:1.04!important
}
.title,.qmx-copy h2{font-size:clamp(34px,4.2vw,54px)!important}
.lead,.qmx-copy p,.concept-card p,.step p,.milestone p,.compare-item,.hub-item{
  color:var(--gamma-ink-soft)!important;
  font-family:'Lato','Helvetica Neue',Arial,sans-serif!important;
  line-height:1.55!important
}
.lead,.qmx-copy p{font-size:16.5px!important}

.glass,.qmx-copy,.concept-card,.step,.milestone p,.compare-col,.hub-item,.quiz-card,.quiz-option,.final-card{
  background:transparent!important;
  color:var(--gamma-ink)!important;
  border:0!important;
  box-shadow:none!important;
  backdrop-filter:none!important;-webkit-backdrop-filter:none!important
}
.glass,.qmx-copy,.quiz-card,.final-card{border-radius:0!important}

.concept-card,.step,.milestone p,.compare-col,.hub-item{
  background:rgba(255,255,255,.22)!important;border:1px solid var(--gamma-paper-3)!important;
  border-radius:8px!important;padding:16px!important
}
.process{gap:36px!important;overflow:visible!important}
.process .step{position:relative!important;overflow:visible!important}
.step:not(:last-child):after{
  content:"\\2192"!important;
  background:var(--gamma-ink)!important;color:#fff!important;
  right:-26px!important;width:24px!important;height:24px!important;
  font-size:12px!important;line-height:1!important;
  box-shadow:0 0 0 4px var(--gamma-paper)!important;z-index:3!important
}
.hub-svg line{stroke:var(--gamma-paper-3)!important;stroke-width:3.5!important;opacity:.65!important}
.timeline:before{background:var(--gamma-ink)!important}
@media(max-width:900px){
  .process{gap:12px!important}
  .process .step:not(:last-child):after{display:none!important}
}
.dot{background:var(--gamma-paper)!important;border-color:var(--gamma-ink)!important;box-shadow:none!important}
.compare-col.good{background:#E4E7DF!important;border-top:3px solid #526C59!important}
.compare-col.warn{background:#EFE1DC!important;border-top:3px solid #8B4C3E!important}
.compare-col.good .compare-title{color:#405A47!important}.compare-col.warn .compare-title{color:#7A3F33!important}

/* Quiz: high-contrast Knowledge Check badge; no option letter cubes */
.qmx-quiz-label{
  background:var(--gamma-ink)!important;color:#fff!important;
  border:1px solid var(--gamma-ink)!important;font-weight:900!important
}
.qmx-quiz-label:before{background:var(--gamma-highlight)!important}
.qmx-option-letter{display:none!important}
.quiz-options{gap:10px!important}
.quiz-option{
  background:var(--gamma-paper)!important;color:var(--gamma-ink)!important;
  border:1px solid var(--gamma-paper-3)!important;border-radius:8px!important;
  padding:15px 16px!important;min-height:58px!important;font-size:14px!important;font-weight:700!important;box-shadow:none!important
}
.quiz-option:hover:not(:disabled){background:var(--gamma-highlight)!important;border-color:#C8B86C!important;transform:none!important}
.quiz-option.correct{background:#DFE9E1!important;border-color:#72917B!important;color:#274A31!important}
.quiz-option.incorrect{background:#EFE0DC!important;border-color:#B9786B!important;color:#713A31!important;text-decoration:none!important}
.quiz-card{
  padding:38px 40px!important;background:rgba(255,255,255,.42)!important;
  border:1px solid var(--gamma-paper-3)!important;border-radius:10px!important
}
.quiz-card h2{font-size:clamp(30px,3vw,42px)!important}
.quiz-wrap{max-width:900px!important}
.feedback{
  border-radius:8px!important;background:var(--gamma-paper-2)!important;color:var(--gamma-ink-soft)!important;
  border:1px solid var(--gamma-paper-3)!important;padding:14px 15px!important;text-align:left!important;
  font-size:13px!important;line-height:1.5!important;font-weight:700!important
}
.final-card{
  padding:38px!important;background:rgba(255,255,255,.38)!important;
  border:1px solid var(--gamma-paper-3)!important;border-radius:10px!important
}
.score-ring{background:conic-gradient(var(--gamma-ink) 0deg,var(--gamma-ink) 270deg,var(--gamma-paper-3) 270deg)!important}
.score-ring:before{background:var(--gamma-paper)!important}.score-ring span{color:var(--gamma-ink)!important;font-weight:900!important}

.nav-btn{
  min-height:42px!important;border-radius:8px!important;padding:9px 16px!important;
  font-family:'Lato','Helvetica Neue',Arial,sans-serif!important;font-weight:700!important;
  box-shadow:none!important;transition:background .15s ease,border-color .15s ease!important
}
.nav-btn.primary{background:var(--gamma-ink)!important;color:#fff!important;border:1px solid var(--gamma-ink)!important;box-shadow:none!important}
.nav-btn.primary:hover{background:#11110F!important;transform:none!important;filter:none!important}
.nav-btn.secondary{background:transparent!important;color:var(--gamma-ink)!important;border:1px solid var(--gamma-paper-3)!important;box-shadow:none!important}
.nav-btn.secondary:hover{background:var(--gamma-paper-2)!important;border-color:#A9A398!important;color:var(--gamma-ink)!important}
button:focus-visible,.nav-btn:focus-visible,.quiz-option:focus-visible,.qmx-point:focus-visible,.qmx-visual:focus-visible{outline:3px solid rgba(40,40,36,.22)!important;outline-offset:3px!important}

@media(max-width:900px){
  .slide{padding:18px!important}
  .quiz-options{grid-template-columns:1fr!important}
}
@media(max-width:560px){
  header{height:56px!important;padding:0 14px!important}footer{height:62px!important;padding:0 14px!important}
  .slide{padding:14px 12px!important}
  .quiz-card,.final-card{padding:22px 18px!important}
  .nav-btn{min-height:42px!important;font-size:12px!important}
}
@media(prefers-reduced-motion:reduce){*,*::before,*::after{scroll-behavior:auto!important;animation-duration:.01ms!important;animation-iteration-count:1!important;transition-duration:.01ms!important}}
</style>`;

function injectGammaEditorialTheme(html) {
  const source = String(html || '');
  if (source.includes('scorm-ai-gamma-editorial-v1')) return source;
  return source.includes('</head>')
    ? source.replace('</head>', `${GAMMA_EDITORIAL_CSS}\n</head>`)
    : `${GAMMA_EDITORIAL_CSS}\n${source}`;
}

async function buildScormPackageZip(analysis, opts = {}) {
  const baseBuffer = await buildTrackedPackage(analysis, opts);
  const zip = await JSZip.loadAsync(baseBuffer);
  const indexFile = zip.file('index.html');
  if (!indexFile) return baseBuffer;
  const html = await indexFile.async('string');
  zip.file('index.html', injectGammaEditorialTheme(html));
  return zip.generateAsync({ type: 'nodebuffer', compression: 'STORE' });
}

module.exports = {
  buildScormPackageZip,
  injectGammaEditorialTheme,
  GAMMA_EDITORIAL_CSS
};
