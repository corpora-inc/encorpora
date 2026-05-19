#!/usr/bin/env python3
"""
Parallel codex-CLI translation orchestrator for phrase packs.

Reads `<pack-dir>/pack.json` + `<pack-dir>/phrases.json`, then dispatches one
`codex exec` invocation per target language. Each codex instance reads the
phrases, translates them, and writes `<pack-dir>/translations/<lang>.json`
directly via its Write tool. No JSON-from-stdout parsing.

Per-language prompts include:
  - target language name + BCP-47 code
  - language-specific notes (script, regional flavor)
  - romanization rule
  - instruction to self-formulate a translator system prompt IN the target
    language (proven to improve naturalness over English-shaped output)
  - exact output schema + absolute paths

Default model is codex's configured default (currently gpt-5.4). Override
with --model to try gpt-5, gpt-5-pro, --oss, etc.

Usage:
  python codex_translate.py <pack-dir> [--langs es,fr,...] [--workers 10]
                                       [--model gpt-5] [--effort medium]
                                       [--dry-run]
"""

from __future__ import annotations

import argparse
import concurrent.futures
import json
import subprocess
import sys
import time
from pathlib import Path

# Mirrors corpan-app/src/store/settings.ts :: ALL_LANGUAGES (51 codes).
ALL_LANGS = (
    "en", "es", "ca", "fr", "it", "ro", "pt-PT", "pt-BR",
    "de", "nl", "no", "sv", "da", "fi", "hu",
    "lt", "pl", "cs", "sk", "sl", "hr", "sr", "bg", "uk", "ru",
    "el", "tr",
    "he", "ar", "fa", "ur", "pa-Arab",
    "pa-Guru", "hi", "ne", "bn", "mr", "gu", "kn", "te", "ta",
    "th", "vi", "id", "ms",
    "sw",
    "zh-Hans", "zh-Hant", "yue-Hant-HK", "ko-polite", "ja",
)

LANG_NAME = {
    "es": "Spanish", "ca": "Catalan", "fr": "French", "it": "Italian", "ro": "Romanian",
    "pt-PT": "European Portuguese", "pt-BR": "Brazilian Portuguese",
    "de": "German", "nl": "Dutch", "no": "Norwegian Bokmål", "sv": "Swedish",
    "da": "Danish", "fi": "Finnish", "hu": "Hungarian",
    "lt": "Lithuanian", "pl": "Polish", "cs": "Czech", "sk": "Slovak", "sl": "Slovenian",
    "hr": "Croatian", "sr": "Serbian (Latin script)", "bg": "Bulgarian",
    "uk": "Ukrainian", "ru": "Russian",
    "el": "Modern Greek", "tr": "Turkish",
    "he": "Modern Hebrew", "ar": "Modern Standard Arabic", "fa": "Persian (Farsi)",
    "ur": "Urdu", "pa-Arab": "Punjabi (Shahmukhi script)",
    "pa-Guru": "Punjabi (Gurmukhi script)", "hi": "Hindi", "ne": "Nepali",
    "bn": "Bengali", "mr": "Marathi", "gu": "Gujarati", "kn": "Kannada",
    "te": "Telugu", "ta": "Tamil",
    "th": "Thai", "vi": "Vietnamese", "id": "Indonesian (Bahasa Indonesia)",
    "ms": "Malay (Bahasa Malaysia)", "sw": "Swahili (Kiswahili)",
    "zh-Hans": "Simplified Mandarin Chinese", "zh-Hant": "Traditional Mandarin Chinese (Taiwan)",
    "yue-Hant-HK": "Hong Kong written Cantonese (Traditional script)",
    "ko-polite": "Korean (polite forms only)", "ja": "Japanese",
}

# Languages that need romanization in addition to native script.
ROMANIZED = {
    "bg", "uk", "ru", "el", "he", "ar", "fa", "ur", "pa-Arab", "pa-Guru",
    "hi", "ne", "bn", "mr", "gu", "kn", "te", "ta", "th",
    "zh-Hans", "zh-Hant", "yue-Hant-HK", "ko-polite", "ja",
}

ROMANIZATION_STYLE = {
    "bg": "Streamlined Latin transliteration",
    "uk": "Ukrainian National 2010 system",
    "ru": "BGN/PCGN",
    "el": "ELOT 743 or ISO 843",
    "he": "common Modern Hebrew transliteration (e.g. 'shalom')",
    "ar": "ALA-LC style with long vowels (ā ī ū)",
    "fa": "DMG/UniPers style with ezāfe marked",
    "ur": "Roman Urdu (common readable style)",
    "pa-Arab": "ALA-LC style for Punjabi",
    "pa-Guru": "ISO 15919 for Gurmukhi",
    "hi": "IAST with proper diacritics (ā ī ū ṛ ṇ ś ṣ ñ ṅ)",
    "ne": "IAST or comparable readable transliteration",
    "bn": "ISO 15919 / IAST-adjacent",
    "mr": "IAST with proper diacritics",
    "gu": "ISO 15919 for Gujarati",
    "kn": "ISO 15919 for Kannada",
    "te": "ISO 15919 for Telugu",
    "ta": "ISO 15919 for Tamil",
    "th": "Royal Thai General System (RTGS)",
    "zh-Hans": "Pinyin with tone marks (ā á ǎ à), word-grouped spacing",
    "zh-Hant": "Pinyin with tone marks, word-grouped spacing",
    "yue-Hant-HK": "Jyutping with tone numbers (1-6)",
    "ko-polite": "Revised Romanization of Korean (2000)",
    "ja": "Modified Hepburn (long vowels with macrons: ō ū)",
}

# Per-language notes that go into the prompt. Only included when non-empty.
LANG_NOTES = {
    "pt-PT": "European Portuguese vocabulary: comboio (not trem), telemóvel (not celular), "
             "pequeno-almoço (not café da manhã). Post-Acordo Ortográfico spelling.",
    "pt-BR": "Brazilian Portuguese: você standard, trem (not comboio), celular (not telemóvel), "
             "café da manhã (not pequeno-almoço).",
    "no": "Norwegian Bokmål (the dominant written standard). Not Nynorsk.",
    "sr": "Use Serbian Latin script (Latinica), NOT Cyrillic.",
    "fi": "Standard written Finnish (yleiskieli) for clarity, with conversational warmth.",
    "he": "Modern conversational Hebrew. Omit niqqud unless ambiguous.",
    "ar": "Modern Standard Arabic (MSA), conversational tone. Omit tashkīl unless needed.",
    "fa": "Modern conversational Persian (Iranian dialect, Tehran-standard).",
    "ur": "Modern conversational Urdu, subcontinental usage. Nastaliq.",
    "pa-Arab": "Pakistani Punjabi in Shahmukhi. NOT Urdu-in-Shahmukhi.",
    "pa-Guru": "Indian Punjabi in Gurmukhi. NOT Hindi-in-Gurmukhi.",
    "hi": "Modern conversational Hindi. Use tum for second person (friendly, learner-appropriate).",
    "bn": "Modern Cholito-bhasha Bengali. Use tumi for second person.",
    "id": "Standard Bahasa Indonesia. Distinct from Bahasa Malaysia.",
    "ms": "Standard Bahasa Malaysia (Bahasa Melayu Baku). Distinct from Bahasa Indonesia.",
    "sw": "Standard East African Kiswahili sanifu.",
    "zh-Hans": "Simplified characters, Mainland Mandarin conventions. NOT Cantonese vocabulary.",
    "zh-Hant": "Traditional characters, Taiwan Mandarin conventions (影片 not 视频, 軟體 not 软件). NOT Cantonese.",
    "yue-Hant-HK": (
        "Written Hong Kong Cantonese in Traditional script. This is the vernacular as Hong Kongers "
        "write it on social media. USE: 唔 (not 不), 嘅 (not 的), 啲 (not 些), 咗 for completed aspect, "
        "嚟 (not 來), 喺 (not 在), 咩/乜嘢 (not 什麼), 點解 (not 為什麼), 識, 我哋/你哋/佢哋, 係 (not 是), "
        "particles 啦/喎/喇/㗎/咩/呀/啊. The most common failure is writing Mandarin in Traditional "
        "characters — DON'T."
    ),
    "ko-polite": (
        "Polite forms only: 해요체 (default, warm) or 합니다체 (formal). NEVER 반말. "
        "Particles 은/는, 이/가, 을/를, etc. — natural usage. Avoid English calques."
    ),
    "ja": (
        "Default to です/ます polite-neutral. Use natural Japanese sentence patterns — don't mirror "
        "English clause structure. Subject pronouns often dropped. Natural kanji/hiragana/katakana mix."
    ),
}


def build_prompt(lang: str, pack_dir: Path, topic: str, n: int) -> str:
    name = LANG_NAME[lang]
    note = LANG_NOTES.get(lang, "")
    if lang in ROMANIZED:
        rom = (f"For every entry, include a Latin romanization in {ROMANIZATION_STYLE[lang]}. "
               f"Populate the `romanization` field for ALL 200 entries.")
    else:
        rom = f"`romanization` is `null` for every entry ({name} uses Latin script)."

    note_block = f"\nLANGUAGE-SPECIFIC NOTES:\n{note}\n" if note else ""

    return f"""You are a native, literate speaker of {name} (BCP-47 code: {lang}). Translate {n} English phrases (topic: {topic}) for a language-learning app.

QUALITY BAR (top priority):
- Natural, conversational, modern. Not literal or stiff.
- Each translation should land as if originally written in {name}, the way a fluent local would actually phrase it.
- Adapt idioms. Never word-for-word for figurative language.
- Register: neutral conversational with a slight warmth, friendly learning-app tone.
- Topic-specific vocabulary ({topic}) should be precise but accessible.

BEFORE TRANSLATING (do this internally, no need to output):
Compose your own translator system prompt IN {name}. Cover register, regional flavor, topic-vocabulary norms, and a one-line idiom-handling rule. Translate against that internal prompt. Self-prompting IN {name} keeps your output in natural {name} cadence rather than English-shaped {name}.
{note_block}
ROMANIZATION: {rom}

PROCESS:
1. Read {pack_dir}/phrases.json — a JSON array of {n} objects {{"english": "...", "level": "..."}}. Array index IS the phrase id (0..{n-1}).
2. Translate each `english` field into {name}.
3. Write the result to {pack_dir}/translations/{lang}.json using the Write tool, once, with this exact JSON schema:
   {{
     "0": {{"text": "<your translation>", "romanization": <null or "...">}},
     "1": {{...}},
     ...
     "{n-1}": {{...}}
   }}
   Exactly {n} entries, keys "0" through "{n-1}" as JSON strings. All `text` non-empty. UTF-8. No markdown, no commentary in the file, just the JSON object.

After writing, return ONLY this (no other commentary):
Wrote {n} entries to {lang}.json.
0 → <translation of phrase 0>
{n//2} → <translation of phrase {n//2}>
{n-1} → <translation of phrase {n-1}>
"""


def translate_one(lang: str, pack_dir: Path, topic: str, n: int,
                  model: str | None, effort: str | None, dry_run: bool,
                  timeout: int) -> tuple[str, str, float]:
    """Run codex for one language. Returns (lang, status_message, duration_s)."""
    out_path = pack_dir / "translations" / f"{lang}.json"
    out_path.parent.mkdir(exist_ok=True)

    if dry_run:
        return (lang, "DRY_RUN (prompt built, not dispatched)", 0.0)

    prompt = build_prompt(lang, pack_dir, topic, n)
    cmd = ["codex", "exec",
           "--skip-git-repo-check",
           "--ephemeral",
           "--dangerously-bypass-approvals-and-sandbox"]
    if model:
        cmd += ["-m", model]
    if effort:
        cmd += ["-c", f"model_reasoning_effort={effort!r}"]
    cmd.append(prompt)

    t0 = time.time()
    try:
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=timeout)
    except subprocess.TimeoutExpired:
        return (lang, f"TIMEOUT after {timeout}s", time.time() - t0)

    dur = time.time() - t0

    if not out_path.exists():
        tail = (result.stderr or result.stdout or "")[-300:]
        return (lang, f"NO_FILE (rc={result.returncode}, tail={tail!r})", dur)

    # Quick validation
    try:
        d = json.loads(out_path.read_text())
    except json.JSONDecodeError as e:
        return (lang, f"BAD_JSON ({e})", dur)
    if len(d) != n:
        return (lang, f"COUNT_MISMATCH (got {len(d)}, expected {n})", dur)

    return (lang, "OK", dur)


def main() -> int:
    p = argparse.ArgumentParser(description=__doc__,
                                formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("pack_dir", help="Path to the pack input directory")
    p.add_argument("--langs", help="Comma-separated language codes (default: all 51 minus en)")
    p.add_argument("--workers", type=int, default=10, help="Concurrent codex processes (default 10)")
    p.add_argument("--model", help="Codex -m flag (default: codex config default)")
    p.add_argument("--effort", choices=["minimal", "low", "medium", "high", "xhigh"],
                   help="Reasoning effort override")
    p.add_argument("--timeout", type=int, default=900, help="Per-language timeout in seconds (default 900)")
    p.add_argument("--dry-run", action="store_true", help="Build prompts but don't dispatch")
    p.add_argument("--write-en", action="store_true",
                   help="Also generate en.json directly from phrases.json (no model call)")
    ns = p.parse_args()

    pack_dir = Path(ns.pack_dir).resolve()
    if not pack_dir.is_dir():
        raise SystemExit(f"not a directory: {pack_dir}")
    pack_meta = json.loads((pack_dir / "pack.json").read_text())
    phrases = json.loads((pack_dir / "phrases.json").read_text())
    n = len(phrases)
    topic = pack_meta.get("topic", pack_meta.get("name", "general"))
    print(f"[orchestrator] pack={pack_meta['id']} v{pack_meta['version']}  n={n}  topic={topic}")

    if ns.write_en:
        en = {str(i): {"text": p["english"], "romanization": None} for i, p in enumerate(phrases)}
        en_path = pack_dir / "translations" / "en.json"
        en_path.parent.mkdir(exist_ok=True)
        en_path.write_text(json.dumps(en, ensure_ascii=False, indent=2))
        print(f"[en] wrote {en_path}: {len(en)} entries")

    langs = (tuple(s.strip() for s in ns.langs.split(",") if s.strip())
             if ns.langs else tuple(l for l in ALL_LANGS if l != "en"))
    print(f"[orchestrator] dispatching {len(langs)} languages, {ns.workers} workers, "
          f"model={ns.model or 'codex-default'}, effort={ns.effort or 'codex-default'}")
    if ns.dry_run:
        print("[orchestrator] DRY RUN — prompts will not be dispatched")

    t0 = time.time()
    results: list[tuple[str, str, float]] = []
    with concurrent.futures.ThreadPoolExecutor(max_workers=ns.workers) as pool:
        futs = {pool.submit(translate_one, l, pack_dir, topic, n,
                            ns.model, ns.effort, ns.dry_run, ns.timeout): l
                for l in langs}
        for fut in concurrent.futures.as_completed(futs):
            lang, status, dur = fut.result()
            marker = "✓" if status == "OK" else "✗"
            print(f"  {marker} {lang:<14} {dur:>6.1f}s  {status}")
            results.append((lang, status, dur))

    elapsed = time.time() - t0
    ok = sum(1 for _, s, _ in results if s == "OK")
    print(f"\n[orchestrator] {ok}/{len(langs)} OK in {elapsed:.1f}s")
    if ok < len(langs):
        print("[orchestrator] failed languages:")
        for l, s, _ in results:
            if s != "OK":
                print(f"  - {l}: {s}")
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
