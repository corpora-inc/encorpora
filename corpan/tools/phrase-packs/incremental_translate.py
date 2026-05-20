#!/usr/bin/env python3
"""
Incremental Gemini translation: translate ONLY the new phrases appended
to a pack and splice them into existing per-language translation files.

Use case: a pack at v0.1.0 has 100 phrases translated into 51 langs.
You append 1-4 new phrases for v0.1.1. Re-running the full translator
re-translates everything; this script translates only the new indices.

Reuses build_prompt + LANG_NAME etc. from gemini_translate.py.

Usage:
  python incremental_translate.py <pack-dir> --new-from <index> [--vertex]
                                  [--langs ...] [--workers 12]

  - The script assumes phrases at indices [new_from .. len(phrases)-1]
    are new and absent from translations/*.json.
  - For each lang, it loads the existing JSON (must have new_from entries),
    asks Gemini for translations of just the new phrases (re-keyed 0..k-1),
    re-keys back to actual indices, merges, and writes.
"""

from __future__ import annotations

import argparse
import concurrent.futures
import json
import os
import sys
import time
from pathlib import Path

from dotenv import load_dotenv
load_dotenv(Path.home() / ".env")

from google import genai
from google.genai import types as gtypes

# Reuse machinery from the sibling module.
sys.path.insert(0, str(Path(__file__).parent))
from gemini_translate import (
    ALL_LANGS,
    LANG_NAME,
    ROMANIZED,
    build_prompt,
    make_client,
)


def translate_increment(lang: str, client, model: str, pack_dir: Path,
                        topic: str, new_phrases: list[dict],
                        new_from: int, temperature: float
                        ) -> tuple[str, str, float, int]:
    """Translate the new phrases for one language and splice into existing file."""
    out_path = pack_dir / "translations" / f"{lang}.json"
    if not out_path.is_file():
        return (lang, f"MISSING_BASE: {out_path.name} not found", 0.0, 0)

    existing = json.loads(out_path.read_text())
    if not isinstance(existing, dict):
        return (lang, "BAD_BASE: not a dict", 0.0, 0)

    n = len(new_phrases)
    # Idempotency: if file already contains all the new indices with non-empty text, no-op.
    if len(existing) == new_from + n and all(
            str(new_from + i) in existing
            and isinstance(existing[str(new_from + i)], dict)
            and str(existing[str(new_from + i)].get("text", "")).strip()
            for i in range(n)):
        return (lang, "SKIP (already merged)", 0.0, out_path.stat().st_size)

    if len(existing) != new_from:
        return (lang, f"BASE_SIZE_MISMATCH: have {len(existing)}, expected {new_from}", 0.0, 0)
    prompt = build_prompt(lang, topic, n, new_phrases)

    t0 = time.time()
    try:
        resp = client.models.generate_content(
            model=model,
            contents=prompt,
            config=gtypes.GenerateContentConfig(
                temperature=temperature,
                max_output_tokens=8192,
                response_mime_type="application/json",
            ),
        )
    except Exception as e:
        return (lang, f"API_ERROR: {type(e).__name__}: {str(e)[:200]}", time.time() - t0, 0)

    dur = time.time() - t0
    text = (resp.text or "").strip()
    if not text:
        return (lang, "EMPTY_RESPONSE", dur, 0)

    try:
        data = json.loads(text)
    except json.JSONDecodeError as e:
        return (lang, f"BAD_JSON: {e}", dur, len(text))

    if not isinstance(data, dict) or len(data) != n:
        return (lang, f"COUNT_MISMATCH: got {len(data) if isinstance(data, dict) else type(data).__name__}, expected {n}", dur, len(text))

    # Re-key from 0..n-1 (the model sees these) to new_from..new_from+n-1 (real indices)
    merged = dict(existing)
    for i in range(n):
        k_model = str(i)
        if k_model not in data:
            return (lang, f"MISSING_KEY: {k_model}", dur, len(text))
        entry = data[k_model]
        if not isinstance(entry, dict) or "text" not in entry or not str(entry.get("text", "")).strip():
            return (lang, f"BAD_ENTRY at {k_model}", dur, len(text))
        rom = entry.get("romanization")
        if isinstance(rom, str) and not rom.strip():
            rom = None
        merged[str(new_from + i)] = {"text": entry["text"], "romanization": rom}

    out_path.write_text(json.dumps(merged, ensure_ascii=False, indent=2))
    return (lang, "OK", dur, out_path.stat().st_size)


def main() -> int:
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("pack_dir", help="Pack input directory")
    p.add_argument("--new-from", type=int, required=True,
                   help="First index of new phrases (assumed contiguous to end)")
    p.add_argument("--langs", default="all",
                   help="Comma-separated lang codes, or 'all' (default).")
    p.add_argument("--workers", type=int, default=12)
    p.add_argument("--model", default="gemini-2.5-flash")
    p.add_argument("--vertex", action="store_true")
    p.add_argument("--write-en", action="store_true",
                   help="Also splice new phrases into translations/en.json")
    p.add_argument("--temperature", type=float, default=0.2)
    ns = p.parse_args()

    pack_dir = Path(ns.pack_dir).resolve()
    pack_meta = json.loads((pack_dir / "pack.json").read_text())
    all_phrases = json.loads((pack_dir / "phrases.json").read_text())
    topic = pack_meta.get("topic", pack_meta.get("name", "general topics"))

    new_phrases = all_phrases[ns.new_from:]
    if not new_phrases:
        print("[incremental] no new phrases (new_from >= len(phrases)). nothing to do.")
        return 0

    print(f"[incremental] pack={pack_meta['id']} topic={topic}  "
          f"existing={ns.new_from}  new={len(new_phrases)} (indices {ns.new_from}..{ns.new_from + len(new_phrases) - 1})")

    if ns.langs == "all":
        langs = [l for l in ALL_LANGS if l != "en"]
    else:
        langs = [l.strip() for l in ns.langs.split(",") if l.strip()]

    for l in langs:
        if l not in LANG_NAME:
            print(f"WARN: unknown lang code {l!r}, skipping")
    langs = [l for l in langs if l in LANG_NAME]

    # en handled separately (just splice the literal English text)
    if ns.write_en:
        en_path = pack_dir / "translations" / "en.json"
        en_data = {}
        if en_path.is_file():
            en_data = json.loads(en_path.read_text())
        for i, ph in enumerate(all_phrases):
            en_data[str(i)] = {"text": ph["english"], "romanization": None}
        en_path.parent.mkdir(exist_ok=True)
        en_path.write_text(json.dumps(en_data, ensure_ascii=False, indent=2))
        print(f"[en] spliced -> {en_path.relative_to(pack_dir)}: {len(en_data)} entries")

    client = make_client(ns.vertex)
    backend = "Vertex AI / corpora1" if ns.vertex else "AI Studio"
    print(f"[incremental] {ns.model} via {backend}, {len(langs)} langs, {ns.workers} workers, temp={ns.temperature}")

    t0 = time.time()
    results = {}
    with concurrent.futures.ThreadPoolExecutor(max_workers=ns.workers) as ex:
        futs = {ex.submit(translate_increment, l, client, ns.model, pack_dir,
                          topic, new_phrases, ns.new_from, ns.temperature): l
                for l in langs}
        for fut in concurrent.futures.as_completed(futs):
            l = futs[fut]
            lang, status, dur, sz = fut.result()
            results[lang] = (status, dur, sz)
            marker = "✓" if status == "OK" else "✗"
            print(f"  {marker} {lang:<14} {dur:7.1f}s  {sz:>7}B  {status if status != 'OK' else 'OK'}")

    ok = sum(1 for s, _, _ in results.values() if s == "OK")
    fail = [(l, s) for l, (s, _, _) in results.items() if s != "OK"]
    elapsed = time.time() - t0
    print(f"\n[incremental] {ok}/{len(langs)} OK in {elapsed:.1f}s")
    if fail:
        print("[incremental] failed:")
        for l, s in fail:
            print(f"  - {l}: {s}")
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
