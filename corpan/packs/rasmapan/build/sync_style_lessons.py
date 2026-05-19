#!/usr/bin/env python3
"""Sync the 49-locale `description_md` from styles_seed.json into the
matching `body_md` entries on the style lessons (ord 7-10) inside
lessons_seed.json. Same content, two consumers — better to write once
in styles_seed and replicate than to maintain two diverging copies.

Title stays as "<EnglishName> · <ArabicName>" everywhere because the
calligraphic style names are proper nouns and don't translate.
"""

import json
import pathlib

ROOT = pathlib.Path(__file__).parent
styles = json.loads((ROOT / "seed" / "styles_seed.json").read_text())
lessons = json.loads((ROOT / "seed" / "lessons_seed.json").read_text())

style_by_id = {s["id"]: s for s in styles}

ID_MAP = {
    "style-naskh": "naskh",
    "style-thuluth": "thuluth",
    "style-diwani": "diwani",
    "style-kufic": "kufic",
}

for lesson in lessons:
    sid = ID_MAP.get(lesson["id"])
    if not sid:
        continue
    style = style_by_id.get(sid)
    if not style:
        continue
    s_title = f"{style['name_en']} · {style['name_ar']}"
    i18n = lesson.setdefault("i18n", {})
    for lang, variant in (style.get("i18n") or {}).items():
        body = variant.get("description_md")
        if not body:
            continue
        cur = i18n.setdefault(lang, {})
        cur.setdefault("title", s_title)
        cur["body_md"] = body

(ROOT / "seed" / "lessons_seed.json").write_text(
    json.dumps(lessons, indent=2, ensure_ascii=False) + "\n"
)

counts = {L["id"]: len(L.get("i18n") or {}) for L in lessons if L["id"] in ID_MAP}
print("style-lesson i18n counts after sync:", counts)
