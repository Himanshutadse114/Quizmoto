#!/usr/bin/env python3
"""Quizmoto SCORM vector asset generator.

Uses only the Python standard library. It converts semantic course slides into
portable SVG diagrams that are bundled inside the generated SCORM ZIP.
"""

import argparse
import html
import json
import math
import os
import re
import sys
from pathlib import Path

WIDTH = 960
HEIGHT = 520


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


def svg_text(x, y, value, size=18, weight=700, fill='#1e293b', anchor='middle', max_chars=34, max_lines=3, line_height=None):
    lines = text_lines(value, max_chars=max_chars, max_lines=max_lines)
    lh = line_height or int(size * 1.25)
    start_y = y - ((len(lines) - 1) * lh / 2)
    spans = []
    for idx, line in enumerate(lines):
        spans.append(f'<tspan x="{x}" y="{start_y + idx * lh:.1f}">{esc(line)}</tspan>')
    return f'<text x="{x}" y="{y}" text-anchor="{anchor}" font-family="Inter,Segoe UI,Arial,sans-serif" font-size="{size}" font-weight="{weight}" fill="{fill}">{"".join(spans)}</text>'


def base_svg(inner, title='Learning visual'):
    return f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {WIDTH} {HEIGHT}" role="img" aria-label="{esc(title)}">
<defs>
  <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%"><feDropShadow dx="0" dy="10" stdDeviation="12" flood-color="#0f172a" flood-opacity=".10"/></filter>
  <linearGradient id="accentGrad" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="var(--qm-primary,#f97316)"/><stop offset="1" stop-color="var(--qm-accent,#fdba74)"/></linearGradient>
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
    n = len(items)
    gap = 24
    card_w = min(205, (WIDTH - 100 - gap * (n - 1)) / max(1, n))
    total = card_w * n + gap * (n - 1)
    x0 = (WIDTH - total) / 2
    chunks = []
    for i, item in enumerate(items):
        x = x0 + i * (card_w + gap)
        if i < n - 1:
            x1 = x + card_w
            x2 = x + card_w + gap - 6
            chunks.append(f'<path d="M{x1:.1f} 260 H{x2:.1f}" stroke="var(--qm-primary,#f97316)" stroke-width="5" stroke-linecap="round" marker-end="url(#arrow)" opacity=".75"/>')
        chunks.append(f'<g class="qm-node" style="--delay:{i * 90}ms" filter="url(#shadow)"><rect x="{x:.1f}" y="150" width="{card_w:.1f}" height="220" rx="24" fill="#fff" stroke="#e2e8f0"/><circle cx="{x + card_w/2:.1f}" cy="190" r="25" fill="var(--qm-soft,#fff1e6)"/><text x="{x + card_w/2:.1f}" y="198" text-anchor="middle" font-family="Inter,Arial" font-size="20" font-weight="900" fill="var(--qm-primary,#f97316)">{i+1}</text>{svg_text(x + card_w/2, 282, item, size=16, weight=750, max_chars=25, max_lines=4)}</g>')
    return base_svg(''.join(chunks), slide.get('title'))


def visual_timeline(slide):
    items = points(slide, 5)
    n = len(items)
    left, right, y = 105, WIDTH - 105, 215
    chunks = [f'<path class="qm-path" d="M{left} {y}H{right}" stroke="url(#accentGrad)" stroke-width="8" stroke-linecap="round"/>']
    for i, item in enumerate(items):
        x = left if n == 1 else left + (right-left) * i/(n-1)
        down = i % 2 == 0
        card_y = 270 if down else 32
        line_y2 = card_y if not down else card_y
        chunks.append(f'<g class="qm-node" style="--delay:{i * 100}ms"><line x1="{x:.1f}" y1="{y}" x2="{x:.1f}" y2="{270 if down else 190}" stroke="#cbd5e1" stroke-width="3"/><circle cx="{x:.1f}" cy="{y}" r="22" fill="#fff" stroke="var(--qm-primary,#f97316)" stroke-width="7"/><rect x="{x-78:.1f}" y="{card_y}" width="156" height="150" rx="20" fill="#fff" stroke="#e2e8f0" filter="url(#shadow)"/>{svg_text(x, card_y+74, item, size=14, weight=750, max_chars=22, max_lines=4)}</g>')
    return base_svg(''.join(chunks), slide.get('title'))


def visual_hub(slide):
    items = points(slide, 6)
    cx, cy, radius = 480, 260, 185
    chunks = []
    for i, item in enumerate(items):
        angle = -math.pi/2 + (2*math.pi*i/max(1,len(items)))
        x = cx + math.cos(angle)*radius
        y = cy + math.sin(angle)*radius
        chunks.append(f'<line class="qm-path" x1="{cx}" y1="{cy}" x2="{x:.1f}" y2="{y:.1f}" stroke="var(--qm-accent,#fdba74)" stroke-width="5" opacity=".8"/>')
        chunks.append(f'<g class="qm-node" style="--delay:{i*90}ms" filter="url(#shadow)"><circle cx="{x:.1f}" cy="{y:.1f}" r="66" fill="#fff" stroke="var(--qm-primary,#f97316)" stroke-width="5"/>{svg_text(x, y, item, size=12, weight=750, max_chars=16, max_lines=4)}</g>')
    center = str(slide.get('visualTitle') or slide.get('title') or 'Key concept')
    chunks.append(f'<g class="qm-center" filter="url(#shadow)"><circle cx="{cx}" cy="{cy}" r="91" fill="url(#accentGrad)"/>{svg_text(cx, cy, center, size=17, weight=900, fill="#fff", max_chars=17, max_lines=3)}</g>')
    return base_svg(''.join(chunks), slide.get('title'))


def visual_comparison(slide):
    items = points(slide, 6)
    half = max(1, math.ceil(len(items)/2))
    good, bad = items[:half], items[half:]
    if not bad:
        bad = ['Avoid the opposite behaviour and verify before acting.']
    chunks = ['<rect x="55" y="55" width="400" height="410" rx="30" fill="#f0fdf4" stroke="#86efac"/><rect x="505" y="55" width="400" height="410" rx="30" fill="#fef2f2" stroke="#fca5a5"/>', svg_text(255, 102, 'RECOMMENDED', size=18, weight=900, fill='#15803d'), svg_text(705, 102, 'WATCH OUT', size=18, weight=900, fill='#dc2626')]
    for col, arr, x, color, symbol in [(0, good, 90, '#16a34a', '✓'), (1, bad, 540, '#ef4444', '!')]:
        for i, item in enumerate(arr[:4]):
            y = 148 + i*78
            chunks.append(f'<g class="qm-node" style="--delay:{(i+col*2)*90}ms"><circle cx="{x+18}" cy="{y+18}" r="18" fill="{color}"/><text x="{x+18}" y="{y+24}" text-anchor="middle" font-family="Arial" font-size="18" font-weight="900" fill="#fff">{symbol}</text>{svg_text(x+48, y+18, item, size=14, weight=700, fill="#334155", anchor="start", max_chars=36, max_lines=3)}</g>')
    return base_svg(''.join(chunks), slide.get('title'))


def visual_cards(slide):
    items = points(slide, 6)
    cols = 3 if len(items) > 4 else 2
    rows = math.ceil(len(items)/cols)
    card_w = 250 if cols == 3 else 350
    card_h = 155 if rows >= 2 else 200
    gap_x, gap_y = 28, 26
    total_w = cols*card_w + (cols-1)*gap_x
    x0 = (WIDTH-total_w)/2
    total_h = rows*card_h + (rows-1)*gap_y
    y0 = (HEIGHT-total_h)/2
    chunks = []
    for i, item in enumerate(items):
        col, row = i % cols, i // cols
        x, y = x0 + col*(card_w+gap_x), y0 + row*(card_h+gap_y)
        chunks.append(f'<g class="qm-node" style="--delay:{i*80}ms" filter="url(#shadow)"><rect x="{x:.1f}" y="{y:.1f}" width="{card_w}" height="{card_h}" rx="24" fill="#fff" stroke="#e2e8f0"/><rect x="{x:.1f}" y="{y:.1f}" width="8" height="{card_h}" rx="4" fill="var(--qm-primary,#f97316)"/><circle cx="{x+44:.1f}" cy="{y+42:.1f}" r="21" fill="var(--qm-soft,#fff1e6)"/><text x="{x+44:.1f}" y="{y+49:.1f}" text-anchor="middle" font-family="Inter,Arial" font-size="18" font-weight="900" fill="var(--qm-primary,#f97316)">{i+1}</text>{svg_text(x+28, y+95, item, size=14, weight=750, fill="#334155", anchor="start", max_chars=30, max_lines=3)}</g>')
    return base_svg(''.join(chunks), slide.get('title'))


def visual_spotlight(slide):
    item = points(slide, 1)[0]
    title = slide.get('visualTitle') or slide.get('title') or 'Key takeaway'
    inner = f'''<circle class="qm-pulse" cx="480" cy="250" r="190" fill="var(--qm-soft,#fff1e6)"/>
<circle cx="480" cy="250" r="135" fill="url(#accentGrad)" filter="url(#shadow)"/>
<path d="M480 142l82 34v62c0 66-35 108-82 126-47-18-82-60-82-126v-62l82-34z" fill="none" stroke="#fff" stroke-width="12" stroke-linejoin="round"/>
<path d="M440 252l27 27 58-66" fill="none" stroke="#fff" stroke-width="14" stroke-linecap="round" stroke-linejoin="round"/>
{svg_text(480, 430, title, size=18, weight=900, fill="#1e293b", max_chars=32, max_lines=2)}
{svg_text(480, 482, item, size=13, weight=650, fill="#64748b", max_chars=70, max_lines=2)}'''
    return base_svg(inner, slide.get('title'))


def visual_matrix(slide):
    items = points(slide, 4)
    labels = items + ['']*(4-len(items))
    inner = ['<text x="480" y="45" text-anchor="middle" font-family="Inter,Arial" font-size="15" font-weight="900" fill="#475569">IMPACT →</text>', '<text x="35" y="265" text-anchor="middle" transform="rotate(-90 35 265)" font-family="Inter,Arial" font-size="15" font-weight="900" fill="#475569">LIKELIHOOD →</text>']
    cells = [(90,65,'#dcfce7','#15803d','LOW'), (500,65,'#fef3c7','#b45309','MEDIUM'), (90,275,'#fef3c7','#b45309','MEDIUM'), (500,275,'#fee2e2','#b91c1c','HIGH')]
    for i,(x,y,bg,fg,level) in enumerate(cells):
        inner.append(f'<g class="qm-node" style="--delay:{i*100}ms"><rect x="{x}" y="{y}" width="370" height="180" rx="24" fill="{bg}"/><text x="{x+24}" y="{y+34}" font-family="Inter,Arial" font-size="12" font-weight="900" fill="{fg}">{level}</text>{svg_text(x+185,y+100,labels[i] or level.title()+" risk",size=15,weight=750,fill="#334155",max_chars=35,max_lines=3)}</g>')
    return base_svg(''.join(inner), slide.get('title'))


def visual_cycle(slide):
    items = points(slide, 5)
    cx, cy, radius = 480, 260, 165
    chunks = []
    coords = []
    for i in range(len(items)):
        angle = -math.pi/2 + 2*math.pi*i/max(1,len(items))
        coords.append((cx+math.cos(angle)*radius, cy+math.sin(angle)*radius))
    for i,(x,y) in enumerate(coords):
        nx,ny=coords[(i+1)%len(coords)]
        chunks.append(f'<path class="qm-path" d="M{x:.1f} {y:.1f} Q{cx:.1f} {cy:.1f} {nx:.1f} {ny:.1f}" fill="none" stroke="var(--qm-accent,#fdba74)" stroke-width="5" marker-end="url(#arrow)" opacity=".65"/>')
    for i,((x,y),item) in enumerate(zip(coords,items)):
        chunks.append(f'<g class="qm-node" style="--delay:{i*100}ms" filter="url(#shadow)"><circle cx="{x:.1f}" cy="{y:.1f}" r="72" fill="#fff" stroke="var(--qm-primary,#f97316)" stroke-width="5"/>{svg_text(x,y,item,size=13,weight=750,max_chars=18,max_lines=4)}</g>')
    chunks.append(f'<circle cx="{cx}" cy="{cy}" r="70" fill="url(#accentGrad)"/>{svg_text(cx,cy,slide.get("visualTitle") or slide.get("title") or "Cycle",size=15,weight=900,fill="#fff",max_chars=18,max_lines=3)}')
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
