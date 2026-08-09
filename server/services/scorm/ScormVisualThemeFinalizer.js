const JSZip = require('jszip');
const { buildScormPackageZip: buildFinalPackage } = require('./ScormExperienceFinalizer');

// Restores the original policy-to-scorm-engine "Modern Corporate" visual
// language while keeping the newer immersive layout and Mulish typography.
const PERFECT_THEME = {
    id: 1,
    name: 'Quizmoto Modern Corporate',
    primary: '#F97316',
    primaryDark: '#EA580C',
    accent: '#FDBA74',
    bg: '#0F172A',
    surface: '#FFFFFF',
    text: '#1E293B',
    muted: '#64748B',
    soft: '#FFF7ED',
    secondaryBg: '#F8FAFC'
};

const VISUAL_THEMES = { 1: PERFECT_THEME, 2: PERFECT_THEME, 3: PERFECT_THEME };
const MULISH_LINK = '<link id="quizmoto-mulish-font" rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Mulish:wght@400;500;600;700;800;900&display=swap">';

function templateCss(theme = PERFECT_THEME) {
    return `
<style id="quizmoto-scorm-policy-theme">
:root{--primary:${theme.primary}!important;--primary-dark:${theme.primaryDark}!important;--accent:${theme.accent}!important;--bg:${theme.bg}!important;--surface:${theme.surface}!important;--text:${theme.text}!important;--muted:${theme.muted}!important;--soft:${theme.soft}!important;--secondary-bg:${theme.secondaryBg}!important;--line:#E2E8F0!important}
*{box-sizing:border-box!important;text-shadow:none!important;font-family:"Mulish","Segoe UI",Arial,sans-serif!important}
html,body{background:${theme.bg}!important;color:${theme.text}!important;font-family:"Mulish","Segoe UI",Arial,sans-serif!important}
#app{background:${theme.surface}!important;background-image:none!important;overflow:hidden!important}
header{height:70px!important;padding:0 clamp(18px,2.4vw,38px)!important;background:${theme.primary}!important;color:#fff!important;border-bottom:0!important;box-shadow:0 2px 10px rgba(15,23,42,.12)!important}
footer{height:70px!important;padding:0 clamp(18px,2.4vw,38px)!important;background:${theme.secondaryBg}!important;color:${theme.text}!important;border-top:1px solid rgba(15,23,42,.06)!important;box-shadow:none!important}
.brand-mark{width:42px!important;height:42px!important;background:#fff!important;color:${theme.primary}!important;border:0!important;border-radius:12px!important;box-shadow:0 4px 14px rgba(15,23,42,.12)!important;font-weight:900!important}
header h1{font-size:clamp(14px,1.2vw,18px)!important;font-weight:900!important;letter-spacing:-.02em!important;color:#fff!important;max-width:min(54vw,780px)!important;white-space:nowrap!important;overflow:hidden!important;text-overflow:ellipsis!important}
.progress-shell{height:8px!important;max-width:440px!important;background:rgba(255,255,255,.24)!important;border:0!important;border-radius:999px!important;overflow:hidden!important}.progress-fill{background:${theme.accent}!important;background-image:none!important}.progress-text{color:#fff!important;font-weight:900!important}.part{color:#94A3B8!important;font-weight:900!important;letter-spacing:.08em!important}
.nav-btn{min-width:108px!important;padding:11px 18px!important;border-radius:12px!important;font-family:"Mulish","Segoe UI",Arial,sans-serif!important;font-size:13px!important;font-weight:900!important;box-shadow:none!important;transition:.18s ease!important;text-transform:none!important;letter-spacing:0!important}.nav-btn.primary{background:${theme.primary}!important;color:#fff!important;border:1px solid ${theme.primary}!important}.nav-btn.primary:hover{background:${theme.primaryDark}!important;border-color:${theme.primaryDark}!important;transform:translateY(-1px)!important}.nav-btn.secondary{background:#fff!important;color:#64748B!important;border:1px solid #E2E8F0!important}.nav-btn.secondary:hover{background:#FFF7ED!important;border-color:#FED7AA!important;color:${theme.primaryDark}!important}
main{height:calc(100vh - 140px)!important;min-height:0!important;overflow:hidden!important;background:${theme.surface}!important}.slide{height:100%!important;min-height:0!important;padding:clamp(18px,2.4vw,34px)!important;background:${theme.surface}!important;overflow:hidden!important}.slide.active{align-items:center!important;justify-content:center!important}
.qmx-copy h2,.final-card h1,.quiz-card h2,.title{color:${theme.text}!important;font-family:"Mulish","Segoe UI",Arial,sans-serif!important;font-weight:900!important}.qmx-copy-body p,.lead,.concept-card p,.step p,.milestone p,.compare-item,.hub-item,.qmx-detail,.qmx-prompt,.qmx-count{color:${theme.muted}!important}.qmx-kicker,.eyebrow,.step-no,.hub-item b{color:${theme.primary}!important;font-family:"Mulish","Segoe UI",Arial,sans-serif!important}
.qmx-point{font-family:"Mulish","Segoe UI",Arial,sans-serif!important}.qmx-point:hover,.qmx-point.active{background:${theme.primary}!important;color:#fff!important;border-color:${theme.primary}!important}.qmx-detail{background:#FFF7ED!important;color:#9A3412!important;border-color:#FED7AA!important}.qmx-badge{color:${theme.primaryDark}!important;background:rgba(255,255,255,.94)!important;border-color:#FED7AA!important}
.chip,.concept-number,.takeaway{background:#FFEDD5!important;color:#9A3412!important;border-color:${theme.primary}!important}.hero-art,.spot-visual{background:${theme.primary}!important;background-image:none!important;color:#fff!important}.timeline:before{background:${theme.primary}!important}.dot{border-color:${theme.primary}!important}
.quiz-option{font-family:"Mulish","Segoe UI",Arial,sans-serif!important;background:#fff!important;border-color:#F1F5F9!important}.quiz-option:hover{border-color:${theme.primary}!important;background:#FFFCF7!important}.quiz-option.correct{background:#F0FDF4!important;border:2px solid #22C55E!important;color:#166534!important}.quiz-option.incorrect{background:#FEF2F2!important;border:2px solid #EF4444!important;color:#991B1B!important}.feedback{border-radius:14px!important}
.final-card{background:${theme.primary}!important;color:#fff!important}.final-card h1,.final-card p{color:#fff!important}
@media(max-width:900px){main{height:auto!important;min-height:calc(100vh - 140px)!important;overflow:auto!important}.slide{height:auto!important;min-height:calc(100vh - 140px)!important;overflow:visible!important}}
@media(max-width:680px){header{height:58px!important;padding:0 11px!important}footer{height:60px!important;padding:0 11px!important}main{min-height:calc(100vh - 118px)!important}.slide{min-height:calc(100vh - 118px)!important;padding:11px!important}.brand-mark{width:34px!important;height:34px!important}.nav-btn{min-width:0!important;padding:9px 11px!important;font-size:11px!important}}
</style>`;
}

async function applyPolicyCourseTheme(buffer) {
    const zip = await JSZip.loadAsync(buffer);
    const indexFile = zip.file('index.html');
    if (!indexFile) return buffer;

    let html = await indexFile.async('string');
    html = html.replace(/<body([^>]*)>/i, (match, attrs) => {
        const cleaned = String(attrs || '').replace(/\sclass=("[^"]*"|'[^']*')/i, '');
        return `<body${cleaned} class="qmx-template qmx-template-policy-modern">`;
    });
    if (!html.includes('quizmoto-mulish-font')) {
        html = html.replace('</head>', `${MULISH_LINK}\n</head>`);
    }
    if (!html.includes('quizmoto-scorm-policy-theme')) {
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
    return applyPolicyCourseTheme(buffer);
}

module.exports = {
    buildScormPackageZip,
    VISUAL_THEMES,
    PERFECT_THEME,
    applyEditorialCourseTheme: applyPolicyCourseTheme,
    applyPolicyCourseTheme,
    templateCss
};