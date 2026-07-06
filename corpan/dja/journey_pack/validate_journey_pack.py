#!/usr/bin/env python3
"""Journey course-pack validator — THE merged gate list V-1..V-22.

V-21/V-22 (Journey v0.2) enforce full native-face coverage for the
`course.yaml: l1_full_support` languages: V-21 = word glosses (`wg.<word>`),
V-22 = base-corpus phrase translations. See §6.4 + cross-team contract #1.

Spec: corpan/docs/journey/specs/course-pack.md §6.4 (normative; single source
for Journey pack validation gates — authoring lint gates are absorbed here).

Runs against the authored tree (tree gates) + the built sqlite (authoritative).
Importable (`validate()`) and CLI. Exit non-zero on any error; `--json` emits a
machine-readable report for the ci-gate.

Usage:
    python3 validate_journey_pack.py en [--course-dir DIR] [--dist DIR]
        [--core-db PATH] [--packs-dir DIR] [--recipes PATH] [--json]

Implementation notes (documented interpretations, see README):
  - V-6 "fast forms" is enforced as display word-count <= 12; the zipf >= 4.3
    content-word floor applies to text-bearing probes (phrase/word) — minted
    grammarNode/phoneme probes carry titles, not sentences.
  - V-12's verbatim check needs the local (non-shipped) CEFR descriptor
    reference file; when absent the substring check is skipped with a warning
    (the >=1 can-do check still gates).
"""

from __future__ import annotations

import argparse
import json
import re
import sqlite3
import sys
import zipfile
from collections import defaultdict
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

from journey_common import (
    ALL_LANGUAGES,
    BANNED_COPY_WORDS,
    CORPAN_DIR,
    DJA_DIR,
    HERE,
    JOURNEY_SCHEMA_VERSION,
    PACK_ACTIVITY_TYPE_RE,
    RARE_CARD_TYPES,
    SLOT_TYPES,
    SPINE_ID_RE,
    V01_ANCHOR_PROVIDERS,
    ItemRef,
    arc_id_re,
    item_ref_key,
    load_activity_types,
    parse_item_ref,
    underscore_lang,
    unit_id_re,
)

# Local, non-shipped CEFR descriptor reference corpus for V-12 (never in the pack).
DEFAULT_CEFR_REFERENCE = HERE / "cefr_reference" / "descriptors.txt"

# Small function-word list for the V-6 "content words" zipf floor.
FUNCTION_WORDS = {
    "a", "an", "the", "is", "are", "am", "was", "were", "be", "been", "being",
    "i", "you", "he", "she", "it", "we", "they", "me", "him", "her", "us",
    "them", "my", "your", "his", "its", "our", "their", "this", "that",
    "these", "those", "to", "of", "in", "on", "at", "by", "for", "with",
    "and", "or", "but", "not", "no", "yes", "do", "does", "did", "can",
    "will", "would", "there", "what", "who", "how", "when", "where", "s", "t",
}


class Gate:
    def __init__(self, gate_id: str, rule: str) -> None:
        self.id = gate_id
        self.rule = rule
        self.errors: List[str] = []
        self.warnings: List[str] = []

    @property
    def status(self) -> str:
        return "error" if self.errors else ("warn" if self.warnings else "ok")

    def err(self, msg: str) -> None:
        self.errors.append(msg)

    def warn(self, msg: str) -> None:
        self.warnings.append(msg)

    def as_dict(self) -> Dict[str, Any]:
        return {
            "gate": self.id, "rule": self.rule, "status": self.status,
            "errors": self.errors, "warnings": self.warnings,
        }


Report = List[Gate]


def has_errors(report: Report) -> bool:
    return any(g.errors for g in report)


def print_report(report: Report) -> None:
    for g in report:
        mark = {"ok": "PASS", "warn": "WARN", "error": "FAIL"}[g.status]
        print(f"[{mark}] {g.id}  {g.rule}")
        for e in g.errors:
            print(f"    ERROR: {e}")
        for w in g.warnings:
            print(f"    warn:  {w}")


# ---------------------------------------------------------------------------
# DB snapshot
# ---------------------------------------------------------------------------


class Pack:
    """In-memory snapshot of the built course.sqlite3."""

    def __init__(self, db_path: Path) -> None:
        self.db_path = db_path
        db = sqlite3.connect(f"file:{db_path}?mode=ro", uri=True)
        db.row_factory = sqlite3.Row
        self.user_version = db.execute("PRAGMA user_version").fetchone()[0]
        self.meta = {
            r["key"]: r["value"] for r in db.execute("SELECT * FROM pack_meta")
        }
        self.arcs = [dict(r) for r in db.execute(
            "SELECT * FROM arcs ORDER BY arc_index")]
        self.units = [dict(r) for r in db.execute(
            "SELECT u.*, a.arc_index FROM units u JOIN arcs a ON a.id = u.arc_id "
            "ORDER BY a.arc_index, u.unit_index")]
        self.skills = [dict(r) for r in db.execute("SELECT * FROM skills")]
        self.skill_edges = [dict(r) for r in db.execute("SELECT * FROM skill_edges")]
        self.grammar_nodes = [dict(r) for r in db.execute(
            "SELECT * FROM grammar_nodes ORDER BY node_order")]
        self.items = [dict(r) for r in db.execute(
            "SELECT * FROM items ORDER BY intro_order")]
        self.item_skills = [dict(r) for r in db.execute("SELECT * FROM item_skills")]
        self.recipes = [dict(r) for r in db.execute("SELECT * FROM lesson_recipes")]
        self.recipe_slots = [dict(r) for r in db.execute(
            "SELECT * FROM recipe_slots ORDER BY recipe_id, slot_index")]
        self.unit_lessons = [dict(r) for r in db.execute(
            "SELECT * FROM unit_lessons ORDER BY unit_id, lesson_index")]
        self.checkpoints = [dict(r) for r in db.execute("SELECT * FROM checkpoints")]
        self.rare_cards = [dict(r) for r in db.execute("SELECT * FROM rare_cards")]
        self.l1_overlays = [dict(r) for r in db.execute("SELECT * FROM l1_overlays")]
        self.strings: Dict[Tuple[str, str], str] = {
            (r["key"], r["lang"]): r["text"]
            for r in db.execute("SELECT * FROM strings")
        }
        db.close()

        self.items_by_id = {i["id"]: i for i in self.items}
        self.skills_by_id = {s["id"]: s for s in self.skills}
        self.units_by_id = {u["id"]: u for u in self.units}
        self.unit_pos = {
            u["id"]: (u["arc_index"], u["unit_index"]) for u in self.units
        }
        self.skill_items: Dict[str, List[str]] = defaultdict(list)
        self.item_skill_map: Dict[str, List[str]] = defaultdict(list)
        for row in self.item_skills:
            self.skill_items[row["skill_id"]].append(row["item_id"])
            self.item_skill_map[row["item_id"]].append(row["skill_id"])
        self.string_keys = {k for (k, _l) in self.strings}
        self.langs_by_key: Dict[str, set] = defaultdict(set)
        for (k, lang) in self.strings:
            self.langs_by_key[k].add(lang)


def _zipf(word: str, lang: str) -> float:
    from wordfreq import zipf_frequency

    return zipf_frequency(word, lang.split("-")[0].lower())


def _content_words(text: str) -> List[str]:
    words = re.findall(r"[A-Za-z]+(?:'[A-Za-z]+)?", text.lower())
    return [w for w in words if w not in FUNCTION_WORDS and len(w) > 1]


# ---------------------------------------------------------------------------
# validate()
# ---------------------------------------------------------------------------


def validate(
    target: str,
    course_dir: Path,
    dist_dir: Path,
    core_db: Path = DJA_DIR / "release.sqlite3",
    packs_dir: Path = CORPAN_DIR / "tools" / "phrase-packs",
    recipes_path: Path = HERE / "recipes.yaml",
    cefr_reference: Path = DEFAULT_CEFR_REFERENCE,
) -> Report:
    import build_journey_pack as b

    course = b.load_course_tree(target, course_dir, recipes_path)
    corpus = b.Corpus(core_db, packs_dir, target)
    course_id = course.course_id
    stage_db = dist_dir / course_id / "data" / "course.sqlite3"
    if not stage_db.exists():
        raise FileNotFoundError(
            f"built pack not found at {stage_db} — run build_journey_pack.py first"
        )
    pack = Pack(stage_db)
    manifest_path = dist_dir / course_id / "manifest.json"
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    activity_types = set(load_activity_types())

    report: Report = []

    def gate(gate_id: str, rule: str) -> Gate:
        g = Gate(gate_id, rule)
        report.append(g)
        return g

    # ---- V-1 Every ItemRef resolves ----
    g = gate("V-1", "Every ItemRef resolves")
    word_rank: Optional[Dict[str, int]] = None
    gn_ids = {n["id"] for n in pack.grammar_nodes}
    phoneme_ids = {
        i["ref_id"] for i in pack.items if i["kind"] == "phoneme"
    }
    for it in pack.items:
        kind, source, ref_id = it["kind"], it["source"], it["ref_id"]
        if kind == "phrase":
            if source == "base":
                if corpus.entry_level(int(ref_id)) is None:
                    g.err(f"{it['id']}: no cor_entry row")
                elif not corpus.entry_text(int(ref_id)):
                    g.err(f"{it['id']}: no {target} translation in the base corpus")
            else:
                try:
                    texts = corpus.phrase_pack_texts(source)
                    if not (0 <= int(ref_id) < len(texts)):
                        g.err(f"{it['id']}: index out of pack range")
                except Exception as e:
                    g.err(f"{it['id']}: {e}")
        elif kind == "word":
            if word_rank is None:
                word_rank = b.WordUniverse(target).rank
            if ref_id not in word_rank:
                g.err(f"{it['id']}: not in the {target} word universe")
        elif kind == "grammarNode":
            if source != course_id or ref_id not in gn_ids:
                g.err(f"{it['id']}: grammarNode not minted by this pack")
        elif kind == "phoneme":
            if source != course_id or ref_id not in phoneme_ids:
                g.err(f"{it['id']}: phoneme not minted by this pack")
        elif kind == "segment":
            g.err(f"{it['id']}: segment refs need the book pack dir on disk "
                  "(none configured) — no unverifiable refs ship")
        else:  # char / concept — v0.1 schema stubs
            g.err(f"{it['id']}: kind {kind!r} is a v0.1 schema stub (zero rows)")

    # ---- V-2 Skill DAG acyclic + reachable ----
    g = gate("V-2", "Skill DAG acyclic + reachable")
    skill_ids = set(pack.skills_by_id)
    adj: Dict[str, List[str]] = defaultdict(list)
    indeg: Dict[str, int] = {s: 0 for s in skill_ids}
    for e in pack.skill_edges:
        if e["from_skill"] not in skill_ids:
            g.err(f"edge from unknown skill {e['from_skill']!r}")
            continue
        if e["to_skill"] not in skill_ids:
            g.err(f"edge to unknown skill {e['to_skill']!r}")
            continue
        adj[e["from_skill"]].append(e["to_skill"])
        indeg[e["to_skill"]] += 1
    queue = [s for s, d in indeg.items() if d == 0]
    seen = 0
    dq = list(queue)
    while dq:
        n = dq.pop()
        seen += 1
        for m in adj[n]:
            indeg[m] -= 1
            if indeg[m] == 0:
                dq.append(m)
    if seen != len(skill_ids):
        cyc = sorted(s for s, d in indeg.items() if d > 0)
        g.err(f"cycle detected among skills: {cyc}")
    launchpad_units = {u["id"] for u in pack.units if u["arc_index"] == 0}
    roots = {s["id"] for s in pack.skills if s["unit_id"] in launchpad_units}
    reach = set(roots)
    frontier = list(roots)
    while frontier:
        n = frontier.pop()
        for m in adj[n]:
            if m not in reach:
                reach.add(m)
                frontier.append(m)
    for s in sorted(skill_ids - reach):
        g.err(f"skill {s} not reachable from a Launchpad root")

    # ---- V-3 Grammar-node integrity ----
    g = gate("V-3", "Grammar-node integrity")
    unit_skills: Dict[str, set] = defaultdict(set)
    for s in pack.skills:
        unit_skills[s["unit_id"]].add(s["id"])
    # home unit of a node = its item's unit (the introducing unit)
    node_home: Dict[str, str] = {}
    for it in pack.items:
        if it["kind"] == "grammarNode":
            node_home[it["ref_id"]] = it["unit_id"]
    for n in pack.grammar_nodes:
        if n["skill_id"] not in skill_ids:
            g.err(f"node {n['id']}: unknown skill {n['skill_id']!r}")
            continue
        home = node_home.get(n["id"])
        if home is None:
            g.err(f"node {n['id']}: not introduced by any unit")
            continue
        if n["skill_id"] not in unit_skills[home]:
            g.err(f"node {n['id']}: skill {n['skill_id']} is not a skill of "
                  f"its home unit {home}")
        # prereqs (via the skill's prereq skills) introduced earlier-or-same
        home_pos = pack.unit_pos[home]
        for e in pack.skill_edges:
            if e["to_skill"] != n["skill_id"]:
                continue
            prereq_skill = pack.skills_by_id.get(e["from_skill"])
            if not prereq_skill:
                continue
            p_pos = pack.unit_pos[prereq_skill["unit_id"]]
            if p_pos > home_pos:
                g.err(f"node {n['id']}: prereq skill {e['from_skill']} is "
                      f"introduced later ({prereq_skill['unit_id']})")
    # every unit's grammar_nodes id exists in grammar.yaml (tree side)
    tree_nodes = {n.id for n in course.grammar.nodes}
    for u in course.units:
        for nid in u.grammar_nodes:
            if nid not in tree_nodes:
                g.err(f"unit {u.id}: grammar node {nid!r} not in grammar.yaml")

    # ---- V-4 Unit vocab bands monotone ----
    g = gate("V-4", "Unit vocab bands monotone")
    prev_hi: Optional[int] = None
    for u in pack.units:
        lo, hi = u["vocab_rank_lo"], u["vocab_rank_hi"]
        if lo is None or hi is None:
            continue
        if prev_hi is not None:
            if hi < prev_hi:
                g.err(f"unit {u['id']}: vocab_rank_hi {hi} regresses below {prev_hi}")
            if lo > prev_hi + 1:
                g.err(f"unit {u['id']}: vocab_rank_lo {lo} leaves a gap after {prev_hi}")
        prev_hi = hi if prev_hi is None else max(prev_hi, hi)

    # ---- V-5 Strings complete ×54 ----
    g = gate("V-5", "Strings complete ×54")
    referenced: List[str] = []
    referenced += [a["title_key"] for a in pack.arcs]
    for u in pack.units:
        referenced.append(u["theme_key"])
        referenced += json.loads(u["cando_keys_json"])
    referenced += [s["title_key"] for s in pack.skills]
    for n in pack.grammar_nodes:
        referenced += [n["title_key"], n["note_key"]]
    referenced += [r["title_key"] for r in pack.recipes]
    overlay_keys = [
        o["string_key"] for o in pack.l1_overlays if o["string_key"]
    ]
    for key in referenced:
        missing = [l for l in ALL_LANGUAGES if l not in pack.langs_by_key.get(key, set())]
        if key not in pack.string_keys:
            g.err(f"key {key!r} missing from strings entirely")
        elif missing:
            g.err(f"key {key!r} missing languages: {missing[:8]}"
                  + ("…" if len(missing) > 8 else ""))
    for key in overlay_keys:
        m = re.match(r"^ovl\.([^.]+)\.", key)
        l1 = m.group(1) if m else "en"
        for need in {l1, "en"}:
            if need not in pack.langs_by_key.get(key, set()):
                g.err(f"overlay key {key!r} missing ({need}) copy")

    # ---- V-6 Probe coverage + quality ----
    g = gate("V-6", "Probe coverage + quality")
    probe_ids = {i["id"] for i in pack.items if i["is_probe"]}
    text_by_item: Dict[str, str] = {}
    for it in pack.items:
        if it["kind"] == "phrase" and it["source"] == "base":
            text_by_item[it["id"]] = corpus.entry_text(int(it["ref_id"])) or ""
        elif it["kind"] == "word":
            text_by_item[it["id"]] = it["ref_id"]
    for skill_id in sorted(skill_ids):
        probes = [i for i in pack.skill_items[skill_id] if i in probe_ids]
        if not 2 <= len(probes) <= 4:
            g.err(f"skill {skill_id}: {len(probes)} probes (need 2–4)")
        for pid in probes:
            it = pack.items_by_id[pid]
            if it["importance"] < 2:
                g.err(f"probe {pid}: importance {it['importance']} < 2")
            text = text_by_item.get(pid, "")
            if text:
                if len(text.split()) > 12:
                    g.err(f"probe {pid}: not a fast form ({len(text.split())} words)")
                for w in _content_words(text):
                    if _zipf(w, target) < 4.3:
                        g.err(f"probe {pid}: content word {w!r} zipf "
                              f"{_zipf(w, target):.2f} < 4.3")

    # ---- V-7 Checkpoint totality + boss shape ----
    g = gate("V-7", "Checkpoint totality + boss shape")
    recipe_ids = {r["id"] for r in pack.recipes}
    unit_cp = defaultdict(list)
    arc_cp = defaultdict(list)
    for cp in pack.checkpoints:
        if cp["recipe_id"] not in recipe_ids:
            g.err(f"checkpoint {cp['id']}: unknown recipe {cp['recipe_id']!r}")
        if cp["scope"] == "unit":
            unit_cp[cp["unit_id"]].append(cp)
        else:
            arc_cp[cp["arc_id"]].append(cp)
        if not 0.7 <= cp["pass_score"] <= 0.9:
            g.err(f"checkpoint {cp['id']}: pass_score {cp['pass_score']} outside [0.7, 0.9]")
        params = json.loads(cp["params_json"]) if cp["params_json"] else {}
        require = set(params.get("require", []))
        if not {"produce.speak", "input.listen"} <= require:
            g.err(f"checkpoint {cp['id']}: required slot minima must include "
                  "produce.speak + input.listen")
    for u in pack.units:
        if len(unit_cp.get(u["id"], [])) != 1:
            g.err(f"unit {u['id']}: needs exactly one boss checkpoint")
    for a in pack.arcs:
        if len(arc_cp.get(a["id"], [])) != 1:
            g.err(f"arc {a['id']}: needs exactly one gate checkpoint")

    # ---- V-8 Lesson integrity ----
    g = gate("V-8", "Lesson integrity")
    slots_by_recipe = defaultdict(list)
    for s in pack.recipe_slots:
        slots_by_recipe[s["recipe_id"]].append(s)
    for ul in pack.unit_lessons:
        if ul["recipe_id"] not in recipe_ids:
            g.err(f"unit {ul['unit_id']} lesson {ul['lesson_index']}: unknown "
                  f"recipe {ul['recipe_id']!r}")
    for r in pack.recipes:
        slots = slots_by_recipe.get(r["id"], [])
        if not slots:
            g.err(f"recipe {r['id']}: zero slots")
        for s in slots:
            if s["slot_type"] not in SLOT_TYPES:
                g.err(f"recipe {r['id']} slot {s['slot_index']}: bad slot_type "
                      f"{s['slot_type']!r}")
            for at in json.loads(s["activity_types_json"]):
                if at in activity_types:
                    continue
                if PACK_ACTIVITY_TYPE_RE.match(at):
                    continue
                g.err(f"recipe {r['id']} slot {s['slot_index']}: activityType "
                      f"{at!r} not in the vendored ACTIVITY_TYPES registry and "
                      "not a <packId>:<name> pack type")

    # ---- V-9 Anchor providers ----
    g = gate("V-9", "Anchor providers (v0.1 instrumented set, R13)")
    for u in pack.units:
        p = u["anchor_provider"]
        if p and p not in V01_ANCHOR_PROVIDERS:
            g.err(f"unit {u['id']}: anchor provider {p!r} not in the v0.1 set "
                  f"{sorted(V01_ANCHOR_PROVIDERS)}")

    # ---- V-10 Item-pool adequacy (tree) ----
    g = gate("V-10", "Item-pool adequacy (tree)")
    for unit_id, pools in course.auto_pools.items():
        for kind, pool_size, count in pools:
            if kind != "phrase":
                continue
            floor = max(40, 2 * count)
            if pool_size < floor:
                g.err(f"unit {unit_id}: phrase pool {pool_size} < max(40, 2×{count})")
            elif pool_size < 3 * count:
                g.warn(f"unit {unit_id}: phrase pool {pool_size} < 3×{count}")

    # ---- V-11 Gap-pack band fit (tree) ----
    g = gate("V-11", "Gap-pack band fit (tree)")
    for it in pack.items:
        if it["kind"] != "phrase" or it["source"] == "base":
            continue
        u = pack.units_by_id[it["unit_id"]]
        hi = u["vocab_rank_hi"]
        if hi is None:
            continue
        texts = corpus.phrase_pack_texts(it["source"])
        text = texts[int(it["ref_id"])]
        if word_rank is None:
            word_rank = b.WordUniverse(target).rank
        for w in _content_words(text):
            rank = word_rank.get(w)
            if rank is not None and rank > hi * 1.2:
                g.err(f"{it['id']}: content word {w!r} rank {rank} exceeds "
                      f"unit band hi×1.2 ({hi * 1.2:.0f})")

    # ---- V-12 Can-do paraphrase-only ----
    g = gate("V-12", "Can-do paraphrase-only")
    for u in pack.units:
        if not json.loads(u["cando_keys_json"]):
            g.err(f"unit {u['id']}: no can-do")
    if cefr_reference.exists():
        ref_text = cefr_reference.read_text(encoding="utf-8").lower()
        for (key, lang), text in pack.strings.items():
            if lang != "en" or not key.startswith("cando."):
                continue
            words = text.lower().split()
            for i in range(len(words) - 7):
                window = " ".join(words[i:i + 8])
                if window in ref_text:
                    g.err(f"{key}: 8-word verbatim CEFR substring: {window!r}")
                    break
    else:
        g.warn(f"CEFR descriptor reference not present at {cefr_reference} — "
               "verbatim-substring check skipped")

    # ---- V-13 Copy hygiene ----
    g = gate("V-13", "Copy hygiene (house rules)")
    banned_re = re.compile(
        r"(?<![\w%])(" + "|".join(re.escape(w) for w in BANNED_COPY_WORDS) + r")(?![\w%])",
        re.IGNORECASE,
    )
    for (key, lang), text in sorted(pack.strings.items()):
        m = banned_re.search(text)
        if m:
            g.err(f"strings[{key!r}, {lang}]: banned copy {m.group(0)!r}")
    for field in ("name", "description"):
        val = manifest.get(field, "")
        m = banned_re.search(val)
        if m:
            g.err(f"manifest.{field}: banned copy {m.group(0)!r}")

    # ---- V-14 Difficulty sanity ----
    g = gate("V-14", "Difficulty sanity")
    for it in pack.items:
        if not -4.0 <= it["difficulty_b"] <= 5.0:
            g.err(f"{it['id']}: b {it['difficulty_b']} outside [-4, +5]")
    arc_means: List[Tuple[int, float]] = []
    items_by_arc: Dict[int, List[float]] = defaultdict(list)
    arc_of_unit = {u["id"]: u["arc_index"] for u in pack.units}
    for it in pack.items:
        items_by_arc[arc_of_unit[it["unit_id"]]].append(it["difficulty_b"])
    for arc_idx in sorted(items_by_arc):
        vals = items_by_arc[arc_idx]
        arc_means.append((arc_idx, sum(vals) / len(vals)))
    for (i1, m1), (i2, m2) in zip(arc_means, arc_means[1:]):
        if m2 <= m1:
            g.err(f"per-arc mean b not strictly increasing: arc {i1}={m1:.2f} "
                  f"→ arc {i2}={m2:.2f}")
    for skill_id in sorted(skill_ids):
        b_s = pack.skills_by_id[skill_id]["difficulty_b"]
        for pid in pack.skill_items[skill_id]:
            it = pack.items_by_id[pid]
            if it["is_probe"] and abs(it["difficulty_b"] - b_s) > 1.0:
                g.err(f"probe {pid}: b {it['difficulty_b']} outside "
                      f"skill {skill_id} b_s ± 1.0 ({b_s})")

    # ---- V-15 Id hygiene + round-trip ----
    g = gate("V-15", "Id hygiene + ItemRef round-trip")
    uid_re = unit_id_re(underscore_lang(target))
    aid_re = arc_id_re(underscore_lang(target))
    spine_ids = (
        [a["id"] for a in pack.arcs] + [u["id"] for u in pack.units]
        + [s["id"] for s in pack.skills] + [n["id"] for n in pack.grammar_nodes]
        + [r["id"] for r in pack.recipes] + [c["id"] for c in pack.checkpoints]
        + [rc["id"] for rc in pack.rare_cards]
    )
    for sid in spine_ids:
        if not SPINE_ID_RE.match(sid):
            g.err(f"spine id {sid!r} violates ^[a-z0-9][a-z0-9._-]*$")
    for u in pack.units:
        if not uid_re.match(u["id"]):
            g.err(f"unit id {u['id']!r} violates the unit-id grammar")
    for a in pack.arcs:
        if not aid_re.match(a["id"]):
            g.err(f"arc id {a['id']!r} violates <target>.arc<N>")
    if not re.match(r"^journey_[a-z0-9_]+$", pack.meta.get("course_id", "")):
        g.err(f"course_id {pack.meta.get('course_id')!r} not underscore-canonical")
    for it in pack.items:
        ref = parse_item_ref(it["id"])
        if ref is None or item_ref_key(ref) != it["id"]:
            g.err(f"items.id {it['id']!r} does not round-trip through the "
                  "ONE contract helper")
        elif (ref.kind, ref.source, ref.id) != (it["kind"], it["source"], it["ref_id"]):
            g.err(f"items.id {it['id']!r} disagrees with its (kind, source, ref_id) columns")

    # ---- V-16 Overlay referents ----
    g = gate("V-16", "Overlay referents")
    gn_table_ids = {n["id"] for n in pack.grammar_nodes}
    for o in pack.l1_overlays:
        rk, rid = o["ref_kind"], o["ref_id"]
        ok = (
            (rk == "grammarNode" and rid in gn_table_ids)
            or (rk == "unit" and rid in pack.units_by_id)
            or (rk == "item" and rid in pack.items_by_id)
            or (rk == "course" and rid == pack.meta.get("course_id"))
        )
        if not ok:
            g.err(f"overlay ({o['l1']}, {o['overlay_type']}): ref "
                  f"{rk}:{rid!r} does not exist")
        if o["overlay_type"] == "cognate_credit" and o["payload_json"]:
            payload = json.loads(o["payload_json"])
            for iid in payload.get("items", []):
                if iid not in pack.items_by_id:
                    g.err(f"overlay cognate_credit ({o['l1']}): item {iid!r} "
                          "not in items")

    # ---- V-17 Immutability diff (upgrade builds) ----
    g = gate("V-17", "Immutability diff (upgrade builds)")
    current_version = pack.meta.get("content_version", "0.0.0")
    prev = _find_previous_zip(dist_dir, course_id, current_version)
    if prev is not None:
        prev_items = _items_from_zip(prev)
        cur_by_id = {i["id"]: i for i in pack.items}
        major_needed: List[str] = []
        for pid, prow in prev_items.items():
            crow = cur_by_id.get(pid)
            if crow is None:
                major_needed.append(f"items.id {pid!r} removed")
            elif (crow["kind"], crow["source"], crow["ref_id"]) != (
                prow["kind"], prow["source"], prow["ref_id"]
            ):
                major_needed.append(f"items.id {pid!r} re-pointed")
        if major_needed:
            prev_major = int(_zip_version(prev, course_id).split(".")[0])
            cur_major = int(current_version.split(".")[0])
            if cur_major <= prev_major:
                for msg in major_needed[:20]:
                    g.err(f"{msg} without a MAJOR version bump (§8)")

    # ---- V-18 Meta coherence ----
    g = gate("V-18", "Meta coherence")
    if manifest.get("version") != pack.meta.get("content_version"):
        g.err(f"manifest.version {manifest.get('version')!r} != "
              f"pack_meta.content_version {pack.meta.get('content_version')!r}")
    if str(pack.user_version) != pack.meta.get("schema_version"):
        g.err(f"PRAGMA user_version {pack.user_version} != pack_meta.schema_version "
              f"{pack.meta.get('schema_version')!r}")
    expect_counts = {
        "arc_count": len(pack.arcs), "unit_count": len(pack.units),
        "item_count": len(pack.items), "skill_count": len(pack.skills),
    }
    for key, actual in expect_counts.items():
        if pack.meta.get(key) != str(actual):
            g.err(f"pack_meta.{key} {pack.meta.get(key)!r} != actual {actual}")
    langs_present = sorted({l for (_k, l) in pack.strings})
    if set(pack.meta.get("string_langs", "").split(",")) != set(langs_present):
        g.err("pack_meta.string_langs disagrees with the strings table")
    if set(langs_present) != set(ALL_LANGUAGES):
        missing = sorted(set(ALL_LANGUAGES) - set(langs_present))
        g.err(f"strings table does not cover the 54-list; missing {missing[:8]}")
    if manifest.get("journey", {}).get("schemaVersion") != JOURNEY_SCHEMA_VERSION:
        g.err("manifest.journey.schemaVersion != builder schema version")

    # ---- V-19 Rare-card economy ----
    g = gate("V-19", "Rare-card economy")
    for rc in pack.rare_cards:
        if rc["card_type"] not in RARE_CARD_TYPES:
            g.err(f"rare card {rc['id']}: bad card_type {rc['card_type']!r}")
        if rc["card_type"] == "story":
            g.err(f"rare card {rc['id']}: card_type='story' is schema-only in "
                  "v0.1 (R11) — zero story rows ship")
        if rc["provider"] and rc["provider"] not in V01_ANCHOR_PROVIDERS:
            g.err(f"rare card {rc['id']}: provider {rc['provider']!r} not in "
                  "the V-9 provider registry")
        if rc["card_type"] == "etymology":
            it = pack.items_by_id.get(rc["item_id"] or "")
            if it is None or it["kind"] != "word":
                g.err(f"rare card {rc['id']}: etymology cards need item_id of "
                      "kind 'word'")
        if rc["min_unit_id"] and rc["min_unit_id"] not in pack.units_by_id:
            g.err(f"rare card {rc['id']}: unknown min_unit_id {rc['min_unit_id']!r}")

    # ---- V-20 Band-fill spill (W) ----
    g = gate("V-20", "Band-fill spill (warn-only)")
    for u in pack.units:
        lo, hi = u["vocab_rank_lo"], u["vocab_rank_hi"]
        if lo is None or hi is None:
            continue
        words = [i for i in pack.items
                 if i["unit_id"] == u["id"] and i["kind"] == "word"]
        if not words:
            continue
        spill = [i for i in words
                 if i["freq_rank"] is not None
                 and not lo <= i["freq_rank"] <= hi]
        if len(spill) > 0.25 * len(words):
            g.warn(f"unit {u['id']}: band-fill spill {len(spill)}/{len(words)} "
                   "> 25% of the word budget")

    # l1_full_support: the languages that carry a COMPLETE native face for
    # every item. wg.<word> glosses (V-21) and phrase translations (V-22) are
    # required for these codes; other L1s stay sparse (the deliberate V-5
    # exception — cf. the selective-language ovl.<l1>.* keys).
    l1_full = [
        c for c in pack.meta.get("l1_full_support", "").split(",") if c
    ]

    # ---- V-21 Word glosses complete (en + every l1_full_support lang) ----
    # Every word item (pinned + auto-expanded — both land in `items`) MUST have
    # a wg.<word> gloss in en AND in every l1_full_support language, so no ES
    # learner is ever shown an English→English word card (contract #1). The
    # resolver reads wg.<word> with NO en fallback, so an absent es gloss is a
    # real hole, not a soft degrade.
    g = gate("V-21", "Word glosses complete (en + l1_full_support)")
    need_langs = ["en"] + l1_full
    for it in pack.items:
        if it["kind"] != "word":
            continue
        key = f"wg.{it['ref_id']}"
        have = pack.langs_by_key.get(key, set())
        if key not in pack.string_keys:
            g.err(f"{it['id']}: no gloss {key!r} in strings at all")
            continue
        missing = [l for l in need_langs if l not in have]
        if missing:
            g.err(f"{it['id']}: gloss {key!r} missing languages: {missing}")

    # ---- V-22 Phrase L1 translation coverage (l1_full_support) ----
    # Every base-corpus phrase item MUST have a cor_translation row for every
    # l1_full_support language, or the resolver hands the renderer a phrase card
    # with no native face. Phrase-pack items (source != base) resolve their
    # native face from their own installed pack — not cor_translation — so they
    # are out of scope for this bundled-corpus gate (Team A's runtime guard
    # still reroutes any card whose native face is absent at play time).
    g = gate("V-22", "Phrase L1 translation coverage (l1_full_support)")
    if l1_full:
        for it in pack.items:
            if it["kind"] != "phrase" or it["source"] != "base":
                continue
            eid = int(it["ref_id"])
            for l1 in l1_full:
                if not corpus.has_translation(eid, l1):
                    g.err(f"{it['id']}: no {l1} cor_translation row in the corpus")

    return report


def _find_previous_zip(
    dist_dir: Path, course_id: str, current_version: str
) -> Optional[Path]:
    best: Optional[Tuple[List[int], Path]] = None
    for z in dist_dir.glob(f"{course_id}-*.zip"):
        ver = _zip_version(z, course_id)
        if ver == current_version:
            continue
        parts = [int(p) for p in ver.split(".") if p.isdigit()]
        cur = [int(p) for p in current_version.split(".") if p.isdigit()]
        if parts < cur and (best is None or parts > best[0]):
            best = (parts, z)
    return best[1] if best else None


def _zip_version(zip_path: Path, course_id: str) -> str:
    return zip_path.stem[len(course_id) + 1:]


def _items_from_zip(zip_path: Path) -> Dict[str, Dict[str, Any]]:
    import tempfile

    with zipfile.ZipFile(zip_path) as zf, tempfile.TemporaryDirectory() as td:
        zf.extract("data/course.sqlite3", td)
        db = sqlite3.connect(f"file:{td}/data/course.sqlite3?mode=ro", uri=True)
        db.row_factory = sqlite3.Row
        items = {r["id"]: dict(r) for r in db.execute("SELECT * FROM items")}
        db.close()
        return items


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("target")
    ap.add_argument("--course-dir", type=Path, default=None)
    ap.add_argument("--dist", type=Path, default=HERE / "dist")
    ap.add_argument("--core-db", type=Path, default=DJA_DIR / "release.sqlite3")
    ap.add_argument("--packs-dir", type=Path,
                    default=CORPAN_DIR / "tools" / "phrase-packs")
    ap.add_argument("--recipes", type=Path, default=HERE / "recipes.yaml")
    ap.add_argument("--cefr-reference", type=Path, default=DEFAULT_CEFR_REFERENCE)
    ap.add_argument("--json", action="store_true")
    args = ap.parse_args()

    course_dir = args.course_dir or (HERE / "courses" / args.target)
    report = validate(
        target=args.target, course_dir=course_dir, dist_dir=args.dist,
        core_db=args.core_db, packs_dir=args.packs_dir,
        recipes_path=args.recipes, cefr_reference=args.cefr_reference,
    )
    if args.json:
        print(json.dumps([g.as_dict() for g in report], indent=2))
    else:
        print_report(report)
    sys.exit(1 if has_errors(report) else 0)


if __name__ == "__main__":
    main()
