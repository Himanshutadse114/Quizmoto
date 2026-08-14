#!/usr/bin/env python3
"""Semantic-priority entry point for Quizmoto Course Experience V5 visuals.

The core V5 renderer remains deterministic. This entry point makes explicit
Visual Studio/AI metaphor choices authoritative before falling back to text
inference, avoiding broad terms such as "phishing" overriding a more specific
choice such as "qr".
"""

import re

import generate_scorm_visuals_v5 as engine


EXPLICIT_ICON_MAP = {
    'email': 'mail',
    'mail': 'mail',
    'lock': 'lock',
    'authentication': 'lock',
    'phone': 'phone',
    'mobile': 'phone',
    'file': 'file',
    'cloud': 'cloud',
    'identity': 'user',
    'user': 'user',
    'warning': 'warning',
    'qr': 'qr',
    'ai-wave': 'wave',
    'wave': 'wave',
    'browser': 'browser',
    'shield': 'shield',
}


def resolved_icon_kind(slide):
    explicit = engine.clean(slide.get('visualMetaphor')).lower()
    if explicit in EXPLICIT_ICON_MAP:
        return EXPLICIT_ICON_MAP[explicit]

    source = (
        engine.clean(slide.get('title')).lower()
        + ' '
        + engine.clean(slide.get('content')).lower()
    )

    # Specific visual signals take precedence over broad attack vocabulary.
    if re.search(r'qr|quick response', source): return 'qr'
    if re.search(r'voice|deepfake|audio|synthetic|artificial intelligence|\bai\b', source): return 'wave'
    if re.search(r'password|credential|login|authentication|mfa|passkey', source): return 'lock'
    if re.search(r'phone|sms|whatsapp|call|mobile', source): return 'phone'
    if re.search(r'file|ransom|document|attachment', source): return 'file'
    if re.search(r'cloud|share|drive|storage', source): return 'cloud'
    if re.search(r'user|employee|person|identity|account', source): return 'user'
    if re.search(r'browser|website|url|link', source): return 'browser'
    if re.search(r'email|phish|inbox|message', source): return 'mail'
    if re.search(r'warning|risk|alert|incident|threat|malware', source): return 'warning'
    return 'shield'


# Keep a lightweight semantic marker in generated SVGs. Besides making the
# output easier to inspect, it gives CI a stable way to prove that an explicit
# author choice such as QR is the artwork that was actually rendered.
_core_icon = engine.icon


def semantic_icon(kind, x, y, size, theme, opacity=1):
    return f'<g data-qm-icon-kind="{kind}">{_core_icon(kind, x, y, size, theme, opacity)}</g>'


# All core render functions resolve these module-level symbols at call time, so
# replacing them here keeps the proven V5 layout engine intact while making
# explicit author intent authoritative.
engine.icon_kind = resolved_icon_kind
engine.icon = semantic_icon


if __name__ == '__main__':
    raise SystemExit(engine.main())
