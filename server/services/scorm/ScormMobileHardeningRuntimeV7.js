'use strict';

const JSZip = require('jszip');
const {
    scaledDesktopStyle,
    scaledDesktopScript,
    injectScaledDesktopRuntime
} = require('./ScormScaledDesktopRuntime');

const STYLE_ID = 'quizmoto-scaled-desktop-course-runtime-v8';
const SCRIPT_ID = 'quizmoto-scaled-desktop-course-script-v8';
const VERSION = 'scaled-desktop-v8';
const LEGACY_STYLE_IDS = [
    'quizmoto-mobile-course-responsive-v7',
    'quizmoto-mobile-course-responsive-v6',
    'quizmoto-mobile-course-responsive-v5',
    'quizmoto-mobile-course-hardening-v4',
    'quizmoto-mobile-course-runtime-v3',
    'quizmoto-scaled-desktop-course-runtime-v4',
    'quizmoto-mobile-width-wrap-hotfix-v1'
];
const LEGACY_SCRIPT_IDS = [
    'quizmoto-mobile-course-responsive-script-v7',
    'quizmoto-mobile-course-responsive-script-v6',
    'quizmoto-mobile-course-responsive-script-v5',
    'quizmoto-mobile-course-hardening-script-v4',
    'quizmoto-mobile-course-runtime-script-v3',
    'quizmoto-scaled-desktop-course-script-v4'
];

function style() {
    return scaledDesktopStyle(STYLE_ID, VERSION);
}

function script() {
    return scaledDesktopScript(SCRIPT_ID, STYLE_ID, VERSION);
}

function inject(html) {
    return injectScaledDesktopRuntime(html, {
        styleId: STYLE_ID,
        scriptId: SCRIPT_ID,
        version: VERSION,
        removeStyleIds: LEGACY_STYLE_IDS,
        removeScriptIds: LEGACY_SCRIPT_IDS
    });
}

async function applyMobileHardeningRuntimeToZip(zipBuffer) {
    const zip = await JSZip.loadAsync(zipBuffer);
    const entry = zip.file('index.html');
    if (!entry) return zipBuffer;
    const html = await entry.async('string');
    zip.file('index.html', inject(html));
    return zip.generateAsync({ type:'nodebuffer', compression:'DEFLATE', compressionOptions:{ level:3 } });
}

module.exports = { STYLE_ID, SCRIPT_ID, style, script, inject, applyMobileHardeningRuntimeToZip };
