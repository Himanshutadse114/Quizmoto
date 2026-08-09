const JSZip = require('jszip');
const { buildScormPackageZip: buildFinalPackage } = require('./ScormExperienceFinalizer');

const PERFECT_THEME = {
    id: 1,
    name: 'Quizmoto Immersive Learning Canvas',
    primary: '#4F46E5',
    primaryDark: '#29236E',
    accent: '#DDD9FF',
    bg: '#F7F7FC',
    surface: '#FFFFFF',
    text: '#15161C',
    muted: '#666A77',
    soft: '#EFEFFD'
};

const VISUAL_THEMES = { 1: PERFECT_THEME, 2: PERFECT_THEME, 3: PERFECT_THEME };

function templateCss(theme = PERFECT_THEME) {
    return `
<style id="quizmoto-scorm-editorial-theme">
:root{--primary:${theme.primary}!important;--primary-dark:${theme.primaryDark}!important;--accent:${theme.accent}!important;--bg:${theme.bg}!important;--surface:${theme.surface}!important;--text:${theme.text}!important;--muted:${theme.muted}!important;--soft:${theme.soft}!important;--line:#E2E3EC!important}
*{box-sizing:border-box!important;text-shadow:none!important}
html,body,#app{background:${theme.bg}!important;color:${theme.text}!important;font-family:Inter,"Segoe UI",Arial,sans-serif!important}
#app{background-image:none!important;overflow:hidden!important}
header{height:64px!important;padding:0 clamp(16px,2.5vw,38px)!important;background:rgba(247,247,252,.96)!important;color:${theme.text}!important;border-bottom:1px solid var(--line)!important;backdrop-filter:blur(14px)!important;box-shadow:none!important}
footer{height:68px!important;padding:0 clamp(16px,2.5vw,38px)!important;background:rgba(247,247,252,.97)!important;color:${theme.text}!important;border-top:1px solid var(--line)!important;backdrop-filter:blur(14px)!important;box-shadow:none!important}
.brand-mark{width:40px!important;height:40px!important;background:${theme.primary}!important;color:#fff!important;border:0!important;border-radius:12px!important;box-shadow:none!important}
header h1{font-size:clamp(14px,1.25vw,18px)!important;font-weight:800!important;letter-spacing:-.025em!important;max-width:min(52vw,760px)!important;white-space:nowrap!important;overflow:hidden!important;text-overflow:ellipsis!important}
.progress-shell{height:6px!important;max-width:430px!important;background:#E5E5F0!important;border:0!important;border-radius:999px!important}.progress-fill{background:${theme.primary}!important;background-image:none!important}.progress-text,.part{color:${theme.muted}!important;font-weight:800!important}
.nav-btn{min-width:100px!important;padding:10px 17px!important;border-radius:12px!important;font-family:inherit!important;font-size:14px!important;font-weight:800!important;box-shadow:none!important}.nav-btn.primary{background:${theme.text}!important;color:#fff!important;border:1px solid ${theme.text}!important}.nav-btn.primary:hover{background:${theme.primary}!important;border-color:${theme.primary}!important;transform:translateY(-1px)!important}.nav-btn.secondary{background:${theme.surface}!important;color:${theme.text}!important;border:1px solid #C9CAD5!important}.nav-btn.secondary:hover{background:${theme.soft}!important}
main{height:calc(100vh - 132px)!important;min-height:0!important;overflow:hidden!important}.slide{height:100%!important;min-height:0!important;padding:clamp(14px,2.2vw,30px)!important;background:${theme.bg}!important;overflow:hidden!important}.slide.active{align-items:center!important;justify-content:center!important}
.qmx-scene{background:${theme.surface}!important;border-color:var(--line)!important}.qmx-copy{background:transparent!important}.qmx-visual{background:linear-gradient(145deg,#F3F3FF 0%,#ECECFC 100%)!important}.qmx-copy h2,.final-card h1,.quiz-card h2{color:${theme.text}!important;font-family:Inter,"Segoe UI",Arial,sans-serif!important;font-weight:850!important}.qmx-copy-body p,.lead,.concept-card p,.step p,.milestone p,.compare-item,.hub-item,.qmx-detail,.qmx-prompt,.qmx-count{color:${theme.muted}!important}.qmx-kicker,.eyebrow,.step-no,.hub-item b{color:${theme.primary}!important}
.qmx-point{background:${theme.surface}!important;color:${theme.muted}!important;border-color:#D6D7E0!important}.qmx-point:hover,.qmx-point.active{background:${theme.accent}!important;color:${theme.primaryDark}!important;border-color:${theme.primary}!important}.qmx-detail{background:#F0EFFF!important;color:${theme.primaryDark}!important;border-left-color:${theme.primary}!important}.qmx-badge{color:${theme.primaryDark}!important}
.chip,.concept-number,.takeaway{background:${theme.accent}!important;color:${theme.primaryDark}!important;border-color:${theme.primary}!important}.hero-art,.spot-visual{background:${theme.primary}!important;background-image:none!important;color:#fff!important}.timeline:before{background:${theme.primary}!important}.dot{border-color:${theme.primary}!important}.quiz-option:hover{border-color:${theme.primary}!important;background:${theme.soft}!important}.quiz-option.correct{background:${theme.accent}!important;border:2px solid ${theme.primary}!important;color:${theme.primaryDark}!important}.feedback{border-radius:13px!important;background:#F0EFFF!important;color:${theme.primaryDark}!important;border:1px solid #D5D1FF!important}
@media(max-width:900px){main{height:auto!important;min-height:calc(100vh - 132px)!important;overflow:auto!important}.slide{height:auto!important;min-height:calc(100vh - 132px)!important;overflow:visible!important}}
@media(max-width:680px){header{height:56px!important;padding:0 11px!important}footer{height:58px!important;padding:0 11px!important}main{min-height:calc(100vh - 114px)!important}.slide{min-height:calc(100vh - 114px)!important;padding:9px!important}.brand-mark{width:34px!important;height:34px!important}.nav-btn{min-width:0!important;padding:9px 11px!important;font-size:11px!important}}
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