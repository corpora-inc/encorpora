#!/usr/bin/env python3
"""Print segment IDs whose first-word start_ms (per audio_manifest) exceeds
THRESHOLD_MS — i.e. segments with excessive Gemini leading dead-air, often
indicating the onset of the first word was clipped (the "Exactly" -> "...AC-tly"
pattern). Output: space-separated ids on stdout, or empty if none.

Usage: find_leading_silence.py <pack> <lang> <threshold_ms>
"""
import json, sys
from pathlib import Path
pack, lang = Path(sys.argv[1]), sys.argv[2]
th = int(sys.argv[3]) if len(sys.argv) > 3 else 400
m = json.loads((pack / f"audio_manifest_{lang}.json").read_text())["segments"]
bad = []
for sid, s in m.items():
    w = s.get("words", [])
    if not w:
        continue
    if w[0]["start_ms"] > th:
        bad.append((sid, w[0]["start_ms"]))
bad.sort(key=lambda x: -x[1])
print(" ".join(b[0] for b in bad))
