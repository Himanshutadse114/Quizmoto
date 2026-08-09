const JSZip = require('jszip');
const { buildScormPackageZip: buildFinalPackage } = require('./ScormExperienceFinalizer');

// One intentionally opinionated course presentation. Historical template ids are
// accepted for rebuild compatibility, but all newly generated courses use this
// same premium learning canvas.
const PERFECT_THEME = {
    id: 1,
    name: 'Quizmoto Immersive Learning Canvas',
    primary: '#155E4B',
    primaryDark: '#0B2F27',
    accent: '#D9F99D',
    bg: '#F7F7F2',
    surface: '#FFFFFF',
    text: '#121714',
    muted: '#66706A',
    soft: '#EEF2EC'
};

const VISUAL_THEMES = { 1: PERFECT_THEME, 2: PERFECT_THEME, 3: PERFECT_THEME };

function templateCss(theme = PERFECT_THEME) {
    return `
<style id="quizmoto-scorm-editorial-theme">
:root{--primary:${theme.primary}!important;--primary-dark:${theme.primaryDark}!important;--accent:${theme.accent}!important;--bg:${theme.bg}!important;--surface:${theme.surface}!important;--text:${theme.text}!important;--muted:${theme.muted}!important;--soft:${theme.soft}!important;--line:#DDE3DD!important}
*{text-shadow:none!important;box-sizing:border-box!important}
html,body,#app{background:${theme.bg}!important;color:${theme.text}!important;font-family:Inter,"Segoe UI",Arial,sans-serif!important}
#app{background-image:none!important;overflow:hidden!important}
header{height:68px!important;padding:0 clamp(18px,2.6vw,42px)!important;background:rgba(247,247,242,.97)!important;color:${theme.text}!important;border-bottom:1px solid var(--line)!important;backdrop-filter:blur(12px)!important;box-shadow:none!important}
footer{height:72px!important;padding:0 clamp(18px,2.6vw,42px)!important;background:rgba(247,247,242,.98)!important;color:${theme.text}!important;border-top:1px solid var(--line)!important;backdrop-filter:blur(12px)!important;box-shadow:none!important}
.brand-mark{width:42px!important;height:42px!important;background:${theme.primary}!important;color:#fff!important;border:0!important;border-radius:13px!important;box-shadow:none!important}
header h1{font-size:clamp(14px,1.3vw,18px)!important;font-weight:800!important;letter-spacing:-.02em!important;max-width:min(48vw,720px)!important;white-space:nowrap!important;overflow:hidden!important;text-overflow:ellipsis!important}
.progress-shell{height:6px!important;max-width:430px!important;background:#E3E7E2!important;border:0!important;border-radius:999px!important}.progress-fill{background:${theme.primary}!important;background-image:none!important}.progress-text,.part{color:${theme.muted}!important;font-weight:800!important}
.nav-btn{min-width:104px!important;padding:11px 18px!important;border-radius:13px!important;font-family:inherit!important;font-size:14px!important;font-weight:800!important;box-shadow:none!important}.nav-btn.primary{background:${theme.text}!important;color:#fff!important;border:1px solid ${theme.text}!important}.nav-btn.primary:hover{background:${theme.primary}!important;border-color:${theme.primary}!important;transform:translateY(-1px)!important}.nav-btn.secondary{background:${theme.surface}!important;color:${theme.text}!important;border:1px solid #BFC8C1!important}.nav-btn.secondary:hover{background:${theme.soft}!important}
main{height:calc(100vh - 140px)!important;min-height:0!important;overflow:hidden!important}.slide{height:100%!important;min-height:0!important;padding:clamp(16px,2.2vw,30px)!important;background:${theme.bg}!important;overflow:hidden!important}.slide.active{align-items:center!important;justify-content:center!important}
.qmx-stage{width:min(1280px,100%)!important;height:100%!important;max-height:680px!important;margin:auto!important;min-height:0!important}
.qmx-scene{background:${theme.surface}!important;border-color:var(--line)!important;box-shadow:0 18px 50px rgba(18,23,20,.055)!important}
.qmx-copy{background:transparent!important;border:0!important;box-shadow:none!important}.qmx-copy h2{font-family:Inter,"Segoe UI",Arial,sans-serif!important;color:${theme.text}!important;font-weight:850!important}.qmx-copy p{color:${theme.muted}!important}.qmx-kicker{color:${theme.primary}!important}
.qmx-visual{background:linear-gradient(145deg,${theme.soft},#F7FAF6)!important;border-radius:0!important;box-shadow:none!important}.qmx-visual img,.qmx-visual svg{max-width:90%!important;max-height:88%!important;width:auto!important;height:auto!important;object-fit:contain!important;transform:none!important;filter:none!important}
.qmx-badge{background:rgba(255,255,255,.92)!important;border-color:#CED5CF!important;color:${theme.primaryDark}!important;box-shadow:none!important}.qmx-point{background:${theme.surface}!important;color:${theme.muted}!important;border-color:#CBD3CC!important}.qmx-point:hover,.qmx-point.active{background:${theme.accent}!important;color:${theme.primaryDark}!important;border-color:${theme.primary}!important}.qmx-detail{background:#F0F7E8!important;border-left-color:${theme.primary}!important;color:${theme.primaryDark}!important}.qmx-interaction{background:#FBFCF9!important;border-color:var(--line)!important}
.glass,.concept-card,.step,.milestone p,.compare-col,.hub-item,.quiz-card,.quiz-option,.final-card{background:${theme.surface}!important;border:1px solid var(--line)!important;box-shadow:none!important}.chip,.concept-number,.takeaway{background:${theme.accent}!important;color:${theme.primaryDark}!important;border-color:${theme.primary}!important}.hero-art,.spot-visual{background:${theme.primary}!important;background-image:none!important;color:#fff!important}.timeline:before{background:${theme.primary}!important}.dot{border-color:${theme.primary}!important}.quiz-option:hover{border-color:${theme.primary}!important;background:${theme.soft}!important}.quiz-option.correct{background:${theme.accent}!important;border:2px solid ${theme.primary}!important;color:${theme.primaryDark}!important}.feedback{border-radius:13px!important;background:#F0F7E8!important;color:${theme.primaryDark}!important;border:1px solid #D4E6C0!important}
@media(max-width:980px){#app{overflow:auto!important}main{height:auto!important;min-height:calc(100vh - 140px)!important;overflow:auto!important}.slide{height:auto!important;min-height:calc(100vh - 140px)!important;overflow:visible!important}.qmx-stage{height:auto!important;max-height:none!important}.qmx-copy{overflow:visible!important}.qmx-visual{min-height:300px!important}.qmx-visual img,.qmx-visual svg{max-width:92%!important;max-height:90%!important}}
@media(max-width:680px){header{height:56px!important;padding:0 12px!important}footer{height:58px!important;padding:0 12px!important}main{min-height:calc(100vh - 114px)!important}.slide{min-height:calc(100vh - 114px)!important;padding:10px!important}.brand-mark{width:34px!important;height:34px!important}.qmx-stage{width:100%!important}.qmx-visual{min-height:250px!important}.qmx-visual img,.qmx-visual svg{max-width:94%!important;max-height:92%!important}.nav-btn{min-width:0!important;padding:9px 11px!important;font-size:11px!important}}
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
