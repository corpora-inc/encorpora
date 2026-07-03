#!/usr/bin/env python3
"""FIXTURE-ONLY helper: regenerate fixtures/course/strings/<lang>.json.

The fixture ships passthrough (English) copy for all 54 canonical languages so
gate V-5 genuinely runs. Real courses NEVER do this — course strings are
agent-translated source code (course-pack.md §5). Run after editing the
fixture YAML:

    python3 fixtures/gen_strings.py
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent))

import yaml  # noqa: E402

from journey_common import ALL_LANGUAGES  # noqa: E402

COURSE = HERE / "course"


def mint_en_strings() -> dict:
    out: dict = {}
    course = yaml.safe_load((COURSE / "course.yaml").read_text(encoding="utf-8"))
    for arc in course["arcs"]:
        out[f"arc.{arc['id']}.title"] = arc["title"]
    for f in sorted((COURSE / "units").glob("*.yaml")):
        u = yaml.safe_load(f.read_text(encoding="utf-8"))
        out[f"unit.{u['id']}.theme"] = u["theme"]
        for cd in u["cando"]:
            out[f"cando.{u['id']}.{cd['key']}"] = cd["text"]
        for s in u.get("skills", []):
            out[f"skill.{s['id']}.title"] = s["title"]
    grammar = yaml.safe_load((COURSE / "grammar.yaml").read_text(encoding="utf-8"))
    for n in grammar["nodes"]:
        out[f"gn.{n['id']}.title"] = n["title"]
        out[f"gn.{n['id']}.note"] = n["note"]
    recipes = yaml.safe_load(
        (HERE.parent / "recipes.yaml").read_text(encoding="utf-8")
    )
    for r in recipes["recipes"]:
        out[f"recipe.{r['id']}.title"] = r["title"]
    overlays_dir = COURSE / "overlays"
    overlay_keys: dict = {}
    if overlays_dir.exists():
        for f in sorted(overlays_dir.glob("*.yaml")):
            ov = yaml.safe_load(f.read_text(encoding="utf-8"))
            for note in ov.get("contrastive_notes", []):
                overlay_keys.setdefault(ov["l1"], {})[
                    f"ovl.{ov['l1']}.{note['ref']}.note"
                ] = note["note"]
    return {"base": out, "overlays": overlay_keys}


def main() -> None:
    minted = mint_en_strings()
    strings_dir = COURSE / "strings"
    strings_dir.mkdir(exist_ok=True)
    for lang in ALL_LANGUAGES:
        table = dict(minted["base"])
        # overlay keys need exactly (l1, en) copies (V-5)
        for l1, keys in minted["overlays"].items():
            if lang in (l1, "en"):
                table.update(keys)
        if lang == "en":
            # en is minted from the YAML by the builder; keep en.json as the
            # agreement copy (builder cross-checks it).
            pass
        path = strings_dir / f"{lang}.json"
        path.write_text(
            json.dumps(table, ensure_ascii=False, indent=2, sort_keys=True) + "\n",
            encoding="utf-8",
        )
        print(f"wrote {path.name} ({len(table)} keys)")


if __name__ == "__main__":
    main()
