const JSZip = require('jszip');
const { buildScormPackageZip: buildFinalPackage } = require('./ScormExperienceFinalizer');

const VISUAL_THEMES = {
    1: {
        id: 1,
        name: 'Editorial Story',
        primary: '#123C2B',
        primaryDark: '#091C15',
        accent: '#B8F3CE',
        bg: '#F7F4EA',
        surface: '#FFFFFF',
        text: '#111111',
        muted: '#5F625B',
        soft: '#E9EEE7'
    },
    2: {
        id: 2,
        name: 'Immersive Canvas',
        primary: '#4F46E5',
        primaryDark: '#17133D',
        accent: '#C7D2FE',
        bg: '#F4F5FF',
        surface: '#FFFFFF',
        text: '#17172A',
        muted: '#65657A',
        soft: '#E9EAFE'
    },
    3: {
        id: 3,
        name: 'Executive Focus',
        primary: '#B4491F',
        primaryDark: '#24140E',
        accent: '#FFD9A8',
        bg: '#F8F5F0',
        surface: '#FFFFFF',
        text: '#211E1A',
        muted: '#71685F',
        soft: '#F1E8DD'
    }
};

function templateCss(theme, templateId) {
    const base = `
<style id="quizmoto-scorm-editorial-theme">
:root{--primary:${theme.primary}!important;--primary-dark:${theme.primaryDark}!important;--accent:${theme.accent}!important;--bg:${theme.bg}!important;--surface:${theme.surface}!important;--text:${theme.text}!important;--muted:${theme.muted}!important;--soft:${theme.soft}!important;--line:color-mix(in srgb,${theme.text} 18%,transparent)!important}
*{text-shadow:none!important}
html,body,#app{background:${theme.bg}!important;color:${theme.text}!important;font-family:Inter,"Segoe UI",Arial,sans-serif!important}
#app{background-image:none!important}
header,footer{background:color-mix(in srgb,${theme.bg} 94%,transparent)!important;color:${theme.text}!important;border-color:color-mix(in srgb,${theme.text} 24%,transparent)!important;backdrop-filter:blur(14px)}
.brand-mark{background:${theme.primary}!important;color:#fff!important;border:1px solid color-mix(in srgb,${theme.primaryDark} 40%,transparent)!important;border-radius:14px!important;box-shadow:0 8px 24px color-mix(in srgb,${theme.primary} 20%,transparent)!important}
.progress-shell{background:${theme.soft}!important;border:1px solid color-mix(in srgb,${theme.text} 14%,transparent)!important;border-radius:999px!important}.progress-fill{background:${theme.primary}!important;background-image:none!important}.progress-text,.part{color:${theme.muted}!important}
.nav-btn{border-radius:14px!important;font-family:inherit!important;font-weight:800!important}.nav-btn.primary{background:${theme.text}!important;color:${theme.bg}!important;border:1px solid ${theme.text}!important}.nav-btn.primary:hover{background:${theme.primary}!important;border-color:${theme.primary}!important;transform:translateY(-1px)!important}.nav-btn.secondary{background:${theme.bg}!important;color:${theme.text}!important;border:1px solid color-mix(in srgb,${theme.text} 45%,transparent)!important}.nav-btn.secondary:hover{background:${theme.accent}!important}
.slide{background:${theme.bg}!important}.qmx-stage{width:min(1480px,calc(100vw - 64px))!important}.qmx-frame{gap:32px!important;min-height:min(650px,calc(100vh - 220px));align-items:stretch!important}.qmx-copy,.qmx-visual,.glass,.concept-card,.step,.milestone p,.compare-col,.hub-item,.quiz-card,.quiz-option,.final-card{background:${theme.surface}!important;border:1px solid color-mix(in srgb,${theme.text} 15%,transparent)!important;box-shadow:0 18px 55px rgba(15,23,42,.07)!important}.qmx-copy,.qmx-visual{border-radius:30px!important}.qmx-copy{padding:clamp(28px,3.2vw,52px)!important}.qmx-visual{min-height:clamp(450px,58vh,680px)!important;padding:18px!important;background:${theme.soft}!important;overflow:hidden!important}.qmx-visual img{width:100%!important;height:100%!important;max-height:none!important;object-fit:contain!important;display:block!important;transform:scale(1.16);transform-origin:center center;filter:drop-shadow(0 18px 28px rgba(15,23,42,.08))}.qmx-badge{right:18px!important;top:18px!important;background:color-mix(in srgb,${theme.surface} 94%,transparent)!important;border:1px solid color-mix(in srgb,${theme.text} 28%,transparent)!important;color:${theme.text}!important;padding:8px 11px!important;border-radius:999px!important;box-shadow:none!important}
.qmx-kicker,.eyebrow,.step-no,.hub-item b{color:${theme.primary}!important;font-family:ui-monospace,SFMono-Regular,Menlo,monospace!important;letter-spacing:.07em!important}.title,.qmx-copy h2,.final-card h1,.quiz-card h2{font-family:"Arial Black","Helvetica Neue",Arial,sans-serif!important;color:${theme.text}!important;font-weight:900!important;letter-spacing:-.055em!important;line-height:.96!important}.qmx-copy h2{font-size:clamp(34px,3.6vw,58px)!important}.qmx-copy p{font-size:clamp(15px,1.25vw,19px)!important;line-height:1.62!important;color:${theme.muted}!important;max-width:60ch}.lead,.concept-card p,.step p,.milestone p,.compare-item,.hub-item,.qmx-detail,.qmx-prompt,.qmx-count{color:${theme.muted}!important;line-height:1.55!important}
.qmx-toolbar{margin-top:24px!important;gap:14px!important}.qmx-points{gap:9px!important}.qmx-point{background:${theme.surface}!important;color:${theme.muted}!important;border:1px solid color-mix(in srgb,${theme.text} 18%,transparent)!important;padding:9px 13px!important}.qmx-point:hover,.qmx-point.active{background:${theme.accent}!important;color:${theme.primaryDark}!important;border-color:${theme.primary}!important;transform:translateY(-2px)!important}.qmx-detail{margin-top:14px!important;padding:15px 17px!important;border-radius:16px!important;background:${theme.accent}!important;border:0!important;border-left:4px solid ${theme.primary}!important;color:${theme.primaryDark}!important}.qmx-prompt{font-size:11px!important;margin-top:12px!important}
.chip,.concept-number,.takeaway{background:${theme.accent}!important;color:${theme.primaryDark}!important;border-color:${theme.primary}!important}.hero-art,.spot-visual{background:${theme.primary}!important;background-image:none!important;color:#fff!important}.timeline:before{background:${theme.primary}!important}.dot{border-color:${theme.primary}!important}.quiz-option:hover{border-color:${theme.primary}!important;background:${theme.soft}!important}.quiz-option.correct{background:${theme.accent}!important;border:2px solid ${theme.primary}!important;color:${theme.primaryDark}!important}.feedback{border-radius:14px!important;background:${theme.accent}!important;color:${theme.primaryDark}!important;border:1px solid ${theme.primary}!important}
@media(max-width:980px){.qmx-stage{width:100%!important}.qmx-frame{grid-template-columns:1fr!important;min-height:0}.qmx-copy{padding:24px!important}.qmx-visual{min-height:340px!important}.qmx-copy h2{font-size:clamp(30px,7vw,44px)!important}}
@media(max-width:680px){header{height:54px!important;padding:0 12px!important}footer{height:56px!important;padding:0 12px!important}.slide{padding:12px!important}.qmx-copy{padding:18px!important}.qmx-visual{min-height:260px!important;padding:10px!important}.qmx-visual img{transform:scale(1.08)}.nav-btn{padding:9px 12px!important;font-size:12px!important}}
`;

    const variants = {
        1: `
body.qmx-template-1 .qmx-frame:not(.qmx-wide){grid-template-columns:minmax(330px,.76fr) minmax(620px,1.42fr)!important}
body.qmx-template-1 .qmx-copy{justify-content:center!important}
body.qmx-template-1 .qmx-visual{background:${theme.soft}!important}
`,
        2: `
body.qmx-template-2 .qmx-frame{grid-template-columns:1fr!important;grid-template-rows:minmax(500px,1.55fr) auto!important}
body.qmx-template-2 .qmx-visual{order:1!important;min-height:clamp(520px,62vh,720px)!important;background:linear-gradient(145deg,${theme.primaryDark},${theme.primary})!important;border:0!important}
body.qmx-template-2 .qmx-visual img{transform:scale(1.28);filter:drop-shadow(0 22px 34px rgba(0,0,0,.18))}
body.qmx-template-2 .qmx-copy{order:2!important;display:grid!important;grid-template-columns:minmax(220px,.8fr) minmax(360px,1.2fr)!important;column-gap:38px!important;align-items:start!important;padding:30px 38px!important}
body.qmx-template-2 .qmx-kicker,body.qmx-template-2 .qmx-copy h2{grid-column:1!important}.qmx-template-2 .qmx-copy p{grid-column:2!important;grid-row:1 / span 2!important}.qmx-template-2 .qmx-toolbar,.qmx-template-2 .qmx-detail,.qmx-template-2 .qmx-prompt{grid-column:1 / -1!important}
@media(max-width:980px){body.qmx-template-2 .qmx-copy{display:flex!important}body.qmx-template-2 .qmx-visual{min-height:360px!important}}
`,
        3: `
body.qmx-template-3 .qmx-frame:not(.qmx-wide){grid-template-columns:minmax(420px,.95fr) minmax(540px,1.05fr)!important}
body.qmx-template-3 .qmx-copy{border-left:8px solid ${theme.primary}!important}
body.qmx-template-3 .qmx-visual{background:linear-gradient(160deg,${theme.surface} 0%,${theme.soft} 100%)!important}
body.qmx-template-3 .qmx-visual img{transform:scale(1.22)}
body.qmx-template-3 .qmx-detail{background:${theme.soft}!important;color:${theme.text}!important}
`
    };

    return `${base}${variants[templateId] || variants[1]}</style>`;
}

async function applyEditorialCourseTheme(buffer, opts = {}) {
    const zip = await JSZip.loadAsync(buffer);
    const indexFile = zip.file('index.html');
    if (!indexFile) return buffer;

    const templateId = [1, 2, 3].includes(Number(opts.templateId)) ? Number(opts.templateId) : 1;
    const theme = VISUAL_THEMES[templateId] || VISUAL_THEMES[1];
    let html = await indexFile.async('string');

    html = html.replace(/<body([^>]*)>/i, (match, attrs) => {
        const cleaned = String(attrs || '').replace(/\sclass=("[^"]*"|'[^']*')/i, '');
        return `<body${cleaned} class="qmx-template qmx-template-${templateId}">`;
    });

    if (!html.includes('quizmoto-scorm-editorial-theme')) {
        html = html.replace('</head>', `${templateCss(theme, templateId)}\n</head>`);
    }
    zip.file('index.html', html);

    return zip.generateAsync({ type: 'nodebuffer', compression: 'STORE' });
}

async function buildScormPackageZip(rawAnalysis, opts = {}) {
    const templateId = [1, 2, 3].includes(Number(opts.templateId)) ? Number(opts.templateId) : 1;
    const visualTheme = VISUAL_THEMES[templateId] || VISUAL_THEMES[1];
    const analysis = {
        ...(rawAnalysis || {}),
        templateId,
        templateName: visualTheme.name,
        visualTheme
    };
    const buffer = await buildFinalPackage(analysis, { ...opts, templateId });
    return applyEditorialCourseTheme(buffer, { templateId });
}

module.exports = {
    buildScormPackageZip,
    VISUAL_THEMES,
    applyEditorialCourseTheme,
    templateCss
};