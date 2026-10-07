#!/usr/bin/env python3
"""LMSGEN Video Studio renderer (manifest-driven).

Invoked by the Node job handler, NOT by users directly:

    python3 render_cli.py /tmp/vs-xxx/manifest.json

Manifest format:
{
  "layout": "linkedin" | "innvikta" | "course" | "kinetic" | "cinematic",
  "fps": 30,
  "tail_seconds": 0.8,
  "logo": "/path/logo.png" | null,
  "scenes": [
    {"kind": "...", "headline": "...", "highlight": "...", "sub": "...",
     "bullets": [...], "narration": "...",
     "audio": "/path/scene_00.mp3",          # TTS voiceover (Node-generated)
     "image": "/path/scene_00.png"},         # hero art (Node-generated/uploaded)
    ...
  ],
  "workdir": "/tmp/vs-xxx/work",             # frames + scene mp4s
  "out": "/tmp/vs-xxx/video.mp4"             # final loudness-normalized MP4
}

Progress is printed as JSON lines to stdout:
  {"type":"progress","percent":42,"stage":"render","detail":"scene 2/5"}
  {"type":"result","video":"/tmp/vs-xxx/video.mp4","seconds":61.2}

Requires: python3, Pillow, numpy, ffmpeg + ffprobe on PATH.
"""
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from forge import assemble, verify
from forge.render import linkedin, innvikta, course, kinetic, cinematic

LAYOUTS = {
    "linkedin": linkedin,
    "innvikta": innvikta,
    "course": course,
    "kinetic": kinetic,
    "cinematic": cinematic,
}


def emit(obj):
    print(json.dumps(obj), flush=True)


def main():
    if len(sys.argv) != 2:
        print("usage: render_cli.py manifest.json", file=sys.stderr)
        sys.exit(2)
    with open(sys.argv[1], encoding="utf-8") as f:
        mf = json.load(f)

    layout = mf.get("layout", "linkedin")
    if layout not in LAYOUTS:
        raise SystemExit(f"unknown layout: {layout}")
    mod = LAYOUTS[layout]
    fps = int(mf.get("fps", 30))
    tail = float(mf.get("tail_seconds", 0.8))
    workdir = mf["workdir"]
    frames_root = os.path.join(workdir, "frames")
    os.makedirs(frames_root, exist_ok=True)
    logo = mf.get("logo")
    if logo and not os.path.exists(logo):
        logo = None

    scenes = mf["scenes"]
    n = len(scenes)
    jobs = []
    framemaps = []
    total = 0.0
    for i, scene in enumerate(scenes):
        emit({"type": "progress", "percent": int(5 + 55 * i / n),
              "stage": "render", "detail": f"scene {i + 1}/{n}"})
        audio = scene.get("audio")
        dur = assemble.audio_duration(audio) if audio else 0
        if not dur:
            raise SystemExit(f"scene {i}: missing/unreadable audio: {audio}")
        scene_dur = dur + tail
        total += scene_dur
        frames_dir = os.path.join(frames_root, f"scene_{i:02d}")
        assets = {"hero": scene.get("image"), "logo": logo, "scene_idx": i}
        framemaps.append(mod.render_scene(scene, scene_dur, assets, frames_dir,
                                          {"fps": fps}))
        jobs.append((frames_dir, audio))

    # local geometry verification (Jev runs too when JEV_API_KEY is set)
    emit({"type": "progress", "percent": 65, "stage": "verify",
          "detail": "checking layout geometry"})
    issues, notes = verify.run_all(layout, framemaps, {})
    if issues:
        for issue in issues[:10]:
            emit({"type": "warning", "stage": "verify", "detail": issue})
    emit({"type": "progress", "percent": 68, "stage": "verify",
          "detail": f"geometry checked ({len(issues)} issues)"})

    emit({"type": "progress", "percent": 70, "stage": "assemble",
          "detail": "encoding scenes"})
    # forge.assemble prints human logs to stdout; keep stdout pure JSON-lines.
    import contextlib
    import io as _io
    out = mf["out"]
    with contextlib.redirect_stdout(_io.StringIO()):
        final_path = assemble.assemble(jobs, out, {"fps": fps})
    emit({"type": "progress", "percent": 95, "stage": "assemble",
          "detail": "done"})
    emit({"type": "result", "video": final_path, "seconds": round(total, 1)})


if __name__ == "__main__":
    main()
