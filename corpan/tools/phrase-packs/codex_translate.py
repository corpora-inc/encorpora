#!/usr/bin/env python3
"""
Parallel codex-CLI translation orchestrator for phrase packs.

Codex pattern (proven, from corpan/dja/cor/utils/codex.py +
ttsctl/auto_rewrite.py): use codex as a JSON chat-completion backend,
NOT as an agentic file-writer.

  - `--sandbox read-only` keeps codex out of agent-loop mode (no Bash,
    no Write); it just generates a response and exits. Fast.
  - `-c model_reasoning_effort=low` for translation (overkill on xhigh).
  - Pass the prompt as the final positional argv.
  - Parse stdout: extract the assistant text block, parse JSON, write
    `translations/<lang>.json` from Python.

This is what the existing pipelines do, and what makes codex usable for
bulk text transformation at scale. Earlier attempts to use codex in
`--dangerously-bypass-approvals-and-sandbox` mode hung silently for
many minutes per call because codex was entering the agent loop trying
to write the file itself.

Usage:
  python codex_translate.py <pack-dir>
                            [--langs es,fr,...]
                            [--workers 12]
                            [--model gpt-5.4]
                            [--effort low|medium|high|xhigh|minimal]
                            [--timeout 240]
                            [--write-en]
"""

from __future__ import annotations

import argparse
import concurrent.futures
import json
import re
import subprocess
import sys
import time
from pathlib import Path

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
    "hi": "IAST with proper diacritics",
    "ne": "IAST or comparable readable transliteration",
    "bn": "ISO 15919 / IAST-adjacent",
    "mr": "IAST with proper diacritics",
    "gu": "ISO 15919 for Gujarati",
    "kn": "ISO 15919 for Kannada",
    "te": "ISO 15919 for Telugu",
    "ta": "ISO 15919 for Tamil",
    "th": "Royal Thai General System (RTGS)",
    "zh-Hans": "Pinyin with tone marks, word-grouped spacing",
    "zh-Hant": "Pinyin with tone marks, word-grouped spacing",
    "yue-Hant-HK": "Jyutping with tone numbers (1-6)",
    "ko-polite": "Revised Romanization of Korean (2000)",
    "ja": "Modified Hepburn (long vowels with macrons)",
}

LANG_NOTES = {
    "pt-PT": "European Portuguese: comboio (not trem), telemóvel (not celular), pequeno-almoço (not café da manhã). Post-Acordo Ortográfico.",
    "pt-BR": "Brazilian Portuguese: você standard, trem (not comboio), celular (not telemóvel), café da manhã (not pequeno-almoço).",
    "no": "Norwegian Bokmål, not Nynorsk.",
    "sr": "Use Serbian Latin script (Latinica), NOT Cyrillic.",
    "he": "Modern conversational Hebrew. Omit niqqud unless ambiguous.",
    "ar": "Modern Standard Arabic (MSA), conversational. Omit tashkīl unless ambiguous.",
    "pa-Arab": "Pakistani Punjabi in Shahmukhi. NOT Urdu-in-Shahmukhi.",
    "pa-Guru": "Indian Punjabi in Gurmukhi. NOT Hindi-in-Gurmukhi.",
    "hi": "Modern conversational Hindi. Use tum for second person.",
    "id": "Standard Bahasa Indonesia. Distinct from Bahasa Malaysia.",
    "ms": "Standard Bahasa Malaysia. Distinct from Bahasa Indonesia.",
    "zh-Hans": "Simplified characters, Mainland Mandarin. NOT Cantonese.",
    "zh-Hant": "Traditional characters, Taiwan Mandarin (影片 not 视频, 軟體 not 软件). NOT Cantonese.",
    "yue-Hant-HK": (
        "Written Hong Kong Cantonese in Traditional script. USE Cantonese particles and grammar: "
        "唔 (not 不), 嘅 (not 的), 啲 (not 些), 咗 for completed aspect, 嚟 (not 來), 喺 (not 在), "
        "咩/乜嘢 (not 什麼), 點解 (not 為什麼), 識, 我哋/你哋/佢哋, 係 (not 是), particles 啦/喎/喇/㗎/咩/呀/啊. "
        "DO NOT write standard Mandarin in Traditional characters."
    ),
    "ko-polite": "Polite forms only: 해요체 or 합니다체. NEVER 반말. Avoid English calques.",
    "ja": "Default to です/ます polite-neutral. Natural Japanese sentence patterns, not English-clause structure.",
}


def build_prompt(lang: str, topic: str, n: int, phrases: list[dict]) -> str:
    name = LANG_NAME[lang]
    note = LANG_NOTES.get(lang, "")
    rom = (f"For EVERY entry, include a Latin romanization in {ROMANIZATION_STYLE[lang]}."
           if lang in ROMANIZED
           else f"`romanization` is null for every entry ({name} uses Latin script).")
    note_block = f"\nLANGUAGE-SPECIFIC NOTES: {note}\n" if note else ""
    phrase_lines = "\n".join(f"{i}. {p['english']}" for i, p in enumerate(phrases))

    return f"""Translate {n} English phrases (topic: {topic}) into {name} (BCP-47: {lang}) for a language-learning app.

QUALITY: natural, conversational, modern {name}. Not literal. Adapt idioms. Each translation lands as if originally written in {name}. Register: warm-neutral, friendly learning-app tone. Topic vocabulary precise but accessible.

Before translating, internally formulate your translator system prompt IN {name} (cover register, regional flavor, topic vocab, idiom-handling rule). Self-prompting IN {name} keeps cadence natural.
{note_block}
ROMANIZATION: {rom}

OUTPUT: Return a single JSON object — and ONLY that object, no prose, no markdown fences. Exactly {n} keys ("0" through "{n-1}" as JSON strings). Each value is {{"text": "<translation>", "romanization": <null or "...">}}. UTF-8.

PHRASES (indexed 0..{n-1}):
{phrase_lines}
"""


# Codex stdout format: a series of named blocks separated by newlines + tags.
# The assistant's response appears after a `codex` tag line. We extract the
# last such block. Identical to corpan/dja/cor/utils/codex.py.
_ASSISTANT_RE = re.compile(
    r"\ncodex\n(?P<body>.*?)(?=\n(?:tokens used|user|codex)\n|\Z)",
    re.DOTALL,
)


def extract_assistant_text(stdout: str) -> str:
    matches = list(_ASSISTANT_RE.finditer(stdout))
    return matches[-1].group("body").strip() if matches else stdout.strip()


def parse_json_relaxed(text: str) -> object:
    """Take the first balanced JSON value out of text, ignoring code fences + trailing chatter."""
    text = text.strip()
    if text.startswith("```"):
        text = re.sub(r"^```[a-zA-Z]*\n?", "", text)
        text = re.sub(r"\n?```\s*$", "", text)
        text = text.strip()
    start = next((i for i, ch in enumerate(text) if ch in "{["), -1)
    if start == -1:
        raise json.JSONDecodeError("no JSON value found", text, 0)
    obj, _ = json.JSONDecoder().raw_decode(text[start:])
    return obj


def translate_one(lang: str, pack_dir: Path, topic: str, phrases: list[dict],
                  model: str | None, effort: str, timeout: int) -> tuple[str, str, float, int]:
    """Run one codex translation. Returns (lang, status, dur_s, output_bytes)."""
    out_path = pack_dir / "translations" / f"{lang}.json"
    out_path.parent.mkdir(exist_ok=True)
    n = len(phrases)
    prompt = build_prompt(lang, topic, n, phrases)

    args = [
        "codex", "exec",
        "--sandbox", "read-only",
        "--skip-git-repo-check",
        "-c", f"model_reasoning_effort={effort}",
    ]
    if model:
        args += ["-c", f"model={json.dumps(model)}"]
    args.append(prompt)

    t0 = time.time()
    try:
        proc = subprocess.run(args, capture_output=True, text=True, timeout=timeout)
    except subprocess.TimeoutExpired:
        return (lang, f"TIMEOUT after {timeout}s", time.time() - t0, 0)

    dur = time.time() - t0

    if proc.returncode != 0:
        return (lang, f"EXIT_{proc.returncode}: {proc.stderr[-200:]!r}", dur, 0)

    body = extract_assistant_text(proc.stdout)
    if not body:
        return (lang, "EMPTY_BODY", dur, 0)

    try:
        data = parse_json_relaxed(body)
    except json.JSONDecodeError as e:
        return (lang, f"BAD_JSON: {e}; head={body[:100]!r}", dur, len(body))

    if not isinstance(data, dict):
        return (lang, f"NOT_DICT: {type(data).__name__}", dur, len(body))
    if len(data) != n:
        return (lang, f"COUNT_MISMATCH: got {len(data)}, expected {n}", dur, len(body))

    normalized = {}
    for i in range(n):
        k = str(i)
        if k not in data:
            return (lang, f"MISSING_KEY: {k}", dur, len(body))
        ent = data[k]
        if not isinstance(ent, dict) or "text" not in ent or not str(ent["text"]).strip():
            return (lang, f"BAD_ENTRY at {k}", dur, len(body))
        rom = ent.get("romanization")
        if isinstance(rom, str) and not rom.strip():
            rom = None
        normalized[k] = {"text": ent["text"], "romanization": rom}

    out_path.write_text(json.dumps(normalized, ensure_ascii=False, indent=2))
    return (lang, "OK", dur, out_path.stat().st_size)


def main() -> int:
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("pack_dir", help="Path to the pack input directory")
    p.add_argument("--langs", help="Comma-separated codes (default: all 51 minus en)")
    p.add_argument("--workers", type=int, default=12)
    p.add_argument("--model", help="Codex model override (-c model=...)")
    p.add_argument("--effort", default="low", choices=["minimal", "low", "medium", "high", "xhigh"])
    p.add_argument("--timeout", type=int, default=240, help="Per-language timeout (sec)")
    p.add_argument("--write-en", action="store_true",
                   help="Generate en.json directly from phrases.json (no model call)")
    ns = p.parse_args()

    pack_dir = Path(ns.pack_dir).resolve()
    if not pack_dir.is_dir():
        raise SystemExit(f"not a directory: {pack_dir}")
    meta = json.loads((pack_dir / "pack.json").read_text())
    phrases = json.loads((pack_dir / "phrases.json").read_text())
    n = len(phrases)
    topic = meta.get("topic", meta.get("name", "general"))
    print(f"[orchestrator] pack={meta['id']} v{meta['version']}  n={n}  topic={topic}")

    if ns.write_en:
        en = {str(i): {"text": p["english"], "romanization": None} for i, p in enumerate(phrases)}
        en_path = pack_dir / "translations" / "en.json"
        en_path.parent.mkdir(exist_ok=True)
        en_path.write_text(json.dumps(en, ensure_ascii=False, indent=2))
        print(f"[en] wrote {en_path}: {len(en)} entries")

    langs = (tuple(s.strip() for s in ns.langs.split(",") if s.strip())
             if ns.langs else tuple(l for l in ALL_LANGS if l != "en"))
    print(f"[orchestrator] codex model={ns.model or 'codex-default'}  effort={ns.effort}  "
          f"workers={ns.workers}  langs={len(langs)}")

    t0 = time.time()
    results: list[tuple[str, str, float, int]] = []
    with concurrent.futures.ThreadPoolExecutor(max_workers=ns.workers) as pool:
        futs = {pool.submit(translate_one, l, pack_dir, topic, phrases,
                            ns.model, ns.effort, ns.timeout): l for l in langs}
        for fut in concurrent.futures.as_completed(futs):
            lang, status, dur, sz = fut.result()
            marker = "✓" if status == "OK" else "✗"
            print(f"  {marker} {lang:<14} {dur:>6.1f}s  {sz:>7}B  {status}")
            results.append((lang, status, dur, sz))

    elapsed = time.time() - t0
    ok = sum(1 for _, s, _, _ in results if s == "OK")
    print(f"\n[orchestrator] {ok}/{len(langs)} OK in {elapsed:.1f}s")
    if ok < len(langs):
        print("[orchestrator] failed:")
        for l, s, _, _ in results:
            if s != "OK":
                print(f"  - {l}: {s}")
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
