'use strict';

const DEFAULT_COURSE_THEME = 'teal';
const MAX_LOGO_BYTES = Math.floor(1.5 * 1024 * 1024);
const COURSE_THEME_IDS = Object.freeze(['neutral', 'teal', 'blue', 'orange', 'purple', 'forest', 'custom']);
const COURSE_THEME_SET = new Set(COURSE_THEME_IDS);
const HEX_RE = /^#[0-9a-f]{6}$/i;

const DEFAULT_CUSTOM_THEME = Object.freeze({
    primary: '#0F8C82',
    accent: '#63D6CC',
    background: '#F2F8F7',
    text: '#172321'
});

function safeHex(value, fallback = '') {
    const text = String(value || '').trim();
    return HEX_RE.test(text) ? text.toUpperCase() : fallback;
}

function normalizeCourseTheme(value, fallback = DEFAULT_COURSE_THEME) {
    const requested = String(value || '').trim().toLowerCase();
    if (COURSE_THEME_SET.has(requested)) return requested;
    const cleanFallback = String(fallback || '').trim().toLowerCase();
    return COURSE_THEME_SET.has(cleanFallback) ? cleanFallback : DEFAULT_COURSE_THEME;
}

function normalizeCustomTheme(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
    const primary = safeHex(value.primary, DEFAULT_CUSTOM_THEME.primary);
    const accent = safeHex(value.accent, DEFAULT_CUSTOM_THEME.accent);
    const background = safeHex(value.background, DEFAULT_CUSTOM_THEME.background);
    const text = safeHex(value.text, DEFAULT_CUSTOM_THEME.text);
    return { primary, accent, background, text };
}

function normalizeLogoDataUrl(value) {
    const raw = String(value || '').trim();
    if (!raw) return '';
    const match = raw.match(/^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/=]+)$/i);
    if (!match) {
        const error = new Error('Logo must be a PNG, JPG or WebP image.');
        error.code = 'SCORM_BRANDING_LOGO_INVALID';
        throw error;
    }
    const bytes = Buffer.from(match[2], 'base64');
    if (!bytes.length || bytes.length > MAX_LOGO_BYTES) {
        const error = new Error('Logo must be 1.5 MB or smaller.');
        error.code = 'SCORM_BRANDING_LOGO_TOO_LARGE';
        throw error;
    }
    const mime = match[1].toLowerCase() === 'jpeg' ? 'jpeg' : match[1].toLowerCase();
    return `data:image/${mime};base64,${match[2]}`;
}

function resolveCourseBranding({ analysis = null, courseTheme, customTheme, logoDataUrl } = {}) {
    const existing = analysis?.branding && typeof analysis.branding === 'object'
        ? analysis.branding
        : {};
    const requestedTheme = courseTheme || existing.courseTheme || analysis?.courseTheme || DEFAULT_COURSE_THEME;
    let theme = normalizeCourseTheme(requestedTheme);
    const requestedCustom = customTheme || existing.customTheme || analysis?.customTheme || null;
    const custom = normalizeCustomTheme(requestedCustom);
    if (theme === 'custom' && !custom) theme = DEFAULT_COURSE_THEME;

    const logoCandidate = logoDataUrl || existing.logoDataUrl || '';
    const logo = normalizeLogoDataUrl(logoCandidate);

    return {
        courseTheme: theme,
        customTheme: theme === 'custom' ? (custom || { ...DEFAULT_CUSTOM_THEME }) : null,
        logoDataUrl: logo
    };
}

function applyCourseBranding(analysis, branding) {
    const source = analysis && typeof analysis === 'object' ? analysis : {};
    const clean = branding || resolveCourseBranding({ analysis: source });
    const next = {
        ...source,
        courseTheme: clean.courseTheme,
        branding: {
            courseTheme: clean.courseTheme,
            customTheme: clean.customTheme,
            logoDataUrl: clean.logoDataUrl
        }
    };
    if (clean.customTheme) next.customTheme = clean.customTheme;
    else delete next.customTheme;
    return next;
}

module.exports = {
    COURSE_THEME_IDS,
    DEFAULT_COURSE_THEME,
    DEFAULT_CUSTOM_THEME,
    MAX_LOGO_BYTES,
    safeHex,
    normalizeCourseTheme,
    normalizeCustomTheme,
    normalizeLogoDataUrl,
    resolveCourseBranding,
    applyCourseBranding
};
