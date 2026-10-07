"""Assemble: PNG frames + narration MP3 -> per-scene MP4s -> final video.

ffmpeg pipeline with loudness normalization (no music, voice only).
Requires ffmpeg + ffprobe on PATH (setup.bat checks).
"""
import json
import os
import shutil
import subprocess


def _which(bin_name):
    p = shutil.which(bin_name)
    if not p:
        raise RuntimeError(
            f"'{bin_name}' not found on PATH. Install ffmpeg "
            "(winget install Gyan.FFmpeg) and reopen the terminal.")
    return p


def audio_duration(path):
    """Seconds, via ffprobe (fallback: rough words estimate)."""
    try:
        _which("ffprobe")
        out = subprocess.run(
            ["ffprobe", "-v", "quiet", "-print_format", "json",
             "-show_format", path],
            capture_output=True, text=True, check=True, timeout=30)
        return float(json.loads(out.stdout)["format"]["duration"])
    except Exception:  # noqa: BLE001
        return 0.0


def scene_video(frames_dir, audio_path, out_path, fps):
    _which("ffmpeg")
    cmd = ["ffmpeg", "-y",
           "-framerate", str(fps), "-i",
           os.path.join(frames_dir, "f_%05d.png"),
           "-i", audio_path,
           "-c:v", "libx264", "-preset", "medium", "-crf", "20",
           "-pix_fmt", "yuv420p",
           "-c:a", "aac", "-b:a", "160k",
           "-shortest", out_path]
    subprocess.run(cmd, check=True, capture_output=True)


def concat(videos, out_path):
    _which("ffmpeg")
    lst = out_path + ".txt"
    with open(lst, "w") as f:
        for v in videos:
            f.write(f"file '{os.path.abspath(v)}'\n")
    subprocess.run(["ffmpeg", "-y", "-f", "concat", "-safe", "0",
                    "-i", lst, "-c", "copy", out_path],
                   check=True, capture_output=True)
    os.remove(lst)


def loudnorm(src, dst):
    """Single-pass loudness normalization, video stream copied."""
    _which("ffmpeg")
    subprocess.run(["ffmpeg", "-y", "-i", src,
                    "-af", "loudnorm=I=-16:TP=-1.5:LRA=11",
                    "-c:v", "copy", "-c:a", "aac", "-b:a", "160k", dst],
                   check=True, capture_output=True)


def thumbnail(video, out_path, at=2.0):
    try:
        subprocess.run(["ffmpeg", "-y", "-ss", str(at), "-i", video,
                        "-vframes", "1", "-q:v", "3", out_path],
                       check=True, capture_output=True)
    except Exception:  # noqa: BLE001
        pass


def assemble(scene_jobs, final_path, cfg):
    """scene_jobs: [(frames_dir, audio_path)]. Builds final_path."""
    work = os.path.dirname(final_path)
    parts = []
    fps = int(cfg.get("fps", 30))
    for i, (frames_dir, audio) in enumerate(scene_jobs):
        part = os.path.join(work, f"_scene_{i:02d}.mp4")
        print(f"  assemble: scene {i}...")
        scene_video(frames_dir, audio, part, fps)
        parts.append(part)
    joined = os.path.join(work, "_joined.mp4")
    print("  assemble: concat...")
    concat(parts, joined)
    print("  assemble: loudness normalize...")
    loudnorm(joined, final_path)
    thumbnail(final_path, os.path.splitext(final_path)[0] + "_thumb.jpg")
    for p in parts + [joined]:
        try:
            os.remove(p)
        except OSError:
            pass
    print("  done:", final_path)
    return final_path
