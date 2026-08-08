const JSZip = require('jszip');
const { buildScormPackageZip: buildFinalPackage } = require('./ScormExperienceFinalizer');

const LIVE_QUIZ_THEME = {
    primary: '#46178F',
    primaryDark: '#25076B',
    accent: '#864CBF',
    bg: '#F8F5FB',
    surface: '#FFFFFF',
    text: '#111111',
    muted: '#6B6474',
    soft: '#F2ECFA'
};

// Template IDs still control layout/content structure, but all generated courses
// share one Quizmoto visual identity with Live Quiz.
const VISUAL_THEMES = {
    1: { ...LIVE_QUIZ_THEME },
    3: { ...LIVE_QUIZ_THEME },
    4: { ...LIVE_QUIZ_THEME },
    5: { ...LIVE_QUIZ_THEME }
};

const EDITORIAL_COURSE_CSS = `
<style id="quizmoto-scorm-editorial-theme">
:root{--primary:#46178F!important;--primary-dark:#25076B!important;--accent:#864CBF!important;--bg:#F8F5FB!important;--surface:#FFFFFF!important;--text:#111111!important;--muted:#6B6474!important;--soft:#F2ECFA!important;--line:#DED3EC!important;--shadow:0 8px 24px rgba(37,7,107,.10)!important}
*{text-shadow:none!important}
html,body,#app{background:#F8F5FB!important;color:#111111!important}
#app{background-image:none!important}
header,footer{background:#FFFFFF!important;color:#111111!important;border-color:#DED3EC!important;box-shadow:none!important}
.brand-mark{background:#46178F!important;color:#FFFFFF!important;border-radius:12px!important;box-shadow:none!important}
.progress-shell{background:#E8E0F1!important;border-radius:999px!important}.progress-fill{background:#46178F!important;background-image:none!important}.progress-text,.part{color:#6B6474!important}
.nav-btn{border-radius:10px!important}.nav-btn.primary{background:#46178F!important;color:#FFFFFF!important;box-shadow:none!important}.nav-btn.primary:hover{background:#25076B!important;box-shadow:none!important;transform:translateY(-1px)!important}.nav-btn.secondary{background:#FFFFFF!important;color:#46178F!important;border:1px solid #DED3EC!important}
.slide{background:#F8F5FB!important}.glass,.qmx-copy,.qmx-visual,.concept-card,.step,.milestone p,.compare-col,.hub-item,.quiz-card,.quiz-option,.final-card{background:#FFFFFF!important;border:1px solid #DED3EC!important;border-radius:18px!important;box-shadow:0 4px 14px rgba(17,17,17,.06)!important}
.qmx-copy,.qmx-visual{border-radius:20px!important}.qmx-visual{background:#F2ECFA!important;background-image:none!important}.qmx-badge{background:#FFFFFF!important;border:1px solid #DED3EC!important;color:#46178F!important;box-shadow:none!important}
.eyebrow,.qmx-kicker,.step-no,.hub-item b{color:#46178F!important}.title,.qmx-copy h2{color:#111111!important;font-weight:800!important;letter-spacing:-.035em!important}.lead,.qmx-copy p,.concept-card p,.step p,.milestone p,.compare-item,.hub-item,.qmx-detail,.qmx-prompt,.qmx-count{color:#6B6474!important}
.chip,.concept-number,.takeaway,.qmx-detail{background:#F2ECFA!important;color:#46178F!important;border-color:#DED3EC!important}.chip{border:1px solid #DED3EC!important}.concept-card:before{background:#46178F!important}
.hero-art,.spot-visual{background:#F2ECFA!important;background-image:none!important;color:#46178F!important;border:1px solid #DED3EC!important}.hero-art svg,.spot-visual svg{color:#46178F!important;filter:none!important}.hero-art:before,.hero-art:after,.spot-visual:before{border-color:#864CBF!important;opacity:.28!important}
.step:not(:last-child):after{background:#46178F!important;color:#FFFFFF!important}.timeline:before{background:#864CBF!important}.dot{background:#FFFFFF!important;border-color:#46178F!important;box-shadow:0 0 0 4px #F2ECFA!important}
.compare-col.good,.compare-col.warn{border-top:4px solid #46178F!important}.compare-col.good .compare-title,.compare-col.warn .compare-title{color:#46178F!important}.good .badge-dot,.warn .badge-dot{background:#46178F!important;color:#FFFFFF!important}
.qmx-point{background:#FFFFFF!important;color:#6B6474!important;border:1px solid #DED3EC!important;box-shadow:none!important}.qmx-point:hover,.qmx-point.active{background:#F2ECFA!important;color:#46178F!important;border-color:#864CBF!important;transform:translateY(-1px)!important}
.quiz-option{box-shadow:none!important}.quiz-option:hover{border-color:#46178F!important}.quiz-option.correct{background:#F2ECFA!important;border:2px solid #46178F!important;color:#25076B!important}.quiz-option.incorrect{background:#FFFFFF!important;border:2px dashed #111111!important;color:#111111!important;text-decoration:none!important;opacity:.78!important}.feedback{border-radius:12px!important;background:#F2ECFA!important;color:#25076B!important;border:1px solid #864CBF!important}
.score-ring{background:conic-gradient(#46178F 0deg,#864CBF 270deg,#E8E0F1 270deg)!important}.score-ring:before{background:#FFFFFF!important}.score-ring span{color:#25076B!important}
@media(max-width:680px){header{height:54px!important;padding:0 12px!important}footer{height:56px!important;padding:0 12px!important}.slide{padding:12px!important}.title{font-size:clamp(23px,7.5vw,32px)!important}.lead{font-size:13px!important}.qmx-copy{padding:16px!important}.qmx-visual{min-height:220px!important}.nav-btn{padding:9px 12px!important;font-size:12px!important}}
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

    return zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
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
