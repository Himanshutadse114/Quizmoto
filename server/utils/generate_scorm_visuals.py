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
SAFE_LEFT = 62
SAFE_RIGHT = WIDTH - 62
SAFE_TOP = 48
SAFE_BOTTOM = HEIGHT - 48


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
    spans = [f'<tspan x="{x}" y="{start_y + idx * lh:.1f}">{esc(line)}</tspan>' for idx, line in enumerate(lines)]
    return f'<text x="{x}" y="{y}" text-anchor="{anchor}" font-family="Inter,Segoe UI,Arial,sans-serif" font-size="{size}" font-weight="{weight}" fill="{fill}">{"".join(spans)}</text>'


def base_svg(inner, title='Learning visual'):
    return f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {WIDTH} {HEIGHT}" preserveAspectRatio="xMidYMid meet" role="img" aria-label="{esc(title)}">
<defs>
  <filter id="shadow" x="-18%" y="-18%" width="136%" height="136%"><feDropShadow dx="0" dy="8" stdDeviation="10" flood-color="#0f172a" flood-opacity=".08"/></filter>
  <linearGradient id="accentGrad" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="var(--qm-primary,#4f46e5)"/><stop offset="1" stop-color="var(--qm-accent,#ddd9ff)"/></linearGradient>
  <marker id="arrow" markerWidth="9" markerHeight="9" refX="7.5" refY="4.5" orient="auto"><path d="M0 0L9 4.5L0 9Z" fill="var(--qm-primary,#4f46e5)"/></marker>
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
    gap = 24
    usable = SAFE_RIGHT - SAFE_LEFT
    card_w = min(198, (usable - gap * (n - 1)) / n)
    total = card_w * n + gap * (n - 1)
    x0 = (WIDTH - total) / 2
    y, card_h = 150, 220
    chunks = []
    for i, item in enumerate(items):
        x = x0 + i * (card_w + gap)
        if i < len(items) - 1:
            chunks.append(f'<path class="qm-path" d="M{x + card_w:.1f} 260 H{x + card_w + gap - 7:.1f}" stroke="var(--qm-primary,#4f46e5)" stroke-width="4" stroke-linecap="round" marker-end="url(#arrow)" opacity=".55"/>')
        chunks.append(f'<g class="qm-node" style="--delay:{i * 90}ms" filter="url(#shadow)"><rect x="{x:.1f}" y="{y}" width="{card_w:.1f}" height="{card_h}" rx="22" fill="#fff" stroke="#e2e8f0"/><circle cx="{x + card_w/2:.1f}" cy="192" r="23" fill="var(--qm-soft,#efeffd)"/><text x="{x + card_w/2:.1f}" y="199" text-anchor="middle" font-family="Inter,Arial" font-size="18" font-weight="900" fill="var(--qm-primary,#4f46e5)">{i+1}</text>{svg_text(x + card_w/2, 282, item, size=15, weight=750, max_chars=24, max_lines=4)}</g>')
    return base_svg(''.join(chunks), slide.get('title'))


def visual_timeline(slide):
    items = points(slide, 5)
    n = max(1, len(items))
    left, right, y = 120, WIDTH - 120, 260
    chunks = [f'<path class="qm-path" d="M{left} {y}H{right}" stroke="url(#accentGrad)" stroke-width="7" stroke-linecap="round"/>']
    for i, item in enumerate(items):
        x = left if n == 1 else left + (right-left) * i/(n-1)
        down = i % 2 == 0
        card_y = 302 if down else 62
        chunks.append(f'<g class="qm-node" style="--delay:{i * 100}ms"><line x1="{x:.1f}" y1="{y}" x2="{x:.1f}" y2="{302 if down else 190}" stroke="#cbd5e1" stroke-width="3"/><circle cx="{x:.1f}" cy="{y}" r="18" fill="#fff" stroke="var(--qm-primary,#4f46e5)" stroke-width="6"/><rect x="{x-70:.1f}" y="{card_y}" width="140" height="118" rx="18" fill="#fff" stroke="#e2e8f0" filter="url(#shadow)"/>{svg_text(x, card_y+59, item, size=13, weight=750, max_chars=20, max_lines=4)}</g>')
    return base_svg(''.join(chunks), slide.get('title'))


def visual_hub(slide):
    items = points(slide, 6)
    cx, cy = 480, 260
    radius = 152 if len(items) >= 5 else 165
    node_r = 52 if len(items) >= 5 else 58
    center_r = 76
    chunks = []
    for i, item in enumerate(items):
        angle = -math.pi/2 + (2*math.pi*i/max(1,len(items)))
        x = cx + math.cos(angle)*radius
        y = cy + math.sin(angle)*radius
        chunks.append(f'<line class="qm-path" x1="{cx}" y1="{cy}" x2="{x:.1f}" y2="{y:.1f}" stroke="var(--qm-accent,#ddd9ff)" stroke-width="4" opacity=".75"/>')
        chunks.append(f'<g class="qm-node" style="--delay:{i*90}ms" filter="url(#shadow)"><circle cx="{x:.1f}" cy="{y:.1f}" r="{node_r}" fill="#fff" stroke="var(--qm-primary,#4f46e5)" stroke-width="4"/>{svg_text(x, y, item, size=11, weight=750, max_chars=15, max_lines=4)}</g>')
    center = str(slide.get('visualTitle') or slide.get('title') or 'Key concept')
    chunks.append(f'<g class="qm-center" filter="url(#shadow)"><circle cx="{cx}" cy="{cy}" r="{center_r}" fill="url(#accentGrad)"/>{svg_text(cx, cy, center, size=16, weight=900, fill="#fff", max_chars=16, max_lines=3)}</g>')
    return base_svg(''.join(chunks), slide.get('title'))


def visual_comparison(slide):
    items = points(slide, 6)
    half = max(1, math.ceil(len(items)/2))
    good, bad = items[:half], items[half:]
    if not bad:
        bad = ['Avoid the opposite behaviour and verify before acting.']
    chunks = ['<rect x="70" y="65" width="375" height="390" rx="28" fill="#f0fdf4" stroke="#bbf7d0"/><rect x="515" y="65" width="375" height="390" rx="28" fill="#fef2f2" stroke="#fecaca"/>', svg_text(257, 108, 'RECOMMENDED', size=17, weight=900, fill='#15803d'), svg_text(702, 108, 'WATCH OUT', size=17, weight=900, fill='#dc2626')]
    for col, arr, x, color, symbol in [(0, good, 96, '#16a34a', '✓'), (1, bad, 541, '#ef4444', '!')]:
        for i, item in enumerate(arr[:4]):
            y = 150 + i*76
            chunks.append(f'<g class="qm-node" style="--delay:{(i+col*2)*90}ms"><circle cx="{x+16}" cy="{y+16}" r="16" fill="{color}"/><text x="{x+16}" y="{y+22}" text-anchor="middle" font-family="Arial" font-size="16" font-weight="900" fill="#fff">{symbol}</text>{svg_text(x+44, y+16, item, size=13, weight=700, fill="#334155", anchor="start", max_chars=34, max_lines=3)}</g>')
    return base_svg(''.join(chunks), slide.get('title'))


def visual_cards(slide):
    items = points(slide, 6)
    cols = 3 if len(items) > 4 else 2
    rows = math.ceil(len(items)/cols)
    gap_x, gap_y = 24, 22
    usable_w = SAFE_RIGHT - SAFE_LEFT
    usable_h = SAFE_BOTTOM - SAFE_TOP
    card_w = (usable_w - (cols-1)*gap_x) / cols
    card_h = min(150 if rows > 1 else 205, (usable_h - (rows-1)*gap_y) / rows)
    total_w = cols*card_w + (cols-1)*gap_x
    total_h = rows*card_h + (rows-1)*gap_y
    x0 = (WIDTH-total_w)/2
    y0 = (HEIGHT-total_h)/2
    chunks = []
    for i, item in enumerate(items):
        col, row = i % cols, i // cols
        x, y = x0 + col*(card_w+gap_x), y0 + row*(card_h+gap_y)
        chunks.append(f'<g class="qm-node" style="--delay:{i*80}ms" filter="url(#shadow)"><rect x="{x:.1f}" y="{y:.1f}" width="{card_w:.1f}" height="{card_h:.1f}" rx="22" fill="#fff" stroke="#e2e8f0"/><rect x="{x:.1f}" y="{y:.1f}" width="7" height="{card_h:.1f}" rx="3.5" fill="var(--qm-primary,#4f46e5)"/><circle cx="{x+40:.1f}" cy="{y+38:.1f}" r="19" fill="var(--qm-soft,#efeffd)"/><text x="{x+40:.1f}" y="{y+44:.1f}" text-anchor="middle" font-family="Inter,Arial" font-size="16" font-weight="900" fill="var(--qm-primary,#4f46e5)">{i+1}</text>{svg_text(x+24, y+88, item, size=13, weight=750, fill="#334155", anchor="start", max_chars=28, max_lines=3)}</g>')
    return base_svg(''.join(chunks), slide.get('title'))


def visual_spotlight(slide):
    item = points(slide, 1)[0]
    title = slide.get('visualTitle') or slide.get('title') or 'Key takeaway'
    inner = f'''<circle class="qm-pulse" cx="480" cy="230" r="165" fill="var(--qm-soft,#efeffd)"/>
<circle cx="480" cy="230" r="118" fill="url(#accentGrad)" filter="url(#shadow)"/>
<path d="M480 135l70 29v54c0 57-30 94-70 110-40-16-70-53-70-110v-54l70-29z" fill="none" stroke="#fff" stroke-width="10" stroke-linejoin="round"/>
<path d="M446 231l23 23 49-56" fill="none" stroke="#fff" stroke-width="12" stroke-linecap="round" stroke-linejoin="round"/>
{svg_text(480, 414, title, size=18, weight=900, fill="#1e293b", max_chars=32, max_lines=2)}
{svg_text(480, 462, item, size=13, weight=650, fill="#64748b", max_chars=68, max_lines=2)}'''
    return base_svg(inner, slide.get('title'))


def visual_matrix(slide):
    items = points(slide, 4)
    labels = items + ['']*(4-len(items))
    inner = ['<text x="480" y="42" text-anchor="middle" font-family="Inter,Arial" font-size="14" font-weight="900" fill="#475569">IMPACT →</text>', '<text x="42" y="260" text-anchor="middle" transform="rotate(-90 42 260)" font-family="Inter,Arial" font-size="14" font-weight="900" fill="#475569">LIKELIHOOD →</text>']
    cells = [(92,62,'#dcfce7','#15803d','LOW'), (500,62,'#fef3c7','#b45309','MEDIUM'), (92,272,'#fef3c7','#b45309','MEDIUM'), (500,272,'#fee2e2','#b91c1c','HIGH')]
    for i,(x,y,bg,fg,level) in enumerate(cells):
        inner.append(f'<g class="qm-node" style="--delay:{i*100}ms"><rect x="{x}" y="{y}" width="360" height="176" rx="22" fill="{bg}"/><text x="{x+22}" y="{y+31}" font-family="Inter,Arial" font-size="11" font-weight="900" fill="{fg}">{level}</text>{svg_text(x+180,y+99,labels[i] or level.title()+" risk",size=14,weight=750,fill="#334155",max_chars=34,max_lines=3)}</g>')
    return base_svg(''.join(inner), slide.get('title'))


def visual_cycle(slide):
    items = points(slide, 5)
    cx, cy = 480, 260
    radius = 148
    node_r = 56
    chunks = []
    coords = []
    for i in range(len(items)):
        angle = -math.pi/2 + 2*math.pi*i/max(1,len(items))
        coords.append((cx+math.cos(angle)*radius, cy+math.sin(angle)*radius))
    for i,(x,y) in enumerate(coords):
        nx,ny=coords[(i+1)%len(coords)]
        chunks.append(f'<path class="qm-path" d="M{x:.1f} {y:.1f} Q{cx:.1f} {cy:.1f} {nx:.1f} {ny:.1f}" fill="none" stroke="var(--qm-accent,#ddd9ff)" stroke-width="4" marker-end="url(#arrow)" opacity=".62"/>')
    for i,((x,y),item) in enumerate(zip(coords,items)):
        chunks.append(f'<g class="qm-node" style="--delay:{i*100}ms" filter="url(#shadow)"><circle cx="{x:.1f}" cy="{y:.1f}" r="{node_r}" fill="#fff" stroke="var(--qm-primary,#4f46e5)" stroke-width="4"/>{svg_text(x,y,item,size=12,weight=750,max_chars=16,max_lines=4)}</g>')
    chunks.append(f'<circle cx="{cx}" cy="{cy}" r="68" fill="url(#accentGrad)"/>{svg_text(cx,cy,slide.get("visualTitle") or slide.get("title") or "Cycle",size=15,weight=900,fill="#fff",max_chars=17,max_lines=3)}')
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
