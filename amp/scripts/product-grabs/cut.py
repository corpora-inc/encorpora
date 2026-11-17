#!/usr/bin/env python3
"""Remove time ranges from an encoded clip (re-encodes once, same settings).
  cut.py IN.mp4 OUT.mp4 A-B [A-B ...]   (seconds, output of encode.py)"""
import subprocess, sys
src, out, *ranges = sys.argv[1:]
spans = [tuple(map(float, r.split("-"))) for r in ranges]
cond = "+".join(f"between(t,{a},{b})" for a, b in spans)
vf = f"select='not({cond})',setpts=N/30/TB,fps=30,format=yuv420p"
subprocess.check_call(["ffmpeg", "-y", "-loglevel", "error", "-i", src, "-vf", vf, "-c:v", "libx264", "-preset", "slow",
                       "-crf", "15", "-profile:v", "high", "-tune", "animation", "-movflags", "+faststart", "-an", out])
d = subprocess.check_output(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", out]).decode().strip()
print(out, d)
