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
  <linearGradient id="accentGrad" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="var(--qm-primary,#5147e8)"/><stop offset="1" stop-color="#8F87FF"/></linearGradient>
  <linearGradient id="softGrad" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#F8F7FF"/><stop offset="1" stop-color="var(--qm-soft,#f0efff)"/></linearGradient>
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
    items = points(slide, 4)
    n = max(1, len(items))
    gap = 28
    usable = SAFE_RIGHT - SAFE_LEFT
    card_w = min(205, (usable - gap * (n - 1)) / n)
    card_h = 162
    x0 = (WIDTH - (card_w*n + gap*(n-1))) / 2
    y = 178
    chunks = []
    for i, item in enumerate(items):
        x = x0 + i * (card_w + gap)
        if i < n - 1:
            mid_y = y + card_h/2
            chunks.append(f'<path class="qm-path" d="M{x + card_w + 4:.1f} {mid_y:.1f} H{x + card_w + gap - 10:.1f}" stroke="var(--qm-primary,#5147e8)" stroke-width="4" stroke-linecap="round" marker-end="url(#arrow)" opacity=".68"/>')
        chunks.append(
            f'<g class="qm-node" style="--delay:{i*90}ms" filter="url(#shadow)">'
            f'<rect x="{x:.1f}" y="{y}" width="{card_w:.1f}" height="{card_h}" rx="24" fill="#fff" stroke="{LINE}"/>'
            f'<rect x="{x:.1f}" y="{y}" width="{card_w:.1f}" height="7" rx="3.5" fill="var(--qm-primary,#5147e8)"/>'
            f'<circle cx="{x+32:.1f}" cy="{y+38}" r="17" fill="var(--qm-soft,#f0efff)"/>'
            f'<text x="{x+32:.1f}" y="{y+44}" text-anchor="middle" font-family="Mulish,Segoe UI,Arial,sans-serif" font-size="14" font-weight="900" fill="var(--qm-primary,#5147e8)">{i+1:02d}</text>'
            f'{svg_text(x+24, y+94, item, size=14, weight=800, anchor="start", max_chars=24, max_lines=3)}'
            f'</g>'
        )
    chunks.append(svg_text(WIDTH/2, 92, slide.get('visualTitle') or 'How it works', size=19, weight=900, fill=INK, max_chars=34, max_lines=2))
    return base_svg(''.join(chunks), slide.get('title'))


def visual_timeline(slide):
    items = points(slide, 5)
    n = max(1, len(items))
    left, right, y = 115, WIDTH - 115, 258
    chunks = [f'<path class="qm-path" d="M{left} {y}H{right}" stroke="#C9C6FF" stroke-width="6" stroke-linecap="round"/>']
    for i, item in enumerate(items):
        x = left if n == 1 else left + (right-left)*i/(n-1)
        up = i % 2 == 0
        card_y = 78 if up else 310
        connector_y = card_y + 112 if up else card_y
        chunks.append(
            f'<g class="qm-node" style="--delay:{i*90}ms">'
            f'<line x1="{x:.1f}" y1="{y}" x2="{x:.1f}" y2="{connector_y}" stroke="#CFD2DF" stroke-width="2.5"/>'
            f'<circle cx="{x:.1f}" cy="{y}" r="15" fill="#fff" stroke="var(--qm-primary,#5147e8)" stroke-width="5"/>'
            f'<rect x="{x-69:.1f}" y="{card_y}" width="138" height="112" rx="18" fill="#fff" stroke="{LINE}" filter="url(#shadow)"/>'
            f'<text x="{x:.1f}" y="{card_y+28}" text-anchor="middle" font-family="Mulish,Segoe UI,Arial,sans-serif" font-size="10" font-weight="900" fill="var(--qm-primary,#5147e8)">STAGE {i+1}</text>'
            f'{svg_text(x, card_y+68, item, size=12, weight=800, max_chars=20, max_lines=3)}'
            f'</g>'
        )
    return base_svg(''.join(chunks), slide.get('title'))


def visual_hub(slide):
    items = points(slide, 6)
    n = max(1, len(items))
    cx, cy = 480, 260
    center_w, center_h = 184, 108
    positions = []
    if n <= 4:
        presets = [(480, 82), (742, 260), (480, 438), (218, 260)]
        positions = presets[:n]
        card_w, card_h = 176, 76
    else:
        card_w, card_h = 154, 72
        radius_x, radius_y = 300, 178
        for i in range(n):
            angle = -math.pi/2 + 2*math.pi*i/n
            positions.append((cx + math.cos(angle)*radius_x, cy + math.sin(angle)*radius_y))
    chunks = []
    for i, (item, (x, y)) in enumerate(zip(items, positions)):
        edge_x = cx + (x-cx)*0.62
        edge_y = cy + (y-cy)*0.62
        chunks.append(f'<path class="qm-path" d="M{cx} {cy} L{edge_x:.1f} {edge_y:.1f}" stroke="#C9C6FF" stroke-width="3" stroke-linecap="round" opacity=".9"/>')
        left = x - card_w/2
        top = y - card_h/2
        chunks.append(
            f'<g class="qm-node" style="--delay:{i*80}ms" filter="url(#shadow)">'
            f'<rect x="{left:.1f}" y="{top:.1f}" width="{card_w}" height="{card_h}" rx="18" fill="#fff" stroke="{LINE}"/>'
            f'<circle cx="{left+24:.1f}" cy="{y:.1f}" r="13" fill="var(--qm-soft,#f0efff)"/>'
            f'<text x="{left+24:.1f}" y="{y+4:.1f}" text-anchor="middle" font-family="Mulish,Segoe UI,Arial,sans-serif" font-size="10" font-weight="900" fill="var(--qm-primary,#5147e8)">{i+1:02d}</text>'
            f'{svg_text(left+46, y, item, size=11, weight=800, anchor="start", max_chars=20, max_lines=3)}'
            f'</g>'
        )
    title = slide.get('visualTitle') or slide.get('title') or 'Key concept'
    chunks.append(
        f'<g class="qm-center" filter="url(#shadow)">'
        f'<rect x="{cx-center_w/2}" y="{cy-center_h/2}" width="{center_w}" height="{center_h}" rx="30" fill="url(#accentGrad)"/>'
        f'{svg_text(cx, cy-4, title, size=17, weight=900, fill="#fff", max_chars=20, max_lines=2)}'
        f'<text x="{cx}" y="{cy+34}" text-anchor="middle" font-family="Mulish,Segoe UI,Arial,sans-serif" font-size="9" font-weight="900" fill="#EDEBFF" letter-spacing="1.6">KEY CONCEPT</text>'
        f'</g>'
    )
    return base_svg(''.join(chunks), slide.get('title'))


def visual_comparison(slide):
    items = points(slide, 6)
    half = max(1, math.ceil(len(items)/2))
    good, bad = items[:half], items[half:]
    if not bad:
        bad = ['Avoid the opposite behaviour and verify before acting.']
    chunks = [
        '<rect x="64" y="58" width="396" height="404" rx="28" fill="#F4FBF6" stroke="#D4EADA"/>',
        '<rect x="500" y="58" width="396" height="404" rx="28" fill="#FFF7F7" stroke="#F1D8D8"/>',
        '<circle cx="104" cy="102" r="19" fill="#DDF7E4"/><text x="104" y="109" text-anchor="middle" font-family="Mulish,Segoe UI,Arial,sans-serif" font-size="18" font-weight="900" fill="#198754">✓</text>',
        '<circle cx="540" cy="102" r="19" fill="#FFE5E5"/><text x="540" y="109" text-anchor="middle" font-family="Mulish,Segoe UI,Arial,sans-serif" font-size="18" font-weight="900" fill="#D9485F">!</text>',
        svg_text(136, 102, 'Recommended', size=17, weight=900, fill='#198754', anchor='start', max_chars=18, max_lines=1),
        svg_text(572, 102, 'Watch out', size=17, weight=900, fill='#D9485F', anchor='start', max_chars=18, max_lines=1)
    ]
    for col, arr, x in [(0, good, 92), (1, bad, 528)]:
        for i, item in enumerate(arr[:4]):
            y = 154 + i*76
            chunks.append(
                f'<g class="qm-node" style="--delay:{(i+col*2)*80}ms">'
                f'<text x="{x}" y="{y+5}" font-family="Mulish,Segoe UI,Arial,sans-serif" font-size="10" font-weight="900" fill="var(--qm-primary,#5147e8)">{i+1:02d}</text>'
                f'{svg_text(x+34, y, item, size=13, weight=800, fill=INK, anchor="start", max_chars=34, max_lines=3)}'
                f'<line x1="{x}" y1="{y+38}" x2="{x+330}" y2="{y+38}" stroke="#E8E8EF" stroke-width="1"/>'
                f'</g>'
            )
    return base_svg(''.join(chunks), slide.get('title'))


def visual_cards(slide):
    items = points(slide, 6)
    cols = 3 if len(items) > 4 else 2
    rows = math.ceil(len(items)/cols)
    gap_x, gap_y = 24, 24
    usable_w = SAFE_RIGHT - SAFE_LEFT
    card_w = (usable_w - (cols-1)*gap_x) / cols
    card_h = 142 if rows > 1 else 188
    total_h = rows*card_h + (rows-1)*gap_y
    y0 = (HEIGHT-total_h)/2
    chunks = []
    for i, item in enumerate(items):
        col, row = i % cols, i // cols
        x = SAFE_LEFT + col*(card_w+gap_x)
        y = y0 + row*(card_h+gap_y)
        chunks.append(
            f'<g class="qm-node" style="--delay:{i*75}ms" filter="url(#shadow)">'
            f'<rect x="{x:.1f}" y="{y:.1f}" width="{card_w:.1f}" height="{card_h:.1f}" rx="22" fill="#fff" stroke="{LINE}"/>'
            f'<circle cx="{x+34:.1f}" cy="{y+34:.1f}" r="16" fill="var(--qm-soft,#f0efff)"/>'
            f'<text x="{x+34:.1f}" y="{y+40:.1f}" text-anchor="middle" font-family="Mulish,Segoe UI,Arial,sans-serif" font-size="12" font-weight="900" fill="var(--qm-primary,#5147e8)">{i+1:02d}</text>'
            f'{svg_text(x+24, y+88, item, size=13, weight=800, fill=INK, anchor="start", max_chars=29, max_lines=3)}'
            f'</g>'
        )
    return base_svg(''.join(chunks), slide.get('title'))


def visual_spotlight(slide):
    item = points(slide, 1)[0]
    title = slide.get('visualTitle') or slide.get('title') or 'Key takeaway'
    inner = f'''
<rect x="130" y="86" width="700" height="348" rx="42" fill="url(#softGrad)" stroke="{LINE}" filter="url(#shadow)"/>
<circle cx="254" cy="260" r="82" fill="url(#accentGrad)"/>
<path d="M254 208l48 20v37c0 39-21 65-48 76-28-11-48-37-48-76v-37l48-20z" fill="none" stroke="#fff" stroke-width="8" stroke-linejoin="round"/>
<path d="M231 270l16 16 34-40" fill="none" stroke="#fff" stroke-width="9" stroke-linecap="round" stroke-linejoin="round"/>
<text x="384" y="176" font-family="Mulish,Segoe UI,Arial,sans-serif" font-size="10" font-weight="900" fill="var(--qm-primary,#5147e8)" letter-spacing="1.8">KEY TAKEAWAY</text>
{svg_text(384, 230, title, size=22, weight=900, fill=INK, anchor='start', max_chars=30, max_lines=2)}
{svg_text(384, 322, item, size=14, weight=700, fill=MUTED, anchor='start', max_chars=49, max_lines=4)}'''
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
            f'<rect x="{x}" y="{y}" width="350" height="164" rx="22" fill="{bg}" stroke="{LINE}"/>'
            f'<text x="{x+22}" y="{y+29}" font-family="Mulish,Segoe UI,Arial,sans-serif" font-size="10" font-weight="900" fill="{fg}" letter-spacing="1.2">{level}</text>'
            f'{svg_text(x+26,y+92,labels[i] or level.title()+" risk",size=14,weight=800,fill=INK,anchor="start",max_chars=32,max_lines=3)}'
            f'</g>'
        )
    return base_svg(''.join(inner), slide.get('title'))


def visual_cycle(slide):
    items = points(slide, 5)
    n = max(1, len(items))
    cx, cy = 480, 260
    rx, ry = 292, 172
    card_w, card_h = 150, 70
    coords = []
    for i in range(n):
        angle = -math.pi/2 + 2*math.pi*i/n
        coords.append((cx+math.cos(angle)*rx, cy+math.sin(angle)*ry))
    chunks = []
    for i,(x,y) in enumerate(coords):
        nx,ny = coords[(i+1)%n]
        chunks.append(f'<path class="qm-path" d="M{x:.1f} {y:.1f} Q{cx:.1f} {cy:.1f} {nx:.1f} {ny:.1f}" fill="none" stroke="#C9C6FF" stroke-width="3" marker-end="url(#arrow)" opacity=".8"/>')
    for i,((x,y),item) in enumerate(zip(coords,items)):
        left, top = x-card_w/2, y-card_h/2
        chunks.append(
            f'<g class="qm-node" style="--delay:{i*90}ms" filter="url(#shadow)">'
            f'<rect x="{left:.1f}" y="{top:.1f}" width="{card_w}" height="{card_h}" rx="18" fill="#fff" stroke="{LINE}"/>'
            f'<text x="{left+18:.1f}" y="{top+24:.1f}" font-family="Mulish,Segoe UI,Arial,sans-serif" font-size="9" font-weight="900" fill="var(--qm-primary,#5147e8)">{i+1:02d}</text>'
            f'{svg_text(left+18, top+46, item, size=11, weight=800, fill=INK, anchor="start", max_chars=19, max_lines=2)}'
            f'</g>'
        )
    title = slide.get('visualTitle') or slide.get('title') or 'Continuous cycle'
    chunks.append(f'<circle cx="{cx}" cy="{cy}" r="72" fill="url(#accentGrad)" filter="url(#shadow)"/>{svg_text(cx,cy,title,size=15,weight=900,fill="#fff",max_chars=17,max_lines=3)}')
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