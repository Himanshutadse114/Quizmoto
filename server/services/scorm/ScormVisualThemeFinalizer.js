const { buildScormPackageZip: buildFinalPackage } = require('./ScormExperienceFinalizer');

const VISUAL_THEMES = {
    1: { primary: '#f97316', accent: '#fdba74', soft: '#fff1e6' },
    3: { primary: '#b45309', accent: '#fde68a', soft: '#fef3c7' },
    4: { primary: '#059669', accent: '#6ee7b7', soft: '#d1fae5' },
    5: { primary: '#db2777', accent: '#f9a8d4', soft: '#fce7f3' }
};

async function buildScormPackageZip(rawAnalysis, opts = {}) {
    const templateId = Number(opts.templateId) || 1;
    const visualTheme = VISUAL_THEMES[templateId] || VISUAL_THEMES[1];
    const analysis = {
        ...(rawAnalysis || {}),
        visualTheme
    };
    return buildFinalPackage(analysis, { ...opts, templateId });
}

module.exports = {
    buildScormPackageZip,
    VISUAL_THEMES
};
