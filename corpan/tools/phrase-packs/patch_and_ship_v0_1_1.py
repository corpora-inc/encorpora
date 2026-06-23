#!/usr/bin/env python3
"""
Apply patches_v0_1_1.py to every pack, translate the new phrases via
incremental_translate.py, build, and publish.

Order of operations (per pack):
  1. Read pack.json + phrases.json
  2. Append PATCHES[id] to phrases.json (in-place)
  3. Bump pack.json version 0.1.0 -> 0.1.1
  4. Prepend a [0.1.1] section to CHANGELOG.md
  5. Run incremental_translate.py (54 langs, parallel)
  6. Build SQLite
  7. Publish (sequential at the orchestrator level — catalog isn't parallel-safe)

Translation/build are parallelized at the per-pack level (3 packs at a time).
Publish is serialized.
"""

from __future__ import annotations

import json
import os
import subprocess
import sys
from concurrent.futures import ThreadPoolExecutor
from datetime import date
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from patches_v0_1_1 import PATCHES

HERE = Path(__file__).parent.resolve()
PY = "/home/skyl/tts_venv/bin/python"
# -u: unbuffered stdout so master log shows progress in real time
PY_U = [PY, "-u"]
LOG_DIR = Path("/tmp/patch-v011-logs")
LOG_DIR.mkdir(exist_ok=True)


def pack_dir_for(pack_id: str) -> Path:
    """Map pack_id to local source dir. Most match by name; botany is an exception."""
    if pack_id == "phrase-botany-basics":
        return HERE / "example-botany"
    return HERE / pack_id


def apply_patch(pack_id: str, new_phrases: list[dict]) -> tuple[int, int]:
    """Append new phrases, bump version, update CHANGELOG. Returns (new_from, n_new).
    Idempotent: if pack already at 0.1.1 and tail matches, returns the existing offsets."""
    pdir = pack_dir_for(pack_id)
    phrases_path = pdir / "phrases.json"
    pack_meta_path = pdir / "pack.json"
    changelog_path = pdir / "CHANGELOG.md"

    phrases = json.loads(phrases_path.read_text())
    meta = json.loads(pack_meta_path.read_text())

    # Idempotency: if version is already 0.1.1 and last N phrases match the patch tail, no-op.
    if meta.get("version") == "0.1.1" and len(phrases) >= len(new_phrases):
        tail = phrases[-len(new_phrases):]
        if all(t.get("english") == p["english"] and t.get("level") == p["level"]
               for t, p in zip(tail, new_phrases)):
            new_from = len(phrases) - len(new_phrases)
            return (new_from, len(new_phrases))

    new_from = len(phrases)
    phrases.extend(new_phrases)
    phrases_path.write_text(json.dumps(phrases, ensure_ascii=False, indent=2) + "\n")

    meta["version"] = "0.1.1"
    pack_meta_path.write_text(json.dumps(meta, ensure_ascii=False, indent=2) + "\n")

    # CHANGELOG: prepend [0.1.1] before the first existing [x.y.z] section
    cl_text = changelog_path.read_text() if changelog_path.is_file() else ""
    if "## [0.1.1]" in cl_text:
        return (new_from, len(new_phrases))
    added_levels = ", ".join(sorted({p["level"] for p in new_phrases}))
    added_lines = "\n".join(f"  - {p['level']}: \"{p['english']}\"" for p in new_phrases)
    today = date.today().isoformat()
    new_section = (
        f"## [0.1.1] - {today}\n"
        f"### Added\n"
        f"- Ladder-completion pass: ensure at least one phrase at every CEFR\n"
        f"  level (A0..C2). Added {len(new_phrases)} phrase(s) at level(s) {added_levels}.\n"
        f"{added_lines}\n\n"
    )
    if "## [Unreleased]" in cl_text:
        # insert after Unreleased section header (and its blank line)
        idx = cl_text.find("## [Unreleased]")
        # find the next "## [" after it; insert before that
        next_section = cl_text.find("\n## [", idx + 1)
        if next_section == -1:
            # No prior versioned section, append at end
            cl_text = cl_text.rstrip() + "\n\n" + new_section
        else:
            cl_text = cl_text[:next_section + 1] + new_section + cl_text[next_section + 1:]
    else:
        cl_text = cl_text.rstrip() + "\n\n" + new_section
    changelog_path.write_text(cl_text)

    return (new_from, len(new_phrases))


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
    # Two passes: parallel + retry for transient 429s. Hard wall-clock cap
    # of 180s per pass — Vertex calls for 1-4 phrases are normally <10s,
    # but the SDK occasionally hangs forever. Better to kill + retry.
    rc1 = run([PY, str(HERE / "incremental_translate.py"), str(pdir),
               "--new-from", str(new_from), "--vertex", "--write-en",
               "--workers", "17"], log, timeout=180)
    rc2 = run([PY, str(HERE / "incremental_translate.py"), str(pdir),
               "--new-from", str(new_from), "--vertex", "--write-en",
               "--workers", "6"], log, timeout=180)
    rc3 = run([PY, str(HERE / "incremental_translate.py"), str(pdir),
               "--new-from", str(new_from), "--vertex", "--write-en",
               "--workers", "3"], log, timeout=180)
    return (pack_id, rc3)


def build_pack(pack_id: str) -> int:
    pdir = pack_dir_for(pack_id)
    log = LOG_DIR / f"{pack_id}.build.log"
    return run([PY, str(HERE / "build_phrase_pack.py"), str(pdir)], log)


def publish_pack(pack_id: str) -> int:
    pdir = pack_dir_for(pack_id)
    build_dir = pdir / "build"
    log = LOG_DIR / f"{pack_id}.publish.log"
    return run([PY, str(HERE / "publish.py"), str(build_dir),
                "--upload", "--update-catalog",
                "--profile", "corpan-publisher"], log)


def main() -> int:
    pack_ids = sorted(PATCHES.keys())
    print(f"==> PHASE 0: APPLY PATCHES (in-place file edits)")
    new_from_by_id: dict[str, int] = {}
    for pid in pack_ids:
        new_from, n = apply_patch(pid, PATCHES[pid])
        new_from_by_id[pid] = new_from
        print(f"  {pid:<45}  {new_from} existing + {n} new -> v0.1.1")

    print(f"\n==> PHASE 1: TRANSLATE new phrases (3 packs parallel, 17 langs in flight per pack)")
    BATCH = 3
    for i in range(0, len(pack_ids), BATCH):
        batch = pack_ids[i:i+BATCH]
        print(f"  Batch ({i//BATCH+1}/{(len(pack_ids) + BATCH - 1)//BATCH}): {' '.join(batch)}")
        with ThreadPoolExecutor(max_workers=BATCH) as ex:
            futs = {ex.submit(translate_pack, pid, new_from_by_id[pid]): pid for pid in batch}
            for fut in futs:
                pid, rc = fut.result()
                print(f"    [translate rc={rc}] {pid}")

    print(f"\n==> PHASE 2: BUILD (sequential)")
    for pid in pack_ids:
        rc = build_pack(pid)
        marker = "✓" if rc == 0 else "✗"
        print(f"  {marker} build {pid} (rc={rc})")

    print(f"\n==> PHASE 3: PUBLISH (sequential — catalog upsert is NOT parallel-safe)")
    for pid in pack_ids:
        pdir = pack_dir_for(pid)
        if not (pdir / "build").is_dir():
            print(f"  [SKIP] {pid}: no build/ dir")
            continue
        rc = publish_pack(pid)
        marker = "✓" if rc == 0 else "✗"
        print(f"  {marker} publish {pid} (rc={rc})")

    print(f"\n==> PHASE 4: INVALIDATE CDN")
    rc = run([PY, str(HERE / "publish.py"),
              "--update-curation", str(HERE / "curation.json"),
              "--invalidate",
              "--distribution-id", "E1RDNUCVE70SCI",
              "--profile", "corpan-publisher"],
             LOG_DIR / "curation.log")
    print(f"  invalidate rc={rc}")

    print(f"\n==> DONE. Logs at {LOG_DIR}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
