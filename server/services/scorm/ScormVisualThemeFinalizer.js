const JSZip = require('jszip');
const { buildScormPackageZip: buildFinalPackage } = require('./ScormExperienceFinalizer');

const INK = '#111111';
const PAPER = '#F4F0E6';

// SCORM World intentionally uses one high-contrast two-colour identity.
// Template IDs still select layouts/content structures, but not extra colours.
const VISUAL_THEMES = {
    1: { primary: INK, primaryDark: INK, accent: PAPER, bg: PAPER, surface: PAPER, text: INK, muted: INK, soft: PAPER },
    3: { primary: INK, primaryDark: INK, accent: PAPER, bg: PAPER, surface: PAPER, text: INK, muted: INK, soft: PAPER },
    4: { primary: INK, primaryDark: INK, accent: PAPER, bg: PAPER, surface: PAPER, text: INK, muted: INK, soft: PAPER },
    5: { primary: INK, primaryDark: INK, accent: PAPER, bg: PAPER, surface: PAPER, text: INK, muted: INK, soft: PAPER }
};

const EDITORIAL_COURSE_CSS = `
<style id="quizmoto-scorm-editorial-theme">
:root{--primary:#111111!important;--primary-dark:#111111!important;--accent:#F4F0E6!important;--bg:#F4F0E6!important;--surface:#F4F0E6!important;--text:#111111!important;--muted:#111111!important;--soft:#F4F0E6!important;--line:#111111!important;--shadow:none!important}
*{box-shadow:none!important;text-shadow:none!important}
html,body,#app,main,.slide,.stage,.glass,.qmx-copy,.qmx-visual,.concept-card,.step,.milestone p,.compare-col,.hub-item,.quiz-card,.quiz-option,.final-card,.qmx-point,.qmx-detail,.qmx-badge{background:#F4F0E6!important;background-image:none!important;color:#111111!important;border-color:#111111!important}
header,footer{background:#F4F0E6!important;color:#111111!important;border-color:#111111!important;box-shadow:none!important}
header{border-bottom:2px solid #111111!important}footer{border-top:2px solid #111111!important}
.brand-mark,.nav-btn.primary,.progress-fill,.hero-art,.spot-visual,.step:not(:last-child):after,.good .badge-dot,.warn .badge-dot{background:#111111!important;background-image:none!important;color:#F4F0E6!important;border-color:#111111!important}
.brand-mark *,.nav-btn.primary *,.hero-art *,.spot-visual *,.step:not(:last-child):after{color:#F4F0E6!important}
.nav-btn.secondary{background:#F4F0E6!important;color:#111111!important;border:2px solid #111111!important}
.progress-shell{background:#F4F0E6!important;border:2px solid #111111!important;border-radius:0!important}.progress-fill{border-radius:0!important}
.eyebrow,.title,.lead,.part,.progress-text,.chip,.concept-number,.concept-card p,.step-no,.step p,.milestone p,.compare-title,.compare-item,.hub-item,.hub-item b,.takeaway,.quiz-option,.score-ring span,.qmx-kicker,.qmx-copy h2,.qmx-copy p,.qmx-count,.qmx-detail,.qmx-prompt,.qmx-badge,.qmx-fallback{color:#111111!important}
.chip,.concept-number,.takeaway,.qmx-detail{background:#F4F0E6!important;border:2px solid #111111!important}
.hero-art:before,.hero-art:after,.spot-visual:before{border-color:#F4F0E6!important;background:transparent!important}
.timeline:before{background:#111111!important}.dot{background:#F4F0E6!important;border-color:#111111!important;box-shadow:none!important}
.compare-col.good,.compare-col.warn{border-top:6px solid #111111!important}.compare-col.good .compare-title,.compare-col.warn .compare-title{color:#111111!important}
.quiz-option.correct{background:#F4F0E6!important;border:4px solid #111111!important}.quiz-option.incorrect{background:#F4F0E6!important;border:2px solid #111111!important;text-decoration:line-through}
.feedback{background:#111111!important;color:#F4F0E6!important;border:2px solid #111111!important}
.score-ring{background:#111111!important}.score-ring:before{background:#F4F0E6!important}
.qmx-point:hover,.qmx-point.active{background:#111111!important;color:#F4F0E6!important;border-color:#111111!important;transform:none!important}.qmx-point:hover *,.qmx-point.active *{color:#F4F0E6!important}
.qmx-visual{background:#F4F0E6!important}.qmx-badge{border-radius:0!important}.qmx-copy,.qmx-visual,.glass,.concept-card,.step,.compare-col,.hub-item,.quiz-card,.quiz-option,.qmx-detail{border-radius:6px!important}
.nav-btn{border-radius:0!important}.brand-mark{border-radius:0!important}.chip,.qmx-point{border-radius:0!important}
h1,h2,h3,.title,.qmx-copy h2{text-transform:uppercase!important;font-weight:900!important;letter-spacing:-.04em!important}
@media(max-width:680px){header{height:54px!important;padding:0 12px!important}footer{height:56px!important;padding:0 12px!important}.slide{padding:12px!important}.title{font-size:clamp(24px,8vw,34px)!important}.lead{font-size:13px!important}.qmx-copy{padding:16px!important}.qmx-visual{min-height:220px!important}.nav-btn{padding:9px 12px!important;font-size:12px!important}}
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
