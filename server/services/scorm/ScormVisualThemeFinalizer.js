const JSZip = require('jszip');
const { buildScormPackageZip: buildFinalPackage } = require('./ScormExperienceFinalizer');
const { THEMES, getTheme, normalizeThemeId } = require('./ScormThemeCatalog');

const EDITORIAL_COURSE_CSS = `
<style id="quizmoto-scorm-editorial-theme-v5">
:root{
  --bg:#030712;--bg-2:#071426;--surface:#0A1322;--surface-2:#0E1B2E;
  --text:#F8FAFC;--body:#C7D2E1;--muted:#8798AE;--line:#243751;
  --primary:#3B82F6;--primary-dark:#1D4ED8;--accent:#22D3EE;--accent-2:#60A5FA;
  --visual-bg:#07172B;--visual-bg-2:#0B2340;--visual-card:#102A49;
  --visual-card-2:#0D2038;--visual-text:#F4F9FF;--visual-muted:#A9C2DE;
  --soft:#173A63;--glow:#2563EB;
}
*{box-sizing:border-box}
html,body,#app{background:var(--bg)!important;color:var(--text)!important;font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif!important}
body{margin:0}
#app{
  background:
    radial-gradient(circle at 86% -8%,color-mix(in srgb,var(--glow) 18%,transparent),transparent 34rem),
    radial-gradient(circle at -8% 88%,color-mix(in srgb,var(--accent) 8%,transparent),transparent 30rem),
    linear-gradient(180deg,var(--bg-2) 0%,var(--bg) 52%,color-mix(in srgb,var(--bg) 88%,#000) 100%)!important;
}
header,footer{
  background:color-mix(in srgb,var(--bg) 92%,transparent)!important;color:var(--text)!important;
  border-color:color-mix(in srgb,var(--line) 78%,transparent)!important;
  box-shadow:0 1px 0 rgba(255,255,255,.035),0 16px 42px rgba(0,0,0,.22)!important;
  backdrop-filter:blur(18px);-webkit-backdrop-filter:blur(18px)
}
header{height:64px!important;padding:0 22px!important}footer{height:68px!important;padding:0 24px!important}
header h1{font-size:13px!important;font-weight:720!important;color:color-mix(in srgb,var(--text) 92%,transparent)!important;letter-spacing:-.01em!important}
.brand-mark{width:38px!important;height:38px!important;border-radius:13px!important;background:linear-gradient(145deg,var(--primary),var(--primary-dark))!important;color:#fff!important;border:1px solid rgba(255,255,255,.14)!important;box-shadow:0 9px 24px color-mix(in srgb,var(--primary) 20%,rgba(0,0,0,.4))!important}
.progress-shell{height:6px!important;background:color-mix(in srgb,var(--surface-2) 90%,#000)!important;border:1px solid var(--line)!important;border-radius:999px!important}
.progress-fill{background:linear-gradient(90deg,var(--primary),var(--accent))!important;box-shadow:0 0 18px color-mix(in srgb,var(--primary) 35%,transparent)!important}
.progress-text,.part{color:var(--muted)!important;font-size:11px!important;font-weight:700!important;letter-spacing:.035em!important}
.slide{background:transparent!important;padding:24px 30px!important;scrollbar-color:color-mix(in srgb,var(--line) 90%,#fff) var(--bg)}
.stage,.qmx-stage{width:min(1280px,100%)!important}
.glass,.qmx-copy,.concept-card,.step,.milestone p,.compare-col,.hub-item,.quiz-card,.quiz-option,.final-card{
  background:linear-gradient(145deg,color-mix(in srgb,var(--surface-2) 92%,#fff 8%) 0%,var(--surface) 100%)!important;
  color:var(--text)!important;border:1px solid var(--line)!important;
  box-shadow:0 18px 54px rgba(0,0,0,.25),inset 0 1px 0 rgba(255,255,255,.035)!important
}
.glass,.quiz-card,.final-card{border-radius:25px!important}.qmx-copy{border-radius:25px!important}
.qmx-visual{
  background:
    radial-gradient(circle at 78% 12%,color-mix(in srgb,var(--accent) 11%,transparent),transparent 24rem),
    linear-gradient(145deg,var(--visual-bg),var(--visual-bg-2))!important;
  border:1px solid color-mix(in srgb,var(--line) 78%,var(--accent) 22%)!important;
  box-shadow:0 22px 64px rgba(0,0,0,.32),inset 0 1px 0 rgba(255,255,255,.045)!important
}
.qmx-visual picture,.qmx-visual img{border-radius:inherit}.qmx-visual img{filter:none!important}
.qmx-visual-label{background:color-mix(in srgb,var(--bg) 82%,transparent)!important;color:color-mix(in srgb,var(--text) 92%,transparent)!important;border:1px solid color-mix(in srgb,var(--line) 82%,transparent)!important;box-shadow:0 8px 22px rgba(0,0,0,.2)!important}
.eyebrow,.qmx-kicker,.step-no,.hub-item b{color:var(--accent)!important;font-size:10px!important;font-weight:800!important;letter-spacing:.11em!important}
.title,.qmx-copy h2,.final-card h1,.quiz-card h2{color:var(--text)!important;font-weight:760!important;letter-spacing:-.045em!important;line-height:1.02!important}
.lead,.qmx-copy p,.concept-card p,.step p,.milestone p,.compare-item,.hub-item{color:var(--body)!important;line-height:1.64!important}
.lead,.qmx-copy p{font-size:16px!important}
.qmx-interaction{color:var(--body)!important}.qmx-prompt,.qmx-count{color:var(--muted)!important}
.qmx-point{background:color-mix(in srgb,var(--surface-2) 88%,var(--primary) 12%)!important;color:color-mix(in srgb,var(--body) 94%,#fff)!important;border:1px solid color-mix(in srgb,var(--line) 78%,var(--primary) 22%)!important;box-shadow:none!important}
.qmx-point-index{background:color-mix(in srgb,var(--primary) 22%,var(--surface))!important;color:color-mix(in srgb,var(--accent) 78%,#fff)!important}
.qmx-point:hover,.qmx-point:focus-visible,.qmx-point.active{background:color-mix(in srgb,var(--surface-2) 72%,var(--primary) 28%)!important;color:#fff!important;border-color:var(--primary)!important;transform:translateY(-1px)!important}
.qmx-point.explored:not(.active){border-color:color-mix(in srgb,var(--accent) 48%,var(--line))!important;color:var(--text)!important}
.qmx-reveal{background:color-mix(in srgb,var(--surface-2) 82%,var(--primary) 18%)!important;color:var(--body)!important;border:1px solid color-mix(in srgb,var(--line) 70%,var(--primary) 30%)!important;border-left:3px solid var(--accent)!important}
.qmx-reveal-label{color:var(--accent)!important}.qmx-type-scenario .qmx-copy{border-left-color:var(--accent)!important}
.chip,.concept-number,.takeaway{background:color-mix(in srgb,var(--surface-2) 82%,var(--primary) 18%)!important;color:var(--text)!important;border:1px solid color-mix(in srgb,var(--line) 72%,var(--primary) 28%)!important;box-shadow:none!important}
.hero{gap:30px!important;padding:34px!important}.hero-art,.spot-visual{background:radial-gradient(circle at 28% 22%,color-mix(in srgb,var(--accent) 38%,transparent),transparent 34%),linear-gradient(145deg,var(--primary),var(--primary-dark))!important;color:#fff!important;border:1px solid rgba(255,255,255,.12)!important;box-shadow:0 20px 56px rgba(0,0,0,.28)!important}
.hero-core svg,.spot-visual svg{width:210px!important;height:210px!important}.hero-art:before,.hero-art:after,.spot-visual:before{border-color:rgba(255,255,255,.16)!important}
.step:not(:last-child):after{background:var(--primary)!important;color:#fff!important}.timeline:before{background:linear-gradient(90deg,var(--primary),var(--accent))!important}.dot{background:var(--surface)!important;border-color:var(--primary)!important;box-shadow:0 0 0 4px color-mix(in srgb,var(--primary) 18%,var(--surface))!important}
.compare-col.good{background:color-mix(in srgb,#064E3B 45%,var(--surface))!important;border-top:4px solid #34D399!important}.compare-col.warn{background:color-mix(in srgb,#4C0519 45%,var(--surface))!important;border-top:4px solid #FB7185!important}.compare-col.good .compare-title{color:#6EE7B7!important}.compare-col.warn .compare-title{color:#FDA4AF!important}
.quiz-wrap{max-width:940px!important}.quiz-card{padding:34px!important}.quiz-options{gap:12px!important}.quiz-option{background:color-mix(in srgb,var(--surface) 84%,var(--surface-2))!important;color:var(--body)!important;border:1px solid var(--line)!important;border-radius:16px!important;padding:17px!important;min-height:66px!important;font-size:14px!important;font-weight:650!important;box-shadow:none!important}
.quiz-option:hover:not(:disabled){background:color-mix(in srgb,var(--surface-2) 78%,var(--primary) 22%)!important;border-color:color-mix(in srgb,var(--primary) 70%,#fff)!important;transform:translateY(-1px)!important}.quiz-option.correct{background:#0A2B23!important;border:1px solid #238568!important;color:#B7F7DF!important}.quiz-option.incorrect{background:#32131D!important;border:1px solid #9F3550!important;color:#FFD1DB!important;text-decoration:none!important}
.feedback{border-radius:14px!important;background:color-mix(in srgb,var(--surface-2) 86%,var(--primary) 14%)!important;color:var(--body)!important;border:1px solid color-mix(in srgb,var(--line) 72%,var(--primary) 28%)!important;padding:14px 16px!important;text-align:left!important;font-size:13px!important;line-height:1.55!important;font-weight:650!important}
.final-card{padding:40px!important}.score-ring{background:conic-gradient(var(--primary) 0deg,var(--accent) 270deg,color-mix(in srgb,var(--surface-2) 92%,#fff) 270deg)!important}.score-ring:before{background:var(--surface)!important}.score-ring span{color:var(--text)!important;font-weight:800!important}
.nav-btn{min-height:44px!important;border-radius:12px!important;padding:10px 17px!important;font-weight:700!important;transition:transform .18s ease,border-color .18s ease,background .18s ease!important}
.nav-btn.primary{background:linear-gradient(135deg,var(--primary),var(--primary-dark))!important;color:#fff!important;border:1px solid color-mix(in srgb,var(--primary) 72%,#fff)!important;box-shadow:0 9px 24px color-mix(in srgb,var(--primary) 22%,transparent)!important}.nav-btn.primary:hover{transform:translateY(-1px)!important;filter:brightness(1.08)}
.nav-btn.secondary{background:var(--surface)!important;color:var(--body)!important;border:1px solid var(--line)!important;box-shadow:none!important}.nav-btn.secondary:hover{background:var(--surface-2)!important;border-color:color-mix(in srgb,var(--line) 62%,var(--primary))!important;color:#fff!important}
button:focus-visible,.nav-btn:focus-visible,.quiz-option:focus-visible,.qmx-point:focus-visible,.qmx-visual:focus-visible{outline:3px solid color-mix(in srgb,var(--accent) 64%,#fff)!important;outline-offset:3px!important}
@media(max-width:900px){.slide{padding:18px!important}.hero{padding:24px!important}.qmx-copy{padding:22px!important}.lead,.qmx-copy p{font-size:15px!important}.hero-core svg,.spot-visual svg{width:180px!important;height:180px!important}}
@media(max-width:680px){header{height:58px!important;gap:9px!important}footer{height:64px!important}.slide{padding:12px!important}.title{font-size:clamp(25px,8vw,34px)!important}.lead,.qmx-copy p{font-size:14.5px!important}.qmx-copy{padding:18px!important}.quiz-card,.final-card{padding:22px!important}.quiz-options{grid-template-columns:1fr!important}.part{font-size:10px!important}}
@media(max-height:720px) and (min-width:901px){.slide{padding-top:14px!important;padding-bottom:14px!important}.qmx-copy{padding:22px!important}.lead,.qmx-copy p{font-size:14px!important;line-height:1.55!important}.hero-art,.spot-visual{min-height:285px!important;height:285px!important}}
@media(prefers-reduced-motion:reduce){*,*::before,*::after{scroll-behavior:auto!important;animation-duration:.01ms!important;animation-iteration-count:1!important;transition-duration:.01ms!important}}
</style>`;

function safeColor(value, fallback) {
    const text = String(value || '').trim();
    return /^#[0-9a-f]{6}$/i.test(text) ? text : fallback;
}

function themeVariablesCss(theme) {
    const fallback = getTheme(1);
    const vars = {
        '--primary': safeColor(theme.primary, fallback.primary),
        '--primary-dark': safeColor(theme.primaryDark, fallback.primaryDark),
        '--accent': safeColor(theme.accent, fallback.accent),
        '--accent-2': safeColor(theme.accent2, fallback.accent2),
        '--bg': safeColor(theme.bg, fallback.bg),
        '--bg-2': safeColor(theme.bg2, fallback.bg2),
        '--surface': safeColor(theme.surface, fallback.surface),
        '--surface-2': safeColor(theme.surface2, fallback.surface2),
        '--text': safeColor(theme.text, fallback.text),
        '--body': safeColor(theme.body, fallback.body),
        '--muted': safeColor(theme.muted, fallback.muted),
        '--line': safeColor(theme.line, fallback.line),
        '--visual-bg': safeColor(theme.visualBg, fallback.visualBg),
        '--visual-bg-2': safeColor(theme.visualBg2, fallback.visualBg2),
        '--visual-card': safeColor(theme.visualCard, fallback.visualCard),
        '--visual-card-2': safeColor(theme.visualCard2, fallback.visualCard2),
        '--visual-text': safeColor(theme.visualText, fallback.visualText),
        '--visual-muted': safeColor(theme.visualMuted, fallback.visualMuted),
        '--soft': safeColor(theme.soft, fallback.soft),
        '--glow': safeColor(theme.glow, fallback.glow)
    };
    const body = Object.entries(vars).map(([key, value]) => `${key}:${value}!important`).join(';');
    return `<style id="quizmoto-scorm-course-theme">:root{${body}}</style>`;
}

async function applyEditorialCourseTheme(buffer, theme) {
    const zip = await JSZip.loadAsync(buffer);
    const indexFile = zip.file('index.html');
    if (!indexFile) return buffer;

    let html = await indexFile.async('string');
    if (!html.includes('quizmoto-scorm-editorial-theme-v5')) {
        html = html.replace('</head>', `${EDITORIAL_COURSE_CSS}\n${themeVariablesCss(theme)}\n</head>`);
        zip.file('index.html', html);
    }

    const contentFile = zip.file('content.json');
    if (contentFile) {
        try {
            const content = JSON.parse(await contentFile.async('string'));
            zip.file('content.json', JSON.stringify({
                ...content,
                theme: { id: theme.id, slug: theme.slug, name: theme.name, motif: theme.motif },
                themeVersion: 5
            }, null, 2));
        } catch (_) {}
    }

    return zip.generateAsync({ type: 'nodebuffer', compression: 'STORE' });
}

async function buildScormPackageZip(rawAnalysis, opts = {}) {
    const templateId = normalizeThemeId(opts.templateId || rawAnalysis?.themeId || rawAnalysis?.templateId || 1);
    const visualTheme = getTheme(templateId);
    const analysis = {
        ...(rawAnalysis || {}),
        themeId: templateId,
        themeName: visualTheme.name,
        visualTheme
    };
    const buffer = await buildFinalPackage(analysis, { ...opts, templateId });
    return applyEditorialCourseTheme(buffer, visualTheme);
}

module.exports = {
    buildScormPackageZip,
    applyEditorialCourseTheme,
    themeVariablesCss,
    VISUAL_THEMES: THEMES,
    THEMES
};
