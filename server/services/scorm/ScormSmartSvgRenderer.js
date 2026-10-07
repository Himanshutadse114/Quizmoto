const DEFAULT_PALETTE = {
    paper: '#E7E7E4', paper2: '#F4F2EC', beige: '#E5DFD2', structure: '#CBC5B8',
    ink: '#282824', body: '#4A4A45', muted: '#77776F', teal: '#4FC9BF', tealDark: '#177E78',
    yellow: '#FCF2B5', amber: '#E7A13A', red: '#D75245', green: '#3F9E7A', white: '#FFFFFF'
};

function escapeXml(value) {
    const amp = '&' + 'amp;';
    const lt = '&' + 'lt;';
    const gt = '&' + 'gt;';
    const quot = '&' + 'quot;';
    const apos = '&' + 'apos;';
    return String(value == null ? '' : value)
        .replace(/&/g, amp)
        .replace(/</g, lt)
        .replace(/>/g, gt)
        .replace(/"/g, quot)
        .replace(/'/g, apos);
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

const DESKTOP_SVG = { width: 1200, height: 1000, designW: 1400, designH: 1000 };
const MOBILE_SVG = { width: 900, height: 1100, designW: 900, designH: 1100 };

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
        case 'center-stage': return `translate(${cx} ${cy}) scale(.92) translate(${-cx} ${-cy})`;
        case 'wide-scene': return `translate(${cx} ${cy * .94}) scale(1.05 .96) translate(${-cx} ${-cy * .94})`;
        case 'full-bleed': return `translate(${cx} ${cy}) scale(1.08) translate(${-cx} ${-cy})`;
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

function ambient(p, w, h, mobile) {
    const cx = w / 2;
    const cy = h / 2;
    return `<circle cx="${cx - 320}" cy="${cy - 260}" r="${mobile ? 140 : 180}" fill="${p.teal}" opacity=".08"/>\n      <circle cx="${cx + 360}" cy="${cy + 280}" r="${mobile ? 120 : 160}" fill="${p.structure}" opacity=".18"/>\n      <circle cx="${cx + 280}" cy="${cy - 300}" r="90" fill="${p.yellow}" opacity=".22"/>\n      <rect x="${cx - 520}" y="${cy - 380}" width="200" height="12" rx="6" fill="${p.structure}" opacity=".25"/>\n      <rect x="${cx - 520}" y="${cy - 350}" width="120" height="8" rx="4" fill="${p.structure}" opacity=".18"/>`;
}

function sceneArtwork(spec, p, mobile) {
    const w = mobile ? 900 : 1400;
    const h = mobile ? 1100 : 1000;
    const cx = w / 2;
    const cy = h / 2;
    const scene = String(spec.scene || 'abstract-security');
    const bg = ambient(p, w, h, mobile);

    if (scene === 'process-diagram') {
        const pts = mobile
            ? [[cx - 280, cy - 40], [cx - 90, cy - 40], [cx + 100, cy - 40], [cx + 290, cy - 40]]
            : [[cx - 420, cy - 20], [cx - 140, cy - 20], [cx + 140, cy - 20], [cx + 420, cy - 20]];
        const labels = ['1', '2', '3', '4'];
        const links = pts.slice(0, -1).map((pt, i) => {
            const next = pts[i + 1];
            const gap = 48;
            return `<path d="M${pt[0] + gap} ${pt[1]} L${next[0] - gap} ${next[1]}" stroke="${p.structure}" stroke-width="8" stroke-linecap="round"/>\n        <polygon points="${next[0] - gap - 2},${next[1] - 10} ${next[0] - gap + 14},${next[1]} ${next[0] - gap - 2},${next[1] + 10}" fill="${p.ink}"/>`;
        }).join('');
        const nodes = pts.map((pt, i) => `<g transform="translate(${pt[0]} ${pt[1]})">\n        <circle r="46" fill="${i === pts.length - 1 ? p.teal : p.white}" stroke="${p.ink}" stroke-width="5"/>\n        <text text-anchor="middle" y="7" font-size="22" font-weight="900" fill="${p.ink}">${labels[i]}</text>\n      </g>`).join('');
        const cards = pts.map((pt, i) => `<rect x="${pt[0] - 70}" y="${pt[1] + 80}" width="140" height="70" rx="16" fill="${p.white}" stroke="${p.structure}" stroke-width="3"/>\n      <rect x="${pt[0] - 50}" y="${pt[1] + 98}" width="100" height="10" rx="5" fill="${p.ink}" opacity=".35"/>\n      <rect x="${pt[0] - 50}" y="${pt[1] + 118}" width="70" height="8" rx="4" fill="${p.structure}" opacity=".5"/>`).join('');
        return `${bg}${links}${nodes}${cards}`;
    }

    if (scene === 'email-threat') {
        return `${bg}\n      <rect x="${cx - 400}" y="${cy - 300}" width="800" height="580" rx="32" fill="${p.white}" stroke="${p.ink}" stroke-width="6"/>\n      <rect x="${cx - 400}" y="${cy - 300}" width="210" height="580" rx="28" fill="${p.ink}"/>\n      <circle cx="${cx - 295}" cy="${cy - 200}" r="38" fill="${p.teal}"/>\n      <rect x="${cx - 150}" y="${cy - 220}" width="460" height="26" rx="10" fill="${p.ink}" opacity=".8"/>\n      <rect x="${cx - 150}" y="${cy - 160}" width="500" height="150" rx="20" fill="${p.yellow}" stroke="${p.amber}" stroke-width="3"/>\n      <circle cx="${cx - 95}" cy="${cy - 85}" r="26" fill="${p.red}"/>\n      <rect x="${cx - 50}" y="${cy - 98}" width="260" height="12" rx="6" fill="${p.ink}" opacity=".55"/>\n      <rect x="${cx - 150}" y="${cy + 40}" width="180" height="44" rx="14" fill="${p.teal}"/>`;
    }
    if (scene === 'browser-phishing') {
        return `${bg}\n      <rect x="${cx - 460}" y="${cy - 310}" width="920" height="620" rx="30" fill="${p.white}" stroke="${p.ink}" stroke-width="6"/>\n      <path d="M${cx - 460} ${cy - 230} H${cx + 460}" stroke="${p.structure}" stroke-width="3"/>\n      <circle cx="${cx - 410}" cy="${cy - 270}" r="11" fill="${p.red}"/><circle cx="${cx - 380}" cy="${cy - 270}" r="11" fill="${p.amber}"/><circle cx="${cx - 350}" cy="${cy - 270}" r="11" fill="${p.green}"/>\n      <rect x="${cx - 300}" y="${cy - 284}" width="540" height="28" rx="14" fill="${p.paper}" stroke="${p.structure}" stroke-width="2"/>\n      <rect x="${cx - 360}" y="${cy - 140}" width="400" height="32" rx="12" fill="${p.ink}" opacity=".85"/>\n      <rect x="${cx - 360}" y="${cy + 20}" width="620" height="100" rx="18" fill="${p.yellow}" stroke="${p.amber}" stroke-width="3"/>\n      <rect x="${cx + 120}" y="${cy + 50}" width="120" height="48" rx="14" fill="${p.red}"/>`;
    }
    if (scene === 'smartphone-scam' || scene === 'malicious-app' || scene === 'qr-phishing') {
        const kind = scene === 'qr-phishing' ? 'qr' : scene === 'malicious-app' ? 'apps' : 'msg';
        let inner = '';
        if (kind === 'apps') {
            inner = [0,1,2,3,4,5].map((i) => {
                const x = cx - 95 + (i % 3) * 72;
                const y = cy - 90 + Math.floor(i / 3) * 84;
                return `<rect x="${x}" y="${y}" width="58" height="58" rx="16" fill="${i === 4 ? p.red : i % 2 ? p.teal : p.structure}"/>`;
            }).join('');
        } else if (kind === 'qr') {
            inner = `<rect x="${cx - 70}" y="${cy - 90}" width="140" height="140" rx="12" fill="${p.ink}"/>`;
        } else {
            inner = `<rect x="${cx - 105}" y="${cy - 140}" width="210" height="88" rx="22" fill="${p.white}" stroke="${p.structure}" stroke-width="3"/>\n        <circle cx="${cx - 72}" cy="${cy - 96}" r="16" fill="${p.red}"/>\n        <rect x="${cx - 105}" y="${cy - 20}" width="210" height="70" rx="20" fill="${p.yellow}" stroke="${p.amber}" stroke-width="3"/>`;
        }
        return `${bg}\n      <rect x="${cx - 140}" y="${cy - 300}" width="280" height="560" rx="48" fill="#171A19" stroke="${p.ink}" stroke-width="7"/>\n      <rect x="${cx - 120}" y="${cy - 268}" width="240" height="480" rx="36" fill="${p.paper2}"/>\n      <rect x="${cx - 42}" y="${cy - 252}" width="84" height="14" rx="7" fill="${p.ink}"/>\n      ${inner}\n      <rect x="${cx - 42}" y="${cy + 220}" width="84" height="8" rx="4" fill="${p.ink}" opacity=".35"/>`;
    }
    if (scene === 'statistics') {
        const bars = [0.42, 0.72, 0.55, 0.92, 0.68];
        return `${bg}\n      <rect x="${cx - 420}" y="${cy - 300}" width="840" height="600" rx="36" fill="${p.white}" stroke="${p.ink}" stroke-width="6"/>\n      ${bars.map((v, i) => `<rect x="${cx - 320 + i * 140}" y="${cy + 200 - v * 380}" width="90" height="${v * 380}" rx="18" fill="${i === 3 ? p.teal : i === 1 ? p.yellow : p.structure}"/>`).join('')}\n      <circle cx="${cx + 300}" cy="${cy - 140}" r="88" fill="${p.paper}" stroke="${p.structure}" stroke-width="4"/>\n      <path d="M${cx + 300} ${cy - 210} A70 70 0 1 1 ${cx + 240} ${cy - 90}" fill="none" stroke="${p.tealDark}" stroke-width="20" stroke-linecap="round"/>`;
    }
    if (scene === 'password-mfa') {
        return `${bg}\n      <rect x="${cx - 380}" y="${cy - 240}" width="760" height="480" rx="36" fill="${p.white}" stroke="${p.ink}" stroke-width="6"/>\n      <rect x="${cx - 90}" y="${cy - 330}" width="180" height="150" rx="28" fill="${p.teal}" stroke="${p.ink}" stroke-width="5"/>\n      <rect x="${cx - 280}" y="${cy - 50}" width="560" height="70" rx="18" fill="${p.paper}" stroke="${p.structure}" stroke-width="3"/>\n      <rect x="${cx - 280}" y="${cy + 70}" width="250" height="56" rx="18" fill="${p.teal}"/>`;
    }
    if (scene === 'cloud-data') {
        return `${bg}\n      <path d="M${cx - 220} ${cy + 30} C${cx - 300} ${cy + 30} ${cx - 340} ${cy - 30} ${cx - 300} ${cy - 90} C${cx - 280} ${cy - 170} ${cx - 170} ${cy - 210} ${cx - 70} ${cy - 190} C${cx - 10} ${cy - 250} ${cx + 130} ${cy - 230} ${cx + 170} ${cy - 150} C${cx + 250} ${cy - 150} ${cx + 290} ${cy - 70} ${cx + 250} ${cy + 10} C${cx + 290} ${cy + 50} ${cx + 210} ${cy + 90} ${cx + 130} ${cy + 70} Z" fill="${p.white}" stroke="${p.ink}" stroke-width="6"/>\n      <path d="M${cx - 30} ${cy - 90} V${cy + 10} M${cx - 80} ${cy - 30} L${cx - 30} ${cy + 10} L${cx + 20} ${cy - 30}" fill="none" stroke="${p.tealDark}" stroke-width="16" stroke-linecap="round" stroke-linejoin="round"/>\n      <rect x="${cx - 110}" y="${cy + 130}" width="220" height="48" rx="16" fill="${p.teal}"/>`;
    }
    if (scene === 'ransomware-file') {
        return `${bg}\n      <path d="M${cx - 200} ${cy - 220} H${cx + 50} L${cx + 140} ${cy - 130} V${cy + 210} H${cx - 200}Z" fill="${p.white}" stroke="${p.ink}" stroke-width="6"/>\n      <rect x="${cx - 160}" y="${cy - 80}" width="180" height="42" rx="12" fill="${p.red}"/>\n      <circle cx="${cx + 40}" cy="${cy + 120}" r="54" fill="${p.yellow}" stroke="${p.red}" stroke-width="5"/>`;
    }
    if (scene === 'deepfake') {
        return `${bg}\n      <rect x="${cx - 320}" y="${cy - 300}" width="640" height="580" rx="36" fill="${p.ink}"/>\n      <circle cx="${cx}" cy="${cy - 60}" r="105" fill="#D8A783"/>\n      <path d="M${cx - 90} ${cy + 90} C${cx - 80} ${cy} ${cx + 80} ${cy} ${cx + 90} ${cy + 90}Z" fill="${p.yellow}"/>`;
    }
    if (scene === 'network-attack' || scene === 'data-leak') {
        const nodes = [[0.18, 0.28], [0.5, 0.16], [0.82, 0.28], [0.28, 0.62], [0.55, 0.55], [0.82, 0.68]];
        return `${bg}\n      ${[[0,1],[1,2],[0,3],[1,4],[2,5],[3,4],[4,5]].map(([a,b],i) => `<path d="M${nodes[a][0]*w} ${nodes[a][1]*h} L${nodes[b][0]*w} ${nodes[b][1]*h}" stroke="${scene==='data-leak'&&i>4?p.red:p.structure}" stroke-width="5"/>`).join('')}\n      ${nodes.map((n,i) => `<circle cx="${n[0]*w}" cy="${n[1]*h}" r="${i===4?36:26}" fill="${i===4?p.ink:p.white}" stroke="${p.tealDark}" stroke-width="5"/>`).join('')}`;
    }
    if (scene === 'identity-takeover' || scene === 'social-engineering') {
        return `${bg}\n      <circle cx="${cx - 230}" cy="${cy - 60}" r="95" fill="#D8A783"/><path d="M${cx - 340} ${cy + 110} C${cx - 330} ${cy} ${cx - 130} ${cy} ${cx - 120} ${cy + 110}Z" fill="${p.teal}"/>\n      <circle cx="${cx + 230}" cy="${cy - 60}" r="95" fill="#787B76"/><path d="M${cx + 120} ${cy + 110} C${cx + 130} ${cy} ${cx + 330} ${cy} ${cx + 340} ${cy + 110}Z" fill="#343A39"/>`;
    }
    return `${bg}\n      <circle cx="${cx}" cy="${cy}" r="240" fill="${p.teal}" opacity=".1"/>\n      <circle cx="${cx}" cy="${cy}" r="175" fill="${p.white}" stroke="${p.ink}" stroke-width="6"/>\n      <rect x="${cx - 55}" y="${cy - 75}" width="110" height="100" rx="18" fill="${p.teal}" stroke="${p.ink}" stroke-width="4"/>\n      <path d="M${cx - 28} ${cy - 75} V${cy - 108} C${cx - 28} ${cy - 140} ${cx + 28} ${cy - 140} ${cx + 28} ${cy - 108} V${cy - 75}" fill="none" stroke="${p.ink}" stroke-width="10"/>\n      ${[0,1,2,3,4,5].map((i) => {
        const a = i * Math.PI / 3 - Math.PI / 2;
        const x = cx + Math.cos(a) * 230;
        const y = cy + Math.sin(a) * 200;
        return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="32" fill="${i % 2 ? p.yellow : p.teal}" stroke="${p.ink}" stroke-width="3"/>\n      <text x="${x.toFixed(1)}" y="${(y + 6).toFixed(1)}" text-anchor="middle" font-size="14" font-weight="900" fill="${p.ink}">${i + 1}</text>`;
    }).join('')}`;
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

    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="${title}" data-scorm-smart-svg="1" data-scene="${scene}" data-composition="${composition}" data-panel-ratio="${mobile ? '9/11' : '6/5'}">\n      <title>${title}</title>\n      <rect width="${width}" height="${height}" fill="${p.paper}"/>\n      <g data-smart-svg-fit="1" transform="${fit.transform}">\n        <g data-smart-svg-scene="${scene}"${sceneTransform ? ` transform="${sceneTransform}"` : ''}>${sceneArtwork(spec, p, mobile)}</g>\n      </g>\n    </svg>`;
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
