#!/usr/bin/env python3
"""Contact sheet: N evenly spaced frames of a clip, tiled with timestamps.
  contact.py CLIP.mp4 OUT.jpg [--n 12] [--cols 6]"""
import argparse, json, subprocess, os, tempfile
from PIL import Image, ImageDraw, ImageFont
ap = argparse.ArgumentParser(); ap.add_argument("clip"); ap.add_argument("out")
ap.add_argument("--n", type=int, default=12); ap.add_argument("--cols", type=int, default=6)
ap.add_argument("--width", type=int, default=360)
a = ap.parse_args()
dur = float(json.loads(subprocess.check_output(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "json", a.clip]))["format"]["duration"])
tmp = tempfile.mkdtemp()
tiles = []
for i in range(a.n):
    t = dur * (i + 0.5) / a.n
    p = os.path.join(tmp, f"{i}.png")
    subprocess.check_call(["ffmpeg", "-loglevel", "error", "-y", "-ss", f"{t:.2f}", "-i", a.clip, "-frames:v", "1", "-vf", f"scale={a.width}:-2", p])
    tiles.append((t, Image.open(p).convert("RGB")))
w, h = tiles[0][1].size
cols = min(a.cols, a.n); rows = (a.n + cols - 1) // cols
sheet = Image.new("RGB", (cols * (w + 8) + 8, rows * (h + 30) + 8), (30, 30, 30))
d = ImageDraw.Draw(sheet)
try: font = ImageFont.truetype("/System/Library/Fonts/Helvetica.ttc", 18)
except Exception: font = None
for i, (t, im) in enumerate(tiles):
    x = 8 + (i % cols) * (w + 8); y = 8 + (i // cols) * (h + 30)
    sheet.paste(im, (x, y + 22)); d.text((x, y), f"{t:5.1f}s", fill=(255, 255, 255), font=font)
sheet.save(a.out, quality=88)
print(a.out, f"{dur:.1f}s")
