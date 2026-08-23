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

function renderOrbitNodes(p, mobile) {
    if (mobile) {
        return `
      <g opacity=".96">
        <path d="M190 835 C315 750 575 750 710 835" fill="none" stroke="${p.tealDark}" stroke-width="5" stroke-linecap="round" opacity=".28"/>
        <g transform="translate(170 810)" filter="url(#coverShadow)">
          <rect width="142" height="112" rx="28" fill="${p.white}" stroke="${p.structure}" stroke-width="3"/>
          <circle cx="45" cy="47" r="20" fill="${p.teal}" opacity=".22"/>
          <path d="M34 47 L42 55 L57 37" fill="none" stroke="${p.tealDark}" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/>
          <rect x="28" y="80" width="84" height="8" rx="4" fill="${p.structure}" opacity=".45"/>
        </g>
        <g transform="translate(379 850)" filter="url(#coverShadow)">
          <rect width="142" height="112" rx="28" fill="${p.white}" stroke="${p.structure}" stroke-width="3"/>
          <circle cx="71" cy="47" r="22" fill="${p.yellow}" opacity=".7"/>
          <path d="M60 47 H82 M71 36 V58" stroke="${p.ink}" stroke-width="6" stroke-linecap="round"/>
          <rect x="29" y="80" width="84" height="8" rx="4" fill="${p.structure}" opacity=".45"/>
        </g>
        <g transform="translate(588 810)" filter="url(#coverShadow)">
          <rect width="142" height="112" rx="28" fill="${p.white}" stroke="${p.structure}" stroke-width="3"/>
          <circle cx="98" cy="42" r="10" fill="${p.teal}"/>
          <circle cx="48" cy="48" r="18" fill="none" stroke="${p.tealDark}" stroke-width="6"/>
          <path d="M61 62 L79 78" stroke="${p.tealDark}" stroke-width="6" stroke-linecap="round"/>
          <rect x="29" y="80" width="84" height="8" rx="4" fill="${p.structure}" opacity=".45"/>
        </g>
      </g>`;
    }

    return `
      <g opacity=".98">
        <path d="M215 598 C390 525 810 525 985 598" fill="none" stroke="${p.tealDark}" stroke-width="5" stroke-linecap="round" opacity=".24"/>
        <g transform="translate(120 552)" filter="url(#coverShadow)">
          <rect width="182" height="122" rx="30" fill="${p.white}" stroke="${p.structure}" stroke-width="3"/>
          <circle cx="52" cy="47" r="23" fill="${p.teal}" opacity=".22"/>
          <path d="M40 47 L49 56 L66 35" fill="none" stroke="${p.tealDark}" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/>
          <rect x="31" y="88" width="116" height="9" rx="5" fill="${p.structure}" opacity=".48"/>
        </g>
        <g transform="translate(509 570)" filter="url(#coverShadow)">
          <rect width="182" height="122" rx="30" fill="${p.white}" stroke="${p.structure}" stroke-width="3"/>
          <circle cx="91" cy="47" r="26" fill="${p.yellow}" opacity=".72"/>
          <path d="M78 47 H104 M91 34 V60" stroke="${p.ink}" stroke-width="7" stroke-linecap="round"/>
          <rect x="32" y="88" width="118" height="9" rx="5" fill="${p.structure}" opacity=".48"/>
        </g>
        <g transform="translate(898 552)" filter="url(#coverShadow)">
          <rect width="182" height="122" rx="30" fill="${p.white}" stroke="${p.structure}" stroke-width="3"/>
          <circle cx="126" cy="38" r="11" fill="${p.teal}"/>
          <circle cx="58" cy="50" r="21" fill="none" stroke="${p.tealDark}" stroke-width="7"/>
          <path d="M73 66 L94 86" stroke="${p.tealDark}" stroke-width="7" stroke-linecap="round"/>
          <rect x="32" y="88" width="118" height="9" rx="5" fill="${p.structure}" opacity=".48"/>
        </g>
      </g>`;
}

function renderCourseCoverSvg(spec = {}, analysis = {}, options = {}) {
    const mobile = Boolean(options.mobile);
    const { width, height } = coverDimensions(mobile);
    const p = { ...DEFAULT_PALETTE, ...(options.palette || {}) };
    const scene = escapeXml(spec.scene || 'abstract-security');
    const label = escapeXml(analysis.title || spec.visualTitle || 'Course cover');
    const artwork = sceneArtwork(spec, p, mobile);

    const frame = mobile
        ? { x: 104, y: 118, w: 692, h: 650, r: 54 }
        : { x: 150, y: 64, w: 900, h: 470, r: 52 };
    const artTransform = mobile
        ? `translate(${frame.x + 105} ${frame.y + 24}) scale(.53)`
        : `translate(300 70) scale(.42)`;

    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="${label}" data-scorm-course-cover="1" data-cover-scene="${scene}" data-panel-ratio="${mobile ? '9/11' : '5/3'}">
      <title>${label}</title>
      <defs>
        <linearGradient id="coverPaper" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color="${p.paper2}"/>
          <stop offset=".55" stop-color="${p.paper}"/>
          <stop offset="1" stop-color="${p.beige}"/>
        </linearGradient>
        <linearGradient id="coverFrame" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color="${p.ink}"/>
          <stop offset="1" stop-color="#111B1A"/>
        </linearGradient>
        <radialGradient id="coverGlow" cx="50%" cy="45%" r="60%">
          <stop offset="0" stop-color="${p.teal}" stop-opacity=".34"/>
          <stop offset="1" stop-color="${p.teal}" stop-opacity="0"/>
        </radialGradient>
        <filter id="coverShadow" x="-30%" y="-30%" width="160%" height="180%">
          <feDropShadow dx="0" dy="18" stdDeviation="22" flood-color="#101816" flood-opacity=".18"/>
        </filter>
        <filter id="coverDeepShadow" x="-30%" y="-30%" width="160%" height="180%">
          <feDropShadow dx="0" dy="30" stdDeviation="34" flood-color="#101816" flood-opacity=".24"/>
        </filter>
        <clipPath id="coverSceneClip"><rect x="${frame.x + 22}" y="${frame.y + 22}" width="${frame.w - 44}" height="${frame.h - 44}" rx="${frame.r - 18}"/></clipPath>
      </defs>

      <rect width="${width}" height="${height}" fill="url(#coverPaper)"/>
      <circle cx="${mobile ? 110 : 70}" cy="${mobile ? 130 : 100}" r="${mobile ? 180 : 170}" fill="${p.teal}" opacity=".10"/>
      <circle cx="${mobile ? 820 : 1120}" cy="${mobile ? 250 : 140}" r="${mobile ? 155 : 140}" fill="${p.yellow}" opacity=".35"/>
      <circle cx="${mobile ? 720 : 1080}" cy="${mobile ? 960 : 670}" r="${mobile ? 190 : 170}" fill="${p.structure}" opacity=".28"/>
      <path d="M${mobile ? 60 : 50} ${mobile ? 260 : 190} C${mobile ? 240 : 280} ${mobile ? 80 : 10} ${mobile ? 640 : 900} ${mobile ? 70 : 20} ${mobile ? 838 : 1150} ${mobile ? 290 : 220}" fill="none" stroke="${p.tealDark}" stroke-width="3" opacity=".12"/>

      <g filter="url(#coverDeepShadow)">
        <rect x="${frame.x}" y="${frame.y}" width="${frame.w}" height="${frame.h}" rx="${frame.r}" fill="url(#coverFrame)"/>
        <rect x="${frame.x + 14}" y="${frame.y + 14}" width="${frame.w - 28}" height="${frame.h - 28}" rx="${frame.r - 12}" fill="none" stroke="${p.white}" stroke-width="2" opacity=".14"/>
        <rect x="${frame.x + 22}" y="${frame.y + 22}" width="${frame.w - 44}" height="${frame.h - 44}" rx="${frame.r - 18}" fill="${p.paper2}"/>
        <g clip-path="url(#coverSceneClip)">
          <rect x="${frame.x + 22}" y="${frame.y + 22}" width="${frame.w - 44}" height="${frame.h - 44}" fill="url(#coverGlow)"/>
          <g transform="${artTransform}" opacity=".98">${artwork}</g>
        </g>
      </g>

      <g filter="url(#coverShadow)">
        <circle cx="${mobile ? 170 : 190}" cy="${mobile ? 210 : 125}" r="${mobile ? 52 : 52}" fill="${p.teal}"/>
        <path d="M${mobile ? 148 : 169} ${mobile ? 212 : 127} L${mobile ? 164 : 184} ${mobile ? 228 : 142} L${mobile ? 193 : 216} ${mobile ? 190 : 106}" fill="none" stroke="${p.ink}" stroke-width="${mobile ? 10 : 10}" stroke-linecap="round" stroke-linejoin="round"/>
      </g>

      <g opacity=".9">
        <circle cx="${mobile ? 735 : 930}" cy="${mobile ? 176 : 120}" r="9" fill="${p.teal}"/>
        <circle cx="${mobile ? 766 : 970}" cy="${mobile ? 176 : 120}" r="9" fill="${p.yellow}"/>
        <circle cx="${mobile ? 797 : 1010}" cy="${mobile ? 176 : 120}" r="9" fill="${p.structure}"/>
      </g>

      ${renderOrbitNodes(p, mobile)}
    </svg>`;

    return sanitizeSvg(svg);
}

module.exports = {
    renderCourseCoverSvg
};
