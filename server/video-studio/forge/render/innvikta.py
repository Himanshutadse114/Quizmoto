"""Innvikta security-awareness format: dark charcoal + orange.

1920x1080. Warm-charcoal bg, orange glows, hero panel LEFT (center 430,540),
text column RIGHT (x890, max 880), caption pill with orange right stripe.
"""
import os

from PIL import Image, ImageDraw

from . import common as C

LAYOUT_META = {
    "name": "innvikta",
    "label": "Innvikta security awareness",
    "bg": (26, 21, 18),
    "kinds": ["title", "bullets", "callout", "checklist", "closing"],
}

BG = (26, 21, 18)
ORANGE = (241, 90, 36)
CREAM = (245, 238, 230)
MUTED = (180, 168, 158)

_kind_label = {
    "title": "THREAT BRIEFING", "bullets": "RED FLAGS",
    "callout": "REAL INCIDENT", "checklist": "PROTECT YOURSELF",
    "closing": "STAY SHARP",
}

_glow = None
_pts = None


def _bg(t):
    global _glow, _pts
    img = Image.new("RGB", (C.W, C.H), BG)
    if _glow is None:
        _glow = C.soft_glow((800, 800), ORANGE, alpha=34, blur=70)
        _pts = C.particles(21, 70, (C.W, C.H), alpha=60)
    img.paste(_glow, (-260, 140), _glow)
    img.paste(_glow, (C.W - 560, -240), _glow)
    return C.draw_particles(img, _pts, t, color=(255, 150, 90), alpha=44)


def _hero(img, assets, t, fm, tag):
    hp = assets.get("hero")
    if not hp or not os.path.exists(hp):
        return
    hero = C.fit_hero(hp, (680, 680))
    hero = C.ken_burns(hero, t)
    e = C.entrance(t, 0.12, 0.5)
    if e <= 0:
        return
    glow = C.soft_glow((780, 780), ORANGE, alpha=int(40 * e), blur=70)
    img.paste(glow, (430 - 390, 540 - 390), glow)
    # rounded panel
    mask = Image.new("L", (680, 680), 0)
    ImageDraw.Draw(mask).rounded_rectangle([0, 0, 680, 680], 36, fill=255)
    img.paste(hero, (90, 200), mask)
    ImageDraw.Draw(img).rounded_rectangle([90, 200, 770, 880], 36,
                                          outline=ORANGE + (255,), width=3)
    if fm is not None:
        fm.add("hero", "hero image", (90, 200, 770, 880), tag)


def _eyebrow(draw, kind, fm, tag):
    f = C.load_font(True, 30)
    txt = _kind_label.get(kind, "BRIEFING")
    # letterspaced feel: draw with tracking
    x = 890
    for ch in txt:
        draw.text((x, 150), ch, font=f, fill=ORANGE)
        x += C.text_size(draw, ch, f)[0] + 6
    draw.line([890, 196, 890 + 220, 196], fill=ORANGE, width=4)
    if fm is not None:
        fm.add("eyebrow", txt, (890, 150, x, 200), tag)


def _headline(draw, scene, fm, tag, t):
    f = C.load_font(True, 66)
    e = C.entrance(t, 0.1, 0.45)
    yy = 230 + int((1 - e) * 44)
    return C.draw_highlight_headline(
        draw, scene["headline"], scene.get("highlight", ""),
        890, yy, f, (255, 255, 255), ORANGE, 880, 82, framemap=fm, tag=tag)


def _bullets(draw, scene, y, fm, tag, t):
    f = C.load_font(False, 38)
    for i, b in enumerate(scene.get("bullets", [])[:3]):
        e = C.entrance(t, 0.3 + i * 0.15, 0.4)
        yy = y + int((1 - e) * 36)
        # left step-rail marker
        draw.rectangle([890, yy + 6, 898, yy + 66], fill=ORANGE)
        lines = C.wrap(draw, b, f, 800)
        ny = yy
        for ln in lines:
            draw.text((930, ny), ln, font=f, fill=CREAM)
            ny += 56
        if fm is not None:
            fm.add("bullet", b[:40], (890, yy, 1770, ny), tag)
        y = ny + 30
    return y


def _callout(draw, scene, y, fm, tag, t):
    e = C.entrance(t, 0.25, 0.45)
    yy = y + int((1 - e) * 40)
    box = (890, yy, 1770, yy + 300)
    C.rrect(draw, box, 26, (38, 30, 26))
    draw.rectangle([890, yy + 18, 902, yy + 282], fill=ORANGE)
    f1, f2 = C.load_font(True, 52), C.load_font(False, 36)
    draw.text((940, yy + 36), scene["headline"][:58], font=f1, fill=(255, 255, 255))
    if scene.get("sub"):
        ly = yy + 120
        for ln in C.wrap(draw, scene["sub"], f2, 780)[:3]:
            draw.text((940, ly), ln, font=f2, fill=MUTED)
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
        box = (890, yy, 1770, yy + 104)
        C.rrect(draw, box, 20, (42, 34, 30))
        C.rrect(draw, (922, yy + 30, 974, yy + 74), 12, ORANGE)
        df = C.load_font(True, 34)
        draw.text((936, yy + 36), "\u2713", font=df, fill=(255, 255, 255))
        draw.text((1002, yy + 30), b[:56], font=f, fill=CREAM)
        if fm is not None:
            fm.add("checkrow", b[:40], box, tag)
        y = box[3] + 22
    return y


def _draw(t, scene, assets, fm, tag):
    img = _bg(t)
    draw = ImageDraw.Draw(img)
    kind = scene.get("kind", "title")
    _eyebrow(draw, kind, fm, tag)
    if kind == "closing":
        f = C.load_font(True, 76)
        e = C.entrance(t, 0.1, 0.5)
        yy = 400 + int((1 - e) * 44)
        C.draw_highlight_headline(draw, scene["headline"],
                                  scene.get("highlight", ""), 240, yy, f,
                                  (255, 255, 255), ORANGE, 1440, 96,
                                  framemap=fm, tag=tag)
    else:
        y = _headline(draw, scene, fm, tag, t)
        if kind == "bullets":
            _bullets(draw, scene, y + 10, fm, tag, t)
        elif kind == "callout":
            _callout(draw, scene, y + 10, fm, tag, t)
        elif kind == "checklist":
            _checklist(draw, scene, y + 10, fm, tag, t)
        elif scene.get("sub"):
            fs = C.load_font(False, 38)
            lines = C.wrap(draw, scene["sub"], fs, 880)
            yy2 = y + 6
            for ln in lines[:3]:
                draw.text((890, yy2), ln, font=fs, fill=MUTED)
                yy2 += 56
            if fm is not None:
                fm.add("sub", scene["sub"][:40], (890, y, 1770, yy2), tag)
        _hero(img, assets, t, fm, tag)
    cap = C.caption_chunk(scene.get("narration", ""), t)
    C.caption_bar(img, ImageDraw.Draw(img), cap, C.load_font(False, 34),
                  bg=(20, 14, 12, 220), stripe=ORANGE, framemap=fm, tag=tag)
    if t < 0.08:
        img = Image.blend(Image.new("RGB", img.size, BG), img, t / 0.08)
    return img


def render_scene(scene, duration, assets, frames_dir, cfg):
    os.makedirs(frames_dir, exist_ok=True)
    fps = int(cfg.get("fps", 30))
    n = max(1, int(duration * fps))
    fm = C.FrameMap()
    sample_at = {n // 4, n // 2, 3 * n // 4}
    for fi in range(n):
        t = fi / max(1, n - 1)
        tag = f"scene@{t:.2f}" if fi in sample_at else ""
        img = _draw(t, scene, assets, fm if fi in sample_at else None, tag)
        img.save(os.path.join(frames_dir, f"f_{fi:05d}.png"))
    return fm
