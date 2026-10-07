"""Shared drawing primitives for all VideoForge layouts.

Every renderer records what it draws into a FrameMap (element kind, label,
bounding box) - the verifier (local geometry + Jev AI) consumes this.
"""
import math
import os
import random

from PIL import Image, ImageDraw, ImageFont, ImageFilter

W, H = 1920, 1080

_FONT_CACHE = {}


def _font_dirs():
    here = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    pkg_fonts = os.path.join(
        os.path.dirname(os.path.abspath(__file__)), "..", "fonts")  # LMSGEN: bundled
    cands = [
        os.path.normpath(pkg_fonts),                # server/video-studio/fonts
        os.path.join(here, "assets", "fonts"),   # setup.bat downloads
        r"C:\Windows\Fonts",                     # Windows system fonts
        "/usr/share/fonts/truetype/dejavu",      # Linux
        "/usr/share/fonts/truetype/liberation",
        os.path.expanduser("~/Library/Fonts"),   # macOS
        "/Library/Fonts",
    ]
    return [d for d in cands if os.path.isdir(d)]


def load_font(bold=True, size=48):
    """Montserrat/Inter if present, else Arial on Windows, else PIL default."""
    key = (bold, size)
    if key in _FONT_CACHE:
        return _FONT_CACHE[key]
    names = (["Montserrat-Bold.ttf", "Inter-Bold.ttf"] if bold
             else ["Inter-Regular.ttf", "Montserrat-Bold.ttf"])
    names += ["arialbd.ttf" if bold else "arial.ttf",
              "LiberationSans-Bold.ttf" if bold else "LiberationSans-Regular.ttf",
              "DejaVuSans-Bold.ttf" if bold else "DejaVuSans.ttf"]
    for d in _font_dirs():
        for n in names:
            p = os.path.join(d, n)
            if os.path.exists(p):
                try:
                    f = ImageFont.truetype(p, size)
                    _FONT_CACHE[key] = f
                    return f
                except Exception:  # noqa: BLE001
                    continue
    f = ImageFont.load_default()
    _FONT_CACHE[key] = f
    return f


def text_size(draw, text, font):
    l, t, r, b = draw.textbbox((0, 0), text, font=font)
    return r - l, b - t


def wrap(draw, text, font, max_w):
    """Greedy word wrap -> list of lines."""
    words, lines, cur = text.split(), [], ""
    for wd in words:
        trial = (cur + " " + wd).strip()
        if text_size(draw, trial, font)[0] <= max_w or not cur:
            cur = trial
        else:
            lines.append(cur)
            cur = wd
    if cur:
        lines.append(cur)
    return lines


def draw_lines(draw, lines, x, y, font, fill, line_h, framemap=None,
               kind="text", center=None):
    """Draw wrapped lines; optionally record bbox. center=(cx) centers each line."""
    top = y
    maxw = 0
    for ln in lines:
        lw, lh = text_size(draw, ln, font)
        maxw = max(maxw, lw)
        xx = (center - lw // 2) if center else x
        draw.text((xx, y), ln, font=font, fill=fill)
        y += line_h
    if framemap is not None:
        framemap.add(kind, lines[0][:40] if lines else "",
                     (x if not center else center - maxw // 2, top,
                      (x if not center else center - maxw // 2) + maxw, y))
    return y


def rrect(draw, box, radius, fill, outline=None, width=1):
    draw.rounded_rectangle(box, radius=radius, fill=fill,
                           outline=outline, width=width)


def pill(draw, xy, text, font, fg, bg, pad_x=26, pad_y=12, framemap=None):
    tw, th = text_size(draw, text, font)
    box = (xy[0], xy[1], xy[0] + tw + pad_x * 2, xy[1] + th + pad_y * 2)
    rrect(draw, box, (box[3] - box[1]) // 2, bg)
    draw.text((xy[0] + pad_x, xy[1] + pad_y), text, font=font, fill=fg)
    if framemap is not None:
        framemap.add("pill", text[:40], box)
    return box


def soft_glow(size, color, alpha=60, blur=60):
    """Radial glow sprite."""
    g = Image.new("RGBA", size, (0, 0, 0, 0))
    d = ImageDraw.Draw(g)
    cx, cy = size[0] // 2, size[1] // 2
    r = min(size) // 2
    for rr in range(r, 0, -6):
        a = int(alpha * (1 - rr / r))
        d.ellipse([cx - rr, cy - rr, cx + rr, cy + rr], fill=color + (a,))
    return g.filter(ImageFilter.GaussianBlur(blur // 3))


def particles(seed, n, area, rrange=(2, 5), alpha=90):
    """Deterministic drifting dots: list of dicts{x,y,r,dx,dy,phase}."""
    rnd = random.Random(seed)
    pts = []
    for _ in range(n):
        pts.append({
            "x": rnd.uniform(0, area[0]), "y": rnd.uniform(0, area[1]),
            "r": rnd.uniform(*rrange),
            "dx": rnd.uniform(-14, 14), "dy": rnd.uniform(-10, 10),
            "ph": rnd.uniform(0, 6.28),
        })
    return pts


def draw_particles(base, pts, t, color=(255, 255, 255), alpha=70):
    ov = Image.new("RGBA", base.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(ov)
    for p in pts:
        x = (p["x"] + p["dx"] * t) % base.size[0]
        y = (p["y"] + p["dy"] * t) % base.size[1]
        tw = 0.6 + 0.4 * math.sin(t * 2 + p["ph"])
        a = int(alpha * tw)
        r = p["r"]
        d.ellipse([x - r, y - r, x + r, y + r], fill=color + (a,))
    return Image.alpha_composite(base.convert("RGBA"), ov).convert("RGB")


def caption_bar(base, draw, text, font, fg=(255, 255, 255),
                bg=(10, 14, 26, 215), stripe=None, framemap=None, tag=""):
    """Bottom caption pill. Owns y ~ 940-1040; content must end above 880."""
    if not text:
        return
    lines = wrap(draw, text, font, W - 320)
    lines = lines[:2]
    th = sum(text_size(draw, ln, font)[1] + 10 for ln in lines)
    bw, bh = W - 280, th + 44
    bx, by = (W - bw) // 2, H - bh - 36
    ov = Image.new("RGBA", base.size, (0, 0, 0, 0))
    od = ImageDraw.Draw(ov)
    od.rounded_rectangle([bx, by, bx + bw, by + bh], radius=22, fill=bg)
    if stripe:
        od.rounded_rectangle([bx + bw - 14, by, bx + bw, by + bh],
                             radius=7, fill=stripe + (255,))
    y = by + 22
    for ln in lines:
        lw, _ = text_size(draw, ln, font)
        od.text(((W - lw) // 2, y), ln, font=font, fill=fg)
        y += text_size(draw, ln, font)[1] + 10
    out = Image.alpha_composite(base.convert("RGBA"), ov)
    base.paste(out.convert("RGB"), (0, 0))
    if framemap is not None:
        framemap.add("caption", text[:40], (bx, by, bx + bw, by + bh), tag)


def ken_burns(img, t, zoom0=1.0, zoom1=1.06, size=(680, 680)):
    """Slow zoom crop of img to `size` at progress t (0..1)."""
    z = zoom0 + (zoom1 - zoom0) * t
    iw, ih = img.size
    cw, ch = int(size[0] * z), int(size[1] * z)
    cw, ch = min(cw, iw), min(ch, ih)
    x0 = (iw - cw) // 2 + int(20 * math.sin(t * 6.28))
    y0 = (ih - ch) // 2
    crop = img.crop((max(0, x0), max(0, y0), max(0, x0) + cw, max(0, y0) + ch))
    return crop.resize(size, Image.LANCZOS)


def fit_hero(path, size):
    """Load + center-crop an image to exactly `size`."""
    img = Image.open(path).convert("RGB")
    iw, ih = img.size
    sw, sh = size
    scale = max(sw / iw, sh / ih)
    img = img.resize((int(iw * scale) + 1, int(ih * scale) + 1), Image.LANCZOS)
    x0, y0 = (img.size[0] - sw) // 2, (img.size[1] - sh) // 2
    return img.crop((x0, y0, x0 + sw, y0 + sh))


def ease(t):
    t = max(0.0, min(1.0, t))
    return 1 - (1 - t) ** 3


def entrance(t, delay=0.0, dur=0.5):
    """0..1 entrance progress starting at `delay` (t is 0..1 scene progress)."""
    return ease((t - delay) / dur)


class FrameMap:
    """Element bounding boxes recorded on sampled frames, for verification.

    Each entry: (frame_tag, kind, label, (x0, y0, x1, y1)).
    """

    def __init__(self):
        self.entries = []

    def add(self, kind, label, box, tag=""):
        x0, y0, x1, y1 = (int(v) for v in box)
        self.entries.append((tag, kind, str(label)[:60], (x0, y0, x1, y1)))

    def describe(self):
        """Plain-text frame map for the Jev verifier."""
        lines = []
        for tag, kind, label, (x0, y0, x1, y1) in self.entries:
            lines.append(
                f"[{tag}] {kind}: '{label}' at x{x0}-{x1} y{y0}-{y1}")
        return "\n".join(lines)

    def save(self, path):
        import json
        with open(path, "w", encoding="utf-8") as f:
            json.dump(self.entries, f)

    @classmethod
    def load(cls, path):
        import json
        fm = cls()
        with open(path, encoding="utf-8") as f:
            fm.entries = [tuple(e) for e in json.load(f)]
        # boxes come back as lists; normalize
        fm.entries = [(t, k, l, tuple(b)) for t, k, l, b in fm.entries]
        return fm


def draw_highlight_headline(draw, text, highlight, x, y, font, fill,
                            hl_fill, max_w, line_h, framemap=None, tag=""):
    """Word-by-word two-tone headline with wrapping. Returns end y."""
    words = text.split()
    hl_words = set(highlight.split()) if highlight else set()
    space_w = text_size(draw, " ", font)[0]
    lines, cur, cur_w = [], [], 0
    for wd in words:
        ww = text_size(draw, wd, font)[0]
        add = ww + (space_w if cur else 0)
        if cur and cur_w + add > max_w:
            lines.append(cur)
            cur, cur_w = [wd], ww
        else:
            cur.append(wd)
            cur_w += add
    if cur:
        lines.append(cur)
    top, maxw = y, 0
    for ln in lines:
        xx = x
        lw_total = sum(text_size(draw, wd, font)[0] for wd in ln) + space_w * (len(ln) - 1)
        maxw = max(maxw, lw_total)
        for wd in ln:
            ww = text_size(draw, wd, font)[0]
            draw.text((xx, y), wd,
                      font=font, fill=hl_fill if wd in hl_words else fill)
            xx += ww + space_w
        y += line_h
    if framemap is not None:
        framemap.add("headline", text[:40], (x, top, x + maxw, y), tag)
    return y


def caption_chunk(narration, t, chunks=3):
    """Pick the caption chunk for scene progress t (narration split in N)."""
    words = narration.split()
    if not words:
        return ""
    per = max(1, (len(words) + chunks - 1) // chunks)
    idx = min(chunks - 1, int(t * chunks))
    return " ".join(words[idx * per:(idx + 1) * per])
