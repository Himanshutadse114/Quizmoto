#!/usr/bin/env python3
"""Quizmoto Course Experience V5 responsive vector generator.

Generates a purpose-built desktop and portrait-mobile SVG for each learning
screen. Visuals use the selected course theme, integrated backgrounds, simple
portable iconography and layout-specific compositions. No external assets are
required, so generated SCORM packages remain self-contained.
"""

import argparse
import html
import json
import math
import re
from pathlib import Path

DESKTOP = (960, 560)
MOBILE = (390, 620)

DEFAULT_THEME = {
    'primary': '#3B82F6', 'primaryDark': '#1D4ED8', 'accent': '#22D3EE',
    'accent2': '#60A5FA', 'bg': '#030712', 'bg2': '#071426',
    'surface': '#0A1322', 'surface2': '#0E1B2E', 'text': '#F8FAFC',
    'body': '#C7D2E1', 'muted': '#8798AE', 'line': '#243751',
    'visualBg': '#07172B', 'visualBg2': '#0B2340', 'visualCard': '#102A49',
    'visualCard2': '#0D2038', 'visualText': '#F4F9FF',
    'visualMuted': '#A9C2DE', 'soft': '#173A63', 'glow': '#2563EB',
    'motif': 'grid'
}


def esc(value):
    return html.escape(str(value or ''), quote=True)


def clean(value):
    return re.sub(r'\s+', ' ', str(value or '')).strip()


def words(value):
    return clean(value).split(' ') if clean(value) else []


def lines(value, max_chars=28, max_lines=3):
    result, current = [], ''
    all_words = words(value)
    for word in all_words:
        candidate = word if not current else current + ' ' + word
        if len(candidate) <= max_chars:
            current = candidate
        else:
            if current:
                result.append(current)
            current = word
            if len(result) >= max_lines - 1:
                break
    if current and len(result) < max_lines:
        result.append(current)
    if not result:
        result = ['Key learning point']
    if len(result) == max_lines and len(' '.join(all_words)) > len(' '.join(result)):
        result[-1] = result[-1].rstrip(' .') + '…'
    return result


def text(x, y, value, size=18, weight=700, fill='#F8FAFC', anchor='middle',
         max_chars=28, max_lines=3, line_height=None, opacity=1):
    ls = lines(value, max_chars, max_lines)
    lh = line_height or int(size * 1.28)
    start = y - ((len(ls) - 1) * lh / 2)
    tspans = ''.join(
        f'<tspan x="{x}" y="{start + i * lh:.1f}">{esc(line)}</tspan>'
        for i, line in enumerate(ls)
    )
    return (
        f'<text x="{x}" y="{y}" text-anchor="{anchor}" '
        f'font-family="Inter,Segoe UI,Arial,sans-serif" font-size="{size}" '
        f'font-weight="{weight}" fill="{fill}" opacity="{opacity}">{tspans}</text>'
    )


def theme_from(payload):
    theme = dict(DEFAULT_THEME)
    supplied = payload.get('visualTheme') if isinstance(payload, dict) else None
    if isinstance(supplied, dict):
        for key in DEFAULT_THEME:
            value = supplied.get(key)
            if isinstance(value, str) and value:
                theme[key] = value
    return theme


def motif_svg(theme, width, height):
    motif = theme.get('motif', 'grid')
    accent = theme['accent']
    primary = theme['primary']
    if motif in ('rings', 'orbits'):
        return ''.join(
            f'<circle cx="{width * .82:.1f}" cy="{height * .15:.1f}" r="{r}" fill="none" stroke="{accent}" stroke-width="1" opacity="{.10 - i*.012:.3f}"/>'
            for i, r in enumerate((70, 115, 165, 220))
        )
    if motif in ('waves', 'aurora'):
        return (
            f'<path d="M{-40} {height*.78:.1f} C{width*.18:.1f} {height*.58:.1f} {width*.36:.1f} {height*.96:.1f} {width*.58:.1f} {height*.75:.1f} S{width*.88:.1f} {height*.55:.1f} {width+50} {height*.72:.1f}" fill="none" stroke="{accent}" stroke-width="22" opacity=".07"/>'
            f'<path d="M{-30} {height*.84:.1f} C{width*.24:.1f} {height*.67:.1f} {width*.46:.1f} {height*.98:.1f} {width+30} {height*.66:.1f}" fill="none" stroke="{primary}" stroke-width="2" opacity=".15"/>'
        )
    if motif in ('signals', 'scan'):
        return ''.join(
            f'<line x1="0" y1="{int(height*.18)+i*54}" x2="{width}" y2="{int(height*.18)+i*54}" stroke="{accent}" stroke-width="1" opacity=".055"/>'
            for i in range(8)
        )
    if motif == 'mesh':
        return (
            f'<path d="M0 {height*.2:.1f} Q{width*.3:.1f} {height*.05:.1f} {width*.5:.1f} {height*.28:.1f} T{width} {height*.16:.1f}" fill="none" stroke="{accent}" stroke-width="1.5" opacity=".12"/>'
            f'<path d="M0 {height*.85:.1f} Q{width*.28:.1f} {height*.62:.1f} {width*.54:.1f} {height*.82:.1f} T{width} {height*.7:.1f}" fill="none" stroke="{primary}" stroke-width="1.5" opacity=".10"/>'
        )
    # grid
    return (
        f'<pattern id="qmGrid" width="34" height="34" patternUnits="userSpaceOnUse"><path d="M34 0H0V34" fill="none" stroke="{accent}" stroke-width="1" opacity=".055"/></pattern>'
        f'<rect width="100%" height="100%" fill="url(#qmGrid)"/>'
    )


def shell(inner, title, theme, size, motif=True):
    width, height = size
    defs = f'''
<defs>
  <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="{theme['visualBg']}"/><stop offset="1" stop-color="{theme['visualBg2']}"/></linearGradient>
  <linearGradient id="accentGrad" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="{theme['primary']}"/><stop offset="1" stop-color="{theme['accent']}"/></linearGradient>
  <linearGradient id="cardGrad" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="{theme['visualCard']}"/><stop offset="1" stop-color="{theme['visualCard2']}"/></linearGradient>
  <radialGradient id="halo"><stop offset="0" stop-color="{theme['glow']}" stop-opacity=".28"/><stop offset="1" stop-color="{theme['glow']}" stop-opacity="0"/></radialGradient>
  <filter id="shadow" x="-25%" y="-25%" width="150%" height="150%"><feDropShadow dx="0" dy="10" stdDeviation="14" flood-color="#000" flood-opacity=".28"/></filter>
  <filter id="softShadow" x="-30%" y="-30%" width="160%" height="160%"><feDropShadow dx="0" dy="14" stdDeviation="20" flood-color="#000" flood-opacity=".22"/></filter>
  <marker id="arrow" markerWidth="10" markerHeight="10" refX="8" refY="5" orient="auto"><path d="M0 0L10 5L0 10Z" fill="{theme['accent']}"/></marker>
</defs>'''
    safe_title = esc(title or 'Learning visual')
    motion = '''
<style>
.qm-node{opacity:0;transform:translateY(10px);transform-origin:center;animation:nodeIn .52s cubic-bezier(.16,1,.3,1) forwards;animation-delay:var(--delay,0ms)}
.qm-path{stroke-dasharray:1200;stroke-dashoffset:1200;animation:draw .78s cubic-bezier(.4,0,.2,1) forwards;animation-delay:var(--delay,50ms)}
.qm-focus{opacity:0;transform-origin:center;animation:focusIn .66s cubic-bezier(.16,1,.3,1) .06s forwards}
@keyframes nodeIn{to{opacity:1;transform:none}}@keyframes draw{to{stroke-dashoffset:0}}@keyframes focusIn{from{opacity:0;transform:scale(.9)}to{opacity:1;transform:none}}
@media(prefers-reduced-motion:reduce){.qm-node,.qm-path,.qm-focus{animation:none!important;opacity:1!important;transform:none!important;stroke-dashoffset:0!important}}
</style>'''
    decor = motif_svg(theme, width, height) if motif else ''
    return f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {width} {height}" preserveAspectRatio="xMidYMid meet" role="img" aria-label="{safe_title}">{defs}<title>{safe_title}</title><desc>Responsive illustrated learning visual. The course text provides the complete explanation.</desc><rect width="{width}" height="{height}" rx="28" fill="url(#bg)"/>{decor}<ellipse cx="{width*.82:.1f}" cy="{height*.13:.1f}" rx="{width*.28:.1f}" ry="{height*.28:.1f}" fill="url(#halo)" opacity=".65"/>{inner}{motion}</svg>'''


def icon_kind(slide):
    explicit = clean(slide.get('visualMetaphor')).lower()
    source = explicit + ' ' + clean(slide.get('title')).lower() + ' ' + clean(slide.get('content')).lower()
    if re.search(r'email|phish|inbox|message', source): return 'mail'
    if re.search(r'password|credential|login|authentication|mfa|passkey', source): return 'lock'
    if re.search(r'phone|sms|whatsapp|call|mobile', source): return 'phone'
    if re.search(r'file|ransom|document|attachment', source): return 'file'
    if re.search(r'cloud|share|drive|storage', source): return 'cloud'
    if re.search(r'user|employee|person|identity|account', source): return 'user'
    if re.search(r'warning|risk|alert|incident|threat|malware', source): return 'warning'
    if re.search(r'qr|code', source): return 'qr'
    if re.search(r'voice|deepfake|audio|ai|synthetic', source): return 'wave'
    if re.search(r'browser|website|url|link', source): return 'browser'
    return 'shield'


def icon(kind, x, y, size, theme, opacity=1):
    s = size
    stroke = theme['accent']
    fill = theme['soft']
    ink = theme['visualText']
    sw = max(2, s * .045)
    common = f'stroke="{stroke}" stroke-width="{sw:.1f}" stroke-linecap="round" stroke-linejoin="round" fill="none"'
    if kind == 'mail':
        return f'<g opacity="{opacity}"><rect x="{x-s*.45:.1f}" y="{y-s*.3:.1f}" width="{s*.9:.1f}" height="{s*.6:.1f}" rx="{s*.1:.1f}" fill="{fill}" stroke="{stroke}" stroke-width="{sw:.1f}"/><path d="M{x-s*.4:.1f} {y-s*.22:.1f}L{x:.1f} {y+s*.08:.1f}L{x+s*.4:.1f} {y-s*.22:.1f}" {common}/></g>'
    if kind == 'lock':
        return f'<g opacity="{opacity}"><rect x="{x-s*.32:.1f}" y="{y-s*.02:.1f}" width="{s*.64:.1f}" height="{s*.48:.1f}" rx="{s*.1:.1f}" fill="{fill}" stroke="{stroke}" stroke-width="{sw:.1f}"/><path d="M{x-s*.2:.1f} {y-s*.03:.1f}V{y-s*.18:.1f}A{s*.2:.1f} {s*.2:.1f} 0 0 1 {x+s*.2:.1f} {y-s*.18:.1f}V{y-s*.03:.1f}" {common}/><circle cx="{x}" cy="{y+s*.19:.1f}" r="{s*.045:.1f}" fill="{ink}"/></g>'
    if kind == 'phone':
        return f'<g opacity="{opacity}"><rect x="{x-s*.25:.1f}" y="{y-s*.43:.1f}" width="{s*.5:.1f}" height="{s*.86:.1f}" rx="{s*.1:.1f}" fill="{fill}" stroke="{stroke}" stroke-width="{sw:.1f}"/><line x1="{x-s*.1:.1f}" y1="{y+s*.32:.1f}" x2="{x+s*.1:.1f}" y2="{y+s*.32:.1f}" {common}/></g>'
    if kind == 'file':
        return f'<g opacity="{opacity}"><path d="M{x-s*.28:.1f} {y-s*.4:.1f}H{x+s*.12:.1f}L{x+s*.3:.1f} {y-s*.22:.1f}V{y+s*.4:.1f}H{x-s*.28:.1f}Z" fill="{fill}" stroke="{stroke}" stroke-width="{sw:.1f}"/><path d="M{x+s*.1:.1f} {y-s*.38:.1f}V{y-s*.2:.1f}H{x+s*.28:.1f}" {common}/><line x1="{x-s*.15:.1f}" y1="{y:.1f}" x2="{x+s*.16:.1f}" y2="{y:.1f}" {common}/><line x1="{x-s*.15:.1f}" y1="{y+s*.14:.1f}" x2="{x+s*.1:.1f}" y2="{y+s*.14:.1f}" {common}/></g>'
    if kind == 'cloud':
        return f'<g opacity="{opacity}"><path d="M{x-s*.36:.1f} {y+s*.16:.1f}A{s*.2:.1f} {s*.2:.1f} 0 0 1 {x-s*.19:.1f} {y-s*.06:.1f}A{s*.28:.1f} {s*.28:.1f} 0 0 1 {x+s*.32:.1f} {y-s*.1:.1f}A{s*.19:.1f} {s*.19:.1f} 0 0 1 {x+s*.35:.1f} {y+s*.25:.1f}H{x-s*.28:.1f}" fill="{fill}" stroke="{stroke}" stroke-width="{sw:.1f}"/></g>'
    if kind == 'user':
        return f'<g opacity="{opacity}"><circle cx="{x}" cy="{y-s*.18:.1f}" r="{s*.18:.1f}" fill="{fill}" stroke="{stroke}" stroke-width="{sw:.1f}"/><path d="M{x-s*.32:.1f} {y+s*.35:.1f}C{x-s*.26:.1f} {y+s*.04:.1f} {x+s*.26:.1f} {y+s*.04:.1f} {x+s*.32:.1f} {y+s*.35:.1f}" fill="{fill}" stroke="{stroke}" stroke-width="{sw:.1f}"/></g>'
    if kind == 'warning':
        return f'<g opacity="{opacity}"><path d="M{x:.1f} {y-s*.42:.1f}L{x+s*.43:.1f} {y+s*.34:.1f}H{x-s*.43:.1f}Z" fill="{fill}" stroke="{stroke}" stroke-width="{sw:.1f}"/><line x1="{x}" y1="{y-s*.16:.1f}" x2="{x}" y2="{y+s*.1:.1f}" {common}/><circle cx="{x}" cy="{y+s*.22:.1f}" r="{s*.035:.1f}" fill="{ink}"/></g>'
    if kind == 'qr':
        cells = [(0,0),(1,0),(3,0),(4,0),(0,1),(4,1),(2,2),(0,3),(1,3),(3,3),(4,3),(0,4),(2,4),(4,4)]
        cell = s*.13; ox=x-s*.325; oy=y-s*.325
        return '<g opacity="%s">%s</g>' % (opacity, ''.join(f'<rect x="{ox+cx*cell:.1f}" y="{oy+cy*cell:.1f}" width="{cell*.78:.1f}" height="{cell*.78:.1f}" rx="2" fill="{stroke}"/>' for cx,cy in cells))
    if kind == 'wave':
        bars = [(.34,.42),(.22,.64),(.1,.84),(0,.56),(-.1,.9),(-.22,.62),(-.34,.4)]
        return '<g opacity="%s">%s</g>' % (opacity, ''.join(f'<line x1="{x+dx*s:.1f}" y1="{y-h*s/2:.1f}" x2="{x+dx*s:.1f}" y2="{y+h*s/2:.1f}" stroke="{stroke}" stroke-width="{sw*1.4:.1f}" stroke-linecap="round"/>' for dx,h in bars))
    if kind == 'browser':
        return f'<g opacity="{opacity}"><rect x="{x-s*.45:.1f}" y="{y-s*.32:.1f}" width="{s*.9:.1f}" height="{s*.64:.1f}" rx="{s*.08:.1f}" fill="{fill}" stroke="{stroke}" stroke-width="{sw:.1f}"/><line x1="{x-s*.43:.1f}" y1="{y-s*.17:.1f}" x2="{x+s*.43:.1f}" y2="{y-s*.17:.1f}" {common}/><circle cx="{x-s*.32:.1f}" cy="{y-s*.245:.1f}" r="{s*.025:.1f}" fill="{stroke}"/><rect x="{x-s*.28:.1f}" y="{y-s*.06:.1f}" width="{s*.55:.1f}" height="{s*.1:.1f}" rx="4" fill="{theme['visualCard2']}"/></g>'
    # shield
    return f'<g opacity="{opacity}"><path d="M{x:.1f} {y-s*.43:.1f}L{x+s*.34:.1f} {y-s*.28:.1f}V{y-s*.02:.1f}C{x+s*.34:.1f} {y+s*.24:.1f} {x+s*.15:.1f} {y+s*.39:.1f} {x:.1f} {y+s*.47:.1f}C{x-s*.15:.1f} {y+s*.39:.1f} {x-s*.34:.1f} {y+s*.24:.1f} {x-s*.34:.1f} {y-s*.02:.1f}V{y-s*.28:.1f}Z" fill="{fill}" stroke="{stroke}" stroke-width="{sw:.1f}"/><path d="M{x-s*.14:.1f} {y:.1f}L{x-s*.02:.1f} {y+s*.12:.1f}L{x+s*.18:.1f} {y-s*.13:.1f}" {common}/></g>'


def point_list(slide, limit=6):
    raw = slide.get('keyPoints') if isinstance(slide, dict) else []
    result = [clean(x) for x in (raw or []) if clean(x)]
    if not result:
        result = [clean(slide.get('content')) or 'Key learning point']
    return result[:limit]


def top_title(slide, theme, width, mobile=False):
    visual = clean(slide.get('visualTitle') or slide.get('title') or 'Key idea')
    x = 28 if mobile else 52
    return (
        f'<text x="{x}" y="{48 if mobile else 58}" font-family="Inter,Segoe UI,Arial,sans-serif" '
        f'font-size="{13 if mobile else 14}" font-weight="800" fill="{theme["accent"]}" letter-spacing="1.5">LEARNING VISUAL</text>'
        + text(x, 80 if mobile else 92, visual, 22 if mobile else 26, 850, theme['visualText'], 'start', 24 if mobile else 38, 2)
    )


def card(x, y, w, h, theme, radius=22, opacity=1):
    return f'<rect x="{x:.1f}" y="{y:.1f}" width="{w:.1f}" height="{h:.1f}" rx="{radius}" fill="url(#cardGrad)" stroke="{theme["line"]}" stroke-width="1.2" opacity="{opacity}" filter="url(#shadow)"/>'


def desktop_process(slide, theme):
    items = point_list(slide, 4); n=max(1,len(items)); w,h=DESKTOP
    margin=52; gap=16; card_w=(w-2*margin-gap*(n-1))/n; y=165; ch=285; kind=icon_kind(slide)
    chunks=[top_title(slide,theme,w)]
    for i,item in enumerate(items):
        x=margin+i*(card_w+gap); cx=x+card_w/2
        if i<n-1:
            nx=margin+(i+1)*(card_w+gap)
            chunks.append(f'<path class="qm-path" style="--delay:{i*70}ms" d="M{x+card_w+4:.1f} {y+ch/2:.1f}H{nx-8:.1f}" stroke="{theme["accent"]}" stroke-width="3" marker-end="url(#arrow)" opacity=".72"/>')
        chunks.append(f'<g class="qm-node" style="--delay:{100+i*85}ms">{card(x,y,card_w,ch,theme)}<circle cx="{cx:.1f}" cy="{y+72:.1f}" r="48" fill="{theme["soft"]}" opacity=".72"/>{icon(kind,cx,y+72,66,theme)}<text x="{x+20:.1f}" y="{y+28:.1f}" font-family="Inter,Segoe UI,Arial,sans-serif" font-size="11" font-weight="800" fill="{theme["accent"]}" letter-spacing="1.1">STEP {i+1}</text>{text(cx,y+190,item,16,760,theme['visualText'],'middle',22,4)}<circle cx="{cx:.1f}" cy="{y+248:.1f}" r="16" fill="{theme["primary"]}"/><text x="{cx:.1f}" y="{y+253:.1f}" text-anchor="middle" font-family="Inter,Segoe UI,Arial,sans-serif" font-size="11" font-weight="850" fill="#fff">{i+1}</text></g>')
    return ''.join(chunks)


def mobile_process(slide, theme):
    items=point_list(slide,4); w,h=MOBILE; x=24; cw=342; y=126; ch=98; gap=18; kind=icon_kind(slide)
    chunks=[top_title(slide,theme,w,True)]
    for i,item in enumerate(items):
        yy=y+i*(ch+gap)
        if i<len(items)-1:
            chunks.append(f'<path class="qm-path" style="--delay:{i*60}ms" d="M52 {yy+ch:.1f}V{yy+ch+gap-5:.1f}" stroke="{theme["accent"]}" stroke-width="3" marker-end="url(#arrow)" opacity=".65"/>')
        chunks.append(f'<g class="qm-node" style="--delay:{80+i*80}ms">{card(x,yy,cw,ch,theme,20)}<circle cx="70" cy="{yy+49:.1f}" r="30" fill="{theme["soft"]}" opacity=".75"/>{icon(kind,70,yy+49,42,theme)}<text x="108" y="{yy+31:.1f}" font-family="Inter,Segoe UI,Arial,sans-serif" font-size="11" font-weight="800" fill="{theme["accent"]}" letter-spacing="1">STEP {i+1}</text>{text(108,yy+62,item,15,760,theme['visualText'],'start',25,2)}</g>')
    return ''.join(chunks)


def desktop_timeline(slide,theme):
    items=point_list(slide,5)[:5]; w,h=DESKTOP; y=268; left=88; right=872; kind=icon_kind(slide)
    chunks=[top_title(slide,theme,w),f'<path class="qm-path" d="M{left} {y}H{right}" stroke="{theme["line"]}" stroke-width="8" stroke-linecap="round"/><path class="qm-path" d="M{left} {y}H{right}" stroke="{theme["accent"]}" stroke-width="2" opacity=".7"/>']
    n=max(1,len(items))
    for i,item in enumerate(items):
        x=480 if n==1 else left+(right-left)*i/(n-1); top=135 if i%2==0 else 324; cy=top+58
        chunks.append(f'<g class="qm-node" style="--delay:{i*90}ms"><line x1="{x:.1f}" y1="{y}" x2="{x:.1f}" y2="{top+58:.1f}" stroke="{theme["line"]}" stroke-width="2"/>{card(x-78,top,156,116,theme,20)}<circle cx="{x:.1f}" cy="{y}" r="18" fill="{theme["primary"]}" stroke="{theme["visualBg"]}" stroke-width="7"/>{text(x,top+31,f'Stage {i+1}',11,850,theme['accent'],'middle',14,1)}{text(x,top+72,item,14,720,theme['visualText'],'middle',20,3)}</g>')
    chunks.append(f'<g class="qm-focus">{icon(kind,480,268,86,theme,.22)}</g>')
    return ''.join(chunks)


def mobile_timeline(slide,theme):
    items=point_list(slide,5)[:5]; w,h=MOBILE; xline=52; y0=140; gap=91; kind=icon_kind(slide)
    chunks=[top_title(slide,theme,w,True),f'<path class="qm-path" d="M{xline} {y0-12}V{min(570,y0+(len(items)-1)*gap+40)}" stroke="{theme["line"]}" stroke-width="5" stroke-linecap="round"/>']
    for i,item in enumerate(items):
        yy=y0+i*gap
        chunks.append(f'<g class="qm-node" style="--delay:{i*75}ms"><circle cx="{xline}" cy="{yy}" r="15" fill="{theme["primary"]}" stroke="{theme["visualBg"]}" stroke-width="6"/>{card(82,yy-36,284,72,theme,17)}<text x="102" y="{yy-10}" font-family="Inter,Segoe UI,Arial,sans-serif" font-size="10" font-weight="850" fill="{theme["accent"]}" letter-spacing="1">STAGE {i+1}</text>{text(102,yy+16,item,14,730,theme['visualText'],'start',28,2)}</g>')
    chunks.append(icon(kind,330,104,48,theme,.5))
    return ''.join(chunks)


def desktop_comparison(slide,theme):
    items=point_list(slide,6); half=max(1,math.ceil(len(items)/2)); good=items[:half]; bad=items[half:] or ['Pause and verify before acting.']; w,h=DESKTOP
    chunks=[top_title(slide,theme,w)]
    cols=[(52,145,410,345,'RECOMMENDED','#34D399','✓',good),(498,145,410,345,'WATCH OUT','#FB7185','!',bad)]
    for c,(x,y,cw,ch,label,color,symbol,arr) in enumerate(cols):
        chunks.append(f'<g class="qm-node" style="--delay:{c*90}ms">{card(x,y,cw,ch,theme,28)}<rect x="{x}" y="{y}" width="{cw}" height="6" rx="3" fill="{color}"/><text x="{x+28}" y="{y+43}" font-family="Inter,Segoe UI,Arial,sans-serif" font-size="12" font-weight="850" fill="{color}" letter-spacing="1.2">{label}</text>')
        for i,item in enumerate(arr[:4]):
            yy=y+92+i*72
            chunks.append(f'<circle cx="{x+42}" cy="{yy}" r="16" fill="{color}" opacity=".95"/><text x="{x+42}" y="{yy+5}" text-anchor="middle" font-family="Inter,Segoe UI,Arial,sans-serif" font-size="15" font-weight="900" fill="#fff">{symbol}</text>{text(x+72,yy,item,15,720,theme["visualText"],"start",34,2)}')
        chunks.append('</g>')
    return ''.join(chunks)


def mobile_comparison(slide,theme):
    items=point_list(slide,6); half=max(1,math.ceil(len(items)/2)); good=items[:half]; bad=items[half:] or ['Pause and verify before acting.']; w,h=MOBILE
    chunks=[top_title(slide,theme,w,True)]
    configs=[(24,126,342,208,'RECOMMENDED','#34D399','✓',good),(24,354,342,218,'WATCH OUT','#FB7185','!',bad)]
    for c,(x,y,cw,ch,label,color,symbol,arr) in enumerate(configs):
        chunks.append(f'<g class="qm-node" style="--delay:{c*100}ms">{card(x,y,cw,ch,theme,22)}<rect x="{x}" y="{y}" width="5" height="{ch}" rx="2.5" fill="{color}"/><text x="{x+22}" y="{y+32}" font-family="Inter,Segoe UI,Arial,sans-serif" font-size="11" font-weight="850" fill="{color}" letter-spacing="1.1">{label}</text>')
        for i,item in enumerate(arr[:3]):
            yy=y+70+i*48
            chunks.append(f'<circle cx="{x+30}" cy="{yy}" r="13" fill="{color}"/><text x="{x+30}" y="{yy+4}" text-anchor="middle" font-family="Inter,Segoe UI,Arial,sans-serif" font-size="12" font-weight="900" fill="#fff">{symbol}</text>{text(x+52,yy,item,13,710,theme["visualText"],"start",29,2)}')
        chunks.append('</g>')
    return ''.join(chunks)


def desktop_cards(slide,theme):
    items=point_list(slide,6); cols=3 if len(items)>4 else 2; rows=math.ceil(len(items)/cols); w,h=DESKTOP; gap=16; left=52; top=145; cw=(856-gap*(cols-1))/cols; ch=(350-gap*(rows-1))/rows; kind=icon_kind(slide)
    chunks=[top_title(slide,theme,w)]
    for i,item in enumerate(items):
        r=i//cols; c=i%cols; x=left+c*(cw+gap); y=top+r*(ch+gap)
        chunks.append(f'<g class="qm-node" style="--delay:{i*70}ms">{card(x,y,cw,ch,theme,22)}<circle cx="{x+48:.1f}" cy="{y+50:.1f}" r="30" fill="{theme["soft"]}" opacity=".7"/>{icon(kind,x+48,y+50,42,theme)}<text x="{x+91:.1f}" y="{y+34:.1f}" font-family="Inter,Segoe UI,Arial,sans-serif" font-size="10" font-weight="850" fill="{theme["accent"]}" letter-spacing="1">POINT {i+1}</text>{text(x+91,y+70,item,14,720,theme['visualText'],'start',26,3)}</g>')
    return ''.join(chunks)


def mobile_cards(slide,theme):
    items=point_list(slide,6); w,h=MOBILE; cols=2; gap=10; left=22; top=128; cw=168; ch=132; kind=icon_kind(slide)
    chunks=[top_title(slide,theme,w,True)]
    for i,item in enumerate(items):
        r=i//cols; c=i%cols; x=left+c*(cw+gap); y=top+r*(ch+gap)
        chunks.append(f'<g class="qm-node" style="--delay:{i*65}ms">{card(x,y,cw,ch,theme,18)}<circle cx="{x+34}" cy="{y+36}" r="22" fill="{theme["soft"]}" opacity=".72"/>{icon(kind,x+34,y+36,30,theme)}<text x="{x+64}" y="{y+27}" font-family="Inter,Segoe UI,Arial,sans-serif" font-size="9.5" font-weight="850" fill="{theme["accent"]}">{i+1:02d}</text>{text(x+16,y+84,item,13,720,theme['visualText'],'start',21,3)}</g>')
    return ''.join(chunks)


def desktop_hub(slide,theme):
    items=point_list(slide,6); w,h=DESKTOP; cx,cy=480,310; kind=icon_kind(slide); positions=[(90,155),(650,155),(82,390),(658,390),(365,140),(365,430)]; cw,ch=220,78
    chunks=[top_title(slide,theme,w),f'<circle class="qm-focus" cx="{cx}" cy="{cy}" r="122" fill="url(#halo)"/>']
    for i,item in enumerate(items):
        x,y=positions[i]; nx=x+cw/2; ny=y+ch/2
        chunks.append(f'<path class="qm-path" style="--delay:{i*55}ms" d="M{cx} {cy}L{nx:.1f} {ny:.1f}" stroke="{theme["accent"]}" stroke-width="2.5" opacity=".48"/>')
        chunks.append(f'<g class="qm-node" style="--delay:{90+i*75}ms">{card(x,y,cw,ch,theme,20)}<circle cx="{x+29}" cy="{ny:.1f}" r="15" fill="{theme["primary"]}"/><text x="{x+29}" y="{ny+4:.1f}" text-anchor="middle" font-family="Inter,Segoe UI,Arial,sans-serif" font-size="10" font-weight="850" fill="#fff">{i+1}</text>{text(x+54,ny,item,13,720,theme['visualText'],'start',23,2)}</g>')
    chunks.append(f'<g class="qm-focus"><circle cx="{cx}" cy="{cy}" r="83" fill="url(#accentGrad)" filter="url(#softShadow)"/>{icon(kind,cx,cy-12,65,{**theme,"accent":"#FFFFFF","soft":"rgba(255,255,255,.14)"})}{text(cx,cy+51,slide.get("visualTitle") or slide.get("title"),14,850,"#fff","middle",18,2)}</g>')
    return ''.join(chunks)


def mobile_hub(slide,theme):
    items=point_list(slide,6); w,h=MOBILE; kind=icon_kind(slide); cx=195
    chunks=[top_title(slide,theme,w,True),f'<g class="qm-focus"><circle cx="{cx}" cy="190" r="62" fill="url(#accentGrad)" filter="url(#softShadow)"/>{icon(kind,cx,178,48,{**theme,"accent":"#FFFFFF","soft":"rgba(255,255,255,.14)"})}{text(cx,225,slide.get("visualTitle") or slide.get("title"),12,850,"#fff","middle",18,2)}</g>']
    cols=2; gap=10; left=22; top=278; cw=168; ch=88
    for i,item in enumerate(items):
        r=i//cols; c=i%cols; x=left+c*(cw+gap); y=top+r*(ch+gap)
        chunks.append(f'<g class="qm-node" style="--delay:{90+i*65}ms">{card(x,y,cw,ch,theme,17)}<circle cx="{x+25}" cy="{y+26}" r="13" fill="{theme["primary"]}"/><text x="{x+25}" y="{y+30}" text-anchor="middle" font-family="Inter,Segoe UI,Arial,sans-serif" font-size="9" font-weight="850" fill="#fff">{i+1}</text>{text(x+45,y+51,item,12.5,710,theme['visualText'],'start',20,3)}</g>')
    return ''.join(chunks)


def desktop_spotlight(slide,theme):
    items=point_list(slide,4); w,h=DESKTOP; kind=icon_kind(slide); chunks=[top_title(slide,theme,w)]
    chunks.append(f'<g class="qm-focus"><circle cx="265" cy="325" r="150" fill="url(#halo)"/><circle cx="265" cy="325" r="108" fill="url(#accentGrad)" filter="url(#softShadow)"/>{icon(kind,265,300,105,{**theme,"accent":"#FFFFFF","soft":"rgba(255,255,255,.14)"})}</g>{card(470,155,438,335,theme,30)}<text x="510" y="200" font-family="Inter,Segoe UI,Arial,sans-serif" font-size="12" font-weight="850" fill="{theme["accent"]}" letter-spacing="1.2">FOCUS</text>{text(510,250,slide.get("visualTitle") or slide.get("title"),24,850,theme['visualText'],'start',28,3)}')
    for i,item in enumerate(items[:3]):
        yy=332+i*57
        chunks.append(f'<circle cx="520" cy="{yy}" r="13" fill="{theme["primary"]}"/><text x="520" y="{yy+4}" text-anchor="middle" font-family="Inter,Segoe UI,Arial,sans-serif" font-size="9" font-weight="850" fill="#fff">{i+1}</text>{text(547,yy,item,14,710,theme['visualText'],'start',38,2)}')
    return ''.join(chunks)


def mobile_spotlight(slide,theme):
    items=point_list(slide,4); w,h=MOBILE; kind=icon_kind(slide); chunks=[top_title(slide,theme,w,True)]
    chunks.append(f'<g class="qm-focus"><circle cx="195" cy="220" r="105" fill="url(#halo)"/><circle cx="195" cy="220" r="76" fill="url(#accentGrad)" filter="url(#softShadow)"/>{icon(kind,195,208,70,{**theme,"accent":"#FFFFFF","soft":"rgba(255,255,255,.14)"})}</g>{text(195,330,slide.get("visualTitle") or slide.get("title"),22,850,theme['visualText'],'middle',27,3)}{card(24,385,342,185,theme,22)}')
    for i,item in enumerate(items[:3]):
        yy=425+i*48
        chunks.append(f'<circle cx="51" cy="{yy}" r="12" fill="{theme["primary"]}"/><text x="51" y="{yy+4}" text-anchor="middle" font-family="Inter,Segoe UI,Arial,sans-serif" font-size="9" font-weight="850" fill="#fff">{i+1}</text>{text(74,yy,item,13,710,theme['visualText'],'start',29,2)}')
    return ''.join(chunks)


def desktop_matrix(slide,theme):
    items=point_list(slide,4); w,h=DESKTOP; chunks=[top_title(slide,theme,w)]; left=180; top=150; cw=300; ch=170; labels=['LOWER PRIORITY','WATCH','WATCH','HIGHER PRIORITY']; tones=['#10B981','#F59E0B','#F59E0B','#F43F5E']
    for i in range(4):
        c=i%2; r=i//2; x=left+c*cw; y=top+r*ch; tone=tones[i]
        chunks.append(f'<g class="qm-node" style="--delay:{i*80}ms"><rect x="{x}" y="{y}" width="{cw-12}" height="{ch-12}" rx="24" fill="{theme["visualCard"]}" stroke="{tone}" stroke-opacity=".55"/><rect x="{x}" y="{y}" width="6" height="{ch-12}" rx="3" fill="{tone}"/><text x="{x+28}" y="{y+34}" font-family="Inter,Segoe UI,Arial,sans-serif" font-size="10" font-weight="850" fill="{tone}" letter-spacing="1">{labels[i]}</text>{text(x+28,y+91,items[i] if i<len(items) else labels[i].title(),15,730,theme['visualText'],'start',30,3)}</g>')
    chunks.append(f'<text x="85" y="330" transform="rotate(-90 85 330)" font-family="Inter,Segoe UI,Arial,sans-serif" font-size="11" font-weight="800" fill="{theme["visualMuted"]}" letter-spacing="1.2">IMPACT ↑</text><text x="480" y="525" text-anchor="middle" font-family="Inter,Segoe UI,Arial,sans-serif" font-size="11" font-weight="800" fill="{theme["visualMuted"]}" letter-spacing="1.2">LIKELIHOOD →</text>')
    return ''.join(chunks)


def mobile_matrix(slide,theme):
    items=point_list(slide,4); w,h=MOBILE; chunks=[top_title(slide,theme,w,True)]; left=24; top=150; gap=10; cw=166; ch=184; labels=['LOW','WATCH','WATCH','HIGH']; tones=['#10B981','#F59E0B','#F59E0B','#F43F5E']
    for i in range(4):
        c=i%2; r=i//2; x=left+c*(cw+gap); y=top+r*(ch+gap); tone=tones[i]
        chunks.append(f'<g class="qm-node" style="--delay:{i*70}ms"><rect x="{x}" y="{y}" width="{cw}" height="{ch}" rx="20" fill="{theme["visualCard"]}" stroke="{tone}" stroke-opacity=".55"/><text x="{x+16}" y="{y+30}" font-family="Inter,Segoe UI,Arial,sans-serif" font-size="10" font-weight="850" fill="{tone}" letter-spacing="1">{labels[i]}</text>{text(x+16,y+94,items[i] if i<len(items) else labels[i].title(),13,720,theme['visualText'],'start',19,4)}</g>')
    return ''.join(chunks)


def desktop_cycle(slide,theme):
    items=point_list(slide,5)[:5]; w,h=DESKTOP; cx,cy=480,315; rx,ry=300,170; kind=icon_kind(slide); chunks=[top_title(slide,theme,w),f'<circle cx="{cx}" cy="{cy}" r="116" fill="url(#halo)" opacity=".72"/>']; coords=[]
    n=max(1,len(items))
    for i in range(n):
        a=-math.pi/2+2*math.pi*i/n; coords.append((cx+math.cos(a)*rx,cy+math.sin(a)*ry))
    for i,(x,y) in enumerate(coords):
        nx,ny=coords[(i+1)%n]; chunks.append(f'<path class="qm-path" style="--delay:{i*55}ms" d="M{x:.1f} {y:.1f} Q{cx:.1f} {cy:.1f} {nx:.1f} {ny:.1f}" fill="none" stroke="{theme["accent"]}" stroke-width="2.5" marker-end="url(#arrow)" opacity=".5"/>')
    for i,((x,y),item) in enumerate(zip(coords,items)):
        chunks.append(f'<g class="qm-node" style="--delay:{90+i*80}ms">{card(x-88,y-41,176,82,theme,20)}<text x="{x-67:.1f}" y="{y-13:.1f}" font-family="Inter,Segoe UI,Arial,sans-serif" font-size="10" font-weight="850" fill="{theme["accent"]}">PHASE {i+1}</text>{text(x-67,y+17,item,12.5,710,theme['visualText'],'start',20,2)}</g>')
    chunks.append(f'<g class="qm-focus"><circle cx="{cx}" cy="{cy}" r="78" fill="url(#accentGrad)" filter="url(#softShadow)"/>{icon(kind,cx,cy-13,55,{**theme,"accent":"#FFFFFF","soft":"rgba(255,255,255,.14)"})}{text(cx,cy+43,slide.get("visualTitle") or slide.get("title"),12.5,850,"#fff","middle",18,2)}</g>')
    return ''.join(chunks)


def mobile_cycle(slide,theme):
    items=point_list(slide,5)[:5]; w,h=MOBILE; kind=icon_kind(slide); chunks=[top_title(slide,theme,w,True),f'<g class="qm-focus"><circle cx="195" cy="190" r="68" fill="url(#accentGrad)" filter="url(#softShadow)"/>{icon(kind,195,178,48,{**theme,"accent":"#FFFFFF","soft":"rgba(255,255,255,.14)"})}{text(195,226,slide.get("visualTitle") or slide.get("title"),11.5,850,"#fff","middle",17,2)}</g>']; y=292
    for i,item in enumerate(items):
        yy=y+i*59
        if i<len(items)-1:
            chunks.append(f'<path class="qm-path" d="M44 {yy+21}V{yy+46}" stroke="{theme["accent"]}" stroke-width="2" marker-end="url(#arrow)" opacity=".55"/>')
        chunks.append(f'<g class="qm-node" style="--delay:{80+i*65}ms"><circle cx="44" cy="{yy}" r="17" fill="{theme["primary"]}"/><text x="44" y="{yy+5}" text-anchor="middle" font-family="Inter,Segoe UI,Arial,sans-serif" font-size="10" font-weight="850" fill="#fff">{i+1}</text>{card(72,yy-24,294,48,theme,15)}{text(88,yy,item,12.5,710,theme['visualText'],'start',32,2)}</g>')
    chunks.append(f'<path class="qm-path" d="M44 {y+(len(items)-1)*59+22}C18 {y+(len(items)-1)*59+58} 14 247 113 216" fill="none" stroke="{theme["accent"]}" stroke-width="2" stroke-dasharray="5 6" marker-end="url(#arrow)" opacity=".45"/>')
    return ''.join(chunks)


def render(layout, slide, theme, mobile=False):
    table = {
        'process': (desktop_process, mobile_process),
        'timeline': (desktop_timeline, mobile_timeline),
        'comparison': (desktop_comparison, mobile_comparison),
        'hub': (desktop_hub, mobile_hub),
        'spotlight': (desktop_spotlight, mobile_spotlight),
        'matrix': (desktop_matrix, mobile_matrix),
        'cycle': (desktop_cycle, mobile_cycle),
        'cards': (desktop_cards, mobile_cards)
    }
    pair = table.get(layout, table['cards'])
    body = pair[1](slide, theme) if mobile else pair[0](slide, theme)
    return shell(body, slide.get('title'), theme, MOBILE if mobile else DESKTOP)


def normalize_layout(slide, index):
    allowed={'process','cards','timeline','comparison','hub','spotlight','matrix','cycle'}
    layout=clean(slide.get('layout')).lower()
    if layout in allowed: return layout
    text_source=(clean(slide.get('title'))+' '+clean(slide.get('content'))).lower()
    if re.search(r'likelihood|impact|matrix|severity',text_source): return 'matrix'
    if re.search(r'cycle|continuous|repeat|ongoing',text_source): return 'cycle'
    if re.search(r'process|step|workflow|how .* works|flow',text_source): return 'process'
    if re.search(r'timeline|phase|stage|journey|sequence',text_source): return 'timeline'
    if re.search(r'compare|versus|safe|unsafe|recommended|avoid',text_source): return 'comparison'
    if re.search(r'warning|critical|remember|takeaway',text_source): return 'spotlight'
    if re.search(r'components|pillars|areas|categories|elements',text_source): return 'hub'
    return ['cards','process','hub','timeline','spotlight','comparison'][index%6]


def main():
    parser=argparse.ArgumentParser()
    parser.add_argument('input_json'); parser.add_argument('output_dir')
    args=parser.parse_args()
    with open(args.input_json,'r',encoding='utf-8') as handle:
        analysis=json.load(handle)
    output=Path(args.output_dir); output.mkdir(parents=True,exist_ok=True)
    theme=theme_from(analysis); manifest=[]
    slides=analysis.get('slides') if isinstance(analysis.get('slides'),list) else []
    for index,raw in enumerate(slides):
        slide=raw if isinstance(raw,dict) else {}; layout=normalize_layout(slide,index)
        desktop_file=f'visual-{index+1:03d}-{layout}.svg'
        mobile_file=f'visual-{index+1:03d}-{layout}-mobile.svg'
        (output/desktop_file).write_text(render(layout,{**slide,'layout':layout},theme,False),encoding='utf-8')
        (output/mobile_file).write_text(render(layout,{**slide,'layout':layout},theme,True),encoding='utf-8')
        manifest.append({'index':index,'layout':layout,'screenType':clean(slide.get('screenType')) or '', 'desktopFile':desktop_file,'mobileFile':mobile_file})
    manifest_path=output/'visual-manifest.json'
    manifest_path.write_text(json.dumps({'engine':'quizmoto-responsive-vector-v5','visuals':manifest},indent=2),encoding='utf-8')
    print(str(manifest_path)); return 0


if __name__=='__main__':
    raise SystemExit(main())
