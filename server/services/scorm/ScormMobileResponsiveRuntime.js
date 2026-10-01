'use strict';

const JSZip = require('jszip');
const {
    scaledDesktopStyle,
    scaledDesktopScript,
    injectScaledDesktopRuntime
} = require('./ScormScaledDesktopRuntime');

const STYLE_ID = 'quizmoto-scaled-desktop-course-runtime-v4';
const SCRIPT_ID = 'quizmoto-scaled-desktop-course-script-v4';
const VERSION = 'scaled-desktop-v4';
const LEGACY_STYLE_IDS = ['quizmoto-mobile-course-runtime-v3'];
const LEGACY_SCRIPT_IDS = ['quizmoto-mobile-course-runtime-script-v3'];

function responsiveStyle() {
    return scaledDesktopStyle(STYLE_ID, VERSION);
}

function responsiveScript() {
    return scaledDesktopScript(SCRIPT_ID, STYLE_ID, VERSION);
}

function injectMobileRuntime(html) {
    return injectScaledDesktopRuntime(html, {
        styleId: STYLE_ID,
        scriptId: SCRIPT_ID,
        version: VERSION,
        removeStyleIds: LEGACY_STYLE_IDS,
        removeScriptIds: LEGACY_SCRIPT_IDS
    });
}

async function applyMobileResponsiveRuntimeToZip(zipBuffer) {
    const zip = await JSZip.loadAsync(zipBuffer);
    const entry = zip.file('index.html');
    if (!entry) return zipBuffer;
    const html = await entry.async('string');
    zip.file('index.html', injectMobileRuntime(html));
    return zip.generateAsync({
        type: 'nodebuffer',
        compression: 'DEFLATE',
        compressionOptions: { level: 3 }
    });
}

module.exports = {
    STYLE_ID,
    SCRIPT_ID,
    responsiveStyle,
    responsiveScript,
    injectMobileRuntime,
    applyMobileResponsiveRuntimeToZip
};
