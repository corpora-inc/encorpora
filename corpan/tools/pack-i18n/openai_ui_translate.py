#!/usr/bin/env python3
"""
Parallel OpenAI-backed translator for pack UI string maps.

Drop-in alternative to `codex_ui_translate.py` for moments when the
Codex CLI is rate-limited or unavailable. Same CLI surface, same
placeholder/key validation, same per-language locale-notes block —
just talks to `api.openai.com/v1/chat/completions` directly with
`$OPENAI_API_KEY` instead of routing through `codex exec`.

Uses stdlib only (urllib + json + concurrent.futures) so it can run
in any Python 3.8+ without a venv.

Usage:
  python3 openai_ui_translate.py <input.en.json> --out-dir <dir>
                                 [--langs es,fr,...]
                                 [--workers 12]
                                 [--model gpt-4.1-mini]
                                 [--temperature 0.2]
                                 [--timeout 90]
                                 [--only-missing]
                                 [--pack-context "..."]
                                 [--context strings.context.json]
"""

from __future__ import annotations

import argparse
import concurrent.futures
import json
import os
import re
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

# Reuse the canonical language list + names + per-language style notes
# from the phrase-pack translator so all three pipelines stay in lockstep.
sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "phrase-packs"))
from codex_translate import ALL_LANGS, LANG_NAME, LANG_NOTES  # noqa: E402

PLACEHOLDER_RE = re.compile(r"\{\{\w+\}\}")
OPENAI_URL = "https://api.openai.com/v1/chat/completions"


def placeholders_in(s: str) -> tuple[str, ...]:
    return tuple(sorted(PLACEHOLDER_RE.findall(s)))


def build_prompt(
    lang: str,
    source: dict[str, str],
    context: dict[str, str] | None,
    pack_context: str | None,
) -> str:
    name = LANG_NAME[lang]
    note = LANG_NOTES.get(lang, "")
    note_block = f"\nLANGUAGE-SPECIFIC NOTES: {note}\n" if note else ""
    pack_block = f"\nPACK CONTEXT: {pack_context}\n" if pack_context else ""

    lines = []
    for k, v in source.items():
        hint = (context or {}).get(k)
        if hint:
            lines.append(f"  {json.dumps(k)}: {json.dumps(v)}   // {hint}")
        else:
            lines.append(f"  {json.dumps(k)}: {json.dumps(v)}")
    pretty_input = "{\n" + ",\n".join(lines) + "\n}"

    return f"""Translate the following UI strings into {name} (BCP-47: {lang}) for a Corpán language-learning pack.

QUALITY: natural, conversational, modern {name}. Short and button-like where the source is short. Match the register and tone of the source. Idiomatic, not literal.
{pack_block}{note_block}
RULES (STRICT):
1. Return ONE JSON object with EXACTLY the same keys as the input. No extra keys, no missing keys.
2. Preserve EVERY `{{{{placeholder}}}}` token in the same form, with the same spelling, in the same number. Reorder them within a sentence if natural to the target language, but do not invent, drop, rename, translate, or alter the braces or the variable name inside.
3. Preserve emoji, symbols (•, →, ←, %, etc.) exactly as they appear.
4. Output ONLY the JSON object — no prose, no markdown fences. UTF-8.

INPUT (the comment after `//` on some lines is just context — do NOT translate it):
{pretty_input}
"""


def call_openai(
    api_key: str,
    model: str,
    prompt: str,
    temperature: float,
    timeout: int,
) -> tuple[str, str]:
    """Returns (content, error). On success, error is ''."""
    body = {
        "model": model,
        "messages": [
            {
                "role": "system",
                "content": "You are a precise translator. Return only valid JSON matching the requested schema, no prose, no markdown fences.",
            },
            {"role": "user", "content": prompt},
        ],
        "temperature": temperature,
        "response_format": {"type": "json_object"},
    }
    data = json.dumps(body).encode("utf-8")
    req = urllib.request.Request(
        OPENAI_URL,
        data=data,
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            raw = resp.read().decode("utf-8")
    except urllib.error.HTTPError as e:
        return "", f"HTTP_{e.code}: {e.read().decode('utf-8', errors='replace')[:200]}"
    except urllib.error.URLError as e:
        return "", f"URL_ERROR: {e.reason}"
    except TimeoutError:
        return "", "TIMEOUT"
    try:
        parsed = json.loads(raw)
    except json.JSONDecodeError as e:
        return "", f"BAD_RESPONSE: {e}; head={raw[:120]!r}"
    try:
        content = parsed["choices"][0]["message"]["content"]
    except (KeyError, IndexError, TypeError):
        return "", f"NO_CONTENT in response: {raw[:200]!r}"
    return content, ""


def translate_one(
    lang: str,
    out_dir: Path,
    source: dict[str, str],
    context: dict[str, str] | None,
    pack_context: str | None,
    api_key: str,
    model: str,
    temperature: float,
    timeout: int,
    only_missing: bool = False,
) -> tuple[str, str, float, int]:
    out_path = out_dir / f"{lang}.json"
    out_path.parent.mkdir(exist_ok=True, parents=True)

    existing: dict[str, str] = {}
    work_keys = list(source.keys())
    if only_missing and out_path.exists():
        try:
            existing_raw = json.loads(out_path.read_text())
            if isinstance(existing_raw, dict):
                existing = {
                    k: v
                    for k, v in existing_raw.items()
                    if isinstance(v, str)
                }
        except json.JSONDecodeError:
            existing = {}
        work_keys = [k for k in source.keys() if k not in existing]
        if not work_keys:
            return (
                lang,
                "OK (no missing)",
                0.0,
                out_path.stat().st_size if out_path.exists() else 0,
            )

    work_source = {k: source[k] for k in work_keys}
    work_context = (
        {k: context[k] for k in work_keys if context and k in context}
        if context
        else None
    )

    prompt = build_prompt(lang, work_source, work_context, pack_context)

    t0 = time.time()
    content, err = call_openai(api_key, model, prompt, temperature, timeout)
    dur = time.time() - t0

    if err:
        return (lang, err, dur, 0)
    if not content:
        return (lang, "EMPTY_BODY", dur, 0)

    try:
        data = json.loads(content)
    except json.JSONDecodeError as e:
        return (lang, f"BAD_JSON: {e}; head={content[:100]!r}", dur, len(content))

    if not isinstance(data, dict):
        return (lang, f"NOT_DICT: {type(data).__name__}", dur, len(content))

    expected = set(work_keys)
    got = set(data.keys())
    if got != expected:
        missing = expected - got
        extra = got - expected
        return (
            lang,
            f"KEY_MISMATCH: missing={sorted(missing)[:3]} extra={sorted(extra)[:3]}",
            dur,
            len(content),
        )

    for k in work_keys:
        v = source[k]
        src_ph = placeholders_in(v)
        if not src_ph:
            continue
        translated = data[k]
        if not isinstance(translated, str):
            return (
                lang,
                f"BAD_VALUE_TYPE at {k}: {type(translated).__name__}",
                dur,
                len(content),
            )
        dst_ph = placeholders_in(translated)
        if src_ph != dst_ph:
            return (
                lang,
                f"PLACEHOLDER_CORRUPT at {k}: src={src_ph!r} dst={dst_ph!r}",
                dur,
                len(content),
            )

    merged = dict(existing)
    for k in work_keys:
        merged[k] = str(data[k])
    out = {k: merged[k] for k in source.keys() if k in merged}
    out_path.write_text(json.dumps(out, ensure_ascii=False, indent=2) + "\n")
    return (lang, "OK", dur, out_path.stat().st_size)


def main() -> int:
    p = argparse.ArgumentParser(
        description=__doc__,
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    p.add_argument("input", help="Path to source `.en.json` of key→string pairs")
    p.add_argument(
        "--out-dir",
        required=True,
        help="Directory to write `<lang>.json` files into",
    )
    p.add_argument(
        "--langs",
        help="Comma-separated codes (default: all 51 minus en)",
    )
    p.add_argument("--workers", type=int, default=12)
    p.add_argument("--model", default="gpt-4.1-mini")
    p.add_argument("--temperature", type=float, default=0.2)
    p.add_argument("--timeout", type=int, default=90)
    p.add_argument(
        "--context",
        help="Optional `{key: hint}` JSON file with per-key context",
    )
    p.add_argument(
        "--pack-context",
        help="Optional one-paragraph preamble describing the pack",
    )
    p.add_argument(
        "--only-missing",
        action="store_true",
        help=(
            "For each language, translate only the keys absent from the "
            "existing locale file and merge back into it. Skips languages "
            "already at 100%% coverage."
        ),
    )
    ns = p.parse_args()

    api_key = os.environ.get("OPENAI_API_KEY", "").strip()
    if not api_key:
        raise SystemExit("OPENAI_API_KEY is not set in the environment")

    src_path = Path(ns.input).resolve()
    if not src_path.is_file():
        raise SystemExit(f"input not found: {src_path}")
    source = json.loads(src_path.read_text())
    if not isinstance(source, dict) or not all(
        isinstance(v, str) for v in source.values()
    ):
        raise SystemExit("input must be a flat JSON object of {key: string}")

    out_dir = Path(ns.out_dir).resolve()
    context = None
    if ns.context:
        ctx_path = Path(ns.context).resolve()
        context = json.loads(ctx_path.read_text())

    langs = (
        tuple(s.strip() for s in ns.langs.split(",") if s.strip())
        if ns.langs
        else tuple(l for l in ALL_LANGS if l != "en")
    )

    print(
        f"[orchestrator] src={src_path.name}  out={out_dir}  keys={len(source)}  "
        f"langs={len(langs)}  model={ns.model}  temperature={ns.temperature}  "
        f"workers={ns.workers}"
    )

    t0 = time.time()
    results: list[tuple[str, str, float, int]] = []
    with concurrent.futures.ThreadPoolExecutor(max_workers=ns.workers) as pool:
        futs = {
            pool.submit(
                translate_one,
                lang,
                out_dir,
                source,
                context,
                ns.pack_context,
                api_key,
                ns.model,
                ns.temperature,
                ns.timeout,
                ns.only_missing,
            ): lang
            for lang in langs
        }
        for fut in concurrent.futures.as_completed(futs):
            lang, status, dur, sz = fut.result()
            marker = "OK " if status == "OK" or status == "OK (no missing)" else "!! "
            print(f"  {marker}{lang:<14} {dur:>6.1f}s  {sz:>7}B  {status}")
            results.append((lang, status, dur, sz))

    elapsed = time.time() - t0
    ok = sum(
        1
        for _, s, _, _ in results
        if s == "OK" or s == "OK (no missing)"
    )
    print(f"\n[orchestrator] {ok}/{len(langs)} OK in {elapsed:.1f}s")
    if ok < len(langs):
        print("[orchestrator] failed:")
        for lang, status, _, _ in results:
            if status != "OK" and status != "OK (no missing)":
                print(f"  - {lang}: {status}")
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
