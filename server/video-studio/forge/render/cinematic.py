"""Cinematic: full-bleed AI imagery with lower-third text.

1920x1080. The hero image fills the frame with a slow Ken Burns drift;
a dark gradient rises from the bottom; headline + one line sit in the
lower third. Minimal text - the image tells the story.
"""
import os

from PIL import Image, ImageDraw, ImageFilter

from . import common as C

LAYOUT_META = {
    "name": "cinematic",
    "label": "Cinematic",
    "bg": (8, 10, 16),
    "kinds": ["lowerthird", "title", "closing"],
}

WHITE = (250, 250, 252)
SOFT = (210, 215, 225)
GOLD = (230, 180, 90)


def _bg_frame(assets, t):
    hp = assets.get("hero")
    if hp and os.path.exists(hp):
        img = C.fit_hero(hp, (2120, 1190))
        # slow drift crop
        iw, ih = img.size
        dx = int(100 * t)
        crop = img.crop((dx, 45, dx + 1920, 45 + 1080))
    else:
        crop = Image.new("RGB", (1920, 1080), (14, 18, 30))
    # bottom gradient for legibility
    grad = Image.new("RGBA", (1920, 1080), (0, 0, 0, 0))
    gd = ImageDraw.Draw(grad)
    for y in range(1080):
        a = 0
        if y > 420:
            a = int(200 * ((y - 420) / 660) ** 1.4)
        gd.line([(0, y), (1920, y)], fill=(5, 7, 12, a))
    grad = grad.filter(ImageFilter.GaussianBlur(2))
    return Image.alpha_composite(crop.convert("RGBA"), grad).convert("RGB")


def _draw(t, scene, assets, fm, tag):
    img = _bg_frame(assets, t)
    draw = ImageDraw.Draw(img)
    kind = scene.get("kind", "lowerthird")
    if kind == "closing":
        f = C.load_font(True, 84)
        e = C.entrance(t, 0.1, 0.5)
        lines = C.wrap(draw, scene["headline"], f, 1400)
        lh = 100
        y0 = 430 - len(lines) * lh // 2 + int((1 - e) * 50)
        y = y0
        for ln in lines:
            lw, _ = C.text_size(draw, ln, f)
            draw.text(((1920 - lw) // 2, y), ln, font=f, fill=WHITE)
            y += lh
        if fm is not None:
            fm.add("headline", scene["headline"][:40],
                   (260, y0, 1660, y), tag)
    else:
        # eyebrow (skipped for pure lowerthird - cleaner frame)
        if kind != "lowerthird":
            f = C.load_font(True, 30)
            label = kind.upper()
            e0 = C.entrance(t, 0.0, 0.4)
            draw.text((140, 640 + int((1 - e0) * 30)), label, font=f, fill=GOLD)
            draw.line([140, 690, 300, 690], fill=GOLD, width=4)
            if fm is not None:
                fm.add("eyebrow", label, (140, 640, 320, 694), tag)
            head_y = 716
        else:
            head_y = 660
        # headline
        f2 = C.load_font(True, 72)
        e = C.entrance(t, 0.1, 0.45)
        yy = head_y + int((1 - e) * 44)
        y = yy
        for ln in C.wrap(draw, scene["headline"], f2, 1180)[:2]:
            draw.text((140, y), ln, font=f2, fill=WHITE)
            y += 88
        if fm is not None:
            fm.add("headline", scene["headline"][:40], (140, yy, 1400, y), tag)
        # one line
        if scene.get("sub"):
            fs = C.load_font(False, 38)
            y += 8
            sub_top = y
            for ln in C.wrap(draw, scene["sub"], fs, 1100)[:2]:
                draw.text((140, y), ln, font=fs, fill=SOFT)
                y += 54
            if fm is not None:
                fm.add("sub", scene["sub"][:40], (140, sub_top, 1300, y), tag)
    # letterbox kiss
    draw.rectangle([0, 0, 1920, 26], fill=(5, 7, 12))
    draw.rectangle([0, 1054, 1920, 1080], fill=(5, 7, 12))
    cap = C.caption_chunk(scene.get("narration", ""), t)
    C.caption_bar(img, ImageDraw.Draw(img), cap, C.load_font(False, 32),
                  bg=(5, 7, 12, 200), framemap=fm, tag=tag)
    if t < 0.08:
        img = Image.blend(Image.new("RGB", img.size, (8, 10, 16)), img,
                          t / 0.08)
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
