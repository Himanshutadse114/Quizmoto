const DEFAULT_PALETTE = {
    paper: '#E7E7E4', paper2: '#F4F2EC', beige: '#E5DFD2', structure: '#CBC5B8',
    ink: '#282824', body: '#4A4A45', muted: '#77776F', teal: '#4FC9BF', tealDark: '#177E78',
    yellow: '#FCF2B5', amber: '#E7A13A', red: '#D75245', green: '#3F9E7A', white: '#FFFFFF'
};

function escapeXml(value) {
    return String(value == null ? '' : value)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

function safeColor(value, fallback) {
    const text = String(value || '').trim();
    return /^#[0-9a-f]{6}$/i.test(text) ? text.toUpperCase() : fallback;
}

function paletteFromAnalysis(analysis = {}) {
    const theme = analysis.visualTheme || {};
    return {
        ...DEFAULT_PALETTE,
        teal: safeColor(theme.primary || theme.accent, DEFAULT_PALETTE.teal),
        tealDark: safeColor(theme.primaryDark, DEFAULT_PALETTE.tealDark)
    };
}

const DESKTOP_SVG = { width: 1200, height: 1000, designW: 1600, designH: 1000 };
const MOBILE_SVG = { width: 900, height: 1100, designW: 900, designH: 1200 };

function fitDesignTransform(canvas, designW, designH) {
    const scale = Math.min(canvas.width / designW, canvas.height / designH);
    const ox = (canvas.width - designW * scale) / 2;
    const oy = (canvas.height - designH * scale) / 2;
    return { scale, ox, oy, transform: `translate(${ox.toFixed(1)} ${oy.toFixed(1)}) scale(${scale.toFixed(4)})` };
}

function compositionTransform(rawComposition, width, height) {
    const cx = width / 2;
    const cy = height / 2;
    switch (rawComposition) {
        case 'editorial-left':
            return `translate(${width} 0) scale(-1 1)`;
        case 'center-stage':
            return `translate(${cx} ${cy}) scale(.88) translate(${-cx} ${-cy})`;
        case 'wide-scene':
            return `translate(${cx} ${cy * .94}) scale(1.1 .95) translate(${-cx} ${-cy * .94})`;
        case 'full-bleed':
            return `translate(${cx} ${cy}) scale(1.16) translate(${-cx} ${-cy})`;
        default:
            return '';
    }
}

function sanitizeSvg(svg) {
    let output = String(svg || '');
    output = output.replace(/<script\b[^>]*>[\s\S]*?<\/script\s*>/gi, '');
    output = output.replace(/<foreignObject\b[^>]*>[\s\S]*?<\/foreignObject\s*>/gi, '');
    output = output.replace(/<(?:iframe|object|embed)\b[^>]*>[\s\S]*?<\/(?:iframe|object|embed)\s*>/gi, '');
    output = output.replace(/\s+on[a-z]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, '');
    output = output.replace(/javascript\s*:/gi, '');
    return output;
}

function sceneArtwork(spec, p, mobile) {
    const w = mobile ? 900 : 1600;
    const h = mobile ? 1200 : 1000;
    const cx = w / 2;
    const cy = h / 2;
    return `<circle cx="${cx}" cy="${cy}" r="${Math.min(w,h)*0.28}" fill="${p.teal}" opacity=".18"/>
      <rect x="${cx-180}" y="${cy-120}" width="360" height="240" rx="28" fill="${p.white}" stroke="${p.ink}" stroke-width="5"/>
      <circle cx="${cx}" cy="${cy-20}" r="36" fill="${p.teal}"/>
      <rect x="${cx-80}" y="${cy+40}" width="160" height="14" rx="7" fill="${p.ink}" opacity=".45"/>
      <rect x="${cx-60}" y="${cy+66}" width="120" height="10" rx="5" fill="${p.body}" opacity=".3"/>`;
}

function renderSmartSvg(spec = {}, slide = {}, options = {}) {
    const mobile = Boolean(options.mobile);
    const canvas = mobile
        ? { width: MOBILE_SVG.width, height: MOBILE_SVG.height }
        : { width: DESKTOP_SVG.width, height: DESKTOP_SVG.height };
    const width = canvas.width;
    const height = canvas.height;
    const p = { ...DEFAULT_PALETTE, ...(options.palette || {}) };
    const scene = escapeXml(spec.scene || 'abstract-security');
    const title = escapeXml(spec.visualTitle || slide.visualTitle || slide.title || 'Learning visual');
    const rawComposition = spec.composition || 'editorial-right';
    const composition = escapeXml(rawComposition);
    const designW = mobile ? MOBILE_SVG.designW : DESKTOP_SVG.designW;
    const designH = mobile ? MOBILE_SVG.designH : DESKTOP_SVG.designH;
    const sceneTransform = compositionTransform(rawComposition, designW, designH);
    const fit = fitDesignTransform(canvas, designW, designH);

    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="${title}" data-scorm-smart-svg="1" data-scene="${scene}" data-composition="${composition}" data-panel-ratio="${mobile ? '9/11' : '6/5'}">
      <title>${title}</title>
      <rect width="${width}" height="${height}" fill="${p.paper}"/>
      <g data-smart-svg-fit="1" transform="${fit.transform}">
        <g data-smart-svg-scene="${scene}"${sceneTransform ? ` transform="${sceneTransform}"` : ''}>${sceneArtwork(spec, p, mobile)}</g>
      </g>
    </svg>`;
    return sanitizeSvg(svg);
}

module.exports = {
    DEFAULT_PALETTE,
    DESKTOP_SVG,
    MOBILE_SVG,
    escapeXml,
    paletteFromAnalysis,
    sanitizeSvg,
    fitDesignTransform,
    renderSmartSvg,
    sceneArtwork
};
