const DEFAULT_PALETTE = {
    paper: '#E7E7E4',
    paper2: '#F4F2EC',
    beige: '#E5DFD2',
    structure: '#CBC5B8',
    ink: '#282824',
    body: '#4A4A45',
    muted: '#77776F',
    teal: '#4FC9BF',
    tealDark: '#177E78',
    yellow: '#FCF2B5',
    amber: '#E7A13A',
    red: '#D75245',
    green: '#3F9E7A',
    white: '#FFFFFF'
};

function escapeXml(value) {
    return String(value == null ? '' : value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');
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

function shadowDefs(p) {
    return `<defs>
      <linearGradient id="paperWash" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="${p.paper2}"/><stop offset="1" stop-color="${p.beige}"/>
      </linearGradient>
      <linearGradient id="tealGlow" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="${p.teal}"/><stop offset="1" stop-color="${p.tealDark}"/>
      </linearGradient>
      <linearGradient id="darkGlass" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="#343A39"/><stop offset="1" stop-color="#171A19"/>
      </linearGradient>
      <radialGradient id="softHalo" cx="50%" cy="50%" r="60%">
        <stop offset="0" stop-color="${p.teal}" stop-opacity=".28"/><stop offset="1" stop-color="${p.teal}" stop-opacity="0"/>
      </radialGradient>
      <filter id="softShadow" x="-30%" y="-30%" width="160%" height="180%">
        <feDropShadow dx="0" dy="24" stdDeviation="28" flood-color="#141411" flood-opacity=".18"/>
      </filter>
      <filter id="smallShadow" x="-30%" y="-30%" width="160%" height="180%">
        <feDropShadow dx="0" dy="10" stdDeviation="12" flood-color="#141411" flood-opacity=".16"/>
      </filter>
      <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
        <feGaussianBlur stdDeviation="12" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
      </filter>
      <pattern id="microGrid" width="42" height="42" patternUnits="userSpaceOnUse">
        <path d="M42 0H0V42" fill="none" stroke="${p.structure}" stroke-width="1" opacity=".28"/>
      </pattern>
      <clipPath id="phoneClip"><rect x="0" y="0" width="410" height="760" rx="54"/></clipPath>
    </defs>`;
}

function background(p, width, height, mood) {
    const warm = mood === 'urgent' ? p.yellow : p.teal;
    return `<rect width="${width}" height="${height}" fill="url(#paperWash)"/>
      <circle cx="${Math.round(width * .78)}" cy="${Math.round(height * .25)}" r="${Math.round(Math.min(width, height) * .37)}" fill="${warm}" opacity=".10"/>
      <circle cx="${Math.round(width * .18)}" cy="${Math.round(height * .88)}" r="${Math.round(Math.min(width, height) * .26)}" fill="${p.teal}" opacity=".07"/>
      <rect width="${width}" height="${height}" fill="url(#microGrid)" opacity=".32"/>
      <path d="M0 ${Math.round(height * .88)} C ${Math.round(width * .25)} ${Math.round(height * .75)}, ${Math.round(width * .7)} ${Math.round(height * 1.03)}, ${width} ${Math.round(height * .82)} L ${width} ${height} L 0 ${height}Z" fill="${p.ink}" opacity=".035"/>`;
}

function uiLines(x, y, widths, p, lineHeight = 14) {
    return widths.map((width, index) => `<rect x="${x}" y="${y + index * (lineHeight + 12)}" width="${width}" height="${lineHeight}" rx="7" fill="${p.body}" opacity="${index === 0 ? '.48' : '.25'}"/>`).join('');
}

function alertTriangle(x, y, size, p) {
    const h = size * .88;
    return `<g transform="translate(${x} ${y})" filter="url(#smallShadow)">
      <path d="M${size / 2} 0 L${size} ${h} H0Z" fill="${p.yellow}" stroke="${p.ink}" stroke-width="5" stroke-linejoin="round"/>
      <rect x="${size / 2 - 4}" y="${h * .28}" width="8" height="${h * .31}" rx="4" fill="${p.ink}"/>
      <circle cx="${size / 2}" cy="${h * .72}" r="5" fill="${p.ink}"/>
    </g>`;
}

function lockShape(x, y, scale, p, open = false) {
    const s = Number(scale || 1);
    const shackle = open
        ? `<path d="M45 58 V42 C45 5 105 0 117 35" fill="none" stroke="${p.ink}" stroke-width="14" stroke-linecap="round"/>`
        : `<path d="M45 58 V42 C45 4 117 4 117 42 V58" fill="none" stroke="${p.ink}" stroke-width="14" stroke-linecap="round"/>`;
    return `<g transform="translate(${x} ${y}) scale(${s})" filter="url(#smallShadow)">
      ${shackle}<rect x="22" y="54" width="118" height="104" rx="24" fill="url(#tealGlow)" stroke="${p.ink}" stroke-width="5"/>
      <circle cx="81" cy="100" r="12" fill="${p.ink}"/><path d="M81 110 V132" stroke="${p.ink}" stroke-width="9" stroke-linecap="round"/>
    </g>`;
}

function personBust(x, y, scale, p, role = 'user') {
    const s = scale || 1;
    const fill = role === 'attacker' ? '#343A39' : p.teal;
    const face = role === 'attacker' ? '#787B76' : '#D8A783';
    return `<g transform="translate(${x} ${y}) scale(${s})">
      <ellipse cx="86" cy="204" rx="92" ry="38" fill="${p.ink}" opacity=".11"/>
      <path d="M18 202 C20 145 52 123 86 123 C122 123 153 148 156 202Z" fill="${fill}"/>
      <circle cx="86" cy="72" r="50" fill="${face}"/>
      <path d="M39 66 C43 16 129 2 139 65 C116 42 70 38 39 66Z" fill="${role === 'attacker' ? p.ink : '#413A34'}"/>
      ${role === 'attacker' ? `<path d="M34 65 C52 42 119 34 140 66 L130 97 C112 78 60 78 43 98Z" fill="${p.ink}" opacity=".76"/>` : ''}
      <path d="M68 82 Q86 92 104 82" fill="none" stroke="${p.ink}" stroke-width="4" stroke-linecap="round" opacity=".45"/>
    </g>`;
}

function browserWindow(x, y, w, h, p, suspicious = true) {
    const barH = Math.round(h * .13);
    return `<g transform="translate(${x} ${y})" filter="url(#softShadow)">
      <rect width="${w}" height="${h}" rx="34" fill="${p.white}" stroke="${p.ink}" stroke-width="6"/>
      <path d="M0 ${barH} H${w}" stroke="${p.structure}" stroke-width="3"/>
      <circle cx="38" cy="${barH / 2}" r="9" fill="${p.red}"/><circle cx="68" cy="${barH / 2}" r="9" fill="${p.amber}"/><circle cx="98" cy="${barH / 2}" r="9" fill="${p.green}"/>
      <rect x="142" y="${Math.round(barH * .27)}" width="${w - 180}" height="${Math.round(barH * .46)}" rx="${Math.round(barH * .23)}" fill="${p.paper}" stroke="${p.structure}" stroke-width="2"/>
      <circle cx="174" cy="${barH / 2}" r="11" fill="${suspicious ? p.amber : p.green}"/>
      <rect x="198" y="${barH / 2 - 6}" width="${Math.round(w * .34)}" height="12" rx="6" fill="${p.body}" opacity=".28"/>
      <rect x="${Math.round(w * .12)}" y="${Math.round(h * .27)}" width="${Math.round(w * .48)}" height="${Math.round(h * .08)}" rx="12" fill="${p.ink}" opacity=".86"/>
      ${uiLines(Math.round(w * .12), Math.round(h * .40), [w * .66, w * .54, w * .61], p, 12)}
      <rect x="${Math.round(w * .12)}" y="${Math.round(h * .67)}" width="${Math.round(w * .76)}" height="${Math.round(h * .16)}" rx="20" fill="${suspicious ? p.yellow : p.beige}" stroke="${suspicious ? p.amber : p.structure}" stroke-width="3"/>
      <rect x="${Math.round(w * .18)}" y="${Math.round(h * .72)}" width="${Math.round(w * .42)}" height="15" rx="8" fill="${p.ink}" opacity=".58"/>
      <rect x="${Math.round(w * .68)}" y="${Math.round(h * .70)}" width="${Math.round(w * .14)}" height="${Math.round(h * .07)}" rx="14" fill="${suspicious ? p.red : p.teal}"/>
    </g>`;
}

function emailClient(x, y, w, h, p) {
    return `<g transform="translate(${x} ${y})" filter="url(#softShadow)">
      <rect width="${w}" height="${h}" rx="32" fill="${p.white}" stroke="${p.ink}" stroke-width="6"/>
      <rect width="${Math.round(w * .28)}" height="${h}" rx="28" fill="${p.ink}"/>
      <circle cx="${Math.round(w * .14)}" cy="72" r="30" fill="${p.teal}"/>
      <path d="M${Math.round(w * .14) - 17} 65 L${Math.round(w * .14)} 78 L${Math.round(w * .14) + 17} 65" fill="none" stroke="${p.ink}" stroke-width="5"/>
      ${[142, 200, 258, 316, 374].map((yy, i) => `<rect x="38" y="${yy}" width="${Math.round(w * (.18 + (i % 2) * .03))}" height="13" rx="7" fill="${p.white}" opacity="${i === 0 ? '.72' : '.32'}"/>`).join('')}
      <rect x="${Math.round(w * .34)}" y="58" width="${Math.round(w * .54)}" height="28" rx="10" fill="${p.ink}" opacity=".78"/>
      <rect x="${Math.round(w * .34)}" y="113" width="${Math.round(w * .56)}" height="${Math.round(h * .23)}" rx="20" fill="${p.yellow}" stroke="${p.amber}" stroke-width="3"/>
      <circle cx="${Math.round(w * .39)}" cy="${Math.round(h * .19)}" r="22" fill="${p.red}"/>
      <rect x="${Math.round(w * .44)}" y="${Math.round(h * .16)}" width="${Math.round(w * .31)}" height="14" rx="7" fill="${p.ink}" opacity=".72"/>
      <rect x="${Math.round(w * .44)}" y="${Math.round(h * .21)}" width="${Math.round(w * .42)}" height="10" rx="5" fill="${p.body}" opacity=".35"/>
      ${uiLines(Math.round(w * .34), Math.round(h * .43), [w * .52, w * .46, w * .56, w * .38], p, 11)}
      <rect x="${Math.round(w * .34)}" y="${Math.round(h * .75)}" width="${Math.round(w * .28)}" height="${Math.round(h * .10)}" rx="16" fill="${p.teal}"/>
      <path d="M${Math.round(w * .37)} ${Math.round(h * .80)} h${Math.round(w * .12)}" stroke="${p.ink}" stroke-width="8" stroke-linecap="round" opacity=".65"/>
    </g>`;
}

function qrMark(x, y, size, p) {
    const cell = size / 9;
    const bits = [
        '111011111','101010001','111011101','000110001','101011101','010101000','111011111','101000101','111101111'
    ];
    return `<g transform="translate(${x} ${y})" filter="url(#smallShadow)">
      <rect x="-18" y="-18" width="${size + 36}" height="${size + 36}" rx="22" fill="${p.white}" stroke="${p.ink}" stroke-width="4"/>
      ${bits.map((row, r) => row.split('').map((bit, c) => bit === '1' ? `<rect x="${(c * cell).toFixed(2)}" y="${(r * cell).toFixed(2)}" width="${(cell * .82).toFixed(2)}" height="${(cell * .82).toFixed(2)}" rx="2" fill="${p.ink}"/>` : '').join('')).join('')}
    </g>`;
}

function phoneDevice(x, y, scale, p, kind = 'message') {
    const s = scale || 1;
    let content = '';
    if (kind === 'qr') {
        content = `${qrMark(88, 205, 235, p)}<rect x="74" y="500" width="260" height="18" rx="9" fill="${p.ink}" opacity=".6"/><rect x="105" y="542" width="196" height="13" rx="7" fill="${p.body}" opacity=".3"/>`;
    } else if (kind === 'apps') {
        content = `<rect x="54" y="120" width="302" height="74" rx="24" fill="${p.yellow}" stroke="${p.amber}" stroke-width="3"/>${[0,1,2,3,4,5,6,7].map((i) => { const cx = 70 + (i % 4) * 80; const cy = 245 + Math.floor(i / 4) * 106; return `<rect x="${cx}" y="${cy}" width="58" height="58" rx="17" fill="${i === 5 ? p.red : i % 2 ? p.teal : p.structure}"/><circle cx="${cx + 50}" cy="${cy + 8}" r="10" fill="${i === 5 ? p.yellow : p.white}"/>`; }).join('')}${uiLines(62, 500, [275, 230, 260], p, 11)}`;
    } else {
        content = `<rect x="48" y="118" width="314" height="140" rx="28" fill="${p.white}" stroke="${p.structure}" stroke-width="3"/><circle cx="85" cy="160" r="22" fill="${p.red}"/>${uiLines(122, 143, [180, 142, 200], p, 10)}<rect x="76" y="302" width="260" height="102" rx="26" fill="${p.yellow}" stroke="${p.amber}" stroke-width="3"/>${uiLines(104, 330, [205, 168], p, 10)}<rect x="76" y="454" width="260" height="74" rx="23" fill="${p.teal}"/>${uiLines(108, 479, [160], p, 10)}`;
    }
    return `<g transform="translate(${x} ${y}) scale(${s})" filter="url(#softShadow)">
      <rect width="410" height="760" rx="58" fill="url(#darkGlass)" stroke="${p.ink}" stroke-width="7"/>
      <rect x="18" y="20" width="374" height="720" rx="44" fill="${p.paper2}"/>
      <rect x="150" y="38" width="110" height="24" rx="12" fill="${p.ink}"/>
      <g clip-path="url(#phoneClip)">${content}</g>
      <rect x="150" y="710" width="110" height="9" rx="5" fill="${p.ink}" opacity=".36"/>
    </g>`;
}

function fileCard(x, y, scale, p, infected = true) {
    const s = scale || 1;
    return `<g transform="translate(${x} ${y}) scale(${s})" filter="url(#softShadow)">
      <path d="M0 0 H270 L370 100 V500 H0Z" fill="${p.white}" stroke="${p.ink}" stroke-width="6" stroke-linejoin="round"/>
      <path d="M270 0 V100 H370" fill="${p.beige}" stroke="${p.ink}" stroke-width="6"/>
      <rect x="52" y="150" width="170" height="54" rx="16" fill="${infected ? p.red : p.teal}"/>
      <rect x="52" y="244" width="250" height="16" rx="8" fill="${p.ink}" opacity=".63"/>
      <rect x="52" y="282" width="210" height="13" rx="7" fill="${p.body}" opacity=".28"/>
      <rect x="52" y="319" width="238" height="13" rx="7" fill="${p.body}" opacity=".28"/>
      <circle cx="288" cy="410" r="54" fill="${infected ? p.yellow : p.beige}" stroke="${infected ? p.red : p.structure}" stroke-width="5"/>
      ${infected ? `<path d="M288 370 V416 M288 445 v2" stroke="${p.red}" stroke-width="14" stroke-linecap="round"/>` : `<path d="M260 410 l18 18 38-43" fill="none" stroke="${p.green}" stroke-width="12" stroke-linecap="round" stroke-linejoin="round"/>`}
    </g>`;
}

function cloudShape(x, y, scale, p) {
    const s = scale || 1;
    return `<g transform="translate(${x} ${y}) scale(${s})" filter="url(#softShadow)">
      <path d="M87 300 C31 300 0 266 0 220 C0 176 34 142 78 140 C90 83 137 42 197 42 C265 42 315 93 320 156 C366 158 400 193 400 238 C400 273 373 300 334 300Z" fill="${p.white}" stroke="${p.ink}" stroke-width="6"/>
      <path d="M198 108 V240 M145 176 L198 240 L254 176" fill="none" stroke="${p.tealDark}" stroke-width="18" stroke-linecap="round" stroke-linejoin="round"/>
    </g>`;
}

function waveform(x, y, w, h, p) {
    const bars = 38;
    return `<g transform="translate(${x} ${y})">${Array.from({ length: bars }, (_, i) => {
        const amplitude = .20 + Math.abs(Math.sin(i * .73)) * .72;
        const bh = h * amplitude;
        return `<rect x="${(i * (w / bars)).toFixed(1)}" y="${((h - bh) / 2).toFixed(1)}" width="${Math.max(4, w / bars - 5).toFixed(1)}" height="${bh.toFixed(1)}" rx="5" fill="${i % 5 === 0 ? p.tealDark : p.teal}" opacity="${(.55 + amplitude * .4).toFixed(2)}"/>`;
    }).join('')}</g>`;
}

function networkNodes(x, y, w, h, p, leak = false) {
    const nodes = [[.12,.25],[.35,.12],[.58,.26],[.82,.14],[.20,.68],[.47,.58],[.72,.72],[.90,.56]];
    const links = [[0,1],[1,2],[2,3],[0,4],[1,5],[2,5],[2,6],[3,7],[4,5],[5,6],[6,7]];
    return `<g transform="translate(${x} ${y})">
      ${links.map(([a,b], i) => `<path d="M${nodes[a][0]*w} ${nodes[a][1]*h} L${nodes[b][0]*w} ${nodes[b][1]*h}" stroke="${leak && i > 7 ? p.red : p.structure}" stroke-width="5" stroke-linecap="round" opacity=".8"/>`).join('')}
      ${nodes.map((n, i) => `<g transform="translate(${n[0]*w} ${n[1]*h})"><circle r="${i === 5 ? 36 : 26}" fill="${i === 5 ? p.ink : i === 7 && leak ? p.red : p.white}" stroke="${i === 7 && leak ? p.red : p.tealDark}" stroke-width="5"/><circle r="8" fill="${i === 5 ? p.teal : i === 7 && leak ? p.yellow : p.teal}"/></g>`).join('')}
    </g>`;
}

function objectChip(label, x, y, p, tone = 'teal') {
    const fill = tone === 'red' ? p.red : tone === 'yellow' ? p.yellow : p.teal;
    return `<g transform="translate(${x} ${y})" filter="url(#smallShadow)">
      <rect width="148" height="62" rx="22" fill="${p.white}" stroke="${p.structure}" stroke-width="3"/>
      <circle cx="32" cy="31" r="13" fill="${fill}"/>
      <rect x="56" y="22" width="68" height="9" rx="5" fill="${p.ink}" opacity=".55"/>
      <rect x="56" y="38" width="44" height="7" rx="4" fill="${p.body}" opacity=".25"/>
      <title>${escapeXml(label)}</title>
    </g>`;
}

function browserScene(spec, p, mobile) {
    if (mobile) {
        return `${browserWindow(70, 250, 760, 600, p, true)}${alertTriangle(610, 120, 150, p)}${lockShape(92, 108, .85, p, false)}`;
    }
    return `${browserWindow(350, 190, 1070, 650, p, true)}${alertTriangle(1190, 95, 175, p)}${lockShape(115, 190, 1.25, p, false)}<path d="M270 425 C335 350 355 326 425 315" fill="none" stroke="${p.tealDark}" stroke-width="7" stroke-dasharray="18 15" opacity=".65"/>`;
}

function emailScene(spec, p, mobile) {
    if (mobile) {
        return `${emailClient(70, 245, 760, 620, p)}${alertTriangle(606, 112, 150, p)}${objectChip('sender-risk', 64, 102, p, 'red')}`;
    }
    return `${emailClient(295, 150, 1120, 710, p)}${alertTriangle(1170, 90, 180, p)}${personBust(55, 500, .9, p, 'attacker')}${objectChip('suspicious-link', 80, 220, p, 'yellow')}`;
}

function phoneScene(spec, p, mobile, kind = 'message') {
    if (mobile) {
        return `${phoneDevice(245, 150, 1.02, p, kind)}${alertTriangle(90, 170, 150, p)}${objectChip(kind, 84, 390, p, kind === 'apps' ? 'red' : 'yellow')}`;
    }
    return `${phoneDevice(565, 100, 1.02, p, kind)}${personBust(120, 470, 1.18, p, 'user')}${alertTriangle(1075, 155, 170, p)}${objectChip(kind, 1120, 500, p, kind === 'apps' ? 'red' : 'yellow')}<ellipse cx="770" cy="875" rx="420" ry="55" fill="${p.ink}" opacity=".08"/>`;
}

function passwordScene(spec, p, mobile) {
    if (mobile) {
        return `<rect x="95" y="300" width="710" height="540" rx="48" fill="${p.white}" stroke="${p.ink}" stroke-width="6" filter="url(#softShadow)"/>${lockShape(315, 145, 1.55, p, false)}${uiLines(175, 420, [540, 470], p, 16)}<rect x="175" y="560" width="540" height="90" rx="24" fill="${p.paper}" stroke="${p.structure}" stroke-width="3"/>${Array.from({length:11},(_,i)=>`<circle cx="${215+i*43}" cy="605" r="8" fill="${p.ink}" opacity=".65"/>`).join('')}<rect x="175" y="705" width="360" height="72" rx="22" fill="${p.teal}"/>${objectChip('mfa', 600, 705, p)}`;
    }
    return `<rect x="350" y="200" width="930" height="590" rx="52" fill="${p.white}" stroke="${p.ink}" stroke-width="6" filter="url(#softShadow)"/>${lockShape(125, 240, 1.75, p, false)}${uiLines(460, 320, [650, 540], p, 18)}<rect x="460" y="475" width="650" height="104" rx="28" fill="${p.paper}" stroke="${p.structure}" stroke-width="3"/>${Array.from({length:13},(_,i)=>`<circle cx="${515+i*42}" cy="527" r="9" fill="${p.ink}" opacity=".68"/>`).join('')}<rect x="460" y="635" width="310" height="78" rx="24" fill="${p.teal}"/>${objectChip('mfa-prompt', 850, 630, p)}${personBust(1260, 500, .9, p, 'attacker')}`;
}

function ransomwareScene(spec, p, mobile) {
    if (mobile) {
        return `${fileCard(245, 225, 1.05, p, true)}${lockShape(92, 630, .95, p, true)}${alertTriangle(610, 115, 150, p)}`;
    }
    return `${fileCard(570, 170, 1.2, p, true)}${fileCard(265, 330, .74, p, false)}${lockShape(1090, 515, 1.35, p, true)}${alertTriangle(1125, 125, 170, p)}<path d="M480 565 C560 540 610 530 675 495" fill="none" stroke="${p.red}" stroke-width="7" stroke-dasharray="16 14"/>`;
}

function cloudScene(spec, p, mobile) {
    if (mobile) {
        return `${cloudShape(235, 330, 1.12, p)}${personBust(72, 650, .9, p, 'user')}${objectChip('shared-file', 620, 660, p)}`;
    }
    return `${cloudShape(555, 270, 1.45, p)}${personBust(150, 520, 1.15, p, 'user')}${personBust(1240, 520, .95, p, spec.scene === 'data-leak' ? 'attacker' : 'user')}<path d="M350 650 C500 520 540 485 650 455 M1115 455 C1220 515 1270 565 1300 635" fill="none" stroke="${p.tealDark}" stroke-width="7" stroke-dasharray="18 15"/>${objectChip('document', 705, 685, p)}`;
}

function deepfakeScene(spec, p, mobile) {
    if (mobile) {
        return `<rect x="120" y="170" width="660" height="720" rx="54" fill="${p.ink}" filter="url(#softShadow)"/>${personBust(310, 290, 1.55, { ...p, teal: p.yellow }, 'user')}<rect x="175" y="660" width="550" height="128" rx="32" fill="#343A39"/>${waveform(215, 685, 470, 76, p)}<path d="M180 250 H250 M650 250 H720 M180 590 H250 M650 590 H720" stroke="${p.teal}" stroke-width="10" stroke-linecap="round"/>`;
    }
    return `<rect x="320" y="140" width="920" height="700" rx="58" fill="${p.ink}" filter="url(#softShadow)"/>${personBust(635, 230, 1.8, { ...p, teal: p.yellow }, 'user')}<rect x="420" y="630" width="720" height="120" rx="30" fill="#343A39"/>${waveform(470, 655, 620, 72, p)}<path d="M405 235 H510 M1050 235 H1155 M405 570 H510 M1050 570 H1155" stroke="${p.teal}" stroke-width="11" stroke-linecap="round"/>${objectChip('camera', 125, 250, p)}${objectChip('voice', 1290, 500, p, 'yellow')}`;
}

function identityScene(spec, p, mobile, social = false) {
    if (mobile) {
        return `${personBust(120, 335, 1.15, p, 'user')}${personBust(540, 335, 1.15, p, 'attacker')}<path d="M300 500 C390 430 480 430 555 500" fill="none" stroke="${p.red}" stroke-width="8" stroke-dasharray="18 16" marker-end="url(#none)"/>${lockShape(350, 620, 1.05, p, social)}${objectChip(social ? 'pretext' : 'credentials', 376, 210, p, 'yellow')}`;
    }
    return `${personBust(245, 390, 1.45, p, 'user')}${personBust(1110, 390, 1.45, p, 'attacker')}<path d="M505 585 C700 410 920 410 1090 585" fill="none" stroke="${p.red}" stroke-width="9" stroke-dasharray="20 16" opacity=".75"/>${lockShape(715, 500, 1.35, p, social)}${objectChip(social ? 'pretext' : 'credentials', 705, 235, p, 'yellow')}${social ? objectChip('phone', 730, 780, p) : ''}`;
}

function networkScene(spec, p, mobile, leak = false) {
    if (mobile) {
        return `${networkNodes(80, 225, 740, 620, p, leak)}${alertTriangle(620, 115, 145, p)}${objectChip(leak ? 'data-out' : 'network', 75, 880, p, leak ? 'red' : 'teal')}`;
    }
    return `${networkNodes(210, 140, 1180, 720, p, leak)}${personBust(35, 565, .8, p, 'attacker')}${alertTriangle(1270, 105, 160, p)}${objectChip(leak ? 'data-out' : 'network', 1210, 710, p, leak ? 'red' : 'teal')}`;
}

function processScene(spec, p, mobile, statistics = false) {
    if (statistics) {
        if (mobile) return `<rect x="90" y="210" width="720" height="670" rx="50" fill="${p.white}" stroke="${p.ink}" stroke-width="6" filter="url(#softShadow)"/>${[.35,.72,.5,.9].map((v,i)=>`<rect x="${170+i*145}" y="${760-v*430}" width="92" height="${v*430}" rx="22" fill="${i===3?p.teal:p.structure}"/>`).join('')}<circle cx="610" cy="330" r="115" fill="${p.yellow}"/><path d="M610 235 A95 95 0 1 1 528 378" fill="none" stroke="${p.tealDark}" stroke-width="32" stroke-linecap="round"/>`;
        return `<rect x="235" y="150" width="1130" height="720" rx="56" fill="${p.white}" stroke="${p.ink}" stroke-width="6" filter="url(#softShadow)"/>${[.35,.72,.5,.9,.63].map((v,i)=>`<rect x="${360+i*150}" y="${760-v*470}" width="102" height="${v*470}" rx="24" fill="${i===3?p.teal:i===1?p.yellow:p.structure}"/>`).join('')}<circle cx="1110" cy="360" r="138" fill="${p.paper}" stroke="${p.structure}" stroke-width="4"/><path d="M1110 245 A115 115 0 1 1 1012 420" fill="none" stroke="${p.tealDark}" stroke-width="38" stroke-linecap="round"/>`;
    }
    const points = mobile ? [[160,330],[450,330],[730,330],[300,700],[600,700]] : [[250,320],[550,250],[850,320],[1150,250],[700,690]];
    const links = mobile ? [[0,1],[1,2],[1,3],[3,4],[2,4]] : [[0,1],[1,2],[2,3],[1,4],[2,4]];
    return `${links.map(([a,b])=>`<path d="M${points[a][0]} ${points[a][1]} L${points[b][0]} ${points[b][1]}" stroke="${p.structure}" stroke-width="9" stroke-linecap="round"/>`).join('')}${points.map((pt,i)=>`<g transform="translate(${pt[0]} ${pt[1]})" filter="url(#smallShadow)"><circle r="${mobile?72:82}" fill="${i===points.length-1?p.teal:p.white}" stroke="${p.ink}" stroke-width="5"/><circle r="24" fill="${i===points.length-1?p.ink:p.yellow}"/><path d="M-20 0 H20 M0 -20 V20" stroke="${i===points.length-1?p.teal:p.ink}" stroke-width="7" stroke-linecap="round" opacity=".65"/></g>`).join('')}`;
}

function abstractScene(spec, p, mobile) {
    const cx = mobile ? 450 : 800;
    const cy = mobile ? 565 : 500;
    const radius = mobile ? 250 : 310;
    return `<circle cx="${cx}" cy="${cy}" r="${radius}" fill="url(#softHalo)"/><circle cx="${cx}" cy="${cy}" r="${radius*.72}" fill="${p.white}" stroke="${p.ink}" stroke-width="6" filter="url(#softShadow)"/>${lockShape(cx-105, cy-115, 1.3, p, false)}${[0,1,2,3,4,5].map((i)=>{ const a=i*Math.PI/3-.5; const x=cx+Math.cos(a)*radius*1.08; const y=cy+Math.sin(a)*radius*.9; return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="34" fill="${i%2?p.yellow:p.teal}" stroke="${p.ink}" stroke-width="4"/><path d="M${(cx+Math.cos(a)*radius*.72).toFixed(1)} ${(cy+Math.sin(a)*radius*.62).toFixed(1)} L${x.toFixed(1)} ${y.toFixed(1)}" stroke="${p.structure}" stroke-width="5" stroke-dasharray="12 12"/>`;}).join('')}`;
}

function sceneArtwork(spec, p, mobile) {
    switch (spec.scene) {
        case 'browser-phishing': return browserScene(spec, p, mobile);
        case 'email-threat': return emailScene(spec, p, mobile);
        case 'smartphone-scam': return phoneScene(spec, p, mobile, 'message');
        case 'malicious-app': return phoneScene(spec, p, mobile, 'apps');
        case 'qr-phishing': return phoneScene(spec, p, mobile, 'qr');
        case 'password-mfa': return passwordScene(spec, p, mobile);
        case 'ransomware-file': return ransomwareScene(spec, p, mobile);
        case 'cloud-data': return cloudScene(spec, p, mobile);
        case 'deepfake': return deepfakeScene(spec, p, mobile);
        case 'identity-takeover': return identityScene(spec, p, mobile, false);
        case 'social-engineering': return identityScene(spec, p, mobile, true);
        case 'network-attack': return networkScene(spec, p, mobile, false);
        case 'data-leak': return networkScene(spec, p, mobile, true);
        case 'process-diagram': return processScene(spec, p, mobile, false);
        case 'statistics': return processScene(spec, p, mobile, true);
        default: return abstractScene(spec, p, mobile);
    }
}

function supportingDetails(spec, p, mobile) {
    const objects = (Array.isArray(spec.secondaryObjects) ? spec.secondaryObjects : []).slice(0, mobile ? 2 : 4);
    if (!objects.length) return '';
    const positions = mobile
        ? [[70, 1010], [650, 1010]]
        : [[70, 84], [1380, 210], [90, 830], [1350, 825]];
    return objects.map((object, i) => {
        const pos = positions[i % positions.length];
        const tone = /warning|malware|attacker/.test(object) ? 'red' : /lock|qr|password/.test(object) ? 'yellow' : 'teal';
        return objectChip(object, pos[0], pos[1], p, tone);
    }).join('');
}

function compositionTransform(rawComposition, width, height) {
    const cx = width / 2;
    const cy = height / 2;
    switch (rawComposition) {
        case 'editorial-left':
            // Mirror the whole scene so the same scene type reads as a distinct composition.
            return `translate(${width} 0) scale(-1 1)`;
        case 'center-stage':
            // Pull back slightly and center, giving the subject more surrounding air.
            return `translate(${cx} ${cy}) scale(.88) translate(${-cx} ${-cy})`;
        case 'wide-scene':
            // Stretch wide and settle a touch higher, like a establishing shot.
            return `translate(${cx} ${cy * .94}) scale(1.1 .95) translate(${-cx} ${-cy * .94})`;
        case 'full-bleed':
            // Push in close so the focal object fills more of the frame.
            return `translate(${cx} ${cy}) scale(1.16) translate(${-cx} ${-cy})`;
        case 'editorial-right':
        default:
            return '';
    }
}

function sanitizeSvg(svg) {
    let output = String(svg || '');
    output = output.replace(/<script\b[^>]*>[\s\S]*?<\/script\s*>/gi, '');
    output = output.replace(/<foreignObject\b[^>]*>[\s\S]*?<\/foreignObject\s*>/gi, '');
    output = output.replace(/<(?:iframe|object|embed)\b[^>]*>[\s\S]*?<\/(?:iframe|object|embed)\s*>/gi, '');
    output = output.replace(/<(?:iframe|object|embed)\b[^>]*\/?\s*>/gi, '');
    output = output.replace(/\s+on[a-z]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, '');
    output = output.replace(/javascript\s*:/gi, '');
    output = output.replace(/\s(?:href|xlink:href)\s*=\s*["']\s*(?:https?:|\/\/|data:text\/html)[^"']*["']/gi, '');
    output = output.replace(/url\(\s*["']?\s*(?:https?:|\/\/)[^)]+\)/gi, 'none');
    return output;
}

function renderSmartSvg(spec = {}, slide = {}, options = {}) {
    const mobile = Boolean(options.mobile);
    const width = mobile ? 900 : 1600;
    const height = mobile ? 1200 : 1000;
    const p = { ...DEFAULT_PALETTE, ...(options.palette || {}) };
    const scene = escapeXml(spec.scene || 'abstract-security');
    const title = escapeXml(spec.visualTitle || slide.visualTitle || slide.title || 'Learning visual');
    const direction = escapeXml(spec.artDirection || 'Editorial cybersecurity illustration');
    const rawComposition = spec.composition || 'editorial-right';
    const composition = escapeXml(rawComposition);
    const sceneTransform = compositionTransform(rawComposition, width, height);

    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="${title}" data-scorm-smart-svg="1" data-scene="${scene}" data-composition="${composition}">
      <title>${title}</title><desc>${direction}</desc>
      ${shadowDefs(p)}
      ${background(p, width, height, spec.mood)}
      <g data-smart-svg-scene="${scene}"${sceneTransform ? ` transform="${sceneTransform}"` : ''}>${sceneArtwork(spec, p, mobile)}</g>
      <g data-smart-svg-details="1">${supportingDetails(spec, p, mobile)}</g>
      <rect x="${mobile ? 34 : 42}" y="${mobile ? 34 : 38}" width="${mobile ? width - 68 : width - 84}" height="${mobile ? height - 68 : height - 76}" rx="${mobile ? 44 : 52}" fill="none" stroke="${p.ink}" stroke-opacity=".10" stroke-width="2"/>
    </svg>`;
    return sanitizeSvg(svg);
}

module.exports = {
    DEFAULT_PALETTE,
    escapeXml,
    paletteFromAnalysis,
    sanitizeSvg,
    renderSmartSvg,
    sceneArtwork
};
