#!/usr/bin/env python3
"""Scaffold a new Tutomaton language module from the universal template.

Usage:
    python3 scripts/bootstrap-language.py <code> <name> [<native_name>] [<voice_code>]

Examples:
    python3 scripts/bootstrap-language.py fr French Français fr-FR
    python3 scripts/bootstrap-language.py ja Japanese 日本語 ja-JP
    python3 scripts/bootstrap-language.py de German Deutsch de-DE

What it does:
    1. Creates packs/tutomaton/languages/<code>/ with the same directory layout
       as the _template/
    2. Copies every *.template file → strips `.template` → substitutes
       {LANG_CODE} / {LANG_NAME} / {LANG_NATIVE_NAME} / {VOICE_CODE}
    3. Refuses to overwrite an existing language dir
    4. Prints next-steps

After running:
    cd languages/<code>
    # 1. Author lesson_data.py (fill in the 30 universal lesson stubs)
    # 2. Author theme_data.py (fill in 25 themes × ~30 items)
    # 3. Optional: author l1_errors_data.py for high-ROI L1s
    # 4. Optional: customize build_corpus.py for language-specific tables
    # 5. python3 build_corpus.py to build the sqlite
    # 6. python3 tools/llm-packs/publish.py language packs/tutomaton <code>
    #      --sync-manifest --upload
"""
from __future__ import annotations
import shutil
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
PACK_ROOT = HERE.parent
TEMPLATE_DIR = PACK_ROOT / "languages" / "_template"
LANGUAGES_DIR = PACK_ROOT / "languages"


def substitute(text: str, vars: dict[str, str]) -> str:
    for key, val in vars.items():
        text = text.replace("{" + key + "}", val)
    return text


def main():
    if len(sys.argv) < 3:
        print(__doc__)
        sys.exit(1)

    code = sys.argv[1]
    name = sys.argv[2]
    native_name = sys.argv[3] if len(sys.argv) > 3 else name
    voice_code = sys.argv[4] if len(sys.argv) > 4 else f"{code}-{code.upper()}"

    if not code.isalpha() or not 2 <= len(code) <= 5:
        sys.exit(f"language code must be 2-5 letters, got: {code}")

    target = LANGUAGES_DIR / code
    if target.exists():
        sys.exit(f"target already exists: {target} (refusing to overwrite)")

    if not TEMPLATE_DIR.exists():
        sys.exit(f"template not found: {TEMPLATE_DIR}")

    vars = {
        "LANG_CODE": code,
        "LANG_NAME": name,
        "LANG_NATIVE_NAME": native_name,
        "VOICE_CODE": voice_code,
    }

    print(f"Scaffolding {name} ({code}) → {target}")
    print(f"  native: {native_name}, voice: {voice_code}")

    # Walk the template tree. Only copy *.template files (substituting
    # placeholders); other files (like schema_base.sql) stay shared in
    # _template/ and are read at build time via a relative path.
    n_files = 0
    for src in sorted(TEMPLATE_DIR.rglob("*")):
        if src.is_dir():
            continue
        if not src.name.endswith(".template"):
            continue  # shared file (schema_base.sql etc.) — stays in _template/
        rel = src.relative_to(TEMPLATE_DIR)
        dst_rel = rel.with_suffix("")  # strip .template
        dst = target / dst_rel
        dst.parent.mkdir(parents=True, exist_ok=True)
        try:
            text = src.read_text()
            dst.write_text(substitute(text, vars))
        except UnicodeDecodeError:
            shutil.copy2(src, dst)
        n_files += 1

    # Ensure data/ dir exists (gitignored — corpus output lands here)
    (target / "data").mkdir(parents=True, exist_ok=True)
    # Ensure _source/ dir exists (committed — input overrides land here)
    (target / "_source").mkdir(parents=True, exist_ok=True)

    print(f"  scaffolded {n_files} files")
    print()
    print(f"Next steps (in {target.relative_to(Path.cwd()) if target.is_relative_to(Path.cwd()) else target}):")
    print(f"  1. Fill in lesson_data.py (~30 universal lessons, ~400-600 words each)")
    print(f"  2. Fill in theme_data.py (25 themes × ~30 items)")
    print(f"  3. Optional: l1_errors_data.py for high-ROI L1s")
    print(f"  4. Optional: extend build_corpus.py with language-specific tables")
    print(f"  5. Download kaikki dump:")
    print(f"     curl -fL https://kaikki.org/dictionary/{name}/kaikki.org-dictionary-{name}.jsonl \\")
    print(f"       -o ~/data/kaikki/kaikki-{code}.jsonl")
    print(f"  6. Build the corpus:")
    print(f"     python3 build_corpus.py")
    print(f"  7. Publish to CDN:")
    print(f"     python3 ../../../tools/llm-packs/publish.py language packs/tutomaton {code} \\")
    print(f"       --sync-manifest --upload")


if __name__ == "__main__":
    main()
