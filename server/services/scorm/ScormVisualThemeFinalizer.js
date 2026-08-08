const JSZip = require('jszip');
const { buildScormPackageZip: buildFinalPackage } = require('./ScormExperienceFinalizer');

// A small set of intentionally quiet palettes. They share the same visual
// grammar but give authors a real choice without turning courses into theme demos.
const VISUAL_THEMES = {
    1: {
        primary: '#6f887a',
        primaryDark: '#53695d',
        accent: '#c9d8cf',
        bg: '#f7f8f5',
        surface: '#ffffff',
        text: '#26312d',
        muted: '#6e7873',
        soft: '#edf3ef'
    },
    3: {
        primary: '#7896aa',
        primaryDark: '#5e7b8f',
        accent: '#ccd9e2',
        bg: '#f6f8f9',
        surface: '#ffffff',
        text: '#293239',
        muted: '#6f7b83',
        soft: '#edf3f7'
    },
    4: {
        primary: '#ae9069',
        primaryDark: '#8c704e',
        accent: '#e4d6c3',
        bg: '#faf8f4',
        surface: '#ffffff',
        text: '#37312a',
        muted: '#7e756b',
        soft: '#f5f0e8'
    },
    5: {
        primary: '#8f83a5',
        primaryDark: '#706681',
        accent: '#d8d0e1',
        bg: '#f9f7fa',
        surface: '#ffffff',
        text: '#322f36',
        muted: '#77717c',
        soft: '#f2eff6'
    }
};

const EDITORIAL_COURSE_CSS = `
<style id="quizmoto-scorm-editorial-theme">
:root{--line:#e2e7e3!important;--shadow:0 1px 2px rgba(38,49,45,.04),0 14px 34px rgba(38,49,45,.06)!important}
*{text-shadow:none!important}
html,body,#app{background:var(--bg)!important;color:var(--text)!important}
#app{background-image:none!important}
header,footer{background:rgba(255,255,255,.96)!important;color:var(--text)!important;border-color:var(--line)!important;box-shadow:none!important}
.brand-mark{background:var(--primary)!important;color:#fff!important;border-radius:12px!important;box-shadow:none!important}
.progress-shell{background:#edf0ee!important;border-radius:999px!important}.progress-fill{background:var(--primary)!important;background-image:none!important}.progress-text,.part{color:var(--muted)!important}
.nav-btn{border-radius:10px!important}.nav-btn.primary{background:var(--primary-dark)!important;color:#fff!important;box-shadow:none!important}.nav-btn.primary:hover{background:var(--primary)!important;box-shadow:none!important;transform:translateY(-1px)!important}.nav-btn.secondary{background:#fff!important;color:var(--text)!important;border:1px solid var(--line)!important}
.slide{background:var(--bg)!important}.glass,.qmx-copy,.qmx-visual,.concept-card,.step,.milestone p,.compare-col,.hub-item,.quiz-card,.quiz-option,.final-card{background:var(--surface)!important;border:1px solid var(--line)!important;border-radius:18px!important;box-shadow:var(--shadow)!important}
.qmx-copy,.qmx-visual{border-radius:20px!important}.qmx-visual{background:var(--soft)!important;background-image:none!important}.qmx-badge{background:rgba(255,255,255,.92)!important;border:1px solid var(--line)!important;color:var(--primary-dark)!important;box-shadow:none!important}
.eyebrow,.qmx-kicker,.step-no,.hub-item b{color:var(--primary-dark)!important}.title,.qmx-copy h2{color:var(--text)!important;font-weight:800!important;letter-spacing:-.035em!important}.lead,.qmx-copy p,.concept-card p,.step p,.milestone p,.compare-item,.hub-item,.qmx-detail,.qmx-prompt,.qmx-count{color:var(--muted)!important}
.chip,.concept-number,.takeaway,.qmx-detail{background:var(--soft)!important;color:var(--primary-dark)!important;border-color:var(--accent)!important}.chip{border:1px solid var(--accent)!important}.concept-card:before{background:var(--primary)!important}
.hero-art,.spot-visual{background:var(--soft)!important;background-image:none!important;color:var(--primary-dark)!important;border:1px solid var(--accent)!important}.hero-art svg,.spot-visual svg{color:var(--primary-dark)!important;filter:none!important}.hero-art:before,.hero-art:after,.spot-visual:before{border-color:var(--accent)!important;opacity:.55!important}
.step:not(:last-child):after{background:var(--primary)!important;color:#fff!important}.timeline:before{background:var(--accent)!important}.dot{background:#fff!important;border-color:var(--primary)!important;box-shadow:0 0 0 4px var(--soft)!important}
.compare-col.good{border-top:4px solid #8fae9c!important}.compare-col.warn{border-top:4px solid #c98f88!important}.compare-col.good .compare-title{color:#6e8c7a!important}.compare-col.warn .compare-title{color:#a86f69!important}.good .badge-dot{background:#8fae9c!important}.warn .badge-dot{background:#c98f88!important}
.qmx-point{background:#fff!important;color:var(--muted)!important;border:1px solid var(--line)!important;box-shadow:none!important}.qmx-point:hover,.qmx-point.active{background:var(--soft)!important;color:var(--primary-dark)!important;border-color:var(--accent)!important;transform:translateY(-1px)!important}
.quiz-option{box-shadow:none!important}.quiz-option:hover{border-color:var(--primary)!important}.quiz-option.correct{background:#edf4ef!important;border:2px solid #8fae9c!important;color:#50695a!important}.quiz-option.incorrect{background:#f8eeee!important;border:2px solid #c98f88!important;color:#8f615c!important;text-decoration:none!important}.feedback{border-radius:12px!important;background:var(--soft)!important;color:var(--primary-dark)!important;border:1px solid var(--accent)!important}
.score-ring{background:conic-gradient(var(--primary) 0deg,var(--accent) 270deg,#edf0ee 270deg)!important}.score-ring:before{background:#fff!important}.score-ring span{color:var(--primary-dark)!important}
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
