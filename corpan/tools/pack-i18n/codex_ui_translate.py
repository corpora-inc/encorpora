#!/usr/bin/env python3
"""
Parallel codex-CLI translator for pack UI string maps.

Adapted from `corpan/tools/phrase-packs/codex_translate.py` — same
codex-exec orchestration pattern, but for *key→value* string maps used
by pack UIs (button labels, help text, HUD strings) rather than the
indexed phrase arrays used by phrase packs.

Differences from the phrase-pack script:

  - Input is a JSON object of `{key: english_string}`; output is the
    same shape with translated values.
  - No romanization. UI strings ship in the native script only.
  - `{{param}}` placeholders MUST be preserved untouched. The prompt
    is explicit; the script validates the round-trip.
  - Optional `--context` file maps `{key: hint}` so the translator
    sees what each string is for. Optional `--pack-context` is a
    one-paragraph preamble (the pack's overall purpose).

Usage:
  python codex_ui_translate.py <input.en.json> --out-dir <dir>
                               [--langs es,fr,...]
                               [--workers 12]
                               [--model gpt-5.4]
                               [--effort low|medium|high|xhigh|minimal]
                               [--timeout 240]
                               [--context strings.context.json]
                               [--pack-context "Hover Runner is..."]
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

# Reuse the canonical language list + names + per-language style notes
# from the phrase-pack translator so both pipelines stay in lockstep.
sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "phrase-packs"))
from codex_translate import ALL_LANGS, LANG_NAME, LANG_NOTES  # noqa: E402

PLACEHOLDER_RE = re.compile(r"\{\{\w+\}\}")

_ASSISTANT_RE = re.compile(
    r"\ncodex\n(?P<body>.*?)(?=\n(?:tokens used|user|codex)\n|\Z)",
    re.DOTALL,
)


def extract_assistant_text(stdout: str) -> str:
    matches = list(_ASSISTANT_RE.finditer(stdout))
    return matches[-1].group("body").strip() if matches else stdout.strip()


def parse_json_relaxed(text: str) -> object:
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


def translate_one(
    lang: str,
    out_dir: Path,
    source: dict[str, str],
    context: dict[str, str] | None,
    pack_context: str | None,
    model: str | None,
    effort: str,
    timeout: int,
    only_missing: bool = False,
) -> tuple[str, str, float, int]:
    out_path = out_dir / f"{lang}.json"
    out_path.parent.mkdir(exist_ok=True, parents=True)

    # Delta mode: translate only the keys absent from the existing
    # locale file, then merge back. Cheap when adding 1–5 new strings
    # to a pack that's already fully translated.
    existing: dict[str, str] = {}
    work_keys = list(source.keys())
    if only_missing and out_path.exists():
        try:
            existing_raw = json.loads(out_path.read_text())
            if isinstance(existing_raw, dict):
                existing = {k: v for k, v in existing_raw.items() if isinstance(v, str)}
        except json.JSONDecodeError:
            existing = {}
        work_keys = [k for k in source.keys() if k not in existing]
        if not work_keys:
            return (lang, "OK (no missing)", 0.0, out_path.stat().st_size if out_path.exists() else 0)

    work_source = {k: source[k] for k in work_keys}
    work_context = (
        {k: context[k] for k in work_keys if context and k in context}
        if context
        else None
    )

    prompt = build_prompt(lang, work_source, work_context, pack_context)

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

    expected = set(work_keys)
    got = set(data.keys())
    if got != expected:
        missing = expected - got
        extra = got - expected
        return (
            lang,
            f"KEY_MISMATCH: missing={sorted(missing)[:3]} extra={sorted(extra)[:3]}",
            dur,
            len(body),
        )

    # Placeholder integrity check (only on the keys we actually asked for)
    for k in work_keys:
        v = source[k]
        src_ph = placeholders_in(v)
        if not src_ph:
            continue
        translated = data[k]
        if not isinstance(translated, str):
            return (lang, f"BAD_VALUE_TYPE at {k}: {type(translated).__name__}", dur, len(body))
        dst_ph = placeholders_in(translated)
        if src_ph != dst_ph:
            return (
                lang,
                f"PLACEHOLDER_CORRUPT at {k}: src={src_ph!r} dst={dst_ph!r}",
                dur,
                len(body),
            )

    # Merge: existing + freshly translated. Final file is keyed in the
    # source's natural order (so the locale stays diff-friendly).
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
    p.add_argument("--out-dir", required=True, help="Directory to write `<lang>.json` files into")
    p.add_argument("--langs", help="Comma-separated codes (default: all 51 minus en)")
    p.add_argument("--workers", type=int, default=12)
    p.add_argument("--model", help="Codex model override (-c model=...)")
    p.add_argument("--effort", default="low", choices=["minimal", "low", "medium", "high", "xhigh"])
    p.add_argument("--timeout", type=int, default=240)
    p.add_argument("--context", help="Optional `{key: hint}` JSON file with per-key context")
    p.add_argument("--pack-context", help="Optional one-paragraph preamble describing the pack")
    p.add_argument(
        "--only-missing",
        action="store_true",
        help="For each language, translate only the keys absent from the existing locale file and merge back into it. Skips languages already at 100%% coverage.",
    )
    ns = p.parse_args()

    src_path = Path(ns.input).resolve()
    if not src_path.is_file():
        raise SystemExit(f"input not found: {src_path}")
    source = json.loads(src_path.read_text())
    if not isinstance(source, dict) or not all(isinstance(v, str) for v in source.values()):
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
        f"langs={len(langs)}  model={ns.model or 'codex-default'}  "
        f"effort={ns.effort}  workers={ns.workers}"
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
                ns.model,
                ns.effort,
                ns.timeout,
                ns.only_missing,
            ): lang
            for lang in langs
        }
        for fut in concurrent.futures.as_completed(futs):
            lang, status, dur, sz = fut.result()
            marker = "OK " if status == "OK" else "!! "
            print(f"  {marker}{lang:<14} {dur:>6.1f}s  {sz:>7}B  {status}")
            results.append((lang, status, dur, sz))

    elapsed = time.time() - t0
    ok = sum(1 for _, s, _, _ in results if s == "OK")
    print(f"\n[orchestrator] {ok}/{len(langs)} OK in {elapsed:.1f}s")
    if ok < len(langs):
        print("[orchestrator] failed:")
        for lang, status, _, _ in results:
            if status != "OK":
                print(f"  - {lang}: {status}")
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
