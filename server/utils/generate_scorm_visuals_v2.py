#!/usr/bin/env python3
"""Animated wrapper for Quizmoto's standard-library SVG visual generator."""

import sys
import generate_scorm_visuals as base


_original_base_svg = base.base_svg


def animated_base_svg(inner, title='Learning visual'):
    svg = _original_base_svg(inner, title)
    style = '''
<style>
.qm-node{opacity:0;transform:translateY(10px) scale(.985);transform-origin:center;animation:qmNodeIn .62s cubic-bezier(.16,1,.3,1) forwards;animation-delay:var(--delay,0ms)}
.qm-path{stroke-dasharray:1200;stroke-dashoffset:1200;animation:qmDraw .9s cubic-bezier(.4,0,.2,1) forwards;animation-delay:var(--delay,80ms)}
.qm-center{opacity:0;transform-origin:center;animation:qmCenterIn .72s cubic-bezier(.16,1,.3,1) forwards}
.qm-pulse{transform-origin:center;animation:qmPulse 4.2s ease-in-out infinite}
.qm-float{transform-origin:center;animation:qmFloat 4.8s ease-in-out infinite}
.qm-glow{transform-origin:center;animation:qmGlow 3.8s ease-in-out infinite}
@keyframes qmNodeIn{0%{opacity:0;transform:translateY(10px) scale(.985)}100%{opacity:1;transform:translateY(0) scale(1)}}
@keyframes qmDraw{to{stroke-dashoffset:0}}
@keyframes qmCenterIn{0%{opacity:0;transform:scale(.88)}65%{opacity:1;transform:scale(1.025)}100%{opacity:1;transform:scale(1)}}
@keyframes qmPulse{0%,100%{opacity:.72;transform:scale(.985)}50%{opacity:1;transform:scale(1.025)}}
@keyframes qmFloat{0%,100%{transform:translateY(0)}50%{transform:translateY(-5px)}}
@keyframes qmGlow{0%,100%{opacity:.34;transform:scale(.97)}50%{opacity:.62;transform:scale(1.035)}}
@media(prefers-reduced-motion:reduce){.qm-node,.qm-path,.qm-center,.qm-pulse,.qm-float,.qm-glow{animation:none!important;opacity:1!important;transform:none!important;stroke-dashoffset:0!important}}
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
