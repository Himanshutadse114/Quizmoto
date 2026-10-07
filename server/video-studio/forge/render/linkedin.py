"""LinkedIn learning format: light, navy + teal, square hero right.

1920x1080. White bg, navy headline with ONE teal keyword, teal eyebrow pill,
680x680 hero at (1420,540), text x150-910, dark caption bar.
"""
import os

from PIL import Image, ImageDraw

from . import common as C

LAYOUT_META = {
    "name": "linkedin",
    "label": "LinkedIn learning",
    "bg": (255, 255, 255),
    "kinds": ["title", "bullets", "callout", "checklist", "closing"],
}

NAVY = (10, 37, 64)
TEAL = (0, 184, 169)
GRAY = (74, 90, 106)
INK = (20, 30, 44)

_kind_label = {
    "title": "LEARN IN 60 SECONDS", "bullets": "KEY POINTS",
    "callout": "WORTH KNOWING", "checklist": "YOUR CHECKLIST",
    "closing": "TAKEAWAY",
}

_glow = None
_pts = None


def _bg(t):
    global _glow, _pts
    img = Image.new("RGB", (C.W, C.H), (255, 255, 255))
    if _glow is None:
        _glow = C.soft_glow((700, 700), TEAL, alpha=26, blur=60)
        _pts = C.particles(7, 60, (C.W, C.H), alpha=50)
    img.paste(_glow, (C.W - 620, -120), _glow)
    img = C.draw_particles(img, _pts, t, color=(0, 150, 140), alpha=36)
    return img


def _logo(img, assets):
    if assets.get("logo") and os.path.exists(assets["logo"]):
        lg = Image.open(assets["logo"]).convert("RGBA")
        h = 84
        lg = lg.resize((int(lg.width * h / lg.height), h), Image.LANCZOS)
        img.paste(lg, (150, 56), lg)


def _hero(img, assets, t, fm, tag):
    hp = assets.get("hero")
    if not hp or not os.path.exists(hp):
        return
    hero = C.fit_hero(hp, (680, 680))
    hero = C.ken_burns(hero, t)
    e = C.entrance(t, 0.15, 0.5)
    if e <= 0:
        return
    glow = C.soft_glow((760, 760), TEAL, alpha=int(30 * e), blur=60)
    img.paste(glow, (1420 - 380, 540 - 380), glow)
    img.paste(hero, (1080, 200))
    if fm is not None:
        fm.add("hero", "hero image", (1080, 200, 1760, 880), tag)


def _eyebrow(draw, kind, y, fm, tag):
    f = C.load_font(True, 30)
    box = C.pill(draw, (150, y), _kind_label.get(kind, "LEARN"), f,
                 (255, 255, 255), TEAL, framemap=fm)
    if fm is not None:
        fm.entries[-1] = (tag,) + fm.entries[-1][1:]
    return box[3] + 28


def _headline(draw, scene, y, fm, tag, t):
    f = C.load_font(True, 68)
    e = C.entrance(t, 0.1, 0.45)
    yy = y + int((1 - e) * 44)
    return C.draw_highlight_headline(
        draw, scene["headline"], scene.get("highlight", ""),
        150, yy, f, NAVY, TEAL, 760, 84, framemap=fm, tag=tag)


def _sub(draw, scene, y, fm, tag, t):
    if not scene.get("sub"):
        return y
    f = C.load_font(False, 38)
    e = C.entrance(t, 0.2, 0.45)
    yy = y + int((1 - e) * 36)
    lines = C.wrap(draw, scene["sub"], f, 760)
    return _dl(draw, lines, 150, yy, f, GRAY, 56, fm, tag)


def _dl(draw, lines, x, y, font, fill, lh, fm, tag):
    top = y
    maxw = 0
    for ln in lines:
        lw, _ = C.text_size(draw, ln, font)
        maxw = max(maxw, lw)
        draw.text((x, y), ln, font=font, fill=fill)
        y += lh
    if fm is not None:
        fm.add("sub", lines[0][:40] if lines else "", (x, top, x + maxw, y), tag)
    return y


def _bullets(draw, scene, y, fm, tag, t):
    f = C.load_font(False, 38)
    for i, b in enumerate(scene.get("bullets", [])[:3]):
        e = C.entrance(t, 0.3 + i * 0.15, 0.4)
        yy = y + int((1 - e) * 36)
        draw.ellipse([150, yy + 14, 172, yy + 36], fill=TEAL)
        lines = C.wrap(draw, b, f, 700)
        ny = yy
        for ln in lines:
            draw.text((196, ny), ln, font=f, fill=INK)
            ny += 56
        if fm is not None:
            fm.add("bullet", b[:40], (150, yy, 910, ny), tag)
        y = ny + 32
    return y


def _callout_card(draw, scene, y, fm, tag, t):
    e = C.entrance(t, 0.25, 0.45)
    yy = y + int((1 - e) * 40)
    box = (150, yy, 910, yy + 300)
    C.rrect(draw, box, 26, (240, 248, 252))
    draw.rectangle([150, yy + 18, 162, yy + 282], fill=TEAL)
    f1, f2 = C.load_font(True, 54), C.load_font(False, 36)
    draw.text((196, yy + 36), scene["headline"][:60], font=f1, fill=NAVY)
    if scene.get("sub"):
        lines = C.wrap(draw, scene["sub"], f2, 660)
        ly = yy + 120
        for ln in lines[:3]:
            draw.text((196, ly), ln, font=f2, fill=GRAY)
            ly += 52
    if fm is not None:
        fm.add("callout", scene["headline"][:40], box, tag)
    return box[3] + 30


def _checklist(draw, scene, y, fm, tag, t):
    f = C.load_font(False, 38)
    items = scene.get("bullets", [])[:3] or [scene.get("sub", "")]
    for i, b in enumerate(items):
        if not b:
            continue
        e = C.entrance(t, 0.3 + i * 0.15, 0.4)
        yy = y + int((1 - e) * 36)
        box = (150, yy, 910, yy + 104)
        C.rrect(draw, box, 20, (238, 250, 250))
        C.rrect(draw, (182, yy + 30, 234, yy + 74), 12, TEAL)
        df = C.load_font(True, 34)
        draw.text((196, yy + 36), "\u2713", font=df, fill=(255, 255, 255))
        lines = C.wrap(draw, b, f, 620)
        draw.text((262, yy + 30), lines[0][:52], font=f, fill=INK)
        if fm is not None:
            fm.add("checkrow", b[:40], box, tag)
        y = box[3] + 22
    return y


def _draw(t, scene, assets, fm, tag):
    img = _bg(t)
    draw = ImageDraw.Draw(img)
    _logo(img, assets)
    kind = scene.get("kind", "title")
    y = _eyebrow(draw, kind, 168, fm, tag)
    if kind == "bullets":
        y = _headline(draw, scene, y, fm, tag, t)
        y = _bullets(draw, scene, y + 10, fm, tag, t)
    elif kind == "callout":
        y = _callout_card(draw, scene, y, fm, tag, t)
        y = _sub(draw, scene, y, fm, tag, t)
    elif kind == "checklist":
        y = _headline(draw, scene, y, fm, tag, t)
        y = _checklist(draw, scene, y + 10, fm, tag, t)
    elif kind == "closing":
        draw = ImageDraw.Draw(img)
        f = C.load_font(True, 76)
        e = C.entrance(t, 0.1, 0.5)
        yy = 380 + int((1 - e) * 44)
        C.draw_highlight_headline(draw, scene["headline"],
                                  scene.get("highlight", ""), 150, yy, f,
                                  NAVY, TEAL, 1620, 96, framemap=fm, tag=tag)
        if scene.get("sub"):
            fs = C.load_font(False, 40)
            lines = C.wrap(draw, scene["sub"], fs, 1200)
            _dl(draw, lines, 150, yy + 220, fs, GRAY, 60, fm, tag)
        _logo(img, assets)
    else:
        y = _headline(draw, scene, y, fm, tag, t)
        y = _sub(draw, scene, y + 6, fm, tag, t)
        _hero(img, assets, t, fm, tag)
    if kind != "closing":
        _hero(img, assets, t, fm, tag)
    # caption owns the bottom zone
    cap = C.caption_chunk(scene.get("narration", ""), t)
    C.caption_bar(img, ImageDraw.Draw(img), cap, C.load_font(False, 34),
                  framemap=fm, tag=tag)
    # global fade-in
    if t < 0.08:
        img = Image.blend(Image.new("RGB", img.size, (255, 255, 255)), img,
                          t / 0.08)
    return img


def render_scene(scene, duration, assets, frames_dir, cfg):
    import os as _os
    _os.makedirs(frames_dir, exist_ok=True)
    fps = int(cfg.get("fps", 30))
    n = max(1, int(duration * fps))
    fm = C.FrameMap()
    sample_at = {n // 4, n // 2, 3 * n // 4}
    for fi in range(n):
        t = fi / max(1, n - 1)
        tag = f"scene@{t:.2f}" if fi in sample_at else ""
        img = _draw(t, scene, assets, fm if fi in sample_at else None, tag)
        img.save(_os.path.join(frames_dir, f"f_{fi:05d}.png"))
    return fm
