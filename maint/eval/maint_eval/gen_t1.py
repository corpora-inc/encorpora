"""T1 items: what a technician says is wrong, in their own words.

Written by Opus from each symptom's source row only (the manual's verbatim text for its tree). The
pack's baked search synonyms are never shown to the generator; `overlap.py` measures how close the
items came to them anyway.

Kinds:
* single    -- one symptom fits; one item per register per symptom.
* decline   -- the manual's symptom index holds nothing that fits (gold: none).
* ambiguous -- two or three symptoms genuinely fit (gold: that set, plus the distinction to ask about).
"""
from __future__ import annotations

import json
import random
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

from . import claude, packs
from .engine import Engine

PROMPT_VERSION = "t1-gen-2026-11-28.1"

REGISTERS = {
    "novice": "a new technician or operator in plain everyday language, unsure of the terms, a full sentence or two",
    "expert": "an experienced technician in terse shop shorthand and abbreviations, a fragment is fine",
    "typo": "typed fast on a phone with gloves: misspellings, dropped letters, abbreviations, no punctuation",
    "asr": "a speech-to-text transcript of someone talking in a noisy shop, with realistic recognition errors "
           "(homophones, split or merged words, technical terms misheard as common words), lowercase, filler words",
    "observed": "only what the person saw or heard happen, without the message's or the row's own key words "
                "(no word from the row's title), as if they never read the manual",
}

SYSTEM = """You write test inputs for an offline maintenance assistant. A technician tells the assistant, in their own words, what is wrong with a machine; the assistant must find the matching entry in the manual's troubleshooting index.

You see one manual row at a time: the entry's verbatim text from the manual. Write what a real person would say when that entry is the problem. Rules:
- Each utterance must describe THIS row's problem, so that a person who knows the manual would map it to this row. Do not describe the solution or the cause as a known fact unless a technician would plausibly already know it.
- Never copy a sentence of the row. Paraphrase the way real people talk.
- Vary the content across registers: different details, different situations (bench, field, before a mission, after a repair), different lengths (3 to 30 words).
- No names of people, companies, units or places.
- Write exactly the registers asked for, in order."""

SCHEMA = {"type": "object", "properties": {"rows": {"type": "array", "items": {"type": "object", "properties": {
    "key": {"type": "string"},
    "items": {"type": "array", "items": {"type": "object", "properties": {
        "register": {"type": "string", "enum": list(REGISTERS)}, "text": {"type": "string"}},
        "required": ["register", "text"]}}},
    "required": ["key", "items"]}}}, "required": ["rows"]}

DECLINE_SYSTEM = """You write test inputs for an offline maintenance assistant. A technician tells the assistant what is wrong; the assistant must find the matching entry in the manual's troubleshooting index, or say that nothing in the index fits.

You see the list of every entry the index holds (titles only). Write things a technician might say about THIS equipment that NONE of the listed entries covers: real faults, symptoms or requests for this kind of equipment that the index simply does not hold. Rules:
- Most items should be near misses: the same equipment, a related part or system, words that overlap with some titles, but a different problem that no listed entry would fix. Some can be further away (a mechanical, wiring, cosmetic or paperwork issue). A few can be about a different kind of machine that a technician might type by mistake.
- Do not write anything a listed entry plausibly covers, even partly. When in doubt, leave it out.
- Mix registers: plain language, shop shorthand, typos, speech-to-text errors, observation only.
- No names of people, companies, units or places."""

DECLINE_SCHEMA = {"type": "object", "properties": {"items": {"type": "array", "items": {"type": "object", "properties": {
    "register": {"type": "string", "enum": list(REGISTERS)}, "text": {"type": "string"},
    "why_not_covered": {"type": "string"}}, "required": ["register", "text", "why_not_covered"]}}},
    "required": ["items"]}

AMBIG_SYSTEM = """You write test inputs for an offline maintenance assistant. A technician tells the assistant what is wrong; the assistant must find the matching entry in the manual's troubleshooting index. When a report genuinely fits two or three entries, the assistant should ask ONE clarifying question that tells them apart.

You see the index: each entry's key and its verbatim manual text. Write reports that GENUINELY fit two or three entries equally, so that no careful expert could pick one without asking. For each, give the keys it fits and the one distinction a clarifying question would ask about (what would the technician see or know that separates them).
Rules:
- Each report must fit every listed key well, and no other entry better.
- Realistic: a technician who has not read the exact message, or reports a symptom shared by several entries.
- Cover different parts of the index; do not reuse the same group of keys twice.
- Mix registers: plain language, shop shorthand, typos, speech-to-text errors, observation only.
- No names of people, companies, units or places."""

AMBIG_SCHEMA = {"type": "object", "properties": {"items": {"type": "array", "items": {"type": "object", "properties": {
    "register": {"type": "string", "enum": list(REGISTERS)}, "text": {"type": "string"},
    "keys": {"type": "array", "items": {"type": "string"}}, "distinction": {"type": "string"}},
    "required": ["register", "text", "keys", "distinction"]}}}, "required": ["items"]}


def _rows_prompt(equipment: str, rows: list[tuple[str, str]], regs: list[str]) -> str:
    reg_txt = "\n".join(f"- {r}: {REGISTERS[r]}" for r in regs)
    body = "\n\n".join(f"ROW {k}\n{txt}" for k, txt in rows)
    return (f"EQUIPMENT: {equipment}\n\nFor each row, write one utterance per register, in this order:\n{reg_txt}\n\n"
            f"{body}")


def generate(eng: Engine, root: Path, out: Path, batch: int = 6, jobs: int = 3) -> list[dict]:
    items: list[dict] = []
    for pack_id, db in packs.pack_dirs(root).items():
        syms = packs.symptoms(db, pack_id)
        equipment = packs.equipment_label(eng, pack_id)
        src = {s.symptom_id: packs.source_row(eng, pack_id, s.tree_id) for s in syms}
        # A small index gets more phrasings per symptom so it still yields a usable number of items.
        reps = 1 if len(syms) >= 20 else 3
        regs = [r for _ in range(reps) for r in REGISTERS]
        groups = [syms[i:i + batch] for i in range(0, len(syms), batch)] if reps == 1 else [[s] for s in syms]

        def one(group):
            rows = [(f"R{j + 1}", src[s.symptom_id]) for j, s in enumerate(group)]
            res = claude.call(SYSTEM, _rows_prompt(equipment, rows, regs), model="opus", schema=SCHEMA,
                              tag=f"gen-t1-single:{pack_id}")
            got = {r["key"]: r["items"] for r in res["output"]["rows"]}
            found = []
            for j, s in enumerate(group):
                for n, it in enumerate(got.get(f"R{j + 1}", [])):
                    found.append({"task": "t1", "kind": "single", "pack_id": pack_id, "register": it["register"],
                                  "text": it["text"].strip(), "gold": [s.symptom_id],
                                  "id": f"t1:{pack_id}:{s.symptom_id}:{it['register']}:{n}",
                                  "gen": {"model": res.get("model_id"), "prompt": PROMPT_VERSION}})
            return found

        with ThreadPoolExecutor(max_workers=jobs) as ex:
            for f in ex.map(one, groups):
                items.extend(f)

        # Must-decline.
        titles = "\n".join(f"- {s.title}" for s in syms)
        n_dec = 45 if len(syms) >= 20 else 20
        res = claude.call(DECLINE_SYSTEM, f"EQUIPMENT: {equipment}\n\nINDEX ENTRIES ({len(syms)}):\n{titles}\n\n"
                                          f"Write {n_dec} items.", model="opus", schema=DECLINE_SCHEMA,
                          tag=f"gen-t1-decline:{pack_id}")
        for n, it in enumerate(res["output"]["items"]):
            items.append({"task": "t1", "kind": "decline", "pack_id": pack_id, "register": it["register"],
                          "text": it["text"].strip(), "gold": [], "why": it["why_not_covered"],
                          "id": f"t1:{pack_id}:decline:{n}", "gen": {"model": res.get("model_id"), "prompt": PROMPT_VERSION}})

        # Ambiguous: the generator sees the index as verbatim rows (no synonyms).
        if len(syms) >= 2:
            keyed = [(f"E{j + 1}", s) for j, s in enumerate(syms)]
            index = "\n\n".join(f"ENTRY {k}\n{src[s.symptom_id][:500]}" for k, s in keyed)
            n_amb = 50 if len(syms) >= 20 else 4
            res = claude.call(AMBIG_SYSTEM, f"EQUIPMENT: {equipment}\n\nINDEX:\n{index}\n\nWrite {n_amb} items.",
                              model="opus", schema=AMBIG_SCHEMA, tag=f"gen-t1-ambiguous:{pack_id}", timeout=1800)
            kmap = dict((k, s.symptom_id) for k, s in keyed)
            for n, it in enumerate(res["output"]["items"]):
                gold = [kmap[k] for k in it["keys"] if k in kmap]
                if len(set(gold)) < 2:
                    continue
                items.append({"task": "t1", "kind": "ambiguous", "pack_id": pack_id, "register": it["register"],
                              "text": it["text"].strip(), "gold": sorted(set(gold)), "distinction": it["distinction"],
                              "id": f"t1:{pack_id}:ambiguous:{n}",
                              "gen": {"model": res.get("model_id"), "prompt": PROMPT_VERSION}})
    out.write_text("".join(json.dumps(i, ensure_ascii=False) + "\n" for i in items))
    return items


def generate_cal(eng: Engine, root: Path, dev: list[dict], out: Path, batch: int = 6, jobs: int = 3) -> list[dict]:
    """A larger calibration set for tuning thresholds, from the DEV symptoms only (held-out symptoms
    are never touched): two more phrasings per register per dev symptom, plus fresh must-decline items.
    Merged into the dev set; ids carry ':cal'."""
    items: list[dict] = []
    dev_syms = sorted({(i["pack_id"], i["gold"][0]) for i in dev if i["kind"] == "single"})
    regs = [r for _ in range(2) for r in REGISTERS]
    for pack_id, db in packs.pack_dirs(root).items():
        syms = [s for s in packs.symptoms(db, pack_id) if (pack_id, s.symptom_id) in dev_syms]
        if len(packs.symptoms(db, pack_id)) < 20:
            continue  # small packs are split item by item; their dev share is already mixed
        equipment = packs.equipment_label(eng, pack_id)
        src = {s.symptom_id: packs.source_row(eng, pack_id, s.tree_id) for s in syms}
        groups = [syms[i:i + batch] for i in range(0, len(syms), batch)]

        def one(group):
            rows = [(f"R{j + 1}", src[s.symptom_id]) for j, s in enumerate(group)]
            prompt = _rows_prompt(equipment, rows, regs) + ("\n\nThe two utterances of each register must differ from "
                                                           "each other in situation, detail and wording.")
            res = claude.call(SYSTEM, prompt, model="opus", schema=SCHEMA, tag=f"gen-t1-cal:{pack_id}")
            got = {r["key"]: r["items"] for r in res["output"]["rows"]}
            return [{"task": "t1", "kind": "single", "pack_id": pack_id, "register": it["register"],
                     "text": it["text"].strip(), "gold": [s.symptom_id],
                     "id": f"t1:{pack_id}:{s.symptom_id}:{it['register']}:cal{n}",
                     "gen": {"model": res.get("model_id"), "prompt": PROMPT_VERSION + "+cal"}}
                    for j, s in enumerate(group) for n, it in enumerate(got.get(f"R{j + 1}", []))]

        with ThreadPoolExecutor(max_workers=jobs) as ex:
            for f in ex.map(one, groups):
                items.extend(f)
        titles = "\n".join(f"- {s.title}" for s in packs.symptoms(db, pack_id))
        res = claude.call(DECLINE_SYSTEM, f"EQUIPMENT: {equipment}\n\nINDEX ENTRIES:\n{titles}\n\nWrite 60 items. "
                          "Favour near misses: faults of this equipment's sensors, power, radio, propulsion, "
                          "mission and configuration that no entry covers.", model="opus", schema=DECLINE_SCHEMA,
                          tag=f"gen-t1-cal-decline:{pack_id}")
        for n, it in enumerate(res["output"]["items"]):
            items.append({"task": "t1", "kind": "decline", "pack_id": pack_id, "register": it["register"],
                          "text": it["text"].strip(), "gold": [], "why": it["why_not_covered"],
                          "id": f"t1:{pack_id}:decline:cal{n}", "gen": {"model": res.get("model_id"), "prompt": PROMPT_VERSION + "+cal"}})
    out.write_text("".join(json.dumps(i, ensure_ascii=False) + "\n" for i in items))
    return items


def split(items: list[dict], seed: int, dev_share: float = 0.2) -> tuple[list[dict], list[dict]]:
    """Single items are split by symptom (a symptom's phrasings never straddle dev and held-out);
    decline and ambiguous items by item. One seeded draw; record the seed."""
    rng = random.Random(seed)
    syms = sorted({(i["pack_id"], i["gold"][0]) for i in items if i["kind"] == "single"})
    by_pack: dict[str, list] = {}
    for p, s in syms:
        by_pack.setdefault(p, []).append(s)
    dev_syms, small = set(), set()
    for p, ss in by_pack.items():
        if len(ss) < 5:  # too few symptoms to split by symptom: split that pack's items one by one
            small.add(p)
            continue
        dev_syms |= {(p, s) for s in rng.sample(ss, max(1, round(len(ss) * dev_share)))}
    dev, held = [], []
    for i in sorted(items, key=lambda x: x["id"]):
        if i["kind"] == "single" and i["pack_id"] not in small:
            (dev if (i["pack_id"], i["gold"][0]) in dev_syms else held).append(i)
        else:
            (dev if rng.random() < dev_share else held).append(i)
    return dev, held
