const {
    DEFAULT_PALETTE,
    MOBILE_SVG,
    escapeXml,
    sanitizeSvg,
    sceneArtwork
} = require('./ScormSmartSvgRenderer');

function coverDimensions(mobile) {
    return mobile
        ? { width: MOBILE_SVG.width, height: MOBILE_SVG.height }
        : { width: 1200, height: 720 };
}

function coverLabels(scene) {
    const value = String(scene || '').toLowerCase();
    if (/social-engineering|email-threat|browser-phishing|qr-phishing|smartphone-scam/.test(value)) {
        return ['PAUSE', 'VERIFY', 'REPORT'];
    }
    if (/password|identity|mfa/.test(value)) return ['CHECK', 'PROTECT', 'CONFIRM'];
    if (/cloud|data/.test(value)) return ['CLASSIFY', 'PROTECT', 'SHARE SAFELY'];
    if (/ransom|malware|file/.test(value)) return ['STOP', 'ISOLATE', 'REPORT'];
    return ['RECOGNISE', 'DECIDE', 'ACT SAFELY'];
}

function shieldMark(cx, cy, scale, p) {
    const s = Number(scale || 1);
    const path = [
        `M ${cx} ${cy - 96 * s}`,
        `L ${cx + 78 * s} ${cy - 64 * s}`,
        `V ${cy - 2 * s}`,
        `C ${cx + 78 * s} ${cy + 62 * s} ${cx + 35 * s} ${cy + 102 * s} ${cx} ${cy + 122 * s}`,
        `C ${cx - 35 * s} ${cy + 102 * s} ${cx - 78 * s} ${cy + 62 * s} ${cx - 78 * s} ${cy - 2 * s}`,
        `V ${cy - 64 * s} Z`
    ].join(' ');
    return `<path d="${path}" fill="${p.teal}" stroke="${p.ink}" stroke-width="${8 * s}" stroke-linejoin="round"/>
      <path d="M ${cx - 35 * s} ${cy + 3 * s} L ${cx - 6 * s} ${cy + 34 * s} L ${cx + 48 * s} ${cy - 31 * s}" fill="none" stroke="${p.ink}" stroke-width="${12 * s}" stroke-linecap="round" stroke-linejoin="round"/>`;
}

function stepPills(labels, p, mobile) {
    if (mobile) {
        const y = 930;
        return labels.map((label, index) => {
            const x = 70 + index * 270;
            return `<g transform="translate(${x} ${y})">
              <rect width="220" height="86" rx="28" fill="${index === 1 ? p.teal : p.white}" stroke="${p.structure}" stroke-width="3"/>
              <circle cx="42" cy="43" r="20" fill="${index === 1 ? p.ink : p.teal}" opacity="${index === 1 ? '1' : '.9'}"/>
              <text x="74" y="50" font-size="18" font-weight="900" fill="${p.ink}">${escapeXml(label)}</text>
            </g>`;
        }).join('');
    }

    const widths = [260, 260, 260];
    const xs = [95, 470, 845];
    return labels.map((label, index) => `<g transform="translate(${xs[index]} 585)">
      <rect width="${widths[index]}" height="82" rx="26" fill="${index === 1 ? p.teal : p.white}" stroke="${p.structure}" stroke-width="3"/>
      <circle cx="44" cy="41" r="20" fill="${index === 1 ? p.ink : p.teal}"/>
      <text x="78" y="49" font-size="19" font-weight="900" letter-spacing="1" fill="${p.ink}">${escapeXml(label)}</text>
    </g>`).join('');
}

function socialEngineeringCover(p, mobile) {
    if (mobile) {
        return `
      <rect x="54" y="70" width="792" height="720" rx="52" fill="${p.ink}"/>
      <rect x="82" y="98" width="736" height="664" rx="38" fill="#121918" stroke="${p.white}" stroke-opacity=".10" stroke-width="2"/>

      <g transform="translate(118 145)">
        <rect width="664" height="318" rx="34" fill="${p.white}"/>
        <circle cx="72" cy="70" r="34" fill="${p.teal}"/>
        <circle cx="72" cy="60" r="13" fill="${p.ink}" opacity=".75"/>
        <path d="M47 91 C54 70 90 70 97 91" fill="${p.ink}" opacity=".75"/>
        <rect x="126" y="42" width="270" height="24" rx="12" fill="${p.ink}" opacity=".86"/>
        <rect x="126" y="80" width="190" height="16" rx="8" fill="${p.structure}"/>
        <rect x="470" y="38" width="150" height="52" rx="18" fill="${p.yellow}" stroke="${p.amber}" stroke-width="3"/>
        <text x="545" y="71" text-anchor="middle" font-size="17" font-weight="900" fill="${p.ink}">URGENT</text>

        <rect x="44" y="144" width="540" height="18" rx="9" fill="${p.ink}" opacity=".76"/>
        <rect x="44" y="181" width="465" height="14" rx="7" fill="${p.structure}"/>
        <rect x="44" y="211" width="505" height="14" rx="7" fill="${p.structure}"/>
        <rect x="44" y="254" width="226" height="44" rx="16" fill="${p.red}" opacity=".88"/>
        <rect x="292" y="254" width="170" height="44" rx="16" fill="${p.paper}" stroke="${p.structure}" stroke-width="2"/>
      </g>

      <path d="M310 510 C390 565 505 575 575 525" fill="none" stroke="${p.teal}" stroke-width="12" stroke-linecap="round"/>
      <path d="M555 500 L596 517 L570 552" fill="none" stroke="${p.teal}" stroke-width="12" stroke-linecap="round" stroke-linejoin="round"/>

      <g transform="translate(450 610)">
        <circle cx="0" cy="0" r="130" fill="${p.paper2}" stroke="${p.teal}" stroke-width="8"/>
        ${shieldMark(0, -4, .78, p)}
      </g>

      <g transform="translate(120 590)">
        <rect width="220" height="104" rx="28" fill="${p.paper2}" stroke="${p.structure}" stroke-width="3"/>
        <circle cx="50" cy="52" r="25" fill="${p.yellow}"/>
        <path d="M50 34 V56 M50 72 V74" stroke="${p.ink}" stroke-width="8" stroke-linecap="round"/>
        <rect x="92" y="34" width="92" height="15" rx="8" fill="${p.ink}" opacity=".76"/>
        <rect x="92" y="62" width="70" height="11" rx="6" fill="${p.structure}"/>
      </g>`;
    }

    return `
      <rect x="60" y="52" width="1080" height="485" rx="48" fill="${p.ink}"/>
      <rect x="80" y="72" width="1040" height="445" rx="36" fill="#121918" stroke="${p.white}" stroke-opacity=".10" stroke-width="2"/>

      <g transform="translate(118 112)">
        <rect width="620" height="350" rx="34" fill="${p.white}"/>
        <circle cx="68" cy="67" r="33" fill="${p.teal}"/>
        <circle cx="68" cy="57" r="12" fill="${p.ink}" opacity=".75"/>
        <path d="M44 87 C50 68 86 68 92 87" fill="${p.ink}" opacity=".75"/>
        <rect x="120" y="39" width="248" height="24" rx="12" fill="${p.ink}" opacity=".87"/>
        <rect x="120" y="78" width="174" height="15" rx="8" fill="${p.structure}"/>
        <rect x="448" y="34" width="134" height="50" rx="17" fill="${p.yellow}" stroke="${p.amber}" stroke-width="3"/>
        <text x="515" y="66" text-anchor="middle" font-size="16" font-weight="900" fill="${p.ink}">URGENT</text>

        <rect x="42" y="138" width="505" height="18" rx="9" fill="${p.ink}" opacity=".76"/>
        <rect x="42" y="175" width="430" height="14" rx="7" fill="${p.structure}"/>
        <rect x="42" y="204" width="474" height="14" rx="7" fill="${p.structure}"/>
        <rect x="42" y="248" width="216" height="46" rx="15" fill="${p.red}" opacity=".86"/>
        <rect x="280" y="248" width="164" height="46" rx="15" fill="${p.paper}" stroke="${p.structure}" stroke-width="2"/>
        <circle cx="552" cy="272" r="22" fill="${p.yellow}"/>
        <path d="M552 255 V274 M552 287 V289" stroke="${p.ink}" stroke-width="7" stroke-linecap="round"/>
      </g>

      <path d="M770 275 H842" stroke="${p.teal}" stroke-width="12" stroke-linecap="round"/>
      <path d="M824 250 L854 275 L824 300" fill="none" stroke="${p.teal}" stroke-width="12" stroke-linecap="round" stroke-linejoin="round"/>

      <g transform="translate(942 275)">
        <circle cx="0" cy="0" r="142" fill="${p.paper2}" stroke="${p.teal}" stroke-width="8"/>
        ${shieldMark(0, -5, .82, p)}
        <rect x="-84" y="94" width="168" height="34" rx="17" fill="${p.white}"/>
        <text x="0" y="117" text-anchor="middle" font-size="14" font-weight="900" letter-spacing="1" fill="${p.ink}">VERIFY FIRST</text>
      </g>`;
}

function generalCover(spec, p, mobile) {
    const artwork = sceneArtwork(spec, p, mobile);
    if (mobile) {
        return `
      <rect x="55" y="72" width="790" height="720" rx="52" fill="${p.ink}"/>
      <rect x="82" y="99" width="736" height="666" rx="38" fill="${p.paper2}"/>
      <g transform="translate(0 20) scale(.92)" opacity=".98">${artwork}</g>`;
    }
    return `
      <rect x="60" y="52" width="1080" height="485" rx="48" fill="${p.ink}"/>
      <rect x="82" y="74" width="1036" height="441" rx="36" fill="${p.paper2}"/>
      <g transform="translate(258 34) scale(.50)" opacity=".98">${artwork}</g>`;
}

function renderCourseCoverSvg(spec = {}, analysis = {}, options = {}) {
    const mobile = Boolean(options.mobile);
    const { width, height } = coverDimensions(mobile);

    // Keep the neutral Editorial paper/ink palette but reserve the product teal
    // as the visual action colour. The theme's primary can be charcoal, which
    // previously removed all hierarchy from the cover artwork.
    const incoming = options.palette || {};
    const p = {
        ...DEFAULT_PALETTE,
        ...incoming,
        teal: DEFAULT_PALETTE.teal,
        tealDark: DEFAULT_PALETTE.tealDark
    };

    const rawScene = String(spec.scene || 'abstract-security');
    const scene = escapeXml(rawScene);
    const label = escapeXml(analysis.title || spec.visualTitle || 'Course cover');
    const labels = coverLabels(rawScene);
    const isSocial = /social-engineering|email-threat|browser-phishing|qr-phishing|smartphone-scam/.test(rawScene.toLowerCase());
    const artwork = isSocial ? socialEngineeringCover(p, mobile) : generalCover(spec, p, mobile);

    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="${label}" data-scorm-course-cover="1" data-cover-scene="${scene}" data-cover-version="2" data-panel-ratio="${mobile ? '9/11' : '5/3'}">
      <title>${label}</title>
      <defs>
        <linearGradient id="qmxCoverPaper" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color="${p.paper2}"/>
          <stop offset=".55" stop-color="${p.paper}"/>
          <stop offset="1" stop-color="${p.beige}"/>
        </linearGradient>
        <linearGradient id="qmxCoverGlow" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color="${p.teal}" stop-opacity=".18"/>
          <stop offset="1" stop-color="${p.teal}" stop-opacity="0"/>
        </linearGradient>
      </defs>

      <rect width="${width}" height="${height}" fill="url(#qmxCoverPaper)"/>
      <circle cx="${mobile ? 62 : 70}" cy="${mobile ? 110 : 86}" r="${mobile ? 145 : 135}" fill="${p.teal}" opacity=".12"/>
      <circle cx="${mobile ? 842 : 1135}" cy="${mobile ? 150 : 100}" r="${mobile ? 150 : 130}" fill="${p.yellow}" opacity=".48"/>
      <path d="M${mobile ? 25 : 28} ${mobile ? 265 : 180} C${mobile ? 260 : 300} ${mobile ? 60 : 20} ${mobile ? 650 : 900} ${mobile ? 70 : 26} ${mobile ? 885 : 1172} ${mobile ? 300 : 205}" fill="none" stroke="${p.tealDark}" stroke-width="3" opacity=".10"/>
      <rect x="${mobile ? 30 : 30}" y="${mobile ? 28 : 26}" width="${mobile ? 840 : 1140}" height="${mobile ? 1044 : 666}" rx="${mobile ? 58 : 44}" fill="none" stroke="${p.ink}" stroke-opacity=".08" stroke-width="2"/>

      ${artwork}
      ${stepPills(labels, p, mobile)}
    </svg>`;

    return sanitizeSvg(svg);
}

module.exports = {
    renderCourseCoverSvg,
    coverLabels,
    socialEngineeringCover
};
