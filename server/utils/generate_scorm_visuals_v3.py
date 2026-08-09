#!/usr/bin/env python3
"""Quizmoto SCORM animated SVG generator with embedded course theme."""

import json
import sys

import generate_scorm_visuals_v2 as animated

base = animated.base
_current_base_svg = base.base_svg
_theme = {
    'primary': '#F97316',
    'accent': '#FDBA74',
    'soft': '#FFF7ED',
}

# Keep the improved vector geometry, but remap the previous purple palette so
# every generated SVG matches the restored policy-to-scorm Modern Corporate UI.
_PALETTE_REMAP = {
    '#5147e8': '#F97316',
    '#5147E8': '#F97316',
    '#8F87FF': '#FB923C',
    '#f0efff': '#FFF7ED',
    '#F0EFFF': '#FFF7ED',
    '#F8F7FF': '#FFFBF7',
    '#C9C6FF': '#FED7AA',
    '#EDEBFF': '#FFEDD5',
    '#312e81': '#0F172A',
}


def themed_base_svg(inner, title='Learning visual'):
    svg = _current_base_svg(inner, title)
    for old, new in _PALETTE_REMAP.items():
        svg = svg.replace(old, new)
    style = (
        f'--qm-primary:{_theme["primary"]};'
        f'--qm-accent:{_theme["accent"]};'
        f'--qm-soft:{_theme["soft"]};'
    )
    return svg.replace('<svg ', f'<svg style="{style}" ', 1)


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
    base.base_svg = themed_base_svg
    return base.main()


if __name__ == '__main__':
    try:
        sys.exit(main())
    except Exception as exc:
        print(json.dumps({'ok': False, 'error': str(exc)}), file=sys.stderr)
        sys.exit(1)