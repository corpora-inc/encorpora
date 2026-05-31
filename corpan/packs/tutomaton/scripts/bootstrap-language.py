#!/usr/bin/env python3
"""Scaffold a new Tutomaton language source pack (the built-in `core` source)
from the universal template.

Usage:
    python3 scripts/bootstrap-language.py <code> <name> [<native_name>] [<voice_code>]

Examples:
    python3 scripts/bootstrap-language.py hi Hindi   हिन्दी   hi-IN
    python3 scripts/bootstrap-language.py ko-polite Korean 한국어 ko-KR

What it does:
    1. Creates languages/<code>/sources/core/ with the contents of _template/sources/core/
    2. Substitutes {LANG_CODE} / {LANG_NAME} / {LANG_NATIVE_NAME} / {VOICE_CODE} in
       every *.template file, drops the `.template` suffix.
    3. Generates the source manifest with id `tutomaton-corpus-<code>-core-v1`.
    4. Refuses to overwrite an existing sources/core/ dir.

What it does NOT do (frontend agent owns these):
    - languages/<code>/module.json           — owned by frontend
    - languages/<code>/prompts/system_prompt.txt + grounding_instruction.txt — generated
      by tools/gen_prompts.py (frontend)

After running:
    cd languages/<code>/sources/core
    # 1. Fill in lesson_data.py        (~30 universal lessons, ~400-600 words each)
    # 2. Fill in theme_data.py         (~25 themes × ~30 items)
    # 3. Optional: l1_errors_data.py   (for high-ROI L1 cohorts)
    # 4. Optional: extend build_corpus.py with language-specific tables
    # 5. python3 build_corpus.py       → writes data/<code>.sqlite3
    # 6. From repo root:
    #    python3 corpan/tools/llm-packs/publish.py source \\
    #        corpan/packs/tutomaton/languages/<code>/sources/core --upload
    # 7. Hand the resulting sha256 + URL to the frontend agent for catalog registration.
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

    # Tutomaton language codes can include hyphens (pt-BR, zh-Hant, ko-polite, pa-Arab).
    # Allow [A-Za-z0-9-], 2-12 chars.
    if not all(c.isalnum() or c == "-" for c in code) or not 2 <= len(code) <= 12:
        sys.exit(
            f"language code must be alphanumeric + hyphens, 2-12 chars, got: {code!r}"
        )

    target = LANGUAGES_DIR / code / "sources" / "core"
    if target.exists():
        sys.exit(
            f"target already exists: {target} (refusing to overwrite)\n"
            f"To start over, delete it first; this script does not migrate."
        )

    if not TEMPLATE_DIR.exists():
        sys.exit(f"template not found: {TEMPLATE_DIR}")

    template_core = TEMPLATE_DIR / "sources" / "core"
    if not template_core.exists():
        sys.exit(
            f"template/sources/core not found: {template_core}\n"
            f"Has the kit been refactored to the source-pack shape?"
        )

    vars = {
        "LANG_CODE": code,
        "LANG_NAME": name,
        "LANG_NATIVE_NAME": native_name,
        "VOICE_CODE": voice_code,
    }

    print(f"Scaffolding {name} ({code}) → {target}")
    print(f"  native: {native_name}, voice: {voice_code}")
    print(f"  source id: tutomaton-corpus-{code}-core-v1")

    # Walk template/sources/core/ tree. Only copy *.template files (substituting
    # placeholders). Non-template files (like the shared schema_base.sql at the
    # _template root) stay where they are; build scripts reference them via
    # relative path.
    n_files = 0
    for src in sorted(template_core.rglob("*")):
        if src.is_dir():
            continue
        if not src.name.endswith(".template"):
            continue  # shared file — stays in _template/
        rel = src.relative_to(template_core)
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
    # Ensure _source/ dir exists (committed under the source — input overrides)
    (target / "_source").mkdir(parents=True, exist_ok=True)

    print(f"  scaffolded {n_files} files under sources/core/")
    print()
    rel = target.relative_to(Path.cwd()) if target.is_relative_to(Path.cwd()) else target
    print(f"Next steps (in {rel}):")
    print(f"  1. Fill in lesson_data.py    (~30 universal lessons, ~400-600 words each)")
    print(f"  2. Fill in theme_data.py     (~25 themes × ~30 items)")
    print(f"  3. Optional: l1_errors_data.py for high-ROI L1 cohorts")
    print(f"  4. Optional: extend build_corpus.py with language-specific tables")
    print(f"  5. python3 build_corpus.py   → writes data/{code}.sqlite3")
    print(f"  6. From repo root, publish to CDN:")
    print(f"     python3 corpan/tools/llm-packs/publish.py source \\")
    print(f"         corpan/packs/tutomaton/languages/{code}/sources/core --upload")
    print(f"  7. Hand the sha256 + URL to the frontend agent for catalog registration.")
    print()
    print(f"Note: this script does NOT create languages/{code}/module.json or prompts/.")
    print(f"  Those are owned by the frontend agent (see RAG_SOURCES_CONTRACT.md §9.a).")


if __name__ == "__main__":
    main()
