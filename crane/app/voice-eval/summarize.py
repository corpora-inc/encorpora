"""Summarize run-eval.py results as a Markdown table.

    python3 -I summarize.py results.json [more.json ...] > summary.md

One row per model and prompt setting; one column group per noise condition.
Key-term accuracy is the share of the items' key terms recognized (higher is
better); WER is word error rate against the reference (lower is better);
commands is exact matches for the four procedure words; latency is the median
(p90) of whisper's processing time per question with the model warm, 4 threads.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

runs = [r for f in sys.argv[1:] for r in json.loads(Path(f).read_text())["runs"]]
conds = [c for c in ("clean", "snr10", "snr5") if any(r["condition"] == c for r in runs)]
size = {}
models_dir = Path(__file__).resolve().parent / "models"
for r in runs:
    p = models_dir / r["model"]
    size[r["model"]] = p.stat().st_size if p.exists() else None

keys = sorted({(r["model"], r["prompt"]) for r in runs}, key=lambda k: (k[0], k[1]))
head = ["model", "prompt"] + [f"{c} terms / WER" for c in conds] + ["commands (snr10)", "latency ms (snr10)"]
print("| " + " | ".join(head) + " |")
print("|" + "---|" * len(head))
for model, prompt in keys:
    cells = [model.replace("ggml-", "").replace(".bin", ""), "crane" if prompt else "none"]
    byc = {r["condition"]: r for r in runs if r["model"] == model and r["prompt"] == prompt}
    for c in conds:
        r = byc.get(c)
        cells.append(f"{r['key_term_accuracy'] * 100:.1f}% / {r['wer'] * 100:.1f}%" if r else "")
    r = byc.get("snr10")
    cells.append(f"{r['commands'][0]}/{r['commands'][1]}" if r else "")
    lat = r and r.get("latency_ms")
    cells.append(f"{lat['median']} ({lat['p90']})" if lat else "")
    print("| " + " | ".join(cells) + " |")
