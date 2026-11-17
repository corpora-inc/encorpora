#!/usr/bin/env python3
"""Encode one or more screencast captures (capture.json + frames/) into one
H.264 clip. Skipped sections are cut; still stretches longer than --max-still
are shortened. Run through heavy.py.

  encode.py OUT.mp4 CAPTURE_DIR [CAPTURE_DIR ...] [--fps 30] [--max-still 2.5]
"""
import argparse, json, os, subprocess, sys, tempfile

ap = argparse.ArgumentParser()
ap.add_argument("out")
ap.add_argument("captures", nargs="+")
ap.add_argument("--fps", type=int, default=30)
ap.add_argument("--max-still", type=float, default=2.5)
ap.add_argument("--crf", type=int, default=15)
ap.add_argument("--head", type=float, default=0.0, help="seconds to drop from the start of the first capture")
a = ap.parse_args()

entries = []  # (path, duration)
size = None
for ci, cdir in enumerate(a.captures):
    cap = json.load(open(os.path.join(cdir, "capture.json")))
    size = size or cap["out"]
    frames = sorted(cap["frames"], key=lambda f: f["t"])
    skips = sorted(cap["skips"])
    end = cap["end"]
    if not frames:
        continue
    # Place each frame on a timeline with skipped spans removed. Inside a
    # skip only the last frame survives, shown from the skip's end.
    kept = []  # (t_effective, file)
    for f in frames:
        t = f["t"]
        inside = next((s for s in skips if s[0] <= t < s[1]), None)
        if inside:
            if kept and kept[-1][2] == inside:
                kept[-1] = (inside[1], f["file"], inside)
            else:
                kept.append((inside[1], f["file"], inside))
        else:
            kept.append((t, f["file"], None))
    kept.sort(key=lambda k: k[0])

    def removed_before(t):
        r = 0.0
        for s0, s1 in skips:
            if s1 <= t:
                r += s1 - s0
            elif s0 < t:
                r += t - s0
        return r

    times = [k[0] - removed_before(k[0]) for k in kept]
    tend = end - removed_before(end)
    start = times[0] + (a.head if ci == 0 else 0)
    for i, k in enumerate(kept):
        t0 = times[i]
        t1 = times[i + 1] if i + 1 < len(kept) else tend
        if t1 <= start:
            continue
        t0 = max(t0, start)
        d = min(t1 - t0, a.max_still)
        if d > 0.0005:
            entries.append((os.path.abspath(os.path.join(cdir, "frames", k[1])), d))

w, h = size
with tempfile.NamedTemporaryFile("w", suffix=".txt", delete=False) as lst:
    for p, d in entries:
        lst.write(f"file '{p}'\nduration {d:.4f}\n")
    lst.write(f"file '{entries[-1][0]}'\n")
    listpath = lst.name
total = sum(d for _, d in entries)
vf = (f"scale={w}:{h}:force_original_aspect_ratio=decrease:flags=lanczos,"
      f"pad={w}:{h}:(ow-iw)/2:(oh-ih)/2:color=white,fps={a.fps},format=yuv420p")
cmd = ["ffmpeg", "-y", "-loglevel", "error", "-f", "concat", "-safe", "0", "-i", listpath,
       "-vf", vf, "-c:v", "libx264", "-preset", "slow", "-crf", str(a.crf),
       "-profile:v", "high", "-tune", "animation", "-movflags", "+faststart", "-an", "-t", f"{total:.3f}", a.out]
os.makedirs(os.path.dirname(os.path.abspath(a.out)), exist_ok=True)
rc = subprocess.call(cmd)
os.unlink(listpath)
print(json.dumps({"out": a.out, "seconds": round(total, 2), "frames_in": len(entries), "rc": rc}))
sys.exit(rc)
