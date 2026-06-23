#!/usr/bin/env python3
"""
Flat-queue resume using CODEX CLI as the translation backend.

Identical work-queue + per-chunk persistence pattern to resume_flat.py,
but each chunk translation is shelled to `codex exec --sandbox read-only`
instead of going through the Vertex SDK. Codex Pro has no per-second
throttle so we can run far more concurrently without 429 storms.

Loops at most --max-rounds; converges when every (pack, lang) tuple has
a contiguous translations/<lang>.json of length pack.entryCount.
"""

from __future__ import annotations

import argparse
import json
import re
import subprocess
import sys
import threading
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

HERE = Path(__file__).parent.resolve()
sys.path.insert(0, str(HERE))

from facets import TIER
from gemini_translate import ALL_LANGS, build_prompt   # reuse the prompt builder


def pack_dir(pack_id: str) -> Path:
    if pack_id == "phrase-botany-basics":
        return HERE / "example-botany"
    return HERE / pack_id


_ASSISTANT_RE = re.compile(
    r"\ncodex\n(?P<body>.*?)(?=\n(?:tokens used|user|codex)\n|\Z)",
    re.DOTALL,
)


def extract_assistant_text(stdout: str) -> str:
    matches = list(_ASSISTANT_RE.finditer(stdout))
    return matches[-1].group("body").strip() if matches else stdout.strip()


def parse_json_relaxed(text: str):
    text = text.strip()
    if text.startswith("```"):
        text = re.sub(r"^```[a-zA-Z]*\n?", "", text)
        text = re.sub(r"\n?```\s*$", "", text)
        text = text.strip()
    start = next((i for i, ch in enumerate(text) if ch in "{["), -1)
    if start == -1:
        raise ValueError("no JSON")
    return json.JSONDecoder().raw_decode(text[start:])[0]


def call_codex(prompt: str, timeout_s: float = 300.0
               ) -> tuple[dict | None, str | None]:
    args = ["codex", "exec",
            "--sandbox", "read-only",
            "--skip-git-repo-check",
            "-c", "model_reasoning_effort=low",
            prompt]
    try:
        proc = subprocess.run(args, capture_output=True, text=True, timeout=timeout_s)
    except subprocess.TimeoutExpired:
        return (None, f"TIMEOUT:{timeout_s}s")
    if proc.returncode != 0:
        return (None, f"EXIT_{proc.returncode}: {proc.stderr[-200:]!r}")
    body = extract_assistant_text(proc.stdout)
    if not body:
        return (None, "EMPTY_BODY")
    try:
        data = parse_json_relaxed(body)
    except Exception as e:
        return (None, f"BAD_JSON: {e}")
    if not isinstance(data, dict):
        return (None, f"NOT_DICT:{type(data).__name__}")
    return (data, None)


def audit() -> list[tuple[str, str, int, int]]:
    """[(pid, lang, current_contiguous_count, target_count)] for shorts."""
    work = []
    for pid in sorted(TIER.keys()):
        pdir = pack_dir(pid)
        n_phrases = len(json.loads((pdir / "phrases.json").read_text()))
        for lang in ALL_LANGS:
            f = pdir / "translations" / f"{lang}.json"
            n = 0
            if f.is_file():
                try:
                    d = json.loads(f.read_text())
                    if isinstance(d, dict):
                        for i in range(len(d)):
                            if str(i) not in d:
                                n = i; break
                        else:
                            n = len(d)
                except Exception:
                    n = 0
            if n < n_phrases:
                work.append((pid, lang, n, n_phrases))
    return work


# Per-file lock so concurrent chunks for the same lang don't race.
_file_locks: dict[Path, threading.Lock] = {}
_file_locks_guard = threading.Lock()


def file_lock(path: Path) -> threading.Lock:
    with _file_locks_guard:
        if path not in _file_locks:
            _file_locks[path] = threading.Lock()
        return _file_locks[path]


def fill_unit(pack_id: str, lang: str, chunk_timeout: float
              ) -> tuple[str, str, str, int]:
    t0 = time.time()
    pdir = pack_dir(pack_id)
    pmeta = json.loads((pdir / "pack.json").read_text())
    topic = pmeta.get("topic", pmeta.get("name", "general"))
    all_phrases = json.loads((pdir / "phrases.json").read_text())
    target = len(all_phrases)
    out_path = pdir / "translations" / f"{lang}.json"
    out_path.parent.mkdir(parents=True, exist_ok=True)

    with file_lock(out_path):
        if out_path.is_file():
            try:
                merged = json.loads(out_path.read_text())
                if not isinstance(merged, dict): merged = {}
            except Exception:
                merged = {}
        else:
            merged = {}
        cur = 0
        for i in range(len(merged)):
            if str(i) not in merged:
                cur = i; break
        else:
            cur = len(merged)
        if cur >= target:
            return (pack_id, lang, "SKIP", int((time.time() - t0) * 1000))

    CHUNK = 100
    while cur < target:
        end = min(cur + CHUNK, target)
        chunk_phrases = all_phrases[cur:end]
        prompt = build_prompt(lang, topic, len(chunk_phrases), chunk_phrases)
        data, err = call_codex(prompt, timeout_s=chunk_timeout)
        if err:
            return (pack_id, lang, f"FAIL:{err}@{cur}", int((time.time() - t0) * 1000))
        if len(data) != len(chunk_phrases):
            return (pack_id, lang,
                    f"COUNT_MISMATCH:{len(data)}vs{len(chunk_phrases)}@{cur}",
                    int((time.time() - t0) * 1000))

        with file_lock(out_path):
            if out_path.is_file():
                try:
                    disk = json.loads(out_path.read_text())
                    if isinstance(disk, dict): merged = disk
                except Exception:
                    pass
            for i in range(len(chunk_phrases)):
                k_model = str(i)
                if k_model not in data:
                    return (pack_id, lang, f"MISSING_KEY:{k_model}@{cur}",
                            int((time.time() - t0) * 1000))
                entry = data[k_model]
                if not isinstance(entry, dict) or not str(entry.get("text", "")).strip():
                    return (pack_id, lang, f"BAD_ENTRY@{cur + i}",
                            int((time.time() - t0) * 1000))
                rom = entry.get("romanization")
                if isinstance(rom, str) and not rom.strip(): rom = None
                merged[str(cur + i)] = {"text": entry["text"], "romanization": rom}
            out_path.write_text(json.dumps(merged, ensure_ascii=False, indent=2))
        cur = end

    return (pack_id, lang, "OK", int((time.time() - t0) * 1000))


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--max-rounds", type=int, default=6)
    ap.add_argument("--workers", type=int, default=20,
                    help="Concurrent (pack,lang) workers (codex subprocesses)")
    ap.add_argument("--chunk-timeout", type=float, default=300.0)
    ns = ap.parse_args()

    for round_n in range(1, ns.max_rounds + 1):
        work = audit()
        if not work:
            print(f"\n[round {round_n}] CONVERGED")
            return 0
        from collections import Counter
        bp = Counter(p for p, _, _, _ in work)
        print(f"\n[round {round_n}] {len(work)} units; {ns.workers} codex workers")
        for pid, n in bp.most_common(): print(f"  {pid}: {n}")

        t0 = time.time(); ok = 0; fail = []
        with ThreadPoolExecutor(max_workers=ns.workers) as ex:
            futs = {ex.submit(fill_unit, p, l, ns.chunk_timeout): (p, l)
                    for p, l, _, _ in work}
            done = 0
            for fut in as_completed(futs):
                pid, lang, status, ms = fut.result()
                done += 1
                if status in ("OK", "SKIP"):
                    ok += 1
                else:
                    fail.append((pid, lang, status))
                if done % 10 == 0 or done == len(work):
                    print(f"    [{time.strftime('%H:%M:%S')}] {done}/{len(work)}  ok={ok} fail={len(fail)}")
        elapsed = time.time() - t0
        print(f"  round {round_n}: {ok} OK, {len(fail)} failed in {elapsed:.0f}s")
        if fail[:6]:
            print("  sample failures:")
            for pid, lang, status in fail[:8]:
                print(f"    {pid}/{lang}: {status}")

    work = audit()
    if not work:
        print(f"\n[FINAL] CONVERGED")
        return 0
    print(f"\n[FINAL] {len(work)} units still short after {ns.max_rounds} rounds")
    return 1


if __name__ == "__main__":
    sys.exit(main())
