"""Compliance-course format (DPDPA style): white + navy + teal.

1920x1080. Module pill top-left, navy headline + teal keyword, teal pills,
square hero right at (1420,540), text x150-910, caption bar.
Kinds: title / bullets / callout / checklist / closing.
"""
import os

from PIL import Image, ImageDraw

from . import common as C

LAYOUT_META = {
    "name": "course",
    "label": "Compliance course",
    "bg": (255, 255, 255),
    "kinds": ["title", "bullets", "callout", "checklist", "closing"],
}

NAVY = (11, 42, 79)
TEAL = (0, 150, 136)
TEAL_D = (0, 120, 110)
GRAY = (90, 104, 118)
INK = (24, 34, 48)

_glow = None
_pts = None


def _bg(t):
    global _glow, _pts
    img = Image.new("RGB", (C.W, C.H), (255, 255, 255))
    if _glow is None:
        _glow = C.soft_glow((640, 640), TEAL, alpha=22, blur=60)
        _pts = C.particles(33, 46, (C.W, C.H), alpha=40)
    img.paste(_glow, (1180, 220), _glow)
    return C.draw_particles(img, _pts, t, color=(0, 140, 128), alpha=30)


def _module_pill(draw, idx, fm, tag):
    f = C.load_font(True, 28)
    box = C.pill(draw, (150, 120), f"MODULE {idx + 1}", f,
                 (255, 255, 255), TEAL_D, framemap=None)
    if fm is not None:
        fm.add("pill", f"MODULE {idx + 1}", box, tag)
    return box[3] + 26


def _hero(img, assets, t, fm, tag):
    hp = assets.get("hero")
    if not hp or not os.path.exists(hp):
        return
    hero = C.ken_burns(C.fit_hero(hp, (680, 680)), t)
    e = C.entrance(t, 0.12, 0.5)
    if e <= 0:
        return
    glow = C.soft_glow((740, 740), TEAL, alpha=int(26 * e), blur=60)
    img.paste(glow, (1420 - 370, 540 - 370), glow)
    img.paste(hero, (1080, 200))
    ImageDraw.Draw(img).rectangle([1080, 200, 1760, 880], outline=TEAL, width=3)
    if fm is not None:
        fm.add("hero", "hero image", (1080, 200, 1760, 880), tag)


def _headline(draw, scene, y, fm, tag, t):
    f = C.load_font(True, 66)
    e = C.entrance(t, 0.08, 0.45)
    yy = y + int((1 - e) * 44)
    return C.draw_highlight_headline(
        draw, scene["headline"], scene.get("highlight", ""),
        150, yy, f, NAVY, TEAL, 760, 82, framemap=fm, tag=tag)


def _bullets(draw, scene, y, fm, tag, t):
    f = C.load_font(False, 38)
    for i, b in enumerate(scene.get("bullets", [])[:4]):
        e = C.entrance(t, 0.28 + i * 0.13, 0.4)
        yy = y + int((1 - e) * 34)
        # teal square tile + number
        C.rrect(draw, (150, yy + 4, 206, yy + 60), 14, TEAL)
        nf = C.load_font(True, 32)
        draw.text((168, yy + 12), str(i + 1), font=nf, fill=(255, 255, 255))
        lines = C.wrap(draw, b, f, 660)
        ny = yy
        for ln in lines[:2]:
            draw.text((230, ny), ln, font=f, fill=INK)
            ny += 54
        if fm is not None:
            fm.add("bullet", b[:40], (150, yy, 910, ny), tag)
        y = ny + 26
    return y


def _callout(draw, scene, y, fm, tag, t):
    e = C.entrance(t, 0.22, 0.45)
    yy = y + int((1 - e) * 40)
    box = (150, yy, 910, yy + 320)
    C.rrect(draw, box, 24, (235, 245, 248))
    draw.rectangle([150, yy + 16, 164, yy + 304], fill=TEAL)
    f1, f2 = C.load_font(True, 50), C.load_font(False, 36)
    tw = C.wrap(draw, scene["headline"], f1, 680)
    ly = yy + 34
    for ln in tw[:2]:
        draw.text((200, ly), ln, font=f1, fill=NAVY)
        ly += 64
    if scene.get("sub"):
        for ln in C.wrap(draw, scene["sub"], f2, 680)[:3]:
            draw.text((200, ly), ln, font=f2, fill=GRAY)
            ly += 52
    if fm is not None:
        fm.add("callout", scene["headline"][:40], box, tag)
    return box[3] + 28


def _checklist(draw, scene, y, fm, tag, t):
    f = C.load_font(False, 38)
    items = scene.get("bullets", [])[:4] or [scene.get("sub", "")]
    for i, b in enumerate(items):
        if not b:
            continue
        e = C.entrance(t, 0.28 + i * 0.13, 0.4)
        yy = y + int((1 - e) * 34)
        box = (150, yy, 910, yy + 100)
        C.rrect(draw, box, 18, (240, 248, 250))
        C.rrect(draw, (180, yy + 28, 228, yy + 72), 10, TEAL)
        df = C.load_font(True, 32)
        draw.text((193, yy + 33), "\u2713", font=df, fill=(255, 255, 255))
        draw.text((252, yy + 28), b[:54], font=f, fill=INK)
        if fm is not None:
            fm.add("checkrow", b[:40], box, tag)
        y = box[3] + 20
    return y


def _draw(t, scene, assets, fm, tag, idx):
    img = _bg(t)
    draw = ImageDraw.Draw(img)
    kind = scene.get("kind", "title")
    if kind == "closing":
        f = C.load_font(True, 74)
        e = C.entrance(t, 0.1, 0.5)
        yy = 400 + int((1 - e) * 44)
        C.draw_highlight_headline(draw, scene["headline"],
                                  scene.get("highlight", ""), 200, yy, f,
                                  NAVY, TEAL, 1520, 92, framemap=fm, tag=tag)
        if scene.get("sub"):
            fs = C.load_font(False, 40)
            ly = yy + 220
            for ln in C.wrap(draw, scene["sub"], fs, 1200)[:2]:
                lw, _ = C.text_size(draw, ln, fs)
                draw.text(((C.W - lw) // 2, ly), ln, font=fs, fill=GRAY)
                ly += 60
    else:
        y = _module_pill(draw, idx, fm, tag)
        if kind == "bullets":
            y = _headline(draw, scene, y, fm, tag, t)
            _bullets(draw, scene, y + 8, fm, tag, t)
        elif kind == "callout":
            y = _callout(draw, scene, y, fm, tag, t)
        elif kind == "checklist":
            y = _headline(draw, scene, y, fm, tag, t)
            _checklist(draw, scene, y + 8, fm, tag, t)
        else:
            y = _headline(draw, scene, y, fm, tag, t)
            if scene.get("sub"):
                fs = C.load_font(False, 38)
                e = C.entrance(t, 0.2, 0.45)
                yy = y + 6 + int((1 - e) * 34)
                for ln in C.wrap(draw, scene["sub"], fs, 760)[:3]:
                    draw.text((150, yy), ln, font=fs, fill=GRAY)
                    yy += 56
                if fm is not None:
                    fm.add("sub", scene["sub"][:40], (150, y, 910, yy), tag)
        _hero(img, assets, t, fm, tag)
    cap = C.caption_chunk(scene.get("narration", ""), t)
    C.caption_bar(img, ImageDraw.Draw(img), cap, C.load_font(False, 34),
                  framemap=fm, tag=tag)
    if t < 0.08:
        img = Image.blend(Image.new("RGB", img.size, (255, 255, 255)), img,
                          t / 0.08)
    return img


def render_scene(scene, duration, assets, frames_dir, cfg):
    idx = int(assets.get("scene_idx", 0))
    os.makedirs(frames_dir, exist_ok=True)
    fps = int(cfg.get("fps", 30))
    n = max(1, int(duration * fps))
    fm = C.FrameMap()
    sample_at = {n // 4, n // 2, 3 * n // 4}
    for fi in range(n):
        t = fi / max(1, n - 1)
        tag = f"scene{idx}@{t:.2f}" if fi in sample_at else ""
        img = _draw(t, scene, assets, fm if fi in sample_at else None, tag, idx)
        img.save(os.path.join(frames_dir, f"f_{fi:05d}.png"))
    return fm
