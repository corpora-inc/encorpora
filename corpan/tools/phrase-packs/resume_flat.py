#!/usr/bin/env python3
"""
Flat-queue resume: every (pack, lang) tuple that's short of full coverage
gets its own work-unit. Workers pull from a global queue. No per-pack
serialization, no per-pack timeout headaches — just N workers grinding
through M units until done.

Translation work happens IN-PROCESS using gemini_translate.make_client
(thread-local) and gemini_translate.build_prompt — no subprocess churn.

Loops at most --max-rounds (default 6). Between rounds, re-audits and
re-queues anything still short. Convergence check at the top of every
round: if 0 short, exit 0.
"""

from __future__ import annotations

import argparse
import json
import sys
import threading
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

HERE = Path(__file__).parent.resolve()
sys.path.insert(0, str(HERE))

from facets import TIER
from gemini_translate import (
    ALL_LANGS, LANG_NAME, build_prompt, make_client,
)
from google.genai import types as gtypes


_thread_local = threading.local()


def get_client():
    if not hasattr(_thread_local, "client"):
        _thread_local.client = make_client(vertex=True)
    return _thread_local.client


def pack_dir(pack_id: str) -> Path:
    if pack_id == "phrase-botany-basics":
        return HERE / "example-botany"
    return HERE / pack_id


def audit() -> list[tuple[str, str, int, int]]:
    """Return [(pack_id, lang, current_count, target_count)] for every
    (pack, lang) tuple short of full coverage."""
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
                        # Contiguous check: count up to first gap
                        for i in range(len(d)):
                            if str(i) not in d:
                                n = i
                                break
                        else:
                            n = len(d)
                except Exception:
                    n = 0
            if n < n_phrases:
                work.append((pid, lang, n, n_phrases))
    return work


def translate_chunk(client, lang: str, phrases_chunk: list[dict],
                    topic: str, timeout_s: float = 180.0
                    ) -> tuple[dict | None, str | None]:
    """Translate one chunk of phrases. Returns (data_dict, error)."""
    prompt = build_prompt(lang, topic, len(phrases_chunk), phrases_chunk)

    holder = {}
    def _do():
        try:
            resp = client.models.generate_content(
                model="gemini-2.5-flash",
                contents=prompt,
                config=gtypes.GenerateContentConfig(
                    temperature=0.2,
                    max_output_tokens=65536,
                    response_mime_type="application/json",
                ),
            )
            holder["text"] = (resp.text or "").strip()
        except Exception as e:
            holder["err"] = f"{type(e).__name__}:{str(e)[:200]}"

    t = threading.Thread(target=_do, daemon=True)
    t.start()
    t.join(timeout_s)
    if t.is_alive():
        return (None, f"TIMEOUT:{timeout_s}s")
    if "err" in holder:
        return (None, holder["err"])

    text = holder.get("text", "")
    if not text:
        return (None, "EMPTY")
    try:
        data = json.loads(text)
    except json.JSONDecodeError as e:
        return (None, f"BAD_JSON:{e}")
    if not isinstance(data, dict) or len(data) != len(phrases_chunk):
        return (None, f"COUNT_MISMATCH:{len(data) if isinstance(data, dict) else type(data).__name__}")
    return (data, None)


# Per-file lock so chunked writes for the same lang don't race.
_file_locks: dict[Path, threading.Lock] = {}
_file_locks_guard = threading.Lock()


def file_lock(path: Path) -> threading.Lock:
    with _file_locks_guard:
        if path not in _file_locks:
            _file_locks[path] = threading.Lock()
        return _file_locks[path]


def fill_unit(pack_id: str, lang: str) -> tuple[str, str, str, int]:
    """Translate ALL still-missing chunks for one (pack, lang) tuple.
    Per-chunk persistence. Returns (pack_id, lang, status, ms)."""
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

        # Find first gap → start translating from there
        cur = 0
        for i in range(len(merged)):
            if str(i) not in merged:
                cur = i
                break
        else:
            cur = len(merged)
        if cur >= target:
            return (pack_id, lang, "SKIP", int((time.time() - t0) * 1000))

    CHUNK = 100
    client = get_client()
    while cur < target:
        end = min(cur + CHUNK, target)
        chunk_phrases = all_phrases[cur:end]
        data, err = translate_chunk(client, lang, chunk_phrases, topic, timeout_s=180.0)
        if err:
            return (pack_id, lang, f"FAIL:{err}@{cur}", int((time.time() - t0) * 1000))

        # Validate + merge under file lock
        with file_lock(out_path):
            # Re-read to get any concurrent updates (paranoia; usually no other writer)
            if out_path.is_file():
                try:
                    cur_disk = json.loads(out_path.read_text())
                    if isinstance(cur_disk, dict):
                        merged = cur_disk
                except Exception:
                    pass
            for i in range(len(chunk_phrases)):
                k_model = str(i)
                if k_model not in data:
                    return (pack_id, lang, f"MISSING_KEY:{k_model}@{cur}", int((time.time() - t0) * 1000))
                entry = data[k_model]
                if not isinstance(entry, dict) or not str(entry.get("text", "")).strip():
                    return (pack_id, lang, f"BAD_ENTRY@{cur + i}", int((time.time() - t0) * 1000))
                rom = entry.get("romanization")
                if isinstance(rom, str) and not rom.strip(): rom = None
                merged[str(cur + i)] = {"text": entry["text"], "romanization": rom}
            out_path.write_text(json.dumps(merged, ensure_ascii=False, indent=2))

        cur = end

    return (pack_id, lang, "OK", int((time.time() - t0) * 1000))


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--max-rounds", type=int, default=6)
    ap.add_argument("--workers", type=int, default=40,
                    help="Concurrent (pack, lang) workers")
    ns = ap.parse_args()

    for round_n in range(1, ns.max_rounds + 1):
        work = audit()
        if not work:
            print(f"\n[round {round_n}] CONVERGED — 0 packs short, all 24 at 54/54 langs")
            return 0
        print(f"\n[round {round_n}] {len(work)} (pack,lang) units to fill, "
              f"{ns.workers} workers")
        # Show distribution
        from collections import Counter
        by_pack = Counter(p for p, _, _, _ in work)
        for pid, n in by_pack.most_common():
            print(f"  {pid}: {n} units")

        t0 = time.time()
        ok = 0; fail = []
        with ThreadPoolExecutor(max_workers=ns.workers) as ex:
            futs = {ex.submit(fill_unit, p, l): (p, l) for p, l, _, _ in work}
            done = 0
            for fut in as_completed(futs):
                pid, lang, status, ms = fut.result()
                done += 1
                if status == "OK" or status == "SKIP":
                    ok += 1
                else:
                    fail.append((pid, lang, status))
                # Concise progress: every 10 finished
                if done % 10 == 0 or done == len(work):
                    print(f"    [{time.strftime('%H:%M:%S')}] {done}/{len(work)}  ok={ok} fail={len(fail)}")
        elapsed = time.time() - t0
        print(f"  round {round_n} done in {elapsed:.0f}s — {ok} OK, {len(fail)} failed")
        if fail[:5]:
            print("  sample failures:")
            for pid, lang, status in fail[:8]:
                print(f"    {pid}/{lang}: {status}")

    # Final audit
    work = audit()
    if not work:
        print(f"\n[FINAL] CONVERGED after {ns.max_rounds} rounds")
        return 0
    print(f"\n[FINAL] hit max-rounds={ns.max_rounds}; {len(work)} units still short:")
    from collections import Counter
    by_pack = Counter(p for p, _, _, _ in work)
    for pid, n in sorted(by_pack.most_common()):
        print(f"  {pid}: {n} units")
    return 1


if __name__ == "__main__":
    sys.exit(main())
