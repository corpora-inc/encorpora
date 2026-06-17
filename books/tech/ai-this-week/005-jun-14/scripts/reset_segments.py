#!/usr/bin/env python3
"""Reset given segment IDs to PENDING in pipeline_state_<lang>.json so
`ttsctl generate` regenerates only those (scoped concept-swap re-gen).
Usage: reset_segments.py <pack> <lang> <id1> <id2> ...
"""
import json, sys
from pathlib import Path
pack, lang, ids = Path(sys.argv[1]), sys.argv[2], sys.argv[3:]
p = pack / f"pipeline_state_{lang}.json"
d = json.loads(p.read_text())
n = 0
for i in ids:
    if i in d:
        d[i]["status"] = "PENDING"; d[i]["error"] = None
        d[i]["validation_errors"] = []; d[i]["retry_count"] = 0
        n += 1
p.write_text(json.dumps(d, indent=2, ensure_ascii=False))
print(f"[{lang}] reset {n}/{len(ids)} segments to PENDING")
