const JSZip = require('jszip');
const { buildScormPackageZip: buildFinalPackage } = require('./ScormExperienceFinalizer');

const PERFECT_THEME = {
    id: 1,
    name: 'Quizmoto Immersive Learning Canvas',
    primary: '#5147E8',
    primaryDark: '#2C267A',
    accent: '#E2DFFF',
    bg: '#F7F7FC',
    surface: '#FFFFFF',
    text: '#171923',
    muted: '#606675',
    soft: '#F0EFFF'
};

const VISUAL_THEMES = { 1: PERFECT_THEME, 2: PERFECT_THEME, 3: PERFECT_THEME };
const MULISH_LINK = '<link id="quizmoto-mulish-font" rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Mulish:wght@400;500;600;700;800;900&display=swap">';

function templateCss(theme = PERFECT_THEME) {
    return `
<style id="quizmoto-scorm-editorial-theme">
:root{--primary:${theme.primary}!important;--primary-dark:${theme.primaryDark}!important;--accent:${theme.accent}!important;--bg:${theme.bg}!important;--surface:${theme.surface}!important;--text:${theme.text}!important;--muted:${theme.muted}!important;--soft:${theme.soft}!important;--line:#E2E3EC!important}
*{box-sizing:border-box!important;text-shadow:none!important;font-family:"Mulish","Segoe UI",Arial,sans-serif!important}
html,body,#app{background:${theme.bg}!important;color:${theme.text}!important;font-family:"Mulish","Segoe UI",Arial,sans-serif!important}
#app{background-image:none!important;overflow:hidden!important}
header{height:62px!important;padding:0 clamp(18px,2.4vw,38px)!important;background:rgba(247,247,252,.96)!important;color:${theme.text}!important;border-bottom:1px solid var(--line)!important;backdrop-filter:blur(14px)!important;box-shadow:none!important}
footer{height:66px!important;padding:0 clamp(18px,2.4vw,38px)!important;background:rgba(247,247,252,.97)!important;color:${theme.text}!important;border-top:1px solid var(--line)!important;backdrop-filter:blur(14px)!important;box-shadow:none!important}
.brand-mark{width:40px!important;height:40px!important;background:${theme.primary}!important;color:#fff!important;border:0!important;border-radius:13px!important;box-shadow:0 5px 16px rgba(81,71,232,.16)!important;font-weight:900!important}
header h1{font-size:clamp(14px,1.2vw,18px)!important;font-weight:900!important;letter-spacing:-.025em!important;max-width:min(54vw,780px)!important;white-space:nowrap!important;overflow:hidden!important;text-overflow:ellipsis!important}
.progress-shell{height:6px!important;max-width:440px!important;background:#E6E6F0!important;border:0!important;border-radius:999px!important;overflow:hidden!important}.progress-fill{background:${theme.primary}!important;background-image:none!important}.progress-text,.part{color:${theme.muted}!important;font-weight:900!important;letter-spacing:.04em!important}
.nav-btn{min-width:104px!important;padding:10px 18px!important;border-radius:13px!important;font-family:"Mulish","Segoe UI",Arial,sans-serif!important;font-size:14px!important;font-weight:900!important;box-shadow:none!important;transition:.18s ease!important}.nav-btn.primary{background:${theme.text}!important;color:#fff!important;border:1px solid ${theme.text}!important}.nav-btn.primary:hover{background:${theme.primary}!important;border-color:${theme.primary}!important;transform:translateY(-1px)!important}.nav-btn.secondary{background:${theme.surface}!important;color:${theme.text}!important;border:1px solid #C9CBD7!important}.nav-btn.secondary:hover{background:${theme.soft}!important;border-color:#B9B7E9!important}
main{height:calc(100vh - 128px)!important;min-height:0!important;overflow:hidden!important}.slide{height:100%!important;min-height:0!important;padding:clamp(18px,2.4vw,34px)!important;background:${theme.bg}!important;overflow:hidden!important}.slide.active{align-items:center!important;justify-content:center!important}
.qmx-copy h2,.final-card h1,.quiz-card h2,.title{color:${theme.text}!important;font-family:"Mulish","Segoe UI",Arial,sans-serif!important;font-weight:900!important}.qmx-copy-body p,.lead,.concept-card p,.step p,.milestone p,.compare-item,.hub-item,.qmx-detail,.qmx-prompt,.qmx-count{color:${theme.muted}!important}.qmx-kicker,.eyebrow,.step-no,.hub-item b{color:${theme.primary}!important;font-family:"Mulish","Segoe UI",Arial,sans-serif!important}
.qmx-point{font-family:"Mulish","Segoe UI",Arial,sans-serif!important}.qmx-point:hover,.qmx-point.active{background:${theme.primary}!important;color:#fff!important;border-color:${theme.primary}!important}.qmx-detail{background:#F1F0FF!important;color:${theme.primaryDark}!important;border-color:#DDD9FF!important}.qmx-badge{color:${theme.primaryDark}!important}
.chip,.concept-number,.takeaway{background:${theme.accent}!important;color:${theme.primaryDark}!important;border-color:${theme.primary}!important}.hero-art,.spot-visual{background:${theme.primary}!important;background-image:none!important;color:#fff!important}.timeline:before{background:${theme.primary}!important}.dot{border-color:${theme.primary}!important}.quiz-option{font-family:"Mulish","Segoe UI",Arial,sans-serif!important}.quiz-option:hover{border-color:${theme.primary}!important;background:${theme.soft}!important}.quiz-option.correct{background:${theme.accent}!important;border:2px solid ${theme.primary}!important;color:${theme.primaryDark}!important}.feedback{border-radius:14px!important;background:#F0EFFF!important;color:${theme.primaryDark}!important;border:1px solid #D5D1FF!important}
@media(max-width:900px){main{height:auto!important;min-height:calc(100vh - 128px)!important;overflow:auto!important}.slide{height:auto!important;min-height:calc(100vh - 128px)!important;overflow:visible!important}}
@media(max-width:680px){header{height:56px!important;padding:0 11px!important}footer{height:58px!important;padding:0 11px!important}main{min-height:calc(100vh - 114px)!important}.slide{min-height:calc(100vh - 114px)!important;padding:11px!important}.brand-mark{width:34px!important;height:34px!important}.nav-btn{min-width:0!important;padding:9px 11px!important;font-size:11px!important}}
</style>`;
}

async function applyEditorialCourseTheme(buffer) {
    const zip = await JSZip.loadAsync(buffer);
    const indexFile = zip.file('index.html');
    if (!indexFile) return buffer;

    let html = await indexFile.async('string');
    html = html.replace(/<body([^>]*)>/i, (match, attrs) => {
        const cleaned = String(attrs || '').replace(/\sclass=("[^"]*"|'[^']*')/i, '');
        return `<body${cleaned} class="qmx-template qmx-template-1">`;
    });
    if (!html.includes('quizmoto-mulish-font')) {
        html = html.replace('</head>', `${MULISH_LINK}\n</head>`);
    }
    if (!html.includes('quizmoto-scorm-editorial-theme')) {
        html = html.replace('</head>', `${templateCss(PERFECT_THEME)}\n</head>`);
    }
    zip.file('index.html', html);
    return zip.generateAsync({ type: 'nodebuffer', compression: 'STORE' });
}

async function buildScormPackageZip(rawAnalysis, opts = {}) {
    const analysis = {
        ...(rawAnalysis || {}),
        templateId: 1,
        templateName: PERFECT_THEME.name,
        visualTheme: PERFECT_THEME
    };
    const buffer = await buildFinalPackage(analysis, { ...opts, templateId: 1 });
    return applyEditorialCourseTheme(buffer);
}

module.exports = {
    buildScormPackageZip,
    VISUAL_THEMES,
    PERFECT_THEME,
    applyEditorialCourseTheme,
    templateCss
};