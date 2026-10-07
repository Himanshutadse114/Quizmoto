"""Layout verification, two layers.

1. LocalVerifier - deterministic geometry over the renderers' FrameMaps:
   overlaps, off-screen elements, caption-zone intrusions.
2. JevVerifier - TypeSafe's Jev (a decision/classifier model, NOT a text
   generator) is asked `choice` questions over a plain-text description of
   each sampled frame: is the layout clean, or is something overlapping /
   off-screen / too dense?  POST https://api.typesafe.ai/v1/systemone,
   model=jev-latest. Needs JEV_API_KEY (console.typesafe.ai -> Keys).

Jev never sees pixels - it judges the structured frame map as text.
"""
import json
import os

FRAME_W, FRAME_H = 1920, 1080
SAFE = (80, 80, 1840, 900)  # x0, y0, x1, y1 - captions own everything below
TEXT_KINDS = {"headline", "sub", "bullet", "eyebrow", "pill", "callout",
              "checkrow", "word", "review"}


def _overlap(a, b):
    x0, y0 = max(a[0], b[0]), max(a[1], b[1])
    x1, y1 = min(a[2], b[2]), min(a[3], b[3])
    return max(0, x1 - x0) * max(0, y1 - y0)


class LocalVerifier:
    """Exact geometry checks. Returns a list of issue strings."""

    def __init__(self, cfg):
        self.cfg = cfg

    def run(self, framemaps):
        issues = []
        for fm_i, fm in enumerate(framemaps):
            by_tag = {}
            for tag, kind, label, box in fm.entries:
                by_tag.setdefault(tag, []).append((kind, label, box))
            for tag, els in by_tag.items():
                issues += self._check_frame(fm_i, tag, els)
        return issues

    def _check_frame(self, fm_i, tag, els):
        issues = []
        x0, y0, x1, y1 = SAFE
        for kind, label, box in els:
            bx0, by0, bx1, by1 = box
            if bx0 < 0 or by0 < 0 or bx1 > FRAME_W or by1 > FRAME_H:
                issues.append(
                    f"[local] scene {fm_i} {tag}: '{label}' ({kind}) "
                    f"is off-frame at {box}")
            if kind in TEXT_KINDS and (bx0 < x0 or by0 < y0 or bx1 > x1 or by1 > y1):
                # caption is allowed in the bottom zone; everything else is not
                if kind != "caption":
                    issues.append(
                        f"[local] scene {fm_i} {tag}: '{label}' ({kind}) "
                        f"leaves the safe area at {box}")
            if kind == "caption" and by0 < 900:
                issues.append(
                    f"[local] scene {fm_i} {tag}: caption intrudes above y=900")
        # pairwise text overlap on the same sampled frame
        for i in range(len(els)):
            for j in range(i + 1, len(els)):
                ki, li, bi = els[i]
                kj, lj, bj = els[j]
                if ki in TEXT_KINDS and kj in TEXT_KINDS and ki != "caption" \
                        and kj != "caption":
                    area = _overlap(bi, bj)
                    smaller = min((bi[2] - bi[0]) * (bi[3] - bi[1]),
                                  (bj[2] - bj[0]) * (bj[3] - bj[1]))
                    if smaller > 0 and area / smaller > 0.25:
                        issues.append(
                            f"[local] scene {fm_i} {tag}: '{li}' overlaps "
                            f"'{lj}' ({int(area / smaller * 100)}%)")
        return issues


# ---------------- Jev AI ----------------

JEV_QUESTION = (
    "You are a video layout QA judge. Below is a structured map of one "
    "rendered video frame: every on-screen element with its kind and pixel "
    "bounding box on a 1920x1080 canvas. Text must stay inside x80-1840 / "
    "y80-900 (captions own the bottom), text elements must not overlap each "
    "other, and a scene should not cram more than ~40 words on screen. "
    "Which verdict fits best?"
)
JEV_CRITERIA = ["clean", "text_overlap", "text_offscreen",
                "too_dense", "caption_intrusion"]


def _find(obj, keys):
    """Flexibly dig a value out of a Jev JSON response."""
    if isinstance(obj, dict):
        for k in keys:
            if k in obj:
                return obj[k]
        for v in obj.values():
            r = _find(v, keys)
            if r is not None:
                return r
    elif isinstance(obj, list):
        for v in obj:
            r = _find(v, keys)
            if r is not None:
                return r
    return None


class JevVerifier:
    """Ask Jev `choice` questions over frame-map text."""

    def __init__(self, cfg):
        self.cfg = cfg
        self.key = os.environ.get("JEV_API_KEY", "").strip()
        self.url = cfg.get("jev_api_url",
                           "https://api.typesafe.ai/v1/systemone")
        self.model = cfg.get("jev_model", "jev-latest")
        self.gate = float(cfg.get("jev_confidence_gate", 0.45))

    @property
    def enabled(self):
        return bool(self.key)

    def _ask(self, frame_text):
        import requests
        header = os.environ.get("JEV_AUTH_HEADER", "Authorization")
        scheme = os.environ.get("JEV_AUTH_SCHEME", "Bearer")
        payload = {
            "model": self.model,
            "state": frame_text,
            "questions": [{
                "type": "choice",
                "question": JEV_QUESTION,
                "criteria": JEV_CRITERIA,
                "none": True,
            }],
        }
        r = requests.post(
            self.url,
            headers={header: f"{scheme} {self.key}",
                     "Content-Type": "application/json"},
            json=payload, timeout=60)
        r.raise_for_status()
        return r.json()

    def run(self, layout_name, framemaps):
        """Return (issues, notes). Never raises - failures become notes."""
        if not self.enabled:
            return [], ["jev: skipped (no JEV_API_KEY in .env)"]
        issues, notes = [], []
        for fm_i, fm in enumerate(framemaps):
            by_tag = {}
            for tag, kind, label, box in fm.entries:
                by_tag.setdefault(tag, []).append((tag, kind, label, box))
            for tag in sorted(by_tag):
                desc = (f"Layout: {layout_name}. Frame: scene {fm_i} {tag}.\n"
                        f"Elements:\n{fm.describe()}")
                try:
                    resp = self._ask(desc)
                    verdict = _find(resp, ["choice", "selected", "answer",
                                           "label", "result", "verdict"])
                    conf = _find(resp, ["confidence", "top_probability",
                                        "probability", "score"])
                    try:
                        conf = float(conf) if conf is not None else 0.0
                    except (TypeError, ValueError):
                        conf = 0.0
                    if verdict in (None, "", "none"):
                        notes.append(
                            f"jev: scene {fm_i} {tag}: no verdict "
                            f"(raw: {json.dumps(resp)[:160]})")
                    elif conf < self.gate:
                        notes.append(
                            f"jev: scene {fm_i} {tag}: '{verdict}' below "
                            f"confidence gate ({conf:.2f}) - review manually")
                    elif verdict != "clean":
                        issues.append(
                            f"[jev] scene {fm_i} {tag}: verdict '{verdict}' "
                            f"(confidence {conf:.2f})")
                    # 'clean' with good confidence: nothing to report
                except Exception as e:  # noqa: BLE001
                    notes.append(f"jev: scene {fm_i} {tag}: call failed: {e}")
                    break  # don't hammer a failing endpoint
        return issues, notes


def run_all(layout_name, framemaps, cfg):
    """Run both verifiers. Returns (issues, notes)."""
    issues = LocalVerifier(cfg).run(framemaps)
    notes = []
    jv = JevVerifier(cfg)
    jissues, jnotes = jv.run(layout_name, framemaps)
    return issues + jissues, notes + jnotes
