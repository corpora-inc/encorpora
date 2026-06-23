#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import sqlite3
import sys
import threading
import time
from pathlib import Path
from typing import Dict, List

from concurrent.futures import ThreadPoolExecutor, as_completed

from pydantic import BaseModel

from corpora_ai.llm_interface import ChatCompletionTextMessage
from corpora_ai.provider_loader import load_llm_provider


class EtymologyItem(BaseModel):
    char: str
    etymology: str


class EtymologyBatch(BaseModel):
    items: List[EtymologyItem]


class TranslationItem(BaseModel):
    char: str
    text: str


class TranslationBatch(BaseModel):
    items: List[TranslationItem]


def is_hanzi(ch: str) -> bool:
    code = ord(ch)
    return (
        0x3400 <= code <= 0x9FFF
        or 0xF900 <= code <= 0xFAFF
        or 0x20000 <= code <= 0x2FA1F
    )


def extract_hanzi(text: str) -> List[str]:
    return [ch for ch in text if is_hanzi(ch)]


def collect_characters(core_db: Path, langs: List[str]) -> List[str]:
    conn = sqlite3.connect(f"file:{core_db}?mode=ro&immutable=1", uri=True)
    placeholders = ",".join(["?"] * len(langs))
    sql = f"""
        SELECT t.text
        FROM cor_translation t
        JOIN cor_language l ON l.id = t.language_id
        WHERE l.code IN ({placeholders})
    """
    chars: Dict[str, None] = {}
    for (text,) in conn.execute(sql, langs):
        if not text:
            continue
        for ch in extract_hanzi(text):
            chars.setdefault(ch, None)
    conn.close()
    return sorted(chars.keys())


def list_languages(core_db: Path) -> List[str]:
    conn = sqlite3.connect(f"file:{core_db}?mode=ro&immutable=1", uri=True)
    rows = conn.execute("SELECT code FROM cor_language ORDER BY code").fetchall()
    conn.close()
    return [row[0] for row in rows if row and row[0]]


def load_existing(path: Path) -> Dict[str, Dict[str, str]]:
    if not path.exists():
        return {}
    raw = json.loads(path.read_text(encoding="utf-8"))
    existing: Dict[str, Dict[str, str]] = {}
    if isinstance(raw, list):
        for item in raw:
            if not isinstance(item, dict):
                continue
            char = item.get("char")
            ety = item.get("etymology")
            if isinstance(char, str) and isinstance(ety, dict):
                existing[char] = {
                    lang: text
                    for lang, text in ety.items()
                    if isinstance(lang, str) and isinstance(text, str)
                }
    return existing


def save_output(path: Path, data: Dict[str, Dict[str, str]]) -> None:
    payload = [
        {"char": char, "etymology": ety}
        for char, ety in sorted(data.items(), key=lambda item: item[0])
    ]
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")


def chunk(items: List[str], size: int) -> List[List[str]]:
    return [items[i : i + size] for i in range(0, len(items), size)]


def looks_non_english(text: str) -> bool:
    if not text:
        return True
    cjk = sum(1 for ch in text if is_hanzi(ch))
    ratio = cjk / max(len(text), 1)
    return cjk >= 8 and ratio > 0.2


def log_batch(stage: str, lang: str, index: int, total: int, count: int) -> None:
    print(f"[{stage}] {lang} batch {index}/{total} ({count} chars)", flush=True)


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument(
        "--core-db",
        dest="core_db",
        type=Path,
        default=Path(__file__).resolve().parents[1] / "release.sqlite3",
    )
    ap.add_argument(
        "--out",
        dest="out",
        type=Path,
        default=Path(__file__).parent / "seed" / "etymology_full.json",
    )
    ap.add_argument(
        "--langs",
        dest="langs",
        nargs="*",
        default=["en"],
        help="Language codes to generate (include 'en'). Use --all-langs for every language.",
    )
    ap.add_argument(
        "--all-langs",
        action="store_true",
        help="Generate etymologies for all languages in the core DB.",
    )
    ap.add_argument("--limit", type=int, default=0)
    ap.add_argument("--batch-size", type=int, default=6)
    ap.add_argument("--sleep", type=float, default=0.0)
    ap.add_argument("--provider", type=str, default="local")
    ap.add_argument("--completion-model", type=str, default=None)
    ap.add_argument("--base-url", type=str, default=None)
    ap.add_argument(
        "--workers",
        type=int,
        default=1,
        help="Parallel workers for batch requests (default: 1).",
    )
    ap.add_argument(
        "--include-existing",
        action="store_true",
        help=(
            "Union the live core-DB hanzi scan with characters already "
            "present in the existing seed JSON. Use this when the core "
            "corpus has been slimmed but Hanzipan's character universe "
            "should retain previously-curated chars."
        ),
    )
    args = ap.parse_args()

    core_db = args.core_db.resolve()
    if not core_db.exists():
        print(f"Core DB not found: {core_db}", file=sys.stderr)
        sys.exit(1)

    if args.all_langs:
        langs = list_languages(core_db)
    else:
        langs = args.langs
    if "en" not in langs:
        langs = ["en", *langs]

    characters = collect_characters(core_db, ["zh-Hans", "zh-Hant"])

    out = args.out.resolve()
    out.parent.mkdir(parents=True, exist_ok=True)
    existing = load_existing(out)

    if args.include_existing and existing:
        # Hanzipan's character universe is canonically the etymology seed
        # JSON — corpus slims shouldn't drop previously-curated chars from
        # the pack. Union the scan with whatever the seed already covers.
        existing_chars = sorted(existing.keys())
        combined = sorted({*characters, *existing_chars})
        added = len(combined) - len(characters)
        if added:
            print(
                f"[chars] include-existing: scan={len(characters)} "
                f"+ seed-only={added} = {len(combined)} total",
            )
        characters = combined

    if args.limit:
        characters = characters[: args.limit]

    llm_kwargs = {}
    if args.completion_model:
        llm_kwargs["completion_model"] = args.completion_model
    if args.base_url:
        llm_kwargs["base_url"] = args.base_url
    llm_local = threading.local()

    def get_llm():
        llm = getattr(llm_local, "llm", None)
        if llm is None:
            llm = load_llm_provider(args.provider, **llm_kwargs)
            llm_local.llm = llm
        return llm

    def run_etymology_batch(batch: List[str], index: int, total: int):
        log_batch("etymology", "en", index, total, len(batch))
        started = time.time()
        prompt = "\n".join([f"{ch}" for ch in batch])
        messages = [
            ChatCompletionTextMessage(
                role="system",
                text=(
                    "You are a Chinese etymology expert. Write in English ONLY. For each character, write "
                    "2-3 concise sentences that include: (1) the primary meaning(s)/definition for learners, "
                    "(2) common usage or nuance (how it can be used alone or in compounds), and (3) a brief "
                    "origin/components note or mnemonic. Keep it short, accurate, and practical. "
                    "Do not switch languages. Output JSON with `items`: each item has `char` and `etymology`."
                ),
            ),
            ChatCompletionTextMessage(
                role="user",
                text=f"Return JSON for these characters:\n{prompt}",
            ),
        ]
        llm = get_llm()
        result = llm.get_data_completion(messages, EtymologyBatch)
        items = []
        for item in result.items:
            cleaned = item.etymology.strip()
            if looks_non_english(cleaned):
                print(
                    f"[etymology] Warning: {item.char} looks non-English; skipping.",
                    flush=True,
                )
                continue
            items.append((item.char, cleaned))
        elapsed = time.time() - started
        return {"items": items, "elapsed": elapsed, "index": index}

    def run_translation_batch(
        lang_code: str, batch: List[str], index: int, total: int
    ):
        log_batch("translate", lang_code, index, total, len(batch))
        started = time.time()
        prompt_lines = [
            f"{ch}: {existing[ch]['en']}"
            for ch in batch
            if "en" in existing.get(ch, {})
        ]
        prompt = "\n".join(prompt_lines)
        messages = [
            ChatCompletionTextMessage(
                role="system",
                text=(
                    f"You are a world-class translator. Translate the following English etymologies "
                    f"into language code '{lang_code}'. Preserve meaning and tone, keep 2-5 sentences, "
                    "and do not add facts. Output JSON with `items`: each item has `char` and `text`."
                ),
            ),
            ChatCompletionTextMessage(
                role="user",
                text=f"Return JSON translations:\n{prompt}",
            ),
        ]
        llm = get_llm()
        result = llm.get_data_completion(messages, TranslationBatch)
        items = [(item.char, item.text.strip()) for item in result.items if item.text]
        elapsed = time.time() - started
        return {"items": items, "elapsed": elapsed, "index": index}

    # 1) English etymologies
    missing_en = [ch for ch in characters if "en" not in existing.get(ch, {})]
    if missing_en:
        print(f"Generating English etymologies: {len(missing_en)} chars")
    en_batches = chunk(missing_en, args.batch_size)
    if args.workers <= 1 or len(en_batches) <= 1:
        for idx, batch in enumerate(en_batches, start=1):
            result = run_etymology_batch(batch, idx, len(en_batches))
            for char, text in result["items"]:
                existing.setdefault(char, {})["en"] = text
            save_output(out, existing)
            print(
                f"[etymology] en batch {result['index']} done in {result['elapsed']:.1f}s",
                flush=True,
            )
            if args.sleep:
                time.sleep(args.sleep)
    else:
        workers = min(args.workers, len(en_batches))
        with ThreadPoolExecutor(max_workers=workers) as executor:
            futures = {
                executor.submit(run_etymology_batch, batch, idx, len(en_batches)): idx
                for idx, batch in enumerate(en_batches, start=1)
            }
            for future in as_completed(futures):
                idx = futures[future]
                try:
                    result = future.result()
                except Exception as exc:  # noqa: BLE001
                    print(f"[etymology] en batch {idx} failed: {exc}", flush=True)
                    continue
                for char, text in result["items"]:
                    existing.setdefault(char, {})["en"] = text
                save_output(out, existing)
                print(
                    f"[etymology] en batch {result['index']} done in {result['elapsed']:.1f}s",
                    flush=True,
                )
                if args.sleep:
                    time.sleep(args.sleep)

    # 2) Translations
    target_langs = [code for code in langs if code != "en"]
    if target_langs:
        print(f"Translating to {len(target_langs)} languages")
    for lang_code in target_langs:
        missing = [
            ch
            for ch in characters
            if "en" in existing.get(ch, {}) and lang_code not in existing.get(ch, {})
        ]
        if not missing:
            continue
        print(f" -> {lang_code}: {len(missing)} chars")
        lang_batches = chunk(missing, args.batch_size)
        if args.workers <= 1 or len(lang_batches) <= 1:
            for idx, batch in enumerate(lang_batches, start=1):
                result = run_translation_batch(lang_code, batch, idx, len(lang_batches))
                for char, text in result["items"]:
                    existing.setdefault(char, {})[lang_code] = text
                save_output(out, existing)
                print(
                    f"[translate] {lang_code} batch {result['index']} done in {result['elapsed']:.1f}s",
                    flush=True,
                )
                if args.sleep:
                    time.sleep(args.sleep)
        else:
            workers = min(args.workers, len(lang_batches))
            with ThreadPoolExecutor(max_workers=workers) as executor:
                futures = {
                    executor.submit(
                        run_translation_batch, lang_code, batch, idx, len(lang_batches)
                    ): idx
                    for idx, batch in enumerate(lang_batches, start=1)
                }
                for future in as_completed(futures):
                    idx = futures[future]
                    try:
                        result = future.result()
                    except Exception as exc:  # noqa: BLE001
                        print(
                            f"[translate] {lang_code} batch {idx} failed: {exc}",
                            flush=True,
                        )
                        continue
                    for char, text in result["items"]:
                        existing.setdefault(char, {})[lang_code] = text
                    save_output(out, existing)
                    print(
                        f"[translate] {lang_code} batch {result['index']} done in {result['elapsed']:.1f}s",
                        flush=True,
                    )
                    if args.sleep:
                        time.sleep(args.sleep)

    print(f"Done. Wrote {out}")


if __name__ == "__main__":
    main()
