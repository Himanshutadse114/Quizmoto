#!/usr/bin/env python3
"""Quizmoto SCORM vector asset generator.

Uses only the Python standard library. It converts semantic course slides into
portable SVG diagrams that are bundled inside the generated SCORM ZIP.
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
SAFE_LEFT = 42
SAFE_RIGHT = WIDTH - 42
SAFE_TOP = 34
SAFE_BOTTOM = HEIGHT - 34
INK = '#1e293b'
MUTED = '#64748b'
LINE = '#e2e8f0'


def esc(value):
    return html.escape(str(value or ''), quote=True)


def text_lines(value, max_chars=34, max_lines=4):
    words = re.sub(r'\s+', ' ', str(value or '')).strip().split(' ')
    lines = []
    current = ''
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
    lh = line_height or int(size * 1.25)
    start_y = y - ((len(lines) - 1) * lh / 2)
    spans = [f'<tspan x="{x}" y="{start_y + idx * lh:.1f}">{esc(line)}</tspan>' for idx, line in enumerate(lines)]
    return f'<text x="{x}" y="{y}" text-anchor="{anchor}" font-family="Inter,Segoe UI,Arial,sans-serif" font-size="{size}" font-weight="{weight}" fill="{fill}">{"".join(spans)}</text>'


def base_svg(inner, title='Learning visual'):
    return f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {WIDTH} {HEIGHT}" preserveAspectRatio="xMidYMid meet" role="img" aria-label="{esc(title)}">
<defs>
  <filter id="shadow" x="-22%" y="-22%" width="144%" height="144%"><feDropShadow dx="0" dy="8" stdDeviation="12" flood-color="#0f172a" flood-opacity=".10"/></filter>
  <filter id="softShadow" x="-28%" y="-28%" width="156%" height="156%"><feDropShadow dx="0" dy="14" stdDeviation="18" flood-color="#0f172a" flood-opacity=".12"/></filter>
  <linearGradient id="accentGrad" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="var(--qm-primary,#f97316)"/><stop offset="1" stop-color="var(--qm-accent,#fdba74)"/></linearGradient>
  <linearGradient id="softGrad" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset="1" stop-color="var(--qm-soft,#fff1e6)"/></linearGradient>
  <radialGradient id="halo"><stop offset="0" stop-color="var(--qm-accent,#fdba74)" stop-opacity=".34"/><stop offset=".72" stop-color="var(--qm-accent,#fdba74)" stop-opacity=".08"/><stop offset="1" stop-color="var(--qm-accent,#fdba74)" stop-opacity="0"/></radialGradient>
  <marker id="arrow" markerWidth="10" markerHeight="10" refX="8" refY="5" orient="auto"><path d="M0 0L10 5L0 10Z" fill="var(--qm-primary,#f97316)"/></marker>
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
    left, right, center_y = 110, WIDTH - 110, 270
    step_gap = 0 if n == 1 else (right - left) / (n - 1)
    chunks = [
        svg_text(WIDTH / 2, 76, slide.get('visualTitle') or 'How it works', size=20, weight=900, fill=INK, max_chars=40, max_lines=2),
        f'<path class="qm-path" d="M{left} {center_y}H{right}" stroke="#DDE2E8" stroke-width="8" stroke-linecap="round"/>',
        f'<path class="qm-path" d="M{left} {center_y}H{right}" stroke="var(--qm-primary,#f97316)" stroke-width="3" stroke-linecap="round" opacity=".38"/>'
    ]
    for i, item in enumerate(items):
        x = WIDTH / 2 if n == 1 else left + step_gap * i
        above = i % 2 == 0
        stem_end = 205 if above else 335
        text_y = 165 if above else 384
        label_y = text_y - 42
        chunks.append(
            f'<g class="qm-node" style="--delay:{i * 100}ms">'
            f'<line x1="{x:.1f}" y1="{center_y}" x2="{x:.1f}" y2="{stem_end}" stroke="#CBD2DC" stroke-width="2" stroke-linecap="round"/>'
            f'<circle class="qm-glow" cx="{x:.1f}" cy="{center_y}" r="45" fill="url(#halo)"/>'
            f'<circle cx="{x:.1f}" cy="{center_y}" r="31" fill="#fff" stroke="var(--qm-primary,#f97316)" stroke-width="5" filter="url(#shadow)"/>'
            f'<circle cx="{x:.1f}" cy="{center_y}" r="20" fill="var(--qm-soft,#fff1e6)"/>'
            f'<text x="{x:.1f}" y="{center_y + 6}" text-anchor="middle" font-family="Inter,Segoe UI,Arial,sans-serif" font-size="14" font-weight="900" fill="var(--qm-primary,#f97316)">{i + 1:02d}</text>'
            f'<text x="{x:.1f}" y="{label_y}" text-anchor="middle" font-family="Inter,Segoe UI,Arial,sans-serif" font-size="9" font-weight="900" fill="var(--qm-primary,#f97316)" letter-spacing="1.4">STEP {i + 1}</text>'
            f'{svg_text(x, text_y, item, size=13, weight=800, fill=INK, max_chars=24, max_lines=3)}'
            f'</g>'
        )
    return base_svg(''.join(chunks), slide.get('title'))


def visual_timeline(slide):
    items = points(slide, 5)
    n = max(1, len(items))
    left, right, y = 104, WIDTH - 104, 260
    chunks = [
        f'<path class="qm-path" d="M{left} {y}H{right}" stroke="#DDE2E8" stroke-width="8" stroke-linecap="round"/>',
        f'<path class="qm-path" d="M{left} {y}H{right}" stroke="url(#accentGrad)" stroke-width="3" stroke-linecap="round" opacity=".7"/>'
    ]
    for i, item in enumerate(items):
        x = WIDTH / 2 if n == 1 else left + (right-left) * i/(n-1)
        top = i % 2 == 0
        card_y = 72 if top else 328
        connector_y = card_y + 104 if top else card_y
        chunks.append(
            f'<g class="qm-node" style="--delay:{i * 95}ms">'
            f'<line x1="{x:.1f}" y1="{y}" x2="{x:.1f}" y2="{connector_y}" stroke="#CBD2DC" stroke-width="2.5"/>'
            f'<circle cx="{x:.1f}" cy="{y}" r="23" fill="#fff" stroke="var(--qm-primary,#f97316)" stroke-width="6" filter="url(#shadow)"/>'
            f'<circle cx="{x:.1f}" cy="{y}" r="11" fill="var(--qm-soft,#fff1e6)"/>'
            f'<rect x="{x-73:.1f}" y="{card_y}" width="146" height="104" rx="22" fill="url(#softGrad)" stroke="#DDE2E8" filter="url(#shadow)"/>'
            f'<text x="{x:.1f}" y="{card_y+27}" text-anchor="middle" font-family="Inter,Segoe UI,Arial,sans-serif" font-size="9" font-weight="900" fill="var(--qm-primary,#f97316)" letter-spacing="1">STAGE {i+1}</text>'
            f'{svg_text(x, card_y+66, item, size=12, weight=800, fill=INK, max_chars=21, max_lines=3)}'
            f'</g>'
        )
    return base_svg(''.join(chunks), slide.get('title'))


def visual_hub(slide):
    items = points(slide, 6)
    n = max(1, len(items))
    cx, cy = 480, 260
    radius_x, radius_y = 300, 172
    chunks = [f'<ellipse class="qm-pulse" cx="{cx}" cy="{cy}" rx="142" ry="142" fill="url(#halo)"/>']
    positions = []
    for i in range(n):
        angle = -math.pi/2 + 2*math.pi*i/n
        positions.append((cx + math.cos(angle)*radius_x, cy + math.sin(angle)*radius_y))
    for i, (item, (x, y)) in enumerate(zip(items, positions)):
        chunks.append(f'<path class="qm-path" style="--delay:{i * 65}ms" d="M{cx} {cy} L{x:.1f} {y:.1f}" stroke="var(--qm-accent,#fdba74)" stroke-width="3" stroke-linecap="round" opacity=".68"/>')
        capsule_w, capsule_h = 176, 72
        left, top = x - capsule_w/2, y - capsule_h/2
        chunks.append(
            f'<g class="qm-node" style="--delay:{120 + i * 90}ms" filter="url(#shadow)">'
            f'<rect x="{left:.1f}" y="{top:.1f}" width="{capsule_w}" height="{capsule_h}" rx="28" fill="#fff" stroke="#DDE2E8"/>'
            f'<circle cx="{left+28:.1f}" cy="{y:.1f}" r="14" fill="var(--qm-soft,#fff1e6)"/>'
            f'<text x="{left+28:.1f}" y="{y+4:.1f}" text-anchor="middle" font-family="Inter,Segoe UI,Arial,sans-serif" font-size="10" font-weight="900" fill="var(--qm-primary,#f97316)">{i+1:02d}</text>'
            f'{svg_text(left+50, y, item, size=11, weight=800, fill=INK, anchor="start", max_chars=20, max_lines=3)}'
            f'</g>'
        )
    center = str(slide.get('visualTitle') or slide.get('title') or 'Key concept')
    chunks.append(
        f'<g class="qm-center" filter="url(#softShadow)">'
        f'<circle cx="{cx}" cy="{cy}" r="91" fill="url(#accentGrad)"/>'
        f'<circle cx="{cx}" cy="{cy}" r="75" fill="none" stroke="#fff" stroke-opacity=".30" stroke-width="1.5"/>'
        f'{svg_text(cx, cy-7, center, size=17, weight=900, fill="#fff", max_chars=18, max_lines=3)}'
        f'<text x="{cx}" y="{cy+47}" text-anchor="middle" font-family="Inter,Segoe UI,Arial,sans-serif" font-size="8" font-weight="900" fill="#fff" opacity=".75" letter-spacing="1.5">KEY CONCEPT</text>'
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
        '<rect x="52" y="52" width="408" height="416" rx="32" fill="#F4FBF6" stroke="#D1EAD7"/>',
        '<rect x="500" y="52" width="408" height="416" rx="32" fill="#FFF6F7" stroke="#F0D8DC"/>',
        svg_text(94, 96, 'RECOMMENDED', size=16, weight=900, fill='#15803d', anchor='start', max_chars=18, max_lines=1),
        svg_text(542, 96, 'WATCH OUT', size=16, weight=900, fill='#dc2626', anchor='start', max_chars=18, max_lines=1)
    ]
    for col, arr, x, color, symbol in [(0, good, 84, '#16a34a', '✓'), (1, bad, 532, '#ef4444', '!')]:
        for i, item in enumerate(arr[:4]):
            y = 142 + i*78
            chunks.append(
                f'<g class="qm-node" style="--delay:{(i+col*2)*90}ms">'
                f'<circle cx="{x+20}" cy="{y+18}" r="18" fill="{color}"/>'
                f'<text x="{x+20}" y="{y+24}" text-anchor="middle" font-family="Inter,Segoe UI,Arial,sans-serif" font-size="17" font-weight="900" fill="#fff">{symbol}</text>'
                f'{svg_text(x+52, y+18, item, size=13, weight=750, fill=INK, anchor="start", max_chars=35, max_lines=3)}'
                f'<line x1="{x+52}" y1="{y+50}" x2="{x+330}" y2="{y+50}" stroke="#E7EAF0" stroke-width="1"/>'
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
    card_h = 150 if rows > 1 else 198
    total_h = rows*card_h + (rows-1)*gap_y
    y0 = (HEIGHT-total_h)/2
    chunks = []
    for i, item in enumerate(items):
        col, row = i % cols, i // cols
        x = SAFE_LEFT + col*(card_w+gap_x)
        y = y0 + row*(card_h+gap_y) - (8 if i % 2 else 0)
        chunks.append(
            f'<g class="qm-node" style="--delay:{i*80}ms" filter="url(#shadow)">'
            f'<rect x="{x:.1f}" y="{y:.1f}" width="{card_w:.1f}" height="{card_h:.1f}" rx="26" fill="url(#softGrad)" stroke="#DDE2E8"/>'
            f'<rect x="{x:.1f}" y="{y:.1f}" width="{card_w:.1f}" height="7" rx="3.5" fill="var(--qm-primary,#f97316)"/>'
            f'<circle cx="{x+35:.1f}" cy="{y+39:.1f}" r="17" fill="var(--qm-soft,#fff1e6)"/>'
            f'<text x="{x+35:.1f}" y="{y+45:.1f}" text-anchor="middle" font-family="Inter,Segoe UI,Arial,sans-serif" font-size="12" font-weight="900" fill="var(--qm-primary,#f97316)">{i+1:02d}</text>'
            f'{svg_text(x+24, y+91, item, size=13, weight=800, fill=INK, anchor="start", max_chars=29, max_lines=3)}'
            f'</g>'
        )
    return base_svg(''.join(chunks), slide.get('title'))


def visual_spotlight(slide):
    item = points(slide, 1)[0]
    title = slide.get('visualTitle') or slide.get('title') or 'Key takeaway'
    inner = f'''<circle class="qm-glow" cx="330" cy="260" r="170" fill="url(#halo)"/>
<circle class="qm-center" cx="330" cy="260" r="118" fill="url(#accentGrad)" filter="url(#softShadow)"/>
<circle cx="330" cy="260" r="94" fill="none" stroke="#fff" stroke-opacity=".24" stroke-width="2"/>
<path class="qm-float" d="M330 180 L392 205 V252 C392 301 366 334 330 349 C294 334 268 301 268 252 V205 Z" fill="none" stroke="#fff" stroke-width="8" stroke-linejoin="round"/>
<path d="M301 261L322 282L365 230" fill="none" stroke="#fff" stroke-width="10" stroke-linecap="round" stroke-linejoin="round"/>
<path class="qm-path" d="M475 260H550" stroke="var(--qm-accent,#fdba74)" stroke-width="4" stroke-linecap="round"/>
<circle cx="550" cy="260" r="7" fill="var(--qm-primary,#f97316)"/>
<text x="595" y="178" font-family="Inter,Segoe UI,Arial,sans-serif" font-size="10" font-weight="900" fill="var(--qm-primary,#f97316)" letter-spacing="1.8">KEY TAKEAWAY</text>
{svg_text(595, 235, title, size=22, weight=900, fill=INK, anchor='start', max_chars=28, max_lines=2)}
{svg_text(595, 325, item, size=14, weight=700, fill=MUTED, anchor='start', max_chars=44, max_lines=4)}'''
    return base_svg(inner, slide.get('title'))


def visual_matrix(slide):
    items = points(slide, 4)
    labels = items + ['']*(4-len(items))
    cells = [(105, 74, '#F0FAF4', '#15803d', 'LOW'), (500, 74, '#FFF9ED', '#b45309', 'MEDIUM'), (105, 270, '#FFF9ED', '#b45309', 'MEDIUM'), (500, 270, '#FFF3F4', '#b91c1c', 'HIGH')]
    inner = [
        '<text x="500" y="42" text-anchor="middle" font-family="Inter,Segoe UI,Arial,sans-serif" font-size="11" font-weight="900" fill="#64748b" letter-spacing="1.5">IMPACT →</text>',
        '<text x="42" y="260" text-anchor="middle" transform="rotate(-90 42 260)" font-family="Inter,Segoe UI,Arial,sans-serif" font-size="11" font-weight="900" fill="#64748b" letter-spacing="1.5">LIKELIHOOD →</text>'
    ]
    for i, (x, y, bg, fg, level) in enumerate(cells):
        inner.append(
            f'<g class="qm-node" style="--delay:{i*95}ms">'
            f'<rect x="{x}" y="{y}" width="350" height="164" rx="25" fill="{bg}" stroke="#DDE2E8" filter="url(#shadow)"/>'
            f'<text x="{x+22}" y="{y+29}" font-family="Inter,Segoe UI,Arial,sans-serif" font-size="10" font-weight="900" fill="{fg}" letter-spacing="1.2">{level}</text>'
            f'{svg_text(x+26, y+92, labels[i] or level.title()+" risk", size=14, weight=800, fill=INK, anchor="start", max_chars=31, max_lines=3)}'
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
    chunks = [f'<circle class="qm-pulse" cx="{cx}" cy="{cy}" r="110" fill="url(#halo)"/>']
    for i, (x, y) in enumerate(coords):
        nx, ny = coords[(i+1)%n]
        chunks.append(f'<path class="qm-path" style="--delay:{i*55}ms" d="M{x:.1f} {y:.1f} Q{cx:.1f} {cy:.1f} {nx:.1f} {ny:.1f}" fill="none" stroke="var(--qm-accent,#fdba74)" stroke-width="3" marker-end="url(#arrow)" opacity=".78"/>')
    for i, ((x, y), item) in enumerate(zip(coords, items)):
        left, top = x-card_w/2, y-card_h/2
        chunks.append(
            f'<g class="qm-node" style="--delay:{i*95}ms" filter="url(#shadow)">'
            f'<rect x="{left:.1f}" y="{top:.1f}" width="{card_w}" height="{card_h}" rx="26" fill="#fff" stroke="#DDE2E8"/>'
            f'<text x="{left+18:.1f}" y="{top+24:.1f}" font-family="Inter,Segoe UI,Arial,sans-serif" font-size="9" font-weight="900" fill="var(--qm-primary,#f97316)">{i+1:02d}</text>'
            f'{svg_text(left+18, top+47, item, size=11, weight=800, fill=INK, anchor="start", max_chars=18, max_lines=2)}'
            f'</g>'
        )
    title = slide.get('visualTitle') or slide.get('title') or 'Continuous cycle'
    chunks.append(f'<g class="qm-center" filter="url(#softShadow)"><circle cx="{cx}" cy="{cy}" r="76" fill="url(#accentGrad)"/>{svg_text(cx, cy, title, size=15, weight=900, fill="#fff", max_chars=17, max_lines=3)}</g>')
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
