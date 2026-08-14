#!/usr/bin/env python3
"""Quizmoto SCORM vector generator v4.

Keeps the deterministic v2/v3 SVG pipeline, but improves learner readability,
accessibility and motion. Course-theme colours are still injected at generation
time so packages remain portable and do not depend on external assets.
"""

import html
import json
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
    """Raise the practical minimum type size without changing layout semantics."""
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
    """Increase only hard-coded SVG micro labels (8–10px) to 11.5px."""
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

    # Infinite ambient animation looked decorative rather than instructional.
    # Keep entrance/draw motion, then settle the graphic into a stable state.
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
    return base.main()


if __name__ == '__main__':
    try:
        sys.exit(main())
    except Exception as exc:
        print(json.dumps({'ok': False, 'error': str(exc)}), file=sys.stderr)
        sys.exit(1)
