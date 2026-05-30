#!/usr/bin/env python3
"""Merge re-translated concept segments (temp pack) into the real
segments_<lang>.json, replacing those ids WHOLESALE. The new concept block
has a different host/analyst rhythm than the old one, so speaker_id,
tts.speaker_id, pause_after_ms, text and tts.text all come from the freshly
translated temp segment (self-consistent with the regenerated English).
Guards against passthrough (segment left byte-equal to English).
Usage: merge_concept.py <real_pack> <temp_pack> <lang>
"""
import json, sys
from pathlib import Path
real, temp, lang = Path(sys.argv[1]), Path(sys.argv[2]), sys.argv[3]
rp = real / f"segments_{lang}.json"
rd = json.loads(rp.read_text())
td = {s["id"]: s for s in json.loads((temp / f"segments_{lang}.json").read_text())["segments"]}
en = {s["id"]: s for s in json.loads((temp / "segments.json").read_text())["segments"]}
# passthrough check: any translated concept segment byte-equal to English?
bad = [i for i in td if en[i]["text"].strip() == td[i]["text"].strip()]
if bad:
    sys.exit(f"PASSTHROUGH in {lang}: {bad}")
n = 0
for idx, s in enumerate(rd["segments"]):
    t = td.get(s["id"])
    if t:
        rd["segments"][idx] = t   # wholesale replace (new structure + translation)
        n += 1
assert n == len(td), f"expected {len(td)} merges, did {n}"
rp.write_text(json.dumps(rd, indent=2, ensure_ascii=False))
print(f"[{lang}] merged {n} concept segments (wholesale), 0 passthrough")
