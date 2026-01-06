#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import sqlite3
import sys
import time
from pathlib import Path
from typing import Dict, List

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
    if args.limit:
        characters = characters[: args.limit]

    out = args.out.resolve()
    out.parent.mkdir(parents=True, exist_ok=True)
    existing = load_existing(out)

    llm_kwargs = {}
    if args.completion_model:
        llm_kwargs["completion_model"] = args.completion_model
    if args.base_url:
        llm_kwargs["base_url"] = args.base_url
    llm = load_llm_provider(args.provider, **llm_kwargs)

    # 1) English etymologies
    missing_en = [ch for ch in characters if "en" not in existing.get(ch, {})]
    if missing_en:
        print(f"Generating English etymologies: {len(missing_en)} chars")
    en_batches = chunk(missing_en, args.batch_size)
    for idx, batch in enumerate(en_batches, start=1):
        log_batch("etymology", "en", idx, len(en_batches), len(batch))
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
        result = llm.get_data_completion(messages, EtymologyBatch)
        for item in result.items:
            cleaned = item.etymology.strip()
            if looks_non_english(cleaned):
                print(
                    f"[etymology] Warning: {item.char} looks non-English; skipping.",
                    flush=True,
                )
                continue
            existing.setdefault(item.char, {})["en"] = cleaned
        save_output(out, existing)
        elapsed = time.time() - started
        print(f"[etymology] en batch {idx} done in {elapsed:.1f}s", flush=True)
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
        for idx, batch in enumerate(lang_batches, start=1):
            log_batch("translate", lang_code, idx, len(lang_batches), len(batch))
            started = time.time()
            prompt_lines = [
                f"{ch}: {existing[ch]['en']}" for ch in batch if "en" in existing.get(ch, {})
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
            result = llm.get_data_completion(messages, TranslationBatch)
            for item in result.items:
                if item.text:
                    existing.setdefault(item.char, {})[lang_code] = item.text.strip()
            save_output(out, existing)
            elapsed = time.time() - started
            print(f"[translate] {lang_code} batch {idx} done in {elapsed:.1f}s", flush=True)
            if args.sleep:
                time.sleep(args.sleep)

    print(f"Done. Wrote {out}")


if __name__ == "__main__":
    main()
