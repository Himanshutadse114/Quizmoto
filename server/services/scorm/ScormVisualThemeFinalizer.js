const JSZip = require('jszip');
const { buildScormPackageZip: buildFinalPackage } = require('./ScormExperienceFinalizer');

const CODA_INSPIRED_THEME = {
    primary: '#003D21',
    primaryDark: '#000000',
    accent: '#AAFDC0',
    bg: '#F8F9EB',
    surface: '#FFFFFF',
    text: '#000000',
    muted: '#5A5A4F',
    soft: '#EDEEE1'
};

// Layout/content template IDs remain intact, while all generated courses share
// one coherent Coda-inspired visual identity.
const VISUAL_THEMES = {
    1: { ...CODA_INSPIRED_THEME },
    3: { ...CODA_INSPIRED_THEME },
    4: { ...CODA_INSPIRED_THEME },
    5: { ...CODA_INSPIRED_THEME }
};

const EDITORIAL_COURSE_CSS = `
<style id="quizmoto-scorm-editorial-theme">
:root{--primary:#003D21!important;--primary-dark:#000000!important;--accent:#AAFDC0!important;--bg:#F8F9EB!important;--surface:#FFFFFF!important;--text:#000000!important;--muted:#5A5A4F!important;--soft:#EDEEE1!important;--line:#C0C2A9!important;--lilac:#D3BEFF!important;--sky:#B0F4FF!important;--rose:#FFC0E6!important}
*{text-shadow:none!important;box-shadow:none!important}
html,body,#app{background:#F8F9EB!important;color:#000!important;font-family:Arial,Helvetica,sans-serif!important}
#app{background-image:none!important}
header,footer{background:#F8F9EB!important;color:#000!important;border-color:#000!important;box-shadow:none!important}
.brand-mark{background:#003D21!important;color:#F8F9EB!important;border:1px solid #000!important;border-radius:13px!important;box-shadow:none!important}
.progress-shell{background:#EDEEE1!important;border:1px solid #C0C2A9!important;border-radius:999px!important}.progress-fill{background:#003D21!important;background-image:none!important}.progress-text,.part{color:#5A5A4F!important}
.nav-btn{border-radius:13px!important;font-family:Arial,Helvetica,sans-serif!important;font-weight:700!important}.nav-btn.primary{background:#000!important;color:#F8F9EB!important;border:1px solid #000!important}.nav-btn.primary:hover{background:#003D21!important;border-color:#003D21!important;transform:translateY(-1px)!important}.nav-btn.secondary{background:#F8F9EB!important;color:#000!important;border:1px solid #000!important}.nav-btn.secondary:hover{background:#AAFDC0!important}
.slide{background:#F8F9EB!important}.glass,.qmx-copy,.qmx-visual,.concept-card,.step,.milestone p,.compare-col,.hub-item,.quiz-card,.quiz-option,.final-card{background:#FFF!important;border:1px solid #C0C2A9!important;border-radius:22px!important;box-shadow:none!important}
.qmx-copy,.qmx-visual{border-radius:22px!important}.qmx-visual{background:#EDEEE1!important;background-image:none!important}.qmx-badge{background:#F8F9EB!important;border:1px solid #000!important;color:#000!important;box-shadow:none!important;border-radius:999px!important}
.eyebrow,.qmx-kicker,.step-no,.hub-item b{color:#003D21!important;font-family:ui-monospace,SFMono-Regular,Menlo,monospace!important;letter-spacing:.05em!important}.title,.qmx-copy h2,.final-card h1,.quiz-card h2{font-family:"Monument Grotesk","Arial Black","Helvetica Neue",Arial,sans-serif!important;color:#000!important;font-weight:800!important;letter-spacing:-.055em!important;line-height:.94!important}.lead,.qmx-copy p,.concept-card p,.step p,.milestone p,.compare-item,.hub-item,.qmx-detail,.qmx-prompt,.qmx-count{color:#5A5A4F!important;line-height:1.5!important}
.chip,.concept-number,.takeaway,.qmx-detail{background:#AAFDC0!important;color:#000!important;border-color:#000!important}.chip{border:1px solid #000!important}.concept-card:before{background:#003D21!important}
.hero-art,.spot-visual{background:#003D21!important;background-image:none!important;color:#F8F9EB!important;border:1px solid #000!important}.hero-art svg,.spot-visual svg{color:#F8F9EB!important;filter:none!important}.hero-art:before,.hero-art:after,.spot-visual:before{border-color:#AAFDC0!important;opacity:.42!important}
.step:not(:last-child):after{background:#000!important;color:#F8F9EB!important}.timeline:before{background:#003D21!important}.dot{background:#F8F9EB!important;border-color:#003D21!important;box-shadow:0 0 0 4px #AAFDC0!important}
.compare-col.good{background:#AAFDC0!important;border-top:1px solid #000!important}.compare-col.warn{background:#FFC0E6!important;border-top:1px solid #000!important}.compare-col.good .compare-title,.compare-col.warn .compare-title{color:#000!important}.good .badge-dot{background:#003D21!important}.warn .badge-dot{background:#3F0929!important}
.qmx-point{background:#F8F9EB!important;color:#5A5A4F!important;border:1px solid #C0C2A9!important;box-shadow:none!important}.qmx-point:hover,.qmx-point.active{background:#AAFDC0!important;color:#000!important;border-color:#000!important;transform:translateY(-1px)!important}
.quiz-option{box-shadow:none!important}.quiz-option:hover{border-color:#000!important;background:#F8F9EB!important}.quiz-option.correct{background:#AAFDC0!important;border:2px solid #000!important;color:#000!important}.quiz-option.incorrect{background:#FFC0E6!important;border:2px solid #3F0929!important;color:#3F0929!important;text-decoration:none!important}.feedback{border-radius:13px!important;background:#D3BEFF!important;color:#000!important;border:1px solid #000!important}
.score-ring{background:conic-gradient(#003D21 0deg,#AAFDC0 270deg,#EDEEE1 270deg)!important}.score-ring:before{background:#F8F9EB!important}.score-ring span{color:#000!important;font-family:"Arial Black",Arial,sans-serif!important}
@media(max-width:680px){header{height:54px!important;padding:0 12px!important}footer{height:56px!important;padding:0 12px!important}.slide{padding:12px!important}.title{font-size:clamp(25px,8vw,34px)!important;line-height:.94!important}.lead{font-size:13px!important}.qmx-copy{padding:16px!important}.qmx-visual{min-height:220px!important}.nav-btn{padding:9px 12px!important;font-size:12px!important}}
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
