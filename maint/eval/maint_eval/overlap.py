"""Leakage: how close the T1 phrasings came to the pack's baked search synonyms.

The synonyms were written by Sonnet from the same source rows the item generator saw; the generator
never saw them. Overlap with them inflates the engine's lexical baseline, so it is reported next to
every T1 number. Measures, over content stems:

* jaccard_max     -- best Jaccard between the item and any one baked synonym of its gold symptom.
* contain_syn     -- share of the item's content stems found in the union of the gold's synonyms.
* contain_title   -- the same against the symptom's title (the manual's own words; not leakage).
* syn_only        -- share of the item's stems found in the synonyms but NOT in the title or source row:
                     what only the synonyms could have taught the search.
* reference       -- the same measures against a random OTHER symptom's synonyms (the chance level).
"""
from __future__ import annotations

import random
import statistics
from pathlib import Path

from . import packs, sets
from .engine import Engine
from .text import containment, content_stems, jaccard


def item_overlap(text: str, syns: list[str], title: str, source: str) -> dict:
    st = set(content_stems(text))
    syn_stems = set(s for x in syns for s in content_stems(x))
    own = set(content_stems(title)) | set(content_stems(source))
    return {
        "jaccard_max": max((jaccard(text, s) for s in syns), default=0.0),
        "contain_syn": len(st & syn_stems) / len(st) if st else 0.0,
        "contain_title": containment(text, title),
        "syn_only": len((st & syn_stems) - own) / len(st) if st else 0.0,
        "exact_syn": any(" ".join(content_stems(text)) == " ".join(content_stems(s)) for s in syns),
    }


def report(root: Path, parts=("dev", "heldout")) -> dict:
    eng = Engine()
    dbs = packs.pack_dirs(root)
    syn = {p: packs.baked_synonyms(db) for p, db in dbs.items()}
    titles = {p: {s.symptom_id: s for s in packs.symptoms(db, p)} for p, db in dbs.items()}
    src_cache: dict = {}
    rng = random.Random(7)
    out = {}
    for part in parts:
        items = [i for i in sets.load(sets.path("t1", part)) if i["kind"] == "single"]
        rows, ref = [], []
        by_reg: dict[str, list] = {}
        for i in items:
            p, g = i["pack_id"], i["gold"][0]
            s = titles[p][g]
            if (p, g) not in src_cache:
                src_cache[(p, g)] = packs.source_row(eng, p, s.tree_id)
            o = item_overlap(i["text"], syn[p].get(g, []), s.title, src_cache[(p, g)])
            rows.append(o)
            by_reg.setdefault(i["register"], []).append(o)
            others = [x for x in syn[p] if x != g]
            if others:
                og = rng.choice(others)
                ref.append(item_overlap(i["text"], syn[p][og], titles[p][og].title, ""))

        def agg(rs):
            if not rs:
                return {}
            return {"n": len(rs),
                    "jaccard_max_mean": round(statistics.mean(r["jaccard_max"] for r in rs), 3),
                    "share_jaccard_ge_0.5": round(sum(r["jaccard_max"] >= 0.5 for r in rs) / len(rs), 3),
                    "contain_syn_mean": round(statistics.mean(r["contain_syn"] for r in rs), 3),
                    "contain_title_mean": round(statistics.mean(r["contain_title"] for r in rs), 3),
                    "syn_only_mean": round(statistics.mean(r["syn_only"] for r in rs), 3),
                    "exact_syn": sum(r["exact_syn"] for r in rs)}
        out[part] = {"all": agg(rows), "reference_other_symptom": agg(ref),
                     "by_register": {k: agg(v) for k, v in sorted(by_reg.items())}}
    return out
