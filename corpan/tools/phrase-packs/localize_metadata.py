#!/usr/bin/env python3
"""
Localize pack + curation-group metadata into all 54 ALL_LANGUAGES locales.

For each pack.json: translate name, description, topic → fill
  name_localized, description_localized, topic_localized maps.

For curation.json phrasePackGroups: translate label, description → fill
  label_localized, description_localized maps.

Uses Gemini 2.5 Flash on Vertex AI. One call per (subject, lang) — short
texts, cheap, ~5 min wall for the full set.

Idempotent: skips per-lang entries that already exist (so re-runs only
fill in what's missing). Use --force to overwrite.

Usage:
  python localize_metadata.py --packs              # all 24 packs
  python localize_metadata.py --curation           # curation.json groups
  python localize_metadata.py --all                # both
  python localize_metadata.py --pack <id>          # one pack
  python localize_metadata.py --workers 17
  python localize_metadata.py --force              # overwrite existing entries
"""

from __future__ import annotations

import argparse
import concurrent.futures
import json
import os
import sys
import time
from pathlib import Path

from dotenv import load_dotenv
load_dotenv(Path.home() / ".env")

HERE = Path(__file__).parent.resolve()
sys.path.insert(0, str(HERE))

from gemini_translate import ALL_LANGS, LANG_NAME, LANG_NOTES, make_client
from google.genai import types as gtypes


def pack_dir_for(pack_id: str) -> Path:
    if pack_id == "phrase-botany-basics":
        return HERE / "example-botany"
    return HERE / pack_id


def all_pack_ids() -> list[str]:
    """All packs with a pack.json on disk."""
    ids = []
    for d in sorted(HERE.iterdir()):
        if not d.is_dir(): continue
        pf = d / "pack.json"
        if not pf.is_file(): continue
        try:
            meta = json.loads(pf.read_text())
            if str(meta.get("id", "")).startswith("phrase-"):
                ids.append(meta["id"])
        except Exception:
            pass
    return ids


import threading
_thread_local = threading.local()


def get_client():
    """Thread-local Vertex client. The genai SDK's client isn't safe for
    cross-thread reuse after first call (we hit "client has been closed"
    errors with a single shared instance). One per thread fixes it."""
    if not hasattr(_thread_local, "client"):
        _thread_local.client = make_client(vertex=True)
    return _thread_local.client


def build_meta_prompt(lang: str, pack_name: str, pack_topic: str,
                      fields: dict[str, str]) -> str:
    """fields: {field_label: english_text}. Returns a JSON-output prompt."""
    name = LANG_NAME.get(lang, lang)
    note = LANG_NOTES.get(lang, "")
    note_block = f"\nLANGUAGE NOTES:\n{note}\n" if note else ""

    fields_block = "\n".join(f'  - {label}: {text!r}' for label, text in fields.items())
    keys = ", ".join(f'"{k}"' for k in fields)

    return f"""You are a fluent native speaker of {name} (BCP-47: {lang}) translating UI metadata for a language-learning app.

Context: this is the "{pack_name}" phrase pack about {pack_topic}. The text below is shown as a pack title / description / topic-pill in the catalog and onboarding screens.

QUALITY BAR:
- Natural, idiomatic {name} — the way a native UI writer would phrase it.
- Concise. Match the English length roughly (a short label stays short).
- Pack names are proper nouns / titles — translate the *concept* (e.g. "Cooking Basics" → "Cocina básica", not "Conceptos básicos de cocción").
- Descriptions are sentence-case, no end period unless natural.
- Topic pill is a short noun phrase, often one or two words.
{note_block}
TRANSLATE these fields into {name}:
{fields_block}

OUTPUT: a single JSON object with keys {keys}. Each value is the {name} translation as a plain string. No prose, no markdown, no fences.
"""


def call_vertex(prompt: str, timeout_s: float = 60.0) -> tuple[str, str | None]:
    """Returns (text, error). Uses a thread-side timeout because the genai
    SDK occasionally hangs forever on an upstream call."""
    holder: dict = {}

    def _do():
        try:
            resp = get_client().models.generate_content(
                model="gemini-2.5-flash",
                contents=prompt,
                config=gtypes.GenerateContentConfig(
                    temperature=0.1,
                    max_output_tokens=4096,
                    response_mime_type="application/json",
                ),
            )
            holder["text"] = (resp.text or "").strip()
        except Exception as e:
            holder["err"] = f"VERTEX_ERR:{type(e).__name__}:{str(e)[:200]}"

    t = threading.Thread(target=_do, daemon=True)
    t.start()
    t.join(timeout_s)
    if t.is_alive():
        return ("", f"TIMEOUT:{timeout_s}s")
    if "err" in holder:
        return ("", holder["err"])
    return (holder.get("text", ""), None)


def translate_pack_for_lang(pack_id: str, meta: dict, lang: str,
                            force: bool) -> tuple[str, str, dict | None, str | None]:
    """Returns (pack_id, lang, partial_map, error). partial_map has the
    fields THIS call filled (so we don't overwrite untouched ones on merge)."""
    # Decide which fields need filling
    name_map = meta.get("name_localized") or {}
    desc_map = meta.get("description_localized") or {}
    topic_map = meta.get("topic_localized") or {}

    needs = {}
    if force or lang not in name_map:
        needs["name"] = meta.get("name", "")
    if force or lang not in desc_map:
        if meta.get("description"): needs["description"] = meta["description"]
    if force or lang not in topic_map:
        topic_val = meta.get("topic") or meta.get("name", "")
        if topic_val: needs["topic"] = topic_val

    if not needs:
        return (pack_id, lang, None, "SKIP_ALL_FILLED")

    # For English, no Gemini call — just copy the source text.
    if lang == "en":
        return (pack_id, lang, {k: v for k, v in needs.items() if v}, None)

    prompt = build_meta_prompt(lang, meta.get("name", ""),
                                meta.get("topic", meta.get("name", "")),
                                needs)
    text, err = call_vertex(prompt)
    if err:
        return (pack_id, lang, None, err)
    try:
        data = json.loads(text)
    except json.JSONDecodeError as e:
        return (pack_id, lang, None, f"BAD_JSON:{e}")
    if not isinstance(data, dict):
        return (pack_id, lang, None, "NOT_DICT")

    out = {}
    for k in needs:
        v = data.get(k)
        if isinstance(v, str) and v.strip():
            out[k] = v.strip()
    if not out:
        return (pack_id, lang, None, "EMPTY_FIELDS")
    return (pack_id, lang, out, None)


def localize_pack(pack_id: str, workers: int, force: bool) -> dict:
    pdir = pack_dir_for(pack_id)
    pjson = pdir / "pack.json"
    meta = json.loads(pjson.read_text())

    print(f"\n==> {pack_id}: '{meta.get('name')}' / topic '{meta.get('topic', meta.get('name'))}'")

    t0 = time.time()
    results = {}
    with concurrent.futures.ThreadPoolExecutor(max_workers=workers) as ex:
        futs = {ex.submit(translate_pack_for_lang, pack_id, meta, l, force): l
                for l in ALL_LANGS}
        for fut in concurrent.futures.as_completed(futs):
            _pid, lang, partial, err = fut.result()
            results[lang] = (partial, err)

    # Merge into meta, preserving any existing entries
    name_map = dict(meta.get("name_localized") or {})
    desc_map = dict(meta.get("description_localized") or {})
    topic_map = dict(meta.get("topic_localized") or {})
    ok_count = 0; fail = []
    for lang, (partial, err) in results.items():
        if partial:
            if "name" in partial: name_map[lang] = partial["name"]
            if "description" in partial: desc_map[lang] = partial["description"]
            if "topic" in partial: topic_map[lang] = partial["topic"]
            ok_count += 1
        elif err and not err.startswith("SKIP_"):
            fail.append((lang, err))

    if name_map:
        meta["name_localized"] = {k: name_map[k] for k in sorted(name_map)}
    if desc_map:
        meta["description_localized"] = {k: desc_map[k] for k in sorted(desc_map)}
    if topic_map:
        meta["topic_localized"] = {k: topic_map[k] for k in sorted(topic_map)}

    pjson.write_text(json.dumps(meta, ensure_ascii=False, indent=2) + "\n")

    dur = time.time() - t0
    print(f"    {ok_count}/{len(ALL_LANGS)} langs filled in {dur:.1f}s  "
          f"(name:{len(name_map)} desc:{len(desc_map)} topic:{len(topic_map)})")
    if fail:
        print(f"    failures: {len(fail)}")
        for lang, err in fail[:5]:
            print(f"      - {lang}: {err}")

    return {"pack_id": pack_id, "ok": ok_count, "fail": [l for l, _ in fail]}


def localize_curation(workers: int, force: bool) -> dict:
    cjson = HERE / "curation.json"
    cur = json.loads(cjson.read_text())
    groups = cur.get("phrasePackGroups") or []
    print(f"\n==> curation.json: {len(groups)} groups")

    def translate_group_for_lang(group: dict, lang: str
                                  ) -> tuple[str, dict | None, str | None]:
        label_map = group.get("label_localized") or {}
        desc_map = group.get("description_localized") or {}
        needs = {}
        if force or lang not in label_map:
            needs["label"] = group.get("label", "")
        if force or lang not in desc_map:
            if group.get("description"):
                needs["description"] = group["description"]
        if not needs:
            return (lang, None, "SKIP_ALL_FILLED")
        if lang == "en":
            return (lang, {k: v for k, v in needs.items() if v}, None)

        prompt = build_meta_prompt(lang, group.get("label", ""),
                                    "language-learning content category",
                                    needs)
        text, err = call_vertex(prompt)
        if err: return (lang, None, err)
        try:
            data = json.loads(text)
        except json.JSONDecodeError as e:
            return (lang, None, f"BAD_JSON:{e}")
        if not isinstance(data, dict):
            return (lang, None, "NOT_DICT")
        out = {k: data[k] for k in needs if isinstance(data.get(k), str) and data[k].strip()}
        return (lang, out, None if out else "EMPTY_FIELDS")

    for g in groups:
        gid = g.get("id", "?")
        print(f"  [group] {gid}: '{g.get('label')}'")
        with concurrent.futures.ThreadPoolExecutor(max_workers=workers) as ex:
            futs = {ex.submit(translate_group_for_lang, g, l): l for l in ALL_LANGS}
            label_map = dict(g.get("label_localized") or {})
            desc_map = dict(g.get("description_localized") or {})
            ok = 0; fail = []
            for fut in concurrent.futures.as_completed(futs):
                lang, partial, err = fut.result()
                if partial:
                    if "label" in partial: label_map[lang] = partial["label"]
                    if "description" in partial: desc_map[lang] = partial["description"]
                    ok += 1
                elif err and not err.startswith("SKIP_"):
                    fail.append((lang, err))
        if label_map:
            g["label_localized"] = {k: label_map[k] for k in sorted(label_map)}
        if desc_map:
            g["description_localized"] = {k: desc_map[k] for k in sorted(desc_map)}
        print(f"     {ok}/{len(ALL_LANGS)} langs filled  "
              f"(label:{len(label_map)} desc:{len(desc_map)})")
        if fail:
            print(f"     failures: {len(fail)}")
            for l, e in fail[:5]:
                print(f"       - {l}: {e}")

    cjson.write_text(json.dumps(cur, ensure_ascii=False, indent=2) + "\n")
    print(f"\nwrote {cjson.relative_to(HERE.parent.parent)}")
    return {"groups": len(groups)}


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    g = p.add_mutually_exclusive_group(required=True)
    g.add_argument("--packs", action="store_true", help="Localize all packs")
    g.add_argument("--curation", action="store_true", help="Localize curation.json")
    g.add_argument("--all", action="store_true", help="Both")
    g.add_argument("--pack", help="One specific pack id")
    p.add_argument("--workers", type=int, default=17)
    p.add_argument("--force", action="store_true",
                   help="Overwrite existing entries (default: fill-only)")
    ns = p.parse_args(argv)

    if ns.pack:
        localize_pack(ns.pack, ns.workers, ns.force)
    elif ns.packs:
        for pid in all_pack_ids():
            localize_pack(pid, ns.workers, ns.force)
    elif ns.curation:
        localize_curation(ns.workers, ns.force)
    elif ns.all:
        for pid in all_pack_ids():
            localize_pack(pid, ns.workers, ns.force)
        localize_curation(ns.workers, ns.force)

    return 0


if __name__ == "__main__":
    sys.exit(main())
