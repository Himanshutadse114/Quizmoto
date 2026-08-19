const DEFAULT_PALETTE = {
    paper: '#E7E7E4', paper2: '#F4F2EC', beige: '#E5DFD2', structure: '#CBC5B8',
    ink: '#282824', body: '#4A4A45', muted: '#77776F', teal: '#4FC9BF', tealDark: '#177E78',
    yellow: '#FCF2B5', amber: '#E7A13A', red: '#D75245', green: '#3F9E7A', white: '#FFFFFF'
};

function escapeXml(value) {
    return String(value == null ? '' : value)
        .replace(/&/g, '&').replace(/</g, '<').replace(/>/g, '>')
        .replace(/"/g, '"').replace(/'/g, ''');
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
        case 'editorial-left': return `translate(${width} 0) scale(-1 1)`;
        case 'center-stage': return `translate(${cx} ${cy}) scale(.88) translate(${-cx} ${-cy})`;
        case 'wide-scene': return `translate(${cx} ${cy * .94}) scale(1.1 .95) translate(${-cx} ${-cy * .94})`;
        case 'full-bleed': return `translate(${cx} ${cy}) scale(1.16) translate(${-cx} ${-cy})`;
        default: return '';
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

// Distinct, content-shaped scenes (not the same generic card).
function sceneArtwork(spec, p, mobile) {
    const w = mobile ? 900 : 1600;
    const h = mobile ? 1200 : 1000;
    const cx = w / 2;
    const cy = h / 2;
    const scene = String(spec.scene || 'abstract-security');

    if (scene === 'email-threat') {
        return `<rect x="${cx-420}" y="${cy-280}" width="840" height="560" rx="36" fill="${p.white}" stroke="${p.ink}" stroke-width="6"/>
      <rect x="${cx-420}" y="${cy-280}" width="220" height="560" rx="28" fill="${p.ink}"/>
      <circle cx="${cx-310}" cy="${cy-180}" r="36" fill="${p.teal}"/>
      <rect x="${cx-160}" y="${cy-200}" width="480" height="28" rx="10" fill="${p.ink}" opacity=".75"/>
      <rect x="${cx-160}" y="${cy-120}" width="520" height="160" rx="22" fill="${p.yellow}" stroke="${p.amber}" stroke-width="3"/>
      <circle cx="${cx-100}" cy="${cy-40}" r="28" fill="${p.red}"/>
      <rect x="${cx-50}" y="${cy-55}" width="280" height="14" rx="7" fill="${p.ink}" opacity=".6"/>
      <rect x="${cx-50}" y="${cy-25}" width="340" height="10" rx="5" fill="${p.body}" opacity=".3"/>
      <rect x="${cx-160}" y="${cy+120}" width="200" height="48" rx="16" fill="${p.teal}"/>`;
    }
    if (scene === 'browser-phishing') {
        return `<rect x="${cx-480}" y="${cy-300}" width="960" height="600" rx="34" fill="${p.white}" stroke="${p.ink}" stroke-width="6"/>
      <path d="M${cx-480} ${cy-220} H${cx+480}" stroke="${p.structure}" stroke-width="3"/>
      <circle cx="${cx-430}" cy="${cy-260}" r="10" fill="${p.red}"/><circle cx="${cx-400}" cy="${cy-260}" r="10" fill="${p.amber}"/><circle cx="${cx-370}" cy="${cy-260}" r="10" fill="${p.green}"/>
      <rect x="${cx-320}" y="${cy-275}" width="560" height="28" rx="14" fill="${p.paper}" stroke="${p.structure}" stroke-width="2"/>
      <circle cx="${cx-290}" cy="${cy-261}" r="10" fill="${p.amber}"/>
      <rect x="${cx-380}" y="${cy-100}" width="420" height="36" rx="12" fill="${p.ink}" opacity=".85"/>
      <rect x="${cx-380}" y="${cy-30}" width="560" height="14" rx="7" fill="${p.body}" opacity=".35"/>
      <rect x="${cx-380}" y="${cy+10}" width="480" height="12" rx="6" fill="${p.body}" opacity=".25"/>
      <rect x="${cx-380}" y="${cy+80}" width="640" height="90" rx="20" fill="${p.yellow}" stroke="${p.amber}" stroke-width="3"/>
      <rect x="${cx+120}" y="${cy+100}" width="120" height="50" rx="14" fill="${p.red}"/>`;
    }
    if (scene === 'smartphone-scam' || scene === 'malicious-app' || scene === 'qr-phishing') {
        const kind = scene === 'qr-phishing' ? 'qr' : scene === 'malicious-app' ? 'apps' : 'msg';
        let inner = '';
        if (kind === 'qr') {
            inner = `<rect x="${cx-70}" y="${cy-80}" width="140" height="140" rx="12" fill="${p.ink}"/>
        <rect x="${cx-50}" y="${cy-60}" width="40" height="40" fill="${p.white}"/><rect x="${cx+10}" y="${cy-60}" width="40" height="40" fill="${p.white}"/>
        <rect x="${cx-50}" y="${cy}" width="40" height="40" fill="${p.white}"/><rect x="${cx-10}" y="${cy-20}" width="20" height="20" fill="${p.white}"/>`;
        } else if (kind === 'apps') {
            inner = [0,1,2,3,4,5].map((i) => {
                const x = cx - 90 + (i % 3) * 70;
                const y = cy - 80 + Math.floor(i / 3) * 80;
                return `<rect x="${x}" y="${y}" width="54" height="54" rx="14" fill="${i === 4 ? p.red : i % 2 ? p.teal : p.structure}"/>`;
            }).join('');
        } else {
            inner = `<rect x="${cx-100}" y="${cy-120}" width="200" height="90" rx="22" fill="${p.white}" stroke="${p.structure}" stroke-width="3"/>
        <circle cx="${cx-70}" cy="${cy-75}" r="16" fill="${p.red}"/>
        <rect x="${cx-40}" y="${cy-85}" width="110" height="10" rx="5" fill="${p.ink}" opacity=".5"/>
        <rect x="${cx-100}" y="${cy+10}" width="200" height="70" rx="20" fill="${p.yellow}" stroke="${p.amber}" stroke-width="3"/>`;
        }
        return `<rect x="${cx-130}" y="${cy-280}" width="260" height="520" rx="48" fill="#171A19" stroke="${p.ink}" stroke-width="7"/>
      <rect x="${cx-112}" y="${cy-250}" width="224" height="450" rx="36" fill="${p.paper2}"/>
      <rect x="${cx-40}" y="${cy-235}" width="80" height="14" rx="7" fill="${p.ink}"/>
      ${inner}
      <rect x="${cx-40}" y="${cy+210}" width="80" height="8" rx="4" fill="${p.ink}" opacity=".35"/>`;
    }
    if (scene === 'password-mfa') {
        return `<rect x="${cx-360}" y="${cy-220}" width="720" height="440" rx="40" fill="${p.white}" stroke="${p.ink}" stroke-width="6"/>
      <rect x="${cx-80}" y="${cy-300}" width="160" height="140" rx="28" fill="${p.teal}" stroke="${p.ink}" stroke-width="5"/>
      <path d="M${cx-40} ${cy-260} V${cy-290} C${cx-40} ${cy-330} ${cx+40} ${cy-330} ${cx+40} ${cy-290} V${cy-260}" fill="none" stroke="${p.ink}" stroke-width="12" stroke-linecap="round"/>
      <rect x="${cx-260}" y="${cy-40}" width="520" height="70" rx="18" fill="${p.paper}" stroke="${p.structure}" stroke-width="3"/>
      ${Array.from({length:10},(_,i)=>`<circle cx="${cx-220+i*48}" cy="${cy-5}" r="8" fill="${p.ink}" opacity=".65"/>`).join('')}
      <rect x="${cx-260}" y="${cy+80}" width="240" height="56" rx="18" fill="${p.teal}"/>
      <rect x="${cx+20}" y="${cy+80}" width="160" height="56" rx="18" fill="${p.yellow}" stroke="${p.amber}" stroke-width="3"/>`;
    }
    if (scene === 'cloud-data') {
        return `<path d="M${cx-200} ${cy+40} C${cx-280} ${cy+40} ${cx-320} ${cy-20} ${cx-280} ${cy-80} C${cx-260} ${cy-160} ${cx-160} ${cy-200} ${cx-60} ${cy-180} C${cx} ${cy-240} ${cx+120} ${cy-220} ${cx+160} ${cy-140} C${cx+240} ${cy-140} ${cx+280} ${cy-60} ${cx+240} ${cy+20} C${cx+280} ${cy+60} ${cx+200} ${cy+100} ${cx+120} ${cy+80} Z" fill="${p.white}" stroke="${p.ink}" stroke-width="6"/>
      <path d="M${cx-20} ${cy-80} V${cy+20} M${cx-70} ${cy-20} L${cx-20} ${cy+20} L${cx+30} ${cy-20}" fill="none" stroke="${p.tealDark}" stroke-width="16" stroke-linecap="round" stroke-linejoin="round"/>
      <rect x="${cx-100}" y="${cy+140}" width="200" height="48" rx="16" fill="${p.teal}"/>
      <circle cx="${cx-280}" cy="${cy+180}" r="50" fill="${p.teal}" opacity=".3"/><circle cx="${cx+280}" cy="${cy+180}" r="40" fill="${p.structure}"/>`;
    }
    if (scene === 'statistics' || scene === 'process-diagram') {
        if (scene === 'statistics') {
            const bars = [0.4, 0.7, 0.55, 0.9, 0.65];
            return `<rect x="${cx-420}" y="${cy-280}" width="840" height="560" rx="40" fill="${p.white}" stroke="${p.ink}" stroke-width="6"/>
        ${bars.map((v,i) => `<rect x="${cx-320+i*140}" y="${cy+180-v*360}" width="90" height="${v*360}" rx="18" fill="${i===3?p.teal:i===1?p.yellow:p.structure}"/>`).join('')}
        <circle cx="${cx+280}" cy="${cy-120}" r="90" fill="${p.paper}" stroke="${p.structure}" stroke-width="4"/>
        <path d="M${cx+280} ${cy-190} A70 70 0 1 1 ${cx+220} ${cy-70}" fill="none" stroke="${p.tealDark}" stroke-width="22" stroke-linecap="round"/>`;
        }
        const pts = [[cx-350,cy-80],[cx-100,cy-180],[cx+150,cy-80],[cx+380,cy-160],[cx+50,cy+160]];
        const links = [[0,1],[1,2],[2,3],[1,4],[2,4]];
        return `${links.map(([a,b])=>`<path d="M${pts[a][0]} ${pts[a][1]} L${pts[b][0]} ${pts[b][1]}" stroke="${p.structure}" stroke-width="8" stroke-linecap="round"/>`).join('')}
      ${pts.map((pt,i)=>`<g transform="translate(${pt[0]} ${pt[1]})"><circle r="56" fill="${i===4?p.teal:p.white}" stroke="${p.ink}" stroke-width="5"/><circle r="18" fill="${i===4?p.ink:p.yellow}"/></g>`).join('')}`;
    }
    if (scene === 'network-attack' || scene === 'data-leak') {
        const nodes = [[.2,.3],[.5,.15],[.8,.28],[.3,.65],[.6,.55],[.85,.7]];
        return `${[[0,1],[1,2],[0,3],[1,4],[2,5],[3,4],[4,5]].map(([a,b],i)=>`<path d="M${nodes[a][0]*w} ${nodes[a][1]*h} L${nodes[b][0]*w} ${nodes[b][1]*h}" stroke="${scene==='data-leak'&&i>4?p.red:p.structure}" stroke-width="5"/>`).join('')}
      ${nodes.map((n,i)=>`<circle cx="${n[0]*w}" cy="${n[1]*h}" r="${i===4?32:24}" fill="${i===4?p.ink:p.white}" stroke="${i===5&&scene==='data-leak'?p.red:p.tealDark}" stroke-width="5"/>`).join('')}`;
    }
    if (scene === 'identity-takeover' || scene === 'social-engineering') {
        return `<circle cx="${cx-220}" cy="${cy-40}" r="90" fill="#D8A783"/><path d="M${cx-320} ${cy+120} C${cx-310} ${cy+20} ${cx-130} ${cy+20} ${cx-120} ${cy+120}Z" fill="${p.teal}"/>
      <circle cx="${cx+220}" cy="${cy-40}" r="90" fill="#787B76"/><path d="M${cx+120} ${cy+120} C${cx+130} ${cy+20} ${cx+310} ${cy+20} ${cx+320} ${cy+120}Z" fill="#343A39"/>
      <path d="M${cx-100} ${cy+40} C${cx-20} ${cy-60} ${cx+20} ${cy-60} ${cx+100} ${cy+40}" fill="none" stroke="${p.red}" stroke-width="8" stroke-dasharray="16 14"/>
      <rect x="${cx-50}" y="${cy+140}" width="100" height="90" rx="18" fill="${p.teal}" stroke="${p.ink}" stroke-width="4"/>
      <path d="M${cx-20} ${cy+140} V${cy+110} C${cx-20} ${cy+80} ${cx+20} ${cy+80} ${cx+20} ${cy+110} V${cy+140}" fill="none" stroke="${p.ink}" stroke-width="10"/>`;
    }
    if (scene === 'ransomware-file') {
        return `<path d="M${cx-180} ${cy-200} H${cx+40} L${cx+120} ${cy-120} V${cy+200} H${cx-180}Z" fill="${p.white}" stroke="${p.ink}" stroke-width="6"/>
      <path d="M${cx+40} ${cy-200} V${cy-120} H${cx+120}" fill="${p.beige}" stroke="${p.ink}" stroke-width="6"/>
      <rect x="${cx-140}" y="${cy-60}" width="160" height="40" rx="12" fill="${p.red}"/>
      <circle cx="${cx+20}" cy="${cy+100}" r="50" fill="${p.yellow}" stroke="${p.red}" stroke-width="5"/>
      <path d="M${cx+20} ${cy+70} V${cy+110} M${cx+20} ${cy+130} v2" stroke="${p.red}" stroke-width="12" stroke-linecap="round"/>`;
    }
    if (scene === 'deepfake') {
        return `<rect x="${cx-300}" y="${cy-280}" width="600" height="560" rx="40" fill="${p.ink}"/>
      <circle cx="${cx}" cy="${cy-40}" r="100" fill="#D8A783"/>
      <path d="M${cx-80} ${cy+100} C${cx-70} ${cy+20} ${cx+70} ${cy+20} ${cx+80} ${cy+100}Z" fill="${p.yellow}"/>
      <rect x="${cx-220}" y="${cy+160}" width="440" height="70" rx="20" fill="#343A39"/>
      ${Array.from({length:24},(_,i)=>{const a=.2+Math.abs(Math.sin(i*.7))*.7;const bh=50*a;return `<rect x="${cx-200+i*18}" y="${cy+195-bh/2}" width="10" height="${bh}" rx="4" fill="${p.teal}"/>`;}).join('')}`;
    }
    // abstract-security default
    return `<circle cx="${cx}" cy="${cy}" r="220" fill="${p.teal}" opacity=".12"/>
      <circle cx="${cx}" cy="${cy}" r="160" fill="${p.white}" stroke="${p.ink}" stroke-width="6"/>
      <rect x="${cx-50}" y="${cy-70}" width="100" height="90" rx="18" fill="${p.teal}" stroke="${p.ink}" stroke-width="4"/>
      <path d="M${cx-25} ${cy-70} V${cy-100} C${cx-25} ${cy-130} ${cx+25} ${cy-130} ${cx+25} ${cy-100} V${cy-70}" fill="none" stroke="${p.ink}" stroke-width="10"/>
      ${[0,1,2,3,4,5].map((i)=>{const a=i*Math.PI/3-0.5;const x=cx+Math.cos(a)*210;const y=cy+Math.sin(a)*180;return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="28" fill="${i%2?p.yellow:p.teal}" stroke="${p.ink}" stroke-width="3"/>`;}).join('')}`;
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
