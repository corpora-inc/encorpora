#!/usr/bin/env python3
"""
Grind translation passes until EVERY pack has EVERY supported lang at full
phrase count. Loops at most N rounds; per-round runs incremental_translate
on every short lang of every short pack in parallel.

Use this when ship_v0_2_0.py left holes (e.g. timeouts on the biggest
DEEP packs) and you need to converge to 100% coverage before rebuild +
republish.
"""

from __future__ import annotations

import argparse
import json
import subprocess
import sys
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

HERE = Path(__file__).parent.resolve()
PY = "/home/skyl/tts_venv/bin/python"
LOG_DIR = Path("/tmp/resume-until-done-logs")
LOG_DIR.mkdir(exist_ok=True)

sys.path.insert(0, str(HERE))
from facets import TIER
from gemini_translate import ALL_LANGS


def pack_dir(pack_id: str) -> Path:
    if pack_id == "phrase-botany-basics":
        return HERE / "example-botany"
    return HERE / pack_id


def audit() -> dict[str, list[str]]:
    """Return {pack_id: [short_langs]} for all packs with any incomplete lang."""
    result = {}
    for pid in sorted(TIER.keys()):
        pdir = pack_dir(pid)
        n_phrases = len(json.loads((pdir / "phrases.json").read_text()))
        short = []
        for lang in ALL_LANGS:
            f = pdir / "translations" / f"{lang}.json"
            n = 0
            if f.is_file():
                try: n = len(json.loads(f.read_text()))
                except Exception: n = 0
            if n < n_phrases:
                short.append(lang)
        if short:
            result[pid] = short
    return result


def run_translate(pack_id: str, langs: list[str]) -> tuple[str, int, str]:
    """Run incremental_translate for a specific set of langs in one pack."""
    pdir = pack_dir(pack_id)
    log = LOG_DIR / f"{pack_id}.log"
    cmd = [PY, str(HERE / "incremental_translate.py"), str(pdir),
           "--new-from", "0", "--vertex",
           "--langs", ",".join(langs),
           "--workers", str(min(len(langs), 17))]
    with open(log, "ab") as f:
        f.write(f"\n=== {time.strftime('%H:%M:%S')} round on {len(langs)} langs ===\n".encode())
        f.write(b"$ " + " ".join(cmd).encode() + b"\n")
        try:
            proc = subprocess.run(cmd, stdout=f, stderr=subprocess.STDOUT, timeout=1800)
            return (pack_id, proc.returncode, f"langs={len(langs)}")
        except subprocess.TimeoutExpired:
            f.write(b"\n[TIMEOUT 1800s]\n")
            return (pack_id, 124, f"TIMEOUT langs={len(langs)}")


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--max-rounds", type=int, default=8,
                    help="Stop after N rounds even if not converged.")
    ap.add_argument("--max-parallel", type=int, default=4,
                    help="Packs in flight at once.")
    ns = ap.parse_args()

    for round_n in range(1, ns.max_rounds + 1):
        gaps = audit()
        if not gaps:
            print(f"\n[round {round_n}] CONVERGED: all 24 packs at 51/51 langs")
            return 0
        total_lang_slots = sum(len(v) for v in gaps.values())
        print(f"\n[round {round_n}] {len(gaps)} packs short; {total_lang_slots} lang-slots to fill")
        for pid, langs in sorted(gaps.items()):
            short_preview = ",".join(langs[:8]) + ("..." if len(langs) > 8 else "")
            print(f"  {pid}: {len(langs)} short ({short_preview})")

        t0 = time.time()
        with ThreadPoolExecutor(max_workers=ns.max_parallel) as ex:
            futs = {ex.submit(run_translate, pid, langs): pid for pid, langs in gaps.items()}
            for fut in as_completed(futs):
                pid, rc, info = fut.result()
                print(f"    [{time.strftime('%H:%M:%S')}] {pid}: rc={rc} {info}")
        print(f"  round {round_n} done in {time.time() - t0:.0f}s")

    print(f"\n[FINAL] hit max-rounds={ns.max_rounds}; audit:")
    gaps = audit()
    for pid, langs in sorted(gaps.items()):
        print(f"  {pid}: {len(langs)} still short — {','.join(langs)}")
    return 1 if gaps else 0


if __name__ == "__main__":
    sys.exit(main())
