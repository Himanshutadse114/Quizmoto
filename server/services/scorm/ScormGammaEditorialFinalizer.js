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

/* Gamma-style editorial hierarchy */
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

/* Remove the previous neon/glass language. */
.glass,.qmx-copy,.concept-card,.step,.milestone p,.compare-col,.hub-item,.quiz-card,.quiz-option,.final-card{
  background:transparent!important;
  color:var(--gamma-ink)!important;
  border:0!important;
  box-shadow:none!important;
  backdrop-filter:none!important;-webkit-backdrop-filter:none!important
}
.glass,.qmx-copy,.quiz-card,.final-card{border-radius:0!important}

/* Main slide composition follows the uploaded Gamma deck: editorial copy + accent image. */
.qmx-screen:before{display:none!important}
.qmx-frame{
  display:grid!important;
  grid-template-columns:minmax(330px,1fr) minmax(420px,1fr)!important;
  grid-template-areas:'copy visual' 'interaction visual'!important;
  gap:22px 34px!important;
  min-height:min(610px,calc(100dvh - 180px))!important;
  align-items:stretch!important
}
.qmx-copy{
  grid-area:copy!important;
  align-self:center!important;
  padding:34px 8px 18px 4px!important;
  min-width:0!important
}
.qmx-copy h2{margin:0 0 20px!important;max-width:13ch!important;text-wrap:balance!important}
.qmx-copy p{margin:0!important;max-width:48ch!important}
.qmx-interaction{grid-area:interaction!important;align-self:start!important;padding:0 8px 28px 4px!important}

.qmx-visual{
  grid-area:visual!important;
  min-height:560px!important;
  height:100%!important;
  padding:0!important;
  overflow:hidden!important;
  border:0!important;
  border-radius:0!important;
  background:var(--gamma-ink)!important;
  box-shadow:none!important;
  display:flex!important;align-items:stretch!important;justify-content:stretch!important
}
.qmx-visual picture{display:block!important;width:100%!important;height:100%!important}
.qmx-visual img{
  display:block!important;width:100%!important;height:100%!important;
  max-width:none!important;max-height:none!important;object-fit:cover!important;margin:0!important;
  border-radius:0!important;filter:none!important
}
.qmx-visual-label{
  left:14px!important;bottom:14px!important;border-radius:7px!important;
  background:rgba(40,40,36,.86)!important;color:#fff!important;
  border:1px solid rgba(255,255,255,.18)!important;box-shadow:none!important;
  font-size:9px!important;letter-spacing:.06em!important
}

/* All slide types share one visual container size (copy/interaction layout may still vary). */
.qmx-type-scenario .qmx-copy,
.qmx-type-comparison .qmx-copy{padding-right:18px!important}
.qmx-type-takeaway .qmx-copy h2{max-width:15ch!important}

.qmx-prompt{color:var(--gamma-ink-soft)!important;font-size:12px!important;line-height:1.45!important;font-weight:700!important;margin:0 0 10px!important}
.qmx-points{display:grid!important;grid-template-columns:repeat(2,minmax(0,1fr))!important;gap:8px!important}
.qmx-point{
  appearance:none!important;min-height:44px!important;border-radius:8px!important;
  padding:10px 12px!important;font-size:12px!important;font-weight:700!important;text-align:left!important;
  cursor:pointer!important;background:var(--gamma-paper-2)!important;color:var(--gamma-ink)!important;
  border:1px solid var(--gamma-paper-3)!important;box-shadow:none!important;
  transition:background .15s ease,border-color .15s ease!important
}
.qmx-point-index{
  width:22px!important;height:22px!important;border-radius:6px!important;margin-right:7px!important;
  background:var(--gamma-ink)!important;color:#fff!important;font-size:9px!important;font-weight:900!important
}
.qmx-point:hover,.qmx-point:focus-visible,.qmx-point.active{
  transform:none!important;background:var(--gamma-highlight)!important;color:var(--gamma-ink)!important;
  border-color:#C8B86C!important
}
.qmx-point.explored:not(.active){border-color:#A8A296!important;color:var(--gamma-ink)!important}
.qmx-count{color:var(--gamma-ink-soft)!important;font-size:10px!important;font-weight:700!important;letter-spacing:.05em!important}
.qmx-reveal{
  margin-top:10px!important;padding:13px 14px!important;border-radius:8px!important;
  background:var(--gamma-paper-2)!important;color:var(--gamma-ink-soft)!important;
  border:1px solid var(--gamma-paper-3)!important;border-left:4px solid var(--gamma-ink)!important;
  box-shadow:none!important;font-size:13px!important;line-height:1.5!important
}
.qmx-reveal-label{color:var(--gamma-ink)!important;font-size:9px!important;font-weight:900!important}
.qmx-type-scenario .qmx-copy{border-left:0!important}

/* Existing non-QMX layouts get the same editorial treatment. */
.hero{grid-template-columns:minmax(0,1.6fr) minmax(290px,.9fr)!important;gap:34px!important;padding:0!important}
.hero-art,.spot-visual{
  min-height:520px!important;height:100%!important;border-radius:0!important;
  background:var(--gamma-ink)!important;color:#fff!important;border:0!important;box-shadow:none!important
}
.hero-core svg,.spot-visual svg{width:190px!important;height:190px!important}
.chip,.concept-number,.takeaway{
  background:var(--gamma-paper-2)!important;color:var(--gamma-ink)!important;
  border:1px solid var(--gamma-paper-3)!important;box-shadow:none!important;border-radius:8px!important
}
.concept-card,.step,.milestone p,.compare-col,.hub-item{
  background:rgba(255,255,255,.22)!important;border:1px solid var(--gamma-paper-3)!important;
  border-radius:8px!important;padding:16px!important
}
.step:not(:last-child):after{background:var(--gamma-ink)!important;color:#fff!important}
.timeline:before{background:var(--gamma-ink)!important}
.dot{background:var(--gamma-paper)!important;border-color:var(--gamma-ink)!important;box-shadow:none!important}
.compare-col.good{background:#E4E7DF!important;border-top:3px solid #526C59!important}
.compare-col.warn{background:#EFE1DC!important;border-top:3px solid #8B4C3E!important}
.compare-col.good .compare-title{color:#405A47!important}.compare-col.warn .compare-title{color:#7A3F33!important}

/* Assessments: clean card, bold question, no game-show neon. */
.quiz-wrap{max-width:900px!important}
.quiz-card{
  padding:38px 40px!important;background:rgba(255,255,255,.42)!important;
  border:1px solid var(--gamma-paper-3)!important;border-radius:10px!important
}
.quiz-card h2{font-size:clamp(30px,3vw,42px)!important}
.quiz-options{gap:10px!important}
.quiz-option{
  background:var(--gamma-paper)!important;color:var(--gamma-ink)!important;
  border:1px solid var(--gamma-paper-3)!important;border-radius:8px!important;
  padding:15px 16px!important;min-height:58px!important;font-size:14px!important;font-weight:700!important;box-shadow:none!important
}
.quiz-option:hover:not(:disabled){background:var(--gamma-highlight)!important;border-color:#C8B86C!important;transform:none!important}
.quiz-option.correct{background:#DFE9E1!important;border-color:#72917B!important;color:#274A31!important}
.quiz-option.incorrect{background:#EFE0DC!important;border-color:#B9786B!important;color:#713A31!important;text-decoration:none!important}
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

/* Navigation is simple and solid, matching the reference deck. */
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

/* Laptop: keep the editorial balance without crowding. */
@media(max-height:760px) and (min-width:901px){
  .slide{padding-top:18px!important;padding-bottom:18px!important}
  .qmx-frame{min-height:min(520px,calc(100dvh - 156px))!important;gap:18px 28px!important}
  .qmx-visual{min-height:480px!important}
  .qmx-copy{padding-top:22px!important}
  .qmx-copy h2{font-size:clamp(32px,3.5vw,46px)!important;margin-bottom:15px!important}
  .lead,.qmx-copy p{font-size:15px!important;line-height:1.5!important}
}

/* Tablet / mobile: Gamma cards stack cleanly and preserve one idea per screen. */
@media(max-width:900px){
  .slide{padding:18px!important}
  .qmx-frame,
  .qmx-type-scenario .qmx-frame,
  .qmx-type-comparison .qmx-frame,
  .qmx-type-hotspot .qmx-frame,
  .qmx-type-reveal .qmx-frame,
  .qmx-type-takeaway .qmx-frame{
    grid-template-columns:1fr!important;
    grid-template-areas:'copy' 'visual' 'interaction'!important;
    gap:16px!important;min-height:0!important
  }
  .qmx-copy{padding:16px 2px 4px!important}
  .qmx-copy h2{font-size:clamp(30px,7vw,42px)!important;max-width:16ch!important;margin-bottom:14px!important}
  .qmx-copy p{font-size:15px!important}
  .qmx-visual,.qmx-type-scenario .qmx-visual,.qmx-type-comparison .qmx-visual{min-height:320px!important;height:320px!important}
  .qmx-interaction{padding:0 2px 12px!important}
  .hero{grid-template-columns:1fr!important}.hero-art,.spot-visual{min-height:300px!important}
}
@media(max-width:560px){
  header{height:56px!important;padding:0 14px!important}footer{height:62px!important;padding:0 14px!important}
  .slide{padding:14px 12px!important}
  .qmx-copy h2{font-size:clamp(27px,8.4vw,36px)!important}
  .qmx-copy p{font-size:14.5px!important}
  .qmx-visual{min-height:270px!important;height:270px!important}
  .qmx-points{grid-template-columns:1fr!important}
  .quiz-card,.final-card{padding:22px 18px!important}
  .quiz-options{grid-template-columns:1fr!important}
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
