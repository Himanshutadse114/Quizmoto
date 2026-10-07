"""Kinetic typography: giant animated words on dark navy.

1920x1080. No hero panel - the WORDS are the visual. Each word of the
headline rises in with a stagger; the highlight word gets the accent color.
Thin progress line at the bottom; small caption.
"""
import os

from PIL import Image, ImageDraw

from . import common as C

LAYOUT_META = {
    "name": "kinetic",
    "label": "Kinetic typography",
    "bg": (10, 22, 51),
    "kinds": ["statement", "title", "closing"],
}

BG = (10, 22, 51)
ACCENT = (255, 120, 60)
TEAL = (45, 200, 190)
WHITE = (245, 247, 250)

_glow = None
_pts = None


def _bg(t):
    global _glow, _pts
    img = Image.new("RGB", (C.W, C.H), BG)
    if _glow is None:
        _glow = C.soft_glow((900, 900), (30, 60, 140), alpha=50, blur=80)
        _pts = C.particles(55, 90, (C.W, C.H), alpha=70)
    img.paste(_glow, (510, 90), _glow)
    return C.draw_particles(img, _pts, t, color=(120, 170, 255), alpha=40)


def _big_words(draw, text, highlight, cx, cy, fm, tag, t, base_size=150):
    """Centered word-by-word kinetic headline. Returns bbox bottom."""
    words = text.split()
    hl = set(highlight.split()) if highlight else set()
    # shrink until it fits
    size = base_size
    while size > 60:
        f = C.load_font(True, size)
        widths = [C.text_size(draw, w, f)[0] for w in words]
        # greedy lines
        lines, cur, cw = [], [], 0
        sp = C.text_size(draw, " ", f)[0]
        for w, ww in zip(words, widths):
            if cur and cw + sp + ww > 1500:
                lines.append(cur)
                cur, cw = [w], ww
            else:
                cur.append(w)
                cw += (sp if cur[:-1] else 0) + ww
        if cur:
            lines.append(cur)
        nlines = len(lines)
        lh = int(size * 1.12)
        if nlines * lh <= 640:
            break
        size -= 12
    f = C.load_font(True, size)
    sp = C.text_size(draw, " ", f)[0]
    lh = int(size * 1.12)
    # rebuild lines at final size
    lines, cur, cw = [], [], 0
    widths = [C.text_size(draw, w, f)[0] for w in words]
    for w, ww in zip(words, widths):
        if cur and cw + sp + ww > 1500:
            lines.append((cur, cw))
            cur, cw = [w], ww
        else:
            cur.append(w)
            cw += (sp if cur[:-1] else 0) + ww
    if cur:
        lines.append((cur, cw))
    total_h = len(lines) * lh
    y0 = cy - total_h // 2
    wi = 0
    for li, (ln, lw) in enumerate(lines):
        x = cx - lw // 2
        y = y0 + li * lh
        for w in ln:
            ww = C.text_size(draw, w, f)[0]
            e = C.entrance(t, 0.08 + wi * 0.06, 0.35)
            yy = y + int((1 - e) * 90)
            if e > 0:
                col = ACCENT if w in hl else WHITE
                # fade via overlay blend is expensive; use y-rise + pop scale
                draw.text((x, yy), w, font=f, fill=col)
            if fm is not None:
                fm.add("word", w[:30], (x, y, x + ww, y + lh), tag)
            x += ww + sp
            wi += 1
    return y0 + total_h


def _draw(t, scene, assets, fm, tag):
    img = _bg(t)
    draw = ImageDraw.Draw(img)
    kind = scene.get("kind", "statement")
    # eyebrow
    f = C.load_font(True, 30)
    label = {"statement": "LISTEN", "title": "THE IDEA",
             "closing": "REMEMBER"}.get(kind, "LISTEN")
    tw, _ = C.text_size(draw, label, f)
    e0 = C.entrance(t, 0.0, 0.4)
    draw.text(((C.W - tw) // 2, 150 + int((1 - e0) * 30)), label,
              font=f, fill=TEAL)
    if fm is not None:
        fm.add("eyebrow", label, ((C.W - tw) // 2, 150,
                                  (C.W + tw) // 2, 190), tag)
    bottom = _big_words(draw, scene["headline"], scene.get("highlight", ""),
                        C.W // 2, 540, fm, tag, t)
    # sub line under the words
    if scene.get("sub") and kind != "statement":
        fs = C.load_font(False, 40)
        lines = C.wrap(draw, scene["sub"], fs, 1100)
        y = bottom + 40
        for ln in lines[:2]:
            lw, _ = C.text_size(draw, ln, fs)
            draw.text(((C.W - lw) // 2, y), ln, font=fs, fill=(170, 190, 215))
            y += 58
    # thin progress line
    draw.rectangle([0, C.H - 8, int(C.W * t), C.H], fill=ACCENT)
    cap = C.caption_chunk(scene.get("narration", ""), t)
    C.caption_bar(img, ImageDraw.Draw(img), cap, C.load_font(False, 32),
                  bg=(8, 16, 38, 215), framemap=fm, tag=tag)
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
