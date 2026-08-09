#!/usr/bin/env python3
"""Quizmoto SCORM vector asset generator.

Creates bounded, presentation-quality SVG diagrams for the single Quizmoto
immersive course canvas. Uses only Python's standard library.
"""

import argparse
import html
import json
import math
import re
import sys
from pathlib import Path

WIDTH = 960
HEIGHT = 520
SAFE_LEFT = 54
SAFE_RIGHT = WIDTH - 54
SAFE_TOP = 44
SAFE_BOTTOM = HEIGHT - 44
INK = '#293041'
MUTED = '#667085'
LINE = '#D9DCE7'


def esc(value):
    return html.escape(str(value or ''), quote=True)


def text_lines(value, max_chars=34, max_lines=4):
    words = re.sub(r'\s+', ' ', str(value or '')).strip().split(' ')
    lines, current = [], ''
    for word in words:
        if not word:
            continue
        proposed = word if not current else current + ' ' + word
        if len(proposed) <= max_chars:
            current = proposed
        else:
            if current:
                lines.append(current)
            current = word
            if len(lines) >= max_lines - 1:
                break
    if current and len(lines) < max_lines:
        lines.append(current)
    if len(lines) == max_lines and len(' '.join(words)) > len(' '.join(lines)):
        lines[-1] = lines[-1].rstrip(' .') + '…'
    return lines or ['Key learning point']


def svg_text(x, y, value, size=18, weight=700, fill=INK, anchor='middle', max_chars=34, max_lines=3, line_height=None):
    lines = text_lines(value, max_chars=max_chars, max_lines=max_lines)
    lh = line_height or int(size * 1.28)
    start_y = y - ((len(lines) - 1) * lh / 2)
    spans = [f'<tspan x="{x}" y="{start_y + idx * lh:.1f}">{esc(line)}</tspan>' for idx, line in enumerate(lines)]
    return f'<text x="{x}" y="{y}" text-anchor="{anchor}" font-family="Mulish,Segoe UI,Arial,sans-serif" font-size="{size}" font-weight="{weight}" fill="{fill}">{"".join(spans)}</text>'


def base_svg(inner, title='Learning visual'):
    return f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {WIDTH} {HEIGHT}" preserveAspectRatio="xMidYMid meet" role="img" aria-label="{esc(title)}">
<defs>
  <filter id="shadow" x="-18%" y="-18%" width="136%" height="136%"><feDropShadow dx="0" dy="7" stdDeviation="10" flood-color="#312e81" flood-opacity=".07"/></filter>
  <filter id="softShadow" x="-22%" y="-22%" width="144%" height="144%"><feDropShadow dx="0" dy="10" stdDeviation="16" flood-color="#0f172a" flood-opacity=".10"/></filter>
  <linearGradient id="accentGrad" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="var(--qm-primary,#5147e8)"/><stop offset="1" stop-color="#8F87FF"/></linearGradient>
  <linearGradient id="softGrad" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#F8F7FF"/><stop offset="1" stop-color="var(--qm-soft,#f0efff)"/></linearGradient>
  <linearGradient id="warmGlow" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="var(--qm-primary,#5147e8)" stop-opacity=".96"/><stop offset="1" stop-color="#8F87FF" stop-opacity=".72"/></linearGradient>
  <marker id="arrow" markerWidth="9" markerHeight="9" refX="7.5" refY="4.5" orient="auto"><path d="M0 0L9 4.5L0 9Z" fill="var(--qm-primary,#5147e8)"/></marker>
</defs>
{inner}
</svg>'''


def points(slide, limit=6):
    raw = slide.get('keyPoints') if isinstance(slide, dict) else []
    vals = [str(x).strip() for x in (raw or []) if str(x).strip()]
    if not vals:
        vals = [str(slide.get('content') or 'Key learning point')]
    return vals[:limit]


def visual_process(slide):
    """Open, flowing process visual. Avoids the old row of large rectangular cards."""
    items = points(slide, 4)
    n = max(1, len(items))
    left, right, line_y = 128, WIDTH - 128, 260
    step_gap = 0 if n == 1 else (right - left) / (n - 1)
    chunks = [
        svg_text(WIDTH / 2, 78, slide.get('visualTitle') or 'How it works', size=20, weight=900, fill=INK, max_chars=38, max_lines=2),
        f'<path class="qm-path" d="M{left} {line_y} H{right}" stroke="#D7DAE4" stroke-width="5" stroke-linecap="round"/>',
        f'<path class="qm-path" d="M{left} {line_y} H{right}" stroke="var(--qm-primary,#5147e8)" stroke-width="3" stroke-linecap="round" opacity=".35"/>'
    ]
    for i, item in enumerate(items):
        x = WIDTH / 2 if n == 1 else left + step_gap * i
        above = i % 2 == 0
        label_y = 166 if above else 352
        stem_end = 203 if above else 317
        chunks.append(
            f'<g class="qm-node" style="--delay:{i*85}ms">'
            f'<line x1="{x:.1f}" y1="{line_y}" x2="{x:.1f}" y2="{stem_end}" stroke="#CFD4DE" stroke-width="2" stroke-linecap="round"/>'
            f'<circle cx="{x:.1f}" cy="{line_y}" r="27" fill="#fff" stroke="var(--qm-primary,#5147e8)" stroke-width="5" filter="url(#shadow)"/>'
            f'<circle cx="{x:.1f}" cy="{line_y}" r="17" fill="var(--qm-soft,#f0efff)"/>'
            f'<text x="{x:.1f}" y="{line_y+5}" text-anchor="middle" font-family="Mulish,Segoe UI,Arial,sans-serif" font-size="12" font-weight="900" fill="var(--qm-primary,#5147e8)">{i+1:02d}</text>'
            f'<text x="{x:.1f}" y="{label_y-34}" text-anchor="middle" font-family="Mulish,Segoe UI,Arial,sans-serif" font-size="9" font-weight="900" fill="var(--qm-primary,#5147e8)" letter-spacing="1.2">STEP {i+1}</text>'
            f'{svg_text(x, label_y, item, size=13, weight=800, fill=INK, max_chars=22, max_lines=3)}'
            f'</g>'
        )
    return base_svg(''.join(chunks), slide.get('title'))


def visual_timeline(slide):
    items = points(slide, 5)
    n = max(1, len(items))
    left, right, y = 108, WIDTH - 108, 258
    chunks = [f'<path class="qm-path" d="M{left} {y}H{right}" stroke="#D7DAE4" stroke-width="5" stroke-linecap="round"/>']
    for i, item in enumerate(items):
        x = left if n == 1 else left + (right-left)*i/(n-1)
        up = i % 2 == 0
        label_y = 150 if up else 366
        stem_y = 197 if up else 319
        chunks.append(
            f'<g class="qm-node" style="--delay:{i*90}ms">'
            f'<line x1="{x:.1f}" y1="{y}" x2="{x:.1f}" y2="{stem_y}" stroke="#CBD1DB" stroke-width="2"/>'
            f'<circle cx="{x:.1f}" cy="{y}" r="16" fill="#fff" stroke="var(--qm-primary,#5147e8)" stroke-width="5"/>'
            f'<circle cx="{x:.1f}" cy="{y}" r="6" fill="var(--qm-primary,#5147e8)"/>'
            f'<text x="{x:.1f}" y="{label_y-29}" text-anchor="middle" font-family="Mulish,Segoe UI,Arial,sans-serif" font-size="9" font-weight="900" fill="var(--qm-primary,#5147e8)" letter-spacing="1.1">STAGE {i+1}</text>'
            f'{svg_text(x, label_y, item, size=12, weight=800, max_chars=20, max_lines=3)}'
            f'</g>'
        )
    return base_svg(''.join(chunks), slide.get('title'))


def visual_hub(slide):
    """Central concept with orbiting capsule labels instead of boxy cards."""
    items = points(slide, 6)
    n = max(1, len(items))
    cx, cy = 480, 260
    radius_x, radius_y = (305, 176) if n > 4 else (286, 168)
    pill_w, pill_h = (164, 58) if n > 4 else (190, 62)
    positions = []
    for i in range(n):
        angle = -math.pi/2 + 2*math.pi*i/n
        positions.append((cx + math.cos(angle)*radius_x, cy + math.sin(angle)*radius_y))
    chunks = [
        f'<ellipse cx="{cx}" cy="{cy}" rx="116" ry="88" fill="url(#accentGrad)" filter="url(#softShadow)"/>',
        f'<ellipse cx="{cx}" cy="{cy}" rx="138" ry="108" fill="none" stroke="var(--qm-primary,#5147e8)" stroke-width="2" opacity=".14"/>'
    ]
    for i, (item, (x, y)) in enumerate(zip(items, positions)):
        edge_x = cx + (x-cx)*0.62
        edge_y = cy + (y-cy)*0.62
        left, top = x-pill_w/2, y-pill_h/2
        chunks.append(f'<path class="qm-path" d="M{cx} {cy} L{edge_x:.1f} {edge_y:.1f}" stroke="#D7DAE4" stroke-width="2.5" stroke-linecap="round"/>')
        chunks.append(
            f'<g class="qm-node" style="--delay:{i*75}ms" filter="url(#shadow)">'
            f'<rect x="{left:.1f}" y="{top:.1f}" width="{pill_w}" height="{pill_h}" rx="{pill_h/2:.1f}" fill="#fff" stroke="{LINE}"/>'
            f'<circle cx="{left+27:.1f}" cy="{y:.1f}" r="15" fill="var(--qm-soft,#f0efff)"/>'
            f'<text x="{left+27:.1f}" y="{y+4:.1f}" text-anchor="middle" font-family="Mulish,Segoe UI,Arial,sans-serif" font-size="9" font-weight="900" fill="var(--qm-primary,#5147e8)">{i+1:02d}</text>'
            f'{svg_text(left+50, y, item, size=10.5, weight=800, anchor="start", max_chars=22, max_lines=2)}'
            f'</g>'
        )
    title = slide.get('visualTitle') or slide.get('title') or 'Key concept'
    chunks.append(svg_text(cx, cy-5, title, size=18, weight=900, fill='#fff', max_chars=20, max_lines=2))
    chunks.append(f'<text x="{cx}" y="{cy+42}" text-anchor="middle" font-family="Mulish,Segoe UI,Arial,sans-serif" font-size="8.5" font-weight="900" fill="#fff" opacity=".78" letter-spacing="1.5">CORE IDEA</text>')
    return base_svg(''.join(chunks), slide.get('title'))


def visual_comparison(slide):
    items = points(slide, 6)
    half = max(1, math.ceil(len(items)/2))
    good, bad = items[:half], items[half:]
    if not bad:
        bad = ['Avoid the opposite behaviour and verify before acting.']
    chunks = [
        '<path d="M70 100 Q70 64 106 64 H426 Q462 64 462 100 V420 Q462 456 426 456 H106 Q70 456 70 420 Z" fill="#F5FBF7" stroke="#D6EBDD"/>',
        '<path d="M498 100 Q498 64 534 64 H854 Q890 64 890 100 V420 Q890 456 854 456 H534 Q498 456 498 420 Z" fill="#FFF8F8" stroke="#F0DADA"/>',
        '<circle cx="114" cy="106" r="20" fill="#DDF7E4"/><text x="114" y="113" text-anchor="middle" font-family="Mulish,Segoe UI,Arial,sans-serif" font-size="18" font-weight="900" fill="#198754">✓</text>',
        '<circle cx="542" cy="106" r="20" fill="#FFE5E5"/><text x="542" y="113" text-anchor="middle" font-family="Mulish,Segoe UI,Arial,sans-serif" font-size="18" font-weight="900" fill="#D9485F">!</text>',
        svg_text(148, 106, 'Recommended', size=17, weight=900, fill='#198754', anchor='start', max_chars=18, max_lines=1),
        svg_text(576, 106, 'Watch out', size=17, weight=900, fill='#D9485F', anchor='start', max_chars=18, max_lines=1)
    ]
    for col, arr, x in [(0, good, 102), (1, bad, 530)]:
        for i, item in enumerate(arr[:4]):
            y = 170 + i*72
            chunks.append(
                f'<g class="qm-node" style="--delay:{(i+col*2)*80}ms">'
                f'<circle cx="{x+9}" cy="{y-3}" r="9" fill="var(--qm-soft,#f0efff)"/>'
                f'<text x="{x+9}" y="{y+1}" text-anchor="middle" font-family="Mulish,Segoe UI,Arial,sans-serif" font-size="7.5" font-weight="900" fill="var(--qm-primary,#5147e8)">{i+1:02d}</text>'
                f'{svg_text(x+32, y, item, size=12.5, weight=800, fill=INK, anchor="start", max_chars=34, max_lines=3)}'
                f'</g>'
            )
    return base_svg(''.join(chunks), slide.get('title'))


def visual_cards(slide):
    """Compact learning tiles with staggered rhythm, avoiding a rigid rectangle grid."""
    items = points(slide, 6)
    n = len(items)
    rows = math.ceil(n / 2)
    chunks = []
    y_positions = [118, 258, 398]
    for i, item in enumerate(items):
        col, row = i % 2, i // 2
        x = 115 if col == 0 else 535
        y = y_positions[min(row, len(y_positions)-1)]
        offset = 24 if (row % 2 == 1 and col == 0) else (-24 if (row % 2 == 1 and col == 1) else 0)
        x += offset
        chunks.append(
            f'<g class="qm-node" style="--delay:{i*70}ms">'
            f'<circle cx="{x}" cy="{y}" r="29" fill="var(--qm-soft,#f0efff)" stroke="#E5E7EF"/>'
            f'<text x="{x}" y="{y+5}" text-anchor="middle" font-family="Mulish,Segoe UI,Arial,sans-serif" font-size="11" font-weight="900" fill="var(--qm-primary,#5147e8)">{i+1:02d}</text>'
            f'<path d="M{x+46} {y-29} H{x+315} Q{x+333} {y-29} {x+333} {y-11} V{y+11} Q{x+333} {y+29} {x+315} {y+29} H{x+46}" fill="#fff" stroke="{LINE}" filter="url(#shadow)"/>'
            f'{svg_text(x+66, y, item, size=12, weight=800, fill=INK, anchor="start", max_chars=34, max_lines=2)}'
            f'</g>'
        )
    return base_svg(''.join(chunks), slide.get('title'))


def visual_spotlight(slide):
    """Cinematic focus visual designed for the dark Spotlight canvas.

    The previous version drew one giant cream rounded rectangle inside the dark
    stage, which read like a nested card and frequently looked cropped. This
    version is intentionally open: icon, rings, connecting line and typography.
    """
    item = points(slide, 1)[0]
    title = slide.get('visualTitle') or slide.get('title') or 'Key takeaway'
    inner = f'''
<g class="qm-node" filter="url(#softShadow)">
  <circle cx="300" cy="260" r="126" fill="var(--qm-primary,#5147e8)" opacity=".16"/>
  <circle cx="300" cy="260" r="104" fill="url(#warmGlow)"/>
  <circle cx="300" cy="260" r="78" fill="none" stroke="#fff" stroke-width="2" opacity=".24"/>
  <circle cx="300" cy="260" r="56" fill="none" stroke="#fff" stroke-width="2" opacity=".16"/>
  <path d="M300 203l54 22v42c0 44-24 74-54 88-31-14-54-44-54-88v-42l54-22z" fill="none" stroke="#fff" stroke-width="8" stroke-linejoin="round"/>
  <path d="M272 267l18 18 39-46" fill="none" stroke="#fff" stroke-width="9" stroke-linecap="round" stroke-linejoin="round"/>
</g>
<path class="qm-path" d="M425 260 C492 260 500 188 552 188" fill="none" stroke="#FDBA74" stroke-width="3" stroke-linecap="round" opacity=".72"/>
<circle cx="552" cy="188" r="6" fill="#FDBA74"/>
<text x="574" y="160" font-family="Mulish,Segoe UI,Arial,sans-serif" font-size="9.5" font-weight="900" fill="#FDBA74" letter-spacing="1.8">FOCUS</text>
{svg_text(574, 216, title, size=25, weight=900, fill='#FFFFFF', anchor='start', max_chars=25, max_lines=2, line_height=30)}
<line x1="574" y1="278" x2="662" y2="278" stroke="var(--qm-primary,#5147e8)" stroke-width="5" stroke-linecap="round"/>
<text x="574" y="314" font-family="Mulish,Segoe UI,Arial,sans-serif" font-size="9" font-weight="900" fill="#FDBA74" letter-spacing="1.4">WHY IT MATTERS</text>
{svg_text(574, 365, item, size=13.5, weight=700, fill='#E2E8F0', anchor='start', max_chars=42, max_lines=4, line_height=19)}
<circle cx="184" cy="140" r="7" fill="#FDBA74" opacity=".9"/>
<circle cx="408" cy="394" r="5" fill="#fff" opacity=".55"/>
<path d="M169 366 A156 156 0 0 1 185 147" fill="none" stroke="#fff" stroke-width="2" stroke-dasharray="5 10" opacity=".18"/>
'''
    return base_svg(inner, slide.get('title'))


def visual_matrix(slide):
    items = points(slide, 4)
    labels = items + ['']*(4-len(items))
    cells = [
        (105, 74, '#F0FAF4', '#198754', 'LOW'),
        (500, 74, '#FFF9ED', '#B7791F', 'MEDIUM'),
        (105, 270, '#FFF9ED', '#B7791F', 'MEDIUM'),
        (500, 270, '#FFF3F4', '#C43D55', 'HIGH')
    ]
    inner = [
        '<text x="500" y="42" text-anchor="middle" font-family="Mulish,Segoe UI,Arial,sans-serif" font-size="11" font-weight="900" fill="#667085" letter-spacing="1.5">IMPACT →</text>',
        '<text x="42" y="260" text-anchor="middle" transform="rotate(-90 42 260)" font-family="Mulish,Segoe UI,Arial,sans-serif" font-size="11" font-weight="900" fill="#667085" letter-spacing="1.5">LIKELIHOOD →</text>'
    ]
    for i,(x,y,bg,fg,level) in enumerate(cells):
        inner.append(
            f'<g class="qm-node" style="--delay:{i*90}ms">'
            f'<rect x="{x}" y="{y}" width="350" height="164" rx="28" fill="{bg}" stroke="{LINE}"/>'
            f'<circle cx="{x+30}" cy="{y+31}" r="12" fill="#fff" stroke="{fg}" stroke-width="2"/>'
            f'<text x="{x+52}" y="{y+35}" font-family="Mulish,Segoe UI,Arial,sans-serif" font-size="10" font-weight="900" fill="{fg}" letter-spacing="1.2">{level}</text>'
            f'{svg_text(x+28,y+98,labels[i] or level.title()+" risk",size=14,weight=800,fill=INK,anchor="start",max_chars=32,max_lines=3)}'
            f'</g>'
        )
    return base_svg(''.join(inner), slide.get('title'))


def visual_cycle(slide):
    items = points(slide, 5)
    n = max(1, len(items))
    cx, cy = 480, 260
    rx, ry = 294, 174
    pill_w, pill_h = 160, 56
    coords = []
    for i in range(n):
        angle = -math.pi/2 + 2*math.pi*i/n
        coords.append((cx+math.cos(angle)*rx, cy+math.sin(angle)*ry))
    chunks = [f'<circle cx="{cx}" cy="{cy}" r="116" fill="none" stroke="#D7DAE4" stroke-width="2" stroke-dasharray="5 9" opacity=".8"/>']
    for i,(x,y) in enumerate(coords):
        nx,ny = coords[(i+1)%n]
        chunks.append(f'<path class="qm-path" d="M{x:.1f} {y:.1f} Q{cx:.1f} {cy:.1f} {nx:.1f} {ny:.1f}" fill="none" stroke="#D7DAE4" stroke-width="2.5" marker-end="url(#arrow)" opacity=".72"/>')
    for i,((x,y),item) in enumerate(zip(coords,items)):
        left, top = x-pill_w/2, y-pill_h/2
        chunks.append(
            f'<g class="qm-node" style="--delay:{i*85}ms" filter="url(#shadow)">'
            f'<rect x="{left:.1f}" y="{top:.1f}" width="{pill_w}" height="{pill_h}" rx="28" fill="#fff" stroke="{LINE}"/>'
            f'<circle cx="{left+25:.1f}" cy="{y:.1f}" r="13" fill="var(--qm-soft,#f0efff)"/>'
            f'<text x="{left+25:.1f}" y="{y+4:.1f}" text-anchor="middle" font-family="Mulish,Segoe UI,Arial,sans-serif" font-size="8.5" font-weight="900" fill="var(--qm-primary,#5147e8)">{i+1:02d}</text>'
            f'{svg_text(left+46, y, item, size=10.5, weight=800, fill=INK, anchor="start", max_chars=21, max_lines=2)}'
            f'</g>'
        )
    title = slide.get('visualTitle') or slide.get('title') or 'Continuous cycle'
    chunks.append(f'<circle cx="{cx}" cy="{cy}" r="82" fill="url(#accentGrad)" filter="url(#softShadow)"/>{svg_text(cx,cy,title,size=16,weight=900,fill="#fff",max_chars=18,max_lines=3)}')
    return base_svg(''.join(chunks), slide.get('title'))


GENERATORS = {
    'process': visual_process,
    'timeline': visual_timeline,
    'hub': visual_hub,
    'comparison': visual_comparison,
    'cards': visual_cards,
    'spotlight': visual_spotlight,
    'matrix': visual_matrix,
    'cycle': visual_cycle,
}


def normalize_layout(slide, index):
    layout = str(slide.get('layout') or slide.get('slideType') or '').strip().lower()
    if layout in GENERATORS:
        return layout
    text = f"{slide.get('title','')} {slide.get('content','')}".lower()
    if re.search(r'likelihood|impact|risk matrix|severity', text):
        return 'matrix'
    if re.search(r'cycle|continuous|repeat|ongoing', text):
        return 'cycle'
    if re.search(r'step|process|workflow|how .* works|flow', text):
        return 'process'
    if re.search(r'timeline|phase|stage|journey|sequence', text):
        return 'timeline'
    if re.search(r'versus| vs |compare|recommended|avoid|do and don', text):
        return 'comparison'
    if re.search(r'pillars|components|areas|categories|elements', text):
        return 'hub'
    if re.search(r'warning|critical|remember|takeaway', text):
        return 'spotlight'
    fallback = ['cards', 'process', 'hub', 'timeline', 'spotlight', 'comparison']
    return fallback[index % len(fallback)]


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('input_json')
    parser.add_argument('output_dir')
    args = parser.parse_args()

    with open(args.input_json, 'r', encoding='utf-8') as fh:
        analysis = json.load(fh)

    output = Path(args.output_dir)
    output.mkdir(parents=True, exist_ok=True)
    manifest = []
    slides = analysis.get('slides') if isinstance(analysis.get('slides'), list) else []
    for index, slide in enumerate(slides):
        slide = slide if isinstance(slide, dict) else {}
        layout = normalize_layout(slide, index)
        generator = GENERATORS[layout]
        filename = f'visual-{index+1:03d}-{layout}.svg'
        path = output / filename
        path.write_text(generator({**slide, 'layout': layout}), encoding='utf-8')
        manifest.append({'index': index, 'layout': layout, 'file': filename})

    manifest_path = output / 'visual-manifest.json'
    manifest_path.write_text(json.dumps({'visuals': manifest}, indent=2), encoding='utf-8')
    print(str(manifest_path))
    return 0


if __name__ == '__main__':
    try:
        sys.exit(main())
    except Exception as exc:
        print(json.dumps({'ok': False, 'error': str(exc)}), file=sys.stderr)
        sys.exit(1)