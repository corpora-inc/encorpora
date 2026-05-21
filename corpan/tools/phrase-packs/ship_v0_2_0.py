#!/usr/bin/env python3
"""
Ship v0.2.0: translate new phrases, build, publish, invalidate.

Determines `new_from` per pack by reading the existing en.json length
(that's how many phrases were already translated before this expansion).
Skips translation if the en.json already covers the current phrase count.
"""

from __future__ import annotations

import json
import os
import subprocess
import sys
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

HERE = Path(__file__).parent.resolve()
PY = "/home/skyl/tts_venv/bin/python"
LOG_DIR = Path("/tmp/ship-v020-logs")
LOG_DIR.mkdir(exist_ok=True)

sys.path.insert(0, str(HERE))
from facets import TIER


def pack_dir_for(pack_id: str) -> Path:
    if pack_id == "phrase-botany-basics":
        return HERE / "example-botany"
    return HERE / pack_id


SENTINEL_LANGS = ("es", "fr", "ja", "zh-Hans")  # sample langs we check for completion


def _file_len(path: Path) -> int:
    if not path.is_file(): return 0
    try: return len(json.loads(path.read_text()))
    except Exception: return 0


def compute_new_from(pack_id: str) -> tuple[int, int, int]:
    """Returns (n_phrases, n_translations_existing, n_new). new_from is
    the index of the first phrase to translate.

    Marker = MIN coverage across en + sentinel langs. en alone is a bad
    marker because --write-en writes en eagerly before the rest of the
    51 langs finish — so a killed run leaves en at full count while most
    langs are still empty. We take the min across en + a few sentinel
    langs to detect this incomplete state."""
    pdir = pack_dir_for(pack_id)
    phrases = json.loads((pdir / "phrases.json").read_text())
    n_phrases = len(phrases)
    en_len = _file_len(pdir / "translations" / "en.json")
    sentinel_lens = [_file_len(pdir / "translations" / f"{l}.json") for l in SENTINEL_LANGS]
    # Coverage = min across en + sentinels. If any sentinel is empty (0)
    # we treat the whole pack as needing translation from new_from = the
    # min of en and existing sentinels (won't be all 0 unless truly fresh).
    nonzero_sentinels = [s for s in sentinel_lens if s > 0]
    if not nonzero_sentinels:
        coverage = 0
    else:
        coverage = min([en_len] + nonzero_sentinels)
    return (n_phrases, coverage, n_phrases - coverage)


def run(cmd: list[str], log_path: Path, timeout: int | None = None) -> int:
    with open(log_path, "ab") as f:
        f.write(b"\n$ " + " ".join(cmd).encode() + b"\n")
        try:
            proc = subprocess.run(cmd, stdout=f, stderr=subprocess.STDOUT, timeout=timeout)
            return proc.returncode
        except subprocess.TimeoutExpired:
            f.write(b"\n[TIMEOUT after %ds]\n" % (timeout or 0))
            return 124


def translate_pack(pack_id: str, new_from: int) -> tuple[str, int]:
    pdir = pack_dir_for(pack_id)
    log = LOG_DIR / f"{pack_id}.translate.log"
    # Tuned for the v0.2.0 data volume: 800 phrases × 51 langs per pack.
    # Pass 1: 51 workers (one per lang) so all 51 langs run in parallel.
    #   Each lang sequentially walks its chunks (8 × ~45s for romanized
    #   scripts at 800 phrases). One round ≈ 6 min per pack.
    # Pass 2/3: lower concurrency to ride out 429s with extra headroom.
    rc = run([PY, str(HERE / "incremental_translate.py"), str(pdir),
              "--new-from", str(new_from), "--vertex", "--write-en",
              "--workers", "51"], log, timeout=3600)
    rc = run([PY, str(HERE / "incremental_translate.py"), str(pdir),
              "--new-from", str(new_from), "--vertex", "--write-en",
              "--workers", "17"], log, timeout=1800)
    rc = run([PY, str(HERE / "incremental_translate.py"), str(pdir),
              "--new-from", str(new_from), "--vertex", "--write-en",
              "--workers", "6"], log, timeout=900)
    return (pack_id, rc)


def build_pack(pack_id: str) -> int:
    pdir = pack_dir_for(pack_id)
    log = LOG_DIR / f"{pack_id}.build.log"
    return run([PY, str(HERE / "build_phrase_pack.py"), str(pdir)],
               log, timeout=120)


def publish_pack(pack_id: str) -> int:
    pdir = pack_dir_for(pack_id)
    build_dir = pdir / "build"
    log = LOG_DIR / f"{pack_id}.publish.log"
    return run([PY, str(HERE / "publish.py"), str(build_dir),
                "--upload", "--update-catalog",
                "--profile", "corpan-publisher"],
               log, timeout=300)


def main() -> int:
    pack_ids = sorted(TIER.keys())

    print("==> PHASE 0: COMPUTE new_from PER PACK")
    plan: dict[str, int] = {}
    for pid in pack_ids:
        n_phrases, n_en, n_new = compute_new_from(pid)
        plan[pid] = n_en
        marker = "NEW" if n_new > 0 else "up-to-date"
        print(f"  {pid:<45} {n_en:>3} translated, {n_phrases:>3} authored, +{n_new:>3} {marker}")

    print(f"\n==> PHASE 1: TRANSLATE (parallel 3 packs × 17 langs)")
    BATCH = 3
    to_translate = [(pid, plan[pid]) for pid in pack_ids if plan[pid] < compute_new_from(pid)[0]]
    for i in range(0, len(to_translate), BATCH):
        batch = to_translate[i:i+BATCH]
        print(f"  Batch ({i//BATCH+1}/{(len(to_translate) + BATCH - 1)//BATCH}): "
              f"{' '.join(p for p, _ in batch)}")
        with ThreadPoolExecutor(max_workers=BATCH) as ex:
            futs = {ex.submit(translate_pack, pid, nf): pid for pid, nf in batch}
            for fut in futs:
                pid, rc = fut.result()
                print(f"    [translate rc={rc}] {pid}")

    print(f"\n==> PHASE 2: BUILD (sequential)")
    for pid in pack_ids:
        rc = build_pack(pid)
        marker = "✓" if rc == 0 else "✗"
        print(f"  {marker} build {pid} (rc={rc})")

    print(f"\n==> PHASE 3: PUBLISH (sequential — catalog upsert NOT parallel-safe)")
    for pid in pack_ids:
        pdir = pack_dir_for(pid)
        if not (pdir / "build").is_dir():
            print(f"  [SKIP] {pid}: no build/ dir")
            continue
        rc = publish_pack(pid)
        marker = "✓" if rc == 0 else "✗"
        print(f"  {marker} publish {pid} (rc={rc})")

    print(f"\n==> PHASE 4: INVALIDATE CDN + curation refresh")
    rc = run([PY, str(HERE / "publish.py"),
              "--update-curation", str(HERE / "curation.json"),
              "--invalidate",
              "--distribution-id", "E1RDNUCVE70SCI",
              "--profile", "corpan-publisher"],
             LOG_DIR / "curation.log", timeout=120)
    print(f"  invalidate rc={rc}")

    print(f"\n==> DONE. Logs at {LOG_DIR}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
