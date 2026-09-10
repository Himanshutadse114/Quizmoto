'use strict';

const JSZip = require('jszip');

const STYLE_ID = 'lmsgen-course-branding-v1';
const SCRIPT_ID = 'lmsgen-course-branding-script-v1';
const DEFAULT_PRIMARY = '#177E78';
const DEFAULT_ACCENT = '#8EDDD5';
const MAX_LOGO_DATA_URL_LENGTH = 1_500_000;

function normaliseHex(value, fallback) {
    const clean = String(value || '').trim();
    return /^#[0-9a-f]{6}$/i.test(clean) ? clean.toUpperCase() : fallback;
}

function normaliseLogoDataUrl(value) {
    const clean = String(value || '').trim();
    if (!clean) return '';
    if (clean.length > MAX_LOGO_DATA_URL_LENGTH) {
        const error = new Error('Course logo is too large. Use an image smaller than 1 MB.');
        error.code = 'SCORM_BRANDING_LOGO_TOO_LARGE';
        throw error;
    }
    if (!/^data:image\/(?:png|jpeg|webp);base64,[a-z0-9+/=\r\n]+$/i.test(clean)) {
        const error = new Error('Course logo must be a PNG, JPEG or WebP image.');
        error.code = 'SCORM_BRANDING_LOGO_INVALID';
        throw error;
    }
    return clean;
}

function mix(hex, target, ratio) {
    const source = normaliseHex(hex, DEFAULT_PRIMARY).slice(1);
    const destination = normaliseHex(target, '#000000').slice(1);
    const amount = Math.max(0, Math.min(1, Number(ratio) || 0));
    const out = [0, 2, 4].map((offset) => {
        const from = parseInt(source.slice(offset, offset + 2), 16);
        const to = parseInt(destination.slice(offset, offset + 2), 16);
        return Math.round(from + (to - from) * amount).toString(16).padStart(2, '0');
    }).join('');
    return `#${out}`.toUpperCase();
}

function normaliseCourseBranding(value = {}) {
    const source = value && typeof value === 'object' ? value : {};
    const primaryColor = normaliseHex(source.primaryColor || source.primary || source.brandColor, DEFAULT_PRIMARY);
    const accentColor = normaliseHex(source.accentColor || source.secondaryColor || source.accent, DEFAULT_ACCENT);
    return {
        version: 1,
        primaryColor,
        accentColor,
        primaryDark: mix(primaryColor, '#000000', 0.22),
        primarySoft: mix(primaryColor, '#FFFFFF', 0.88),
        accentSoft: mix(accentColor, '#FFFFFF', 0.82),
        logoDataUrl: normaliseLogoDataUrl(source.logoDataUrl || source.logo || '')
    };
}

function css(branding) {
    const b = normaliseCourseBranding(branding);
    return `<style id="${STYLE_ID}">
:root{
  --primary:${b.primaryColor}!important;
  --primary-dark:${b.primaryDark}!important;
  --accent:${b.accentColor}!important;
  --soft:${b.primarySoft}!important;
  --highlight:${b.accentSoft}!important;
  --gamma-highlight:${b.accentSoft}!important;
  --lmsgen-brand-primary:${b.primaryColor};
  --lmsgen-brand-accent:${b.accentColor};
  --lmsgen-brand-soft:${b.primarySoft};
}
.progress-fill{background:var(--lmsgen-brand-primary)!important}
.brand-mark{background:var(--lmsgen-brand-primary)!important}
.eyebrow,.qmx-kicker,.step-no,.hub-item b,.qmx-card span,.qmx-step span,.qmx-course-sidebar-kicker,.qmx-scenario-sidebar-kicker,.qmx-course-nav-type,.qmx-scenario-nav-type{color:${b.primaryDark}!important}
.nav-btn.primary,.qmx-quiz-label{background:${b.primaryColor}!important;border-color:${b.primaryColor}!important;color:#fff!important}
.nav-btn.primary:hover{background:${b.primaryDark}!important;border-color:${b.primaryDark}!important}
.nav-btn.secondary:hover{border-color:${b.accentColor}!important;background:${b.primarySoft}!important}
.qmx-course-nav-item.is-active,.qmx-scenario-nav-item.is-active{box-shadow:inset 3px 0 0 ${b.primaryColor}!important}
.qmx-course-nav-item.is-active .qmx-course-nav-number,.qmx-scenario-nav-item.is-active .qmx-scenario-nav-number{background:${b.primaryColor}!important;border-color:${b.primaryColor}!important;color:#fff!important}
.qmx-course-nav-state,.qmx-scenario-nav-state{color:${b.primaryColor}!important}
.quiz-option:hover:not(:disabled){background:${b.accentSoft}!important;border-color:${b.accentColor}!important}
button:focus-visible,.nav-btn:focus-visible,.quiz-option:focus-visible,.qmx-point:focus-visible,.qmx-visual:focus-visible{outline-color:${b.accentColor}!important}
.slide.qmx-cover-slide .hero:before,.slide.qmx-cover-slide .hero:after{background:linear-gradient(90deg,transparent,${b.primaryColor},transparent)!important}
.slide.qmx-cover-slide .eyebrow{color:${b.primaryDark}!important;border-color:${mix(b.primaryColor, '#FFFFFF', 0.58)}!important;background:${b.primarySoft}!important}
.qmx-brand-logo{display:block;max-width:126px;max-height:36px;width:auto;height:auto;object-fit:contain;flex:0 0 auto}
header .qmx-brand-logo{margin-right:2px}
@media(max-width:560px){.qmx-brand-logo{max-width:96px;max-height:30px}}
</style>`;
}

function script(branding) {
    const b = normaliseCourseBranding(branding);
    const logo = JSON.stringify(b.logoDataUrl).replace(/</g, '\\u003c');
    return `<script id="${SCRIPT_ID}">
(function(){
  var logo=${logo};
  if(!logo)return;
  function install(){
    var header=document.querySelector('#app>header,header');
    if(!header||header.querySelector('.qmx-brand-logo'))return;
    var img=document.createElement('img');
    img.className='qmx-brand-logo';img.src=logo;img.alt='Course brand logo';img.decoding='async';
    var mark=header.querySelector('.brand-mark');
    if(mark&&mark.parentNode)mark.parentNode.replaceChild(img,mark);
    else header.insertBefore(img,header.firstChild);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
})();
</script>`;
}

function injectBranding(html, branding) {
    let source = String(html || '');
    if (!source) return source;
    if (!source.includes(STYLE_ID)) {
        const block = css(branding);
        source = source.includes('</head>') ? source.replace('</head>', `${block}\n</head>`) : `${block}\n${source}`;
    }
    if (!source.includes(SCRIPT_ID)) {
        const block = script(branding);
        source = source.includes('</body>') ? source.replace('</body>', `${block}\n</body>`) : `${source}\n${block}`;
    }
    return source;
}

async function applyCourseBrandingToZip(zipBuffer, branding) {
    const normalised = normaliseCourseBranding(branding);
    const zip = await JSZip.loadAsync(zipBuffer);
    const index = zip.file('index.html');
    if (!index) return { zipBuffer, branding: normalised };
    const html = await index.async('string');
    zip.file('index.html', injectBranding(html, normalised));
    return {
        branding: normalised,
        zipBuffer: await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE', compressionOptions: { level: 6 } })
    };
}

function publicBranding(branding) {
    const b = normaliseCourseBranding(branding);
    return {
        version: b.version,
        primaryColor: b.primaryColor,
        accentColor: b.accentColor,
        logoDataUrl: b.logoDataUrl
    };
}

module.exports = {
    DEFAULT_PRIMARY,
    DEFAULT_ACCENT,
    normaliseCourseBranding,
    publicBranding,
    injectBranding,
    applyCourseBrandingToZip
};
