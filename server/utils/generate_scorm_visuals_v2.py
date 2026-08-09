#!/usr/bin/env python3
"""Animated wrapper for Quizmoto's standard-library SVG visual generator."""

import sys
import generate_scorm_visuals as base


_original_base_svg = base.base_svg


def animated_base_svg(inner, title='Learning visual'):
    svg = _original_base_svg(inner, title)
    style = '''
<style>
.qm-node{opacity:0;transform:translateY(8px);animation:qmNodeIn .42s cubic-bezier(.2,.8,.2,1) forwards;animation-delay:var(--delay,0ms)}
.qm-path{stroke-dasharray:1000;stroke-dashoffset:1000;animation:qmDraw .82s ease forwards}
.qm-center{transform-origin:center;animation:qmCenterIn .48s cubic-bezier(.2,.8,.2,1) both}
.qm-pulse{transform-origin:center;animation:qmPulseIn .5s ease both}
@keyframes qmNodeIn{to{opacity:1;transform:translateY(0)}}
@keyframes qmDraw{to{stroke-dashoffset:0}}
@keyframes qmCenterIn{from{opacity:.4;transform:scale(.94)}to{opacity:1;transform:scale(1)}}
@keyframes qmPulseIn{from{opacity:.55;transform:scale(.96)}to{opacity:1;transform:scale(1)}}
@media(prefers-reduced-motion:reduce){.qm-node,.qm-path,.qm-center,.qm-pulse{animation:none!important;opacity:1!important;transform:none!important;stroke-dashoffset:0!important}}
</style>'''
    return svg.replace('</defs>', '</defs>' + style, 1)


base.base_svg = animated_base_svg

if __name__ == '__main__':
    try:
        sys.exit(base.main())
    except Exception as exc:
        import json
        print(json.dumps({'ok': False, 'error': str(exc)}), file=sys.stderr)
        sys.exit(1)