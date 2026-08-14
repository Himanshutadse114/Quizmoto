const JSZip = require('jszip');
const { buildScormPackageZip: buildFinalPackage } = require('./ScormExperienceFinalizer');

/*
 * The learner shell stays consistently dark and high-contrast, while each
 * template keeps a distinct accent. SVG visuals intentionally receive a light
 * `soft` colour because their deterministic diagrams use dark ink on pale
 * cards; this gives the vector canvas maximum readability inside the dark UI.
 */
const VISUAL_THEMES = {
    1: {
        primary: '#2563EB',
        primaryDark: '#1D4ED8',
        accent: '#22D3EE',
        bg: '#05070D',
        surface: '#0B111B',
        text: '#F8FAFC',
        muted: '#94A3B8',
        soft: '#DBEAFE'
    },
    3: {
        primary: '#D97706',
        primaryDark: '#B45309',
        accent: '#FBBF24',
        bg: '#05070D',
        surface: '#0B111B',
        text: '#F8FAFC',
        muted: '#94A3B8',
        soft: '#FEF3C7'
    },
    4: {
        primary: '#059669',
        primaryDark: '#047857',
        accent: '#34D399',
        bg: '#05070D',
        surface: '#0B111B',
        text: '#F8FAFC',
        muted: '#94A3B8',
        soft: '#D1FAE5'
    },
    5: {
        primary: '#DB2777',
        primaryDark: '#BE185D',
        accent: '#F472B6',
        bg: '#05070D',
        surface: '#0B111B',
        text: '#F8FAFC',
        muted: '#94A3B8',
        soft: '#FCE7F3'
    }
};

const EDITORIAL_COURSE_CSS = `
<style id="quizmoto-scorm-editorial-theme">
:root{
  --bg:#05070D!important;
  --surface:#0B111B!important;
  --text:#F8FAFC!important;
  --muted:#94A3B8!important;
  --line:#1E2A3A!important;
  --qmx-surface:#0B111B;
  --qmx-surface-2:#101826;
  --qmx-surface-3:#131E2E;
  --qmx-line:#203047;
  --qmx-text:#F8FAFC;
  --qmx-body:#C3CEDD;
  --qmx-muted:#8494AA;
  --qmx-visual:#F7F9FC;
  --qmx-visual-line:#D9E1EA;
}
html,body,#app{
  background:#05070D!important;
  color:var(--qmx-text)!important;
  font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif!important;
}
#app{
  background:
    radial-gradient(circle at 78% -10%,rgba(37,99,235,.12),transparent 34rem),
    linear-gradient(180deg,#07101C 0%,#05070D 48%,#030509 100%)!important;
}
header,footer{
  background:rgba(5,7,13,.94)!important;
  color:var(--qmx-text)!important;
  border-color:#182536!important;
  box-shadow:0 1px 0 rgba(148,163,184,.05),0 12px 32px rgba(0,0,0,.18)!important;
  backdrop-filter:blur(18px);
  -webkit-backdrop-filter:blur(18px);
}
header{height:62px!important;padding:0 20px!important}
footer{height:66px!important;padding:0 22px!important}
header h1{font-size:13px!important;font-weight:700!important;color:#E8EEF7!important;letter-spacing:-.01em!important}
.brand-mark{
  width:36px!important;height:36px!important;border-radius:12px!important;
  background:linear-gradient(145deg,var(--primary),var(--primary-dark))!important;
  color:#FFF!important;border:1px solid rgba(255,255,255,.12)!important;
  box-shadow:0 8px 22px rgba(0,0,0,.24)!important;
}
.progress-shell{height:6px!important;background:#111B29!important;border:1px solid #1B2A3D!important;border-radius:999px!important}
.progress-fill{background:linear-gradient(90deg,var(--primary),var(--accent))!important;box-shadow:0 0 16px color-mix(in srgb,var(--primary) 34%,transparent)!important}
.progress-text,.part{color:#8696AC!important;font-size:11px!important;font-weight:700!important;letter-spacing:.04em!important}
.slide{
  background:transparent!important;
  padding:22px 28px!important;
  scrollbar-color:#334760 #08111C;
}
.stage,.qmx-stage{width:min(1280px,100%)!important}
.glass,.qmx-copy,.concept-card,.step,.milestone p,.compare-col,.hub-item,.quiz-card,.quiz-option,.final-card{
  background:linear-gradient(145deg,#0D1521 0%,#09111B 100%)!important;
  color:var(--qmx-text)!important;
  border:1px solid var(--qmx-line)!important;
  box-shadow:0 18px 54px rgba(0,0,0,.26),inset 0 1px 0 rgba(255,255,255,.025)!important;
}
.glass,.quiz-card,.final-card{border-radius:24px!important}
.qmx-copy{
  border-radius:24px!important;
  padding:30px!important;
}
.qmx-visual{
  background:
    radial-gradient(circle at 12% 10%,rgba(37,99,235,.06),transparent 20rem),
    linear-gradient(145deg,#FFFFFF 0%,var(--qmx-visual) 100%)!important;
  border:1px solid var(--qmx-visual-line)!important;
  border-radius:24px!important;
  box-shadow:0 20px 58px rgba(0,0,0,.30),inset 0 1px 0 rgba(255,255,255,.9)!important;
}
.qmx-visual img{filter:none!important}
.qmx-badge{
  background:rgba(7,12,20,.90)!important;
  color:#EAF2FF!important;
  border:1px solid #31445E!important;
  border-radius:999px!important;
  box-shadow:0 8px 22px rgba(0,0,0,.22)!important;
  backdrop-filter:blur(10px);
}
.eyebrow,.qmx-kicker,.step-no,.hub-item b{
  color:var(--accent)!important;
  font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace!important;
  font-size:11px!important;
  font-weight:700!important;
  letter-spacing:.09em!important;
}
.title,.qmx-copy h2,.final-card h1,.quiz-card h2{
  color:#F8FAFC!important;
  font-family:Inter,ui-sans-serif,system-ui,-apple-system,"Segoe UI",sans-serif!important;
  font-weight:750!important;
  letter-spacing:-.045em!important;
  line-height:1.02!important;
}
.lead,.qmx-copy p,.concept-card p,.step p,.milestone p,.compare-item,.hub-item{
  color:var(--qmx-body)!important;
  line-height:1.65!important;
}
.lead,.qmx-copy p{font-size:16px!important}
.qmx-detail{
  background:#101C2C!important;
  color:#D7E1EE!important;
  border:1px solid #243752!important;
  border-left:3px solid var(--primary)!important;
  box-shadow:none!important;
  font-size:14px!important;
  line-height:1.55!important;
}
.qmx-prompt,.qmx-count{color:var(--qmx-muted)!important}
.chip,.concept-number,.takeaway{
  background:#101C2C!important;
  color:#D9E8FF!important;
  border:1px solid #263A55!important;
  box-shadow:none!important;
}
.chip{font-size:12px!important;font-weight:650!important}
.concept-card:before{background:linear-gradient(180deg,var(--primary),var(--accent))!important}
.hero{gap:30px!important;padding:34px!important}
.hero-art,.spot-visual{
  background:
    radial-gradient(circle at 28% 22%,color-mix(in srgb,var(--accent) 46%,transparent),transparent 34%),
    linear-gradient(145deg,var(--primary),var(--primary-dark))!important;
  color:#FFF!important;
  border:1px solid rgba(255,255,255,.10)!important;
  box-shadow:0 18px 50px rgba(0,0,0,.26)!important;
}
.hero-core svg{width:210px!important;height:210px!important}
.spot-visual svg{width:210px!important;height:210px!important}
.hero-art:before,.hero-art:after,.spot-visual:before{border-color:rgba(255,255,255,.16)!important}
.step:not(:last-child):after{background:var(--primary)!important;color:#FFF!important;box-shadow:0 5px 14px rgba(0,0,0,.22)!important}
.timeline:before{background:linear-gradient(90deg,var(--primary),var(--accent))!important}.dot{background:#08111C!important;border-color:var(--primary)!important;box-shadow:0 0 0 4px #13233A!important}
.compare-col.good{background:#0B211B!important;border-top:4px solid #34D399!important}.compare-col.warn{background:#251019!important;border-top:4px solid #FB7185!important}.compare-col.good .compare-title{color:#6EE7B7!important}.compare-col.warn .compare-title{color:#FDA4AF!important}.good .badge-dot{background:#059669!important}.warn .badge-dot{background:#BE123C!important}
.qmx-point{
  background:#0C1623!important;color:#AFC0D4!important;border:1px solid #263A54!important;
  border-radius:11px!important;padding:9px 12px!important;font-size:12px!important;font-weight:700!important;
  box-shadow:none!important;
}
.qmx-point:hover,.qmx-point:focus-visible,.qmx-point.active{
  background:#132541!important;color:#FFF!important;border-color:var(--primary)!important;transform:translateY(-1px)!important;
}
.qmx-point.explored:not(.active){border-color:#31506F!important;color:#CFE0F2!important}
.quiz-wrap{max-width:920px!important}.quiz-card{padding:32px!important}.quiz-options{gap:12px!important}.quiz-option{
  background:#0A131F!important;color:#DCE6F2!important;border:1px solid #26374D!important;
  border-radius:15px!important;padding:16px!important;min-height:64px!important;font-size:14px!important;font-weight:650!important;
  box-shadow:none!important;
}
.quiz-option:hover:not(:disabled){background:#101E31!important;border-color:#47709C!important;transform:translateY(-1px)!important}
.quiz-option.correct{background:#0A2B23!important;border:1px solid #238568!important;color:#B7F7DF!important}.quiz-option.incorrect{background:#32131D!important;border:1px solid #9F3550!important;color:#FFD1DB!important;text-decoration:none!important}
.feedback{
  border-radius:14px!important;background:#101D31!important;color:#DCE8F6!important;
  border:1px solid #2B4568!important;padding:14px 16px!important;text-align:left!important;
  font-size:13px!important;line-height:1.55!important;font-weight:650!important;
}
.final-card{padding:38px!important}.score-ring{background:conic-gradient(var(--primary) 0deg,var(--accent) 270deg,#172335 270deg)!important}.score-ring:before{background:#09111B!important}.score-ring span{color:#F8FAFC!important;font-weight:800!important}
.nav-btn{
  min-height:42px!important;border-radius:12px!important;padding:10px 16px!important;
  font-weight:700!important;transition:transform .18s ease,border-color .18s ease,background .18s ease!important;
}
.nav-btn.primary{background:linear-gradient(135deg,var(--primary),var(--primary-dark))!important;color:#FFF!important;border:1px solid color-mix(in srgb,var(--primary) 72%,#FFF)!important;box-shadow:0 8px 22px color-mix(in srgb,var(--primary) 22%,transparent)!important}
.nav-btn.primary:hover{transform:translateY(-1px)!important;filter:brightness(1.08)}
.nav-btn.secondary{background:#0A131F!important;color:#C3D0DF!important;border:1px solid #28394F!important;box-shadow:none!important}.nav-btn.secondary:hover{background:#101D2C!important;border-color:#45617F!important;color:#FFF!important}
button:focus-visible,.nav-btn:focus-visible,.quiz-option:focus-visible,.qmx-point:focus-visible{outline:3px solid color-mix(in srgb,var(--accent) 60%,#FFF)!important;outline-offset:3px!important}
@media(max-width:900px){
  .slide{padding:18px!important}.hero{padding:24px!important}.qmx-copy{padding:22px!important}.lead,.qmx-copy p{font-size:15px!important}.qmx-visual{min-height:340px!important}.hero-core svg,.spot-visual svg{width:180px!important;height:180px!important}
}
@media(max-width:680px){
  header{height:56px!important;padding:0 12px!important;gap:9px!important}footer{height:60px!important;padding:0 12px!important}.slide{padding:12px!important}.progress-shell{max-width:120px!important}.progress-text{display:none!important}.title{font-size:clamp(25px,8vw,34px)!important;line-height:1.02!important}.lead,.qmx-copy p{font-size:14px!important}.qmx-copy{padding:18px!important}.qmx-visual{min-height:270px!important;border-radius:18px!important}.quiz-card,.final-card{padding:22px!important}.quiz-options{grid-template-columns:1fr!important}.nav-btn{padding:9px 12px!important;font-size:12px!important}.part{font-size:9px!important}
}
@media(max-height:720px) and (min-width:901px){
  .slide{padding-top:14px!important;padding-bottom:14px!important}.qmx-visual{min-height:350px!important}.qmx-copy{padding:22px!important}.lead,.qmx-copy p{font-size:14px!important;line-height:1.55!important}.hero-art,.spot-visual{min-height:285px!important;height:285px!important}
}
@media(prefers-reduced-motion:reduce){
  *,*::before,*::after{scroll-behavior:auto!important;animation-duration:.01ms!important;animation-iteration-count:1!important;transition-duration:.01ms!important}
}
</style>`;

async function applyEditorialCourseTheme(buffer) {
    const zip = await JSZip.loadAsync(buffer);
    const indexFile = zip.file('index.html');
    if (!indexFile) return buffer;

    let html = await indexFile.async('string');
    if (!html.includes('quizmoto-scorm-editorial-theme')) {
        html = html.replace('</head>', `${EDITORIAL_COURSE_CSS}\n</head>`);
        zip.file('index.html', html);
    }

    // This remains an intermediate package. The tracking finalizer performs the
    // single compressed output pass after all HTML/runtime patches are complete.
    return zip.generateAsync({ type: 'nodebuffer', compression: 'STORE' });
}

async function buildScormPackageZip(rawAnalysis, opts = {}) {
    const templateId = Number(opts.templateId) || 1;
    const visualTheme = VISUAL_THEMES[templateId] || VISUAL_THEMES[1];
    const analysis = {
        ...(rawAnalysis || {}),
        visualTheme
    };
    const buffer = await buildFinalPackage(analysis, { ...opts, templateId });
    return applyEditorialCourseTheme(buffer);
}

module.exports = {
    buildScormPackageZip,
    VISUAL_THEMES,
    applyEditorialCourseTheme,
    EDITORIAL_COURSE_CSS
};
