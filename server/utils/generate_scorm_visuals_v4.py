#!/usr/bin/env python3
"""Quizmoto SCORM vector generator v4.

Keeps the deterministic SVG pipeline, but improves learner readability,
geometry, accessibility and motion. Course-theme colours are injected at
generation time so packages remain portable and do not depend on external
assets.
"""

import html
import json
import math
import re
import sys

import generate_scorm_visuals_v2 as animated

base = animated.base
_upstream_base_svg = base.base_svg
_upstream_svg_text = base.svg_text
_theme = {
    'primary': '#3b82f6',
    'accent': '#7dd3fc',
    'soft': '#e0f2fe',
}


def readable_svg_text(x, y, value, size=18, weight=700, fill=base.INK,
                      anchor='middle', max_chars=34, max_lines=3,
                      line_height=None):
    """Raise the practical minimum type size while preserving text wrapping."""
    numeric = float(size or 18)
    if numeric <= 11:
        readable_size = 13
    elif numeric <= 13:
        readable_size = 14
    elif numeric <= 15:
        readable_size = 16
    elif numeric <= 18:
        readable_size = numeric + 1
    else:
        readable_size = numeric

    readable_line_height = line_height
    if readable_line_height is None:
        readable_line_height = int(readable_size * 1.28)

    return _upstream_svg_text(
        x,
        y,
        value,
        size=readable_size,
        weight=weight,
        fill=fill,
        anchor=anchor,
        max_chars=max_chars,
        max_lines=max_lines,
        line_height=readable_line_height,
    )


def _raise_micro_labels(svg):
    """Increase hard-coded SVG micro labels (8–10px) to a readable minimum."""
    def replace(match):
        value = float(match.group(1))
        return 'font-size="11.5"' if value <= 10 else match.group(0)

    return re.sub(r'font-size="(8(?:\.0)?|9(?:\.0)?|10(?:\.0)?)"', replace, svg)


def enhanced_base_svg(inner, title='Learning visual'):
    svg = _upstream_base_svg(inner, title)
    style = (
        f'--qm-primary:{_theme["primary"]};'
        f'--qm-accent:{_theme["accent"]};'
        f'--qm-soft:{_theme["soft"]};'
    )
    svg = svg.replace('<svg ', f'<svg style="{style}" ', 1)
    svg = _raise_micro_labels(svg)

    safe_title = html.escape(str(title or 'Learning visual'))
    description = html.escape(
        'Interactive learning diagram. Read the accompanying course text for the full explanation.'
    )
    first_close = svg.find('>')
    if first_close >= 0:
        svg = (
            svg[:first_close + 1]
            + f'<title>{safe_title}</title><desc>{description}</desc>'
            + svg[first_close + 1:]
        )

    # Infinite ambient motion competed with the learning content. Entrance and
    # path-draw motion remains, but decoration settles quickly into a stable SVG.
    motion_override = '''
<style>
svg text{text-rendering:geometricPrecision}
.qm-pulse,.qm-float,.qm-glow{animation:qmDecorIn .72s cubic-bezier(.16,1,.3,1) both!important}
.qm-node{animation-duration:.52s!important}
.qm-path{animation-duration:.78s!important}
@keyframes qmDecorIn{from{opacity:0;transform:translateY(5px) scale(.985)}to{opacity:1;transform:none}}
@media(prefers-reduced-motion:reduce){.qm-node,.qm-path,.qm-center,.qm-pulse,.qm-float,.qm-glow{animation:none!important;opacity:1!important;transform:none!important;stroke-dashoffset:0!important}}
</style>'''
    return svg.replace('</svg>', motion_override + '</svg>', 1)


def _card_geometry(count, max_width=240, gap=18):
    count = max(1, count)
    usable = base.SAFE_RIGHT - base.SAFE_LEFT
    width = min(max_width, (usable - (count - 1) * gap) / count)
    total = count * width + (count - 1) * gap
    start = (base.WIDTH - total) / 2
    return width, gap, start


def visual_process_v4(slide):
    """Large, scan-friendly process cards with an obvious left-to-right flow."""
    items = base.points(slide, 4)
    card_w, gap, x0 = _card_geometry(len(items), max_width=240, gap=18)
    card_y, card_h = 145, 238
    chunks = [
        base.svg_text(
            base.WIDTH / 2,
            62,
            slide.get('visualTitle') or 'How it works',
            size=20,
            weight=900,
            fill=base.INK,
            max_chars=42,
            max_lines=2,
        )
    ]

    for i, item in enumerate(items):
        x = x0 + i * (card_w + gap)
        center_y = card_y + card_h / 2
        if i < len(items) - 1:
            next_x = x0 + (i + 1) * (card_w + gap)
            chunks.append(
                f'<path class="qm-path" style="--delay:{80 + i * 70}ms" '
                f'd="M{x + card_w + 4:.1f} {center_y:.1f}H{next_x - 8:.1f}" '
                f'stroke="var(--qm-primary,#f97316)" stroke-width="4" '
                f'stroke-linecap="round" marker-end="url(#arrow)" opacity=".72"/>'
            )
        chunks.append(
            f'<g class="qm-node" style="--delay:{120 + i * 95}ms" filter="url(#shadow)">'
            f'<rect x="{x:.1f}" y="{card_y}" width="{card_w:.1f}" height="{card_h}" '
            f'rx="28" fill="url(#softGrad)" stroke="#DDE2E8"/>'
            f'<rect x="{x:.1f}" y="{card_y}" width="{card_w:.1f}" height="7" rx="3.5" '
            f'fill="var(--qm-primary,#f97316)"/>'
            f'<circle cx="{x + 36:.1f}" cy="{card_y + 48}" r="21" fill="var(--qm-soft,#fff1e6)"/>'
            f'<text x="{x + 36:.1f}" y="{card_y + 54}" text-anchor="middle" '
            f'font-family="Inter,Segoe UI,Arial,sans-serif" font-size="12" font-weight="900" '
            f'fill="var(--qm-primary,#f97316)">{i + 1:02d}</text>'
            f'<text x="{x + 67:.1f}" y="{card_y + 45}" '
            f'font-family="Inter,Segoe UI,Arial,sans-serif" font-size="11" font-weight="900" '
            f'fill="var(--qm-primary,#f97316)" letter-spacing="1.1">STEP {i + 1}</text>'
            f'{base.svg_text(x + card_w / 2, card_y + 145, item, size=15, weight=800, fill=base.INK, max_chars=24, max_lines=4)}'
            f'</g>'
        )

    return base.base_svg(''.join(chunks), slide.get('title'))


def visual_timeline_v4(slide):
    """Timeline with larger labels and a single strong sequence line."""
    items = base.points(slide, 4)
    card_w, gap, x0 = _card_geometry(len(items), max_width=238, gap=20)
    line_y, card_y, card_h = 150, 214, 220
    chunks = [
        base.svg_text(
            base.WIDTH / 2,
            58,
            slide.get('visualTitle') or 'Learning journey',
            size=20,
            weight=900,
            fill=base.INK,
            max_chars=42,
            max_lines=2,
        ),
        f'<path class="qm-path" d="M{base.SAFE_LEFT + 40} {line_y}H{base.SAFE_RIGHT - 40}" '
        f'stroke="#DCE3EB" stroke-width="8" stroke-linecap="round"/>',
        f'<path class="qm-path" d="M{base.SAFE_LEFT + 40} {line_y}H{base.SAFE_RIGHT - 40}" '
        f'stroke="url(#accentGrad)" stroke-width="3" stroke-linecap="round" opacity=".8"/>'
    ]

    for i, item in enumerate(items):
        x = x0 + i * (card_w + gap)
        cx = x + card_w / 2
        chunks.append(
            f'<g class="qm-node" style="--delay:{i * 95}ms">'
            f'<line x1="{cx:.1f}" y1="{line_y}" x2="{cx:.1f}" y2="{card_y}" '
            f'stroke="#CBD5E1" stroke-width="2.5"/>'
            f'<circle cx="{cx:.1f}" cy="{line_y}" r="26" fill="#fff" '
            f'stroke="var(--qm-primary,#f97316)" stroke-width="7" filter="url(#shadow)"/>'
            f'<circle cx="{cx:.1f}" cy="{line_y}" r="11" fill="var(--qm-soft,#fff1e6)"/>'
            f'<rect x="{x:.1f}" y="{card_y}" width="{card_w:.1f}" height="{card_h}" '
            f'rx="26" fill="url(#softGrad)" stroke="#DDE2E8" filter="url(#shadow)"/>'
            f'<text x="{x + 22:.1f}" y="{card_y + 35}" '
            f'font-family="Inter,Segoe UI,Arial,sans-serif" font-size="11" font-weight="900" '
            f'fill="var(--qm-primary,#f97316)" letter-spacing="1.1">STAGE {i + 1}</text>'
            f'{base.svg_text(cx, card_y + 125, item, size=15, weight=800, fill=base.INK, max_chars=24, max_lines=4)}'
            f'</g>'
        )

    return base.base_svg(''.join(chunks), slide.get('title'))


def visual_hub_v4(slide):
    """Balanced hub diagram using larger readable capsules around one concept."""
    items = base.points(slide, 6)
    cx, cy = 480, 260
    slots = [
        (65, 76),
        (675, 76),
        (65, 362),
        (675, 362),
        (370, 48),
        (370, 390),
    ]
    capsule_w, capsule_h = 220, 82
    chunks = [f'<circle class="qm-pulse" cx="{cx}" cy="{cy}" r="125" fill="url(#halo)"/>']

    for i, item in enumerate(items):
        x, y = slots[i]
        node_cx, node_cy = x + capsule_w / 2, y + capsule_h / 2
        chunks.append(
            f'<path class="qm-path" style="--delay:{i * 55}ms" d="M{cx} {cy}L{node_cx:.1f} {node_cy:.1f}" '
            f'stroke="var(--qm-accent,#fdba74)" stroke-width="3" stroke-linecap="round" opacity=".72"/>'
        )
        chunks.append(
            f'<g class="qm-node" style="--delay:{100 + i * 85}ms" filter="url(#shadow)">'
            f'<rect x="{x}" y="{y}" width="{capsule_w}" height="{capsule_h}" rx="25" '
            f'fill="#fff" stroke="#DDE2E8"/>'
            f'<circle cx="{x + 31}" cy="{node_cy:.1f}" r="17" fill="var(--qm-soft,#fff1e6)"/>'
            f'<text x="{x + 31}" y="{node_cy + 5:.1f}" text-anchor="middle" '
            f'font-family="Inter,Segoe UI,Arial,sans-serif" font-size="11" font-weight="900" '
            f'fill="var(--qm-primary,#f97316)">{i + 1:02d}</text>'
            f'{base.svg_text(x + 57, node_cy, item, size=13, weight=800, fill=base.INK, anchor="start", max_chars=22, max_lines=3)}'
            f'</g>'
        )

    center = str(slide.get('visualTitle') or slide.get('title') or 'Key concept')
    chunks.append(
        f'<g class="qm-center" filter="url(#softShadow)">'
        f'<circle cx="{cx}" cy="{cy}" r="92" fill="url(#accentGrad)"/>'
        f'<circle cx="{cx}" cy="{cy}" r="75" fill="none" stroke="#fff" stroke-opacity=".28" stroke-width="1.5"/>'
        f'{base.svg_text(cx, cy - 5, center, size=19, weight=900, fill="#fff", max_chars=18, max_lines=3)}'
        f'<text x="{cx}" y="{cy + 52}" text-anchor="middle" '
        f'font-family="Inter,Segoe UI,Arial,sans-serif" font-size="11" font-weight="900" '
        f'fill="#fff" opacity=".76" letter-spacing="1.3">KEY CONCEPT</text>'
        f'</g>'
    )

    return base.base_svg(''.join(chunks), slide.get('title'))


def visual_cycle_v4(slide):
    """Cycle with larger phase cards and stable, easy-to-follow arrows."""
    items = base.points(slide, 5)
    n = max(1, len(items))
    cx, cy = 480, 260
    rx, ry = 300, 170
    card_w, card_h = 180, 86
    coords = []
    for i in range(n):
        angle = -math.pi / 2 + 2 * math.pi * i / n
        coords.append((cx + math.cos(angle) * rx, cy + math.sin(angle) * ry))

    chunks = [f'<circle class="qm-pulse" cx="{cx}" cy="{cy}" r="118" fill="url(#halo)"/>']
    for i, (x, y) in enumerate(coords):
        nx, ny = coords[(i + 1) % n]
        chunks.append(
            f'<path class="qm-path" style="--delay:{i * 55}ms" '
            f'd="M{x:.1f} {y:.1f} Q{cx:.1f} {cy:.1f} {nx:.1f} {ny:.1f}" '
            f'fill="none" stroke="var(--qm-accent,#fdba74)" stroke-width="3.5" '
            f'marker-end="url(#arrow)" opacity=".76"/>'
        )

    for i, ((x, y), item) in enumerate(zip(coords, items)):
        left, top = x - card_w / 2, y - card_h / 2
        chunks.append(
            f'<g class="qm-node" style="--delay:{i * 90}ms" filter="url(#shadow)">'
            f'<rect x="{left:.1f}" y="{top:.1f}" width="{card_w}" height="{card_h}" rx="24" '
            f'fill="#fff" stroke="#DDE2E8"/>'
            f'<text x="{left + 18:.1f}" y="{top + 25:.1f}" '
            f'font-family="Inter,Segoe UI,Arial,sans-serif" font-size="11" font-weight="900" '
            f'fill="var(--qm-primary,#f97316)">PHASE {i + 1}</text>'
            f'{base.svg_text(left + 18, top + 58, item, size=13, weight=800, fill=base.INK, anchor="start", max_chars=20, max_lines=2)}'
            f'</g>'
        )

    title = slide.get('visualTitle') or slide.get('title') or 'Continuous cycle'
    chunks.append(
        f'<g class="qm-center" filter="url(#softShadow)">'
        f'<circle cx="{cx}" cy="{cy}" r="82" fill="url(#accentGrad)"/>'
        f'{base.svg_text(cx, cy, title, size=18, weight=900, fill="#fff", max_chars=18, max_lines=3)}'
        f'</g>'
    )
    return base.base_svg(''.join(chunks), slide.get('title'))


def install_v4_generators():
    base.GENERATORS.update({
        'process': visual_process_v4,
        'timeline': visual_timeline_v4,
        'hub': visual_hub_v4,
        'cycle': visual_cycle_v4,
    })


def main():
    global _theme
    if len(sys.argv) >= 2:
        try:
            with open(sys.argv[1], 'r', encoding='utf-8') as handle:
                payload = json.load(handle)
            visual_theme = payload.get('visualTheme') if isinstance(payload, dict) else None
            if isinstance(visual_theme, dict):
                for key in ('primary', 'accent', 'soft'):
                    value = visual_theme.get(key)
                    if isinstance(value, str) and value.startswith('#') and len(value) in (4, 7, 9):
                        _theme[key] = value
        except Exception:
            pass

    base.svg_text = readable_svg_text
    base.base_svg = enhanced_base_svg
    install_v4_generators()
    return base.main()


if __name__ == '__main__':
    try:
        sys.exit(main())
    except Exception as exc:
        print(json.dumps({'ok': False, 'error': str(exc)}), file=sys.stderr)
        sys.exit(1)
