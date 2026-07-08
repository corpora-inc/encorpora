#!/usr/bin/env python3
"""Build a Journey course pack: authored YAML/JSON + corpora → course.sqlite3 + zip.

Spec: corpan/docs/journey/specs/course-pack.md §5/§6 (normative).

Standalone script (NOT Django models) — precedent: dja/word_pack. The authored
files in git are the editorial source of truth. Deterministic: rebuilding the
same git tree byte-reproduces the same DB modulo `generated_at`.

Usage:
    python3 build_journey_pack.py en \
        [--course-dir courses/en] [--core-db ../release.sqlite3] \
        [--packs-dir ../../tools/phrase-packs] [--recipes recipes.yaml] \
        [--out dist/] [--skip-validate]
"""

from __future__ import annotations

import argparse
import json
import math
import re
import sqlite3
import sys
import zipfile
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

import yaml
from pydantic import BaseModel, ConfigDict, Field

from journey_common import (
    ALL_LANGUAGES,
    CEFR_ARC_VALUES,
    CEFR_CENTERS,
    CORPAN_DIR,
    DDL,
    DJA_DIR,
    HERE,
    JOURNEY_SCHEMA_VERSION,
    ItemRef,
    git_short_sha,
    item_ref_key,
    nfc_len,
    parse_item_ref,
    sha256_file,
    underscore_lang,
)

# ---------------------------------------------------------------------------
# Authored-file schemas (pydantic, hard error on unknown keys — §6.2 step 1)
# ---------------------------------------------------------------------------


class StrictModel(BaseModel):
    model_config = ConfigDict(extra="forbid")


class ArcGate(StrictModel):
    pass_score: float = 0.8
    params: Optional[Dict[str, Any]] = None


class ArcYaml(StrictModel):
    id: str
    index: int
    cefr: str  # one of CEFR_ARC_VALUES
    title: str
    gate: ArcGate


class CourseYaml(StrictModel):
    course_id: Optional[str] = None  # default journey_<target>
    target_lang: str
    version: str
    launchpad_units: int = 1
    script_track: bool = False
    # L1 codes with full native-face coverage (word glosses + phrase
    # translations). Gates V-21/V-22 enforce completeness for these only.
    l1_full_support: List[str] = Field(default_factory=list)
    min_app_version: Optional[str] = None
    name: str
    description: str
    name_localized: Dict[str, str] = Field(default_factory=dict)
    description_localized: Dict[str, str] = Field(default_factory=dict)
    arcs: List[ArcYaml]


class GrammarNodeYaml(StrictModel):
    id: str
    skill: str
    order: int
    cefr: str
    title: str
    note: str
    late_acquired: bool = False


class GrammarYaml(StrictModel):
    nodes: List[GrammarNodeYaml]


class CandoYaml(StrictModel):
    key: str
    text: str


class VocabBand(StrictModel):
    lo: int
    hi: int


class SkillYaml(StrictModel):
    id: str
    kind: str  # grammar|vocab|phonology|script|function
    title: str
    b: float
    prereqs: List[str] = Field(default_factory=list)


class ItemRefYaml(StrictModel):
    ref: str
    skills: List[str] = Field(default_factory=list)
    importance: int = 2
    probe: bool = False
    substitutable: bool = False
    b: Optional[float] = None


class ItemAutoYaml(StrictModel):
    kind: str  # phrase | word
    source: Optional[str] = None  # phrase: "base" | phrase-pack id
    domains: List[str] = Field(default_factory=list)
    level: Optional[str] = None
    rank_band: Optional[Tuple[int, int]] = None
    count: int
    skills: List[str] = Field(default_factory=list)
    importance: int = 2
    substitutable: bool = False


class ItemEntryYaml(StrictModel):
    ref: Optional[str] = None
    auto: Optional[ItemAutoYaml] = None
    skills: List[str] = Field(default_factory=list)
    importance: int = 2
    probe: bool = False
    substitutable: bool = False
    b: Optional[float] = None


class BossYaml(StrictModel):
    pass_score: float = 0.8
    params: Optional[Dict[str, Any]] = None


class AnchorYaml(StrictModel):
    provider: str
    config: Optional[Dict[str, Any]] = None


class UnitYaml(StrictModel):
    id: str
    arc: str
    theme: str
    cando: List[CandoYaml]
    vocab_band: Optional[VocabBand] = None
    phrase_domains: List[str] = Field(default_factory=list)
    skills: List[SkillYaml] = Field(default_factory=list)
    grammar_nodes: List[str] = Field(default_factory=list)
    items: List[ItemEntryYaml] = Field(default_factory=list)
    lessons: List[str] = Field(default_factory=list)
    boss: BossYaml
    anchor: Optional[AnchorYaml] = None


class RecipeSlotYaml(StrictModel):
    slot_type: str
    activity_types: List[str]
    item_selector: str
    params: Optional[Dict[str, Any]] = None
    optional: bool = False


class RecipeYaml(StrictModel):
    id: str
    title: str
    est_minutes: float
    slots: List[RecipeSlotYaml]


class RecipesYaml(StrictModel):
    recipes: List[RecipeYaml]


class ContrastiveNoteYaml(StrictModel):
    ref_kind: str  # grammarNode | unit | item | course
    ref: str
    note: str  # en source text; l1 translation ships in strings/<l1>.json


class CognateCreditYaml(StrictModel):
    ref_kind: str = "course"
    ref: Optional[str] = None  # default course_id
    items: List[str]
    seed_form: int = 0
    stability_boost: float = 0.0


class PhonemePairYaml(StrictModel):
    contrast: str  # sorted-IPA "A-B"
    minimal_pairs: List[Tuple[str, str]] = Field(default_factory=list)
    unit: Optional[str] = None  # introducing phonology unit; default: first launchpad unit


class OverlayYaml(StrictModel):
    l1: str
    contrastive_notes: List[ContrastiveNoteYaml] = Field(default_factory=list)
    cognate_credits: List[CognateCreditYaml] = Field(default_factory=list)
    phoneme_pairs: List[PhonemePairYaml] = Field(default_factory=list)


class RareCardYaml(StrictModel):
    id: str
    card_type: str
    rarity_weight: int
    min_unit: Optional[str] = None
    provider: Optional[str] = None
    item: Optional[str] = None  # serialized ItemRef
    coverage_gate: Optional[float] = None
    params: Optional[Dict[str, Any]] = None


class RareCardsYaml(StrictModel):
    cards: List[RareCardYaml] = Field(default_factory=list)


# ---------------------------------------------------------------------------
# Loaded course (authored tree, resolved)
# ---------------------------------------------------------------------------


class BuildError(Exception):
    pass


class Course:
    """The fully loaded + resolved course, pre-SQLite."""

    def __init__(self) -> None:
        self.course: CourseYaml
        self.course_id: str = ""
        self.target: str = ""
        self.grammar: GrammarYaml
        self.units: List[UnitYaml] = []
        self.recipes: RecipesYaml
        self.overlays: List[OverlayYaml] = []
        self.rare_cards: List[RareCardYaml] = []
        self.strings_files: Dict[str, Dict[str, str]] = {}
        # resolved
        self.arc_by_id: Dict[str, ArcYaml] = {}
        self.unit_order: Dict[str, Tuple[int, int]] = {}  # unit id → (arc_index, unit_index)
        self.unit_index: Dict[str, int] = {}  # unit id → unit_index within arc
        self.skills: Dict[str, Dict[str, Any]] = {}  # skill id → row dict
        self.grammar_nodes: Dict[str, Dict[str, Any]] = {}  # emitted nodes
        self.items: List[Dict[str, Any]] = []  # item row dicts (intro_order later)
        self.strings: Dict[Tuple[str, str], str] = {}  # (key, lang) → text
        self.auto_pools: Dict[str, List[Tuple[str, int]]] = {}  # unit → [(kind, poolsize×count)]


def _load_yaml(path: Path) -> Any:
    with path.open("r", encoding="utf-8") as f:
        return yaml.safe_load(f)


def load_course_tree(
    target: str,
    course_dir: Path,
    recipes_path: Path,
) -> Course:
    c = Course()
    c.target = target
    course_yaml = course_dir / "course.yaml"
    if not course_yaml.exists():
        raise BuildError(f"missing {course_yaml}")
    c.course = CourseYaml.model_validate(_load_yaml(course_yaml))
    if c.course.target_lang != target:
        raise BuildError(
            f"course.yaml target_lang={c.course.target_lang!r} != CLI target {target!r}"
        )
    c.course_id = c.course.course_id or f"journey_{underscore_lang(target)}"

    grammar_yaml = course_dir / "grammar.yaml"
    c.grammar = GrammarYaml.model_validate(
        _load_yaml(grammar_yaml) if grammar_yaml.exists() else {"nodes": []}
    )

    units_dir = course_dir / "units"
    unit_files = sorted(units_dir.glob("*.yaml")) if units_dir.exists() else []
    if not unit_files:
        raise BuildError(f"no unit YAML files under {units_dir}")
    for f in unit_files:
        c.units.append(UnitYaml.model_validate(_load_yaml(f)))

    c.recipes = RecipesYaml.model_validate(_load_yaml(recipes_path))

    overlays_dir = course_dir / "overlays"
    if overlays_dir.exists():
        for f in sorted(overlays_dir.glob("*.yaml")):
            c.overlays.append(OverlayYaml.model_validate(_load_yaml(f)))

    rare_yaml = course_dir / "rare_cards.yaml"
    if rare_yaml.exists():
        c.rare_cards = RareCardsYaml.model_validate(_load_yaml(rare_yaml)).cards

    strings_dir = course_dir / "strings"
    if strings_dir.exists():
        for f in sorted(strings_dir.glob("*.json")):
            lang = f.stem
            data = json.loads(f.read_text(encoding="utf-8"))
            if not isinstance(data, dict):
                raise BuildError(f"{f} must be a flat JSON object")
            c.strings_files[lang] = {str(k): str(v) for k, v in data.items()}

    # ---- spine indexes ----
    for arc in c.course.arcs:
        if arc.cefr not in CEFR_ARC_VALUES:
            raise BuildError(f"arc {arc.id}: bad cefr {arc.cefr!r}")
        c.arc_by_id[arc.id] = arc
    # unit_index: 1-based order within the arc, deterministic by unit id sort
    by_arc: Dict[str, List[UnitYaml]] = {}
    for u in c.units:
        if u.arc not in c.arc_by_id:
            raise BuildError(f"unit {u.id}: unknown arc {u.arc!r}")
        by_arc.setdefault(u.arc, []).append(u)
    for arc_id, arc_units in by_arc.items():
        arc_units.sort(key=lambda u: u.id)
        for i, u in enumerate(arc_units, start=1):
            c.unit_index[u.id] = i
            c.unit_order[u.id] = (c.arc_by_id[arc_id].index, i)
    return c


# ---------------------------------------------------------------------------
# Corpus access
# ---------------------------------------------------------------------------


class Corpus:
    """Read-only access to release.sqlite3 + phrase packs for ref resolution."""

    def __init__(self, core_db: Path, packs_dir: Path, target: str) -> None:
        if not core_db.exists():
            raise BuildError(f"core db not found: {core_db}")
        self.core_db_path = core_db
        self.db = sqlite3.connect(f"file:{core_db}?mode=ro", uri=True)
        self.packs_dir = packs_dir
        self.target = target
        self._phrase_packs: Dict[str, List[str]] = {}
        row = self.db.execute(
            "SELECT id FROM cor_language WHERE code = ?", (target,)
        ).fetchone()
        self.target_lang_id = row[0] if row else None
        self._lang_id_cache: Dict[str, Optional[int]] = {target: self.target_lang_id}

    def lang_id(self, code: str) -> Optional[int]:
        if code not in self._lang_id_cache:
            row = self.db.execute(
                "SELECT id FROM cor_language WHERE code = ?", (code,)
            ).fetchone()
            self._lang_id_cache[code] = row[0] if row else None
        return self._lang_id_cache[code]

    def has_translation(self, entry_id: int, code: str) -> bool:
        """True iff cor_translation has a non-empty row for (entry, language).

        Used by gate V-22 (l1_full_support phrase coverage). Unknown language
        code ⇒ False (a missing L1 is a coverage hole, not a crash)."""
        lid = self.lang_id(code)
        if lid is None:
            return False
        row = self.db.execute(
            "SELECT text FROM cor_translation WHERE entry_id = ? AND language_id = ?",
            (entry_id, lid),
        ).fetchone()
        return bool(row and row[0])

    def entry_level(self, entry_id: int) -> Optional[str]:
        row = self.db.execute(
            "SELECT level FROM cor_entry WHERE id = ?", (entry_id,)
        ).fetchone()
        return row[0] if row else None

    def entry_text(self, entry_id: int) -> Optional[str]:
        if self.target_lang_id is None:
            return None
        row = self.db.execute(
            "SELECT text FROM cor_translation WHERE entry_id = ? AND language_id = ?",
            (entry_id, self.target_lang_id),
        ).fetchone()
        return row[0] if row else None

    def phrase_pack_texts(self, pack_id: str) -> List[str]:
        """phrases.json array — array order = immutable id (index)."""
        if pack_id not in self._phrase_packs:
            path = self.packs_dir / pack_id / "phrases.json"
            if not path.exists():
                raise BuildError(f"phrase pack {pack_id!r} not found at {path}")
            data = json.loads(path.read_text(encoding="utf-8"))
            texts: List[str] = []
            for it in data:
                if isinstance(it, dict):
                    # Legacy phrase packs key their entries "english" (the
                    # original schema); newer packs write "text" (+ sometimes
                    # "en"). Read all three so pins into legacy packs never
                    # resolve to empty text (W7 seam, fixed by W10).
                    texts.append(
                        str(it.get("text") or it.get("en") or it.get("english") or "")
                    )
                else:
                    texts.append(str(it))
            self._phrase_packs[pack_id] = texts
        return self._phrase_packs[pack_id]

    def candidate_pool(
        self, domains: List[str], level: Optional[str]
    ) -> List[Tuple[int, str]]:
        """Base-corpus phrase candidates: [(entry_id, text)]. Deterministic order."""
        sql = (
            "SELECT DISTINCT e.id, t.text FROM cor_entry e "
            "JOIN cor_translation t ON t.entry_id = e.id AND t.language_id = ? "
        )
        params: List[Any] = [self.target_lang_id]
        conds: List[str] = []
        if domains:
            sql += (
                "JOIN cor_entry_domains ed ON ed.entry_id = e.id "
                "JOIN cor_domain d ON d.id = ed.domain_id "
            )
            conds.append(
                "d.code IN (%s)" % ",".join("?" for _ in domains)
            )
            params.extend(domains)
        if level:
            conds.append("e.level = ?")
            params.append(level)
        if conds:
            sql += "WHERE " + " AND ".join(conds) + " "
        sql += "ORDER BY e.id"
        # Exclude single-token phrases: a one-word phrase ("Bye!") produces a
        # degenerate one-blank cloze / one-tile word_order (gate V-24). Auto
        # phrase fills are cloze/word_order fodder, so skip them here — one-word
        # vocabulary belongs in word: items.
        _tok = re.compile(r"[^\W\d_]+(?:'[^\W\d_]+)?", re.UNICODE)
        return [
            (int(r[0]), str(r[1]))
            for r in self.db.execute(sql, params)
            if len(_tok.findall(str(r[1]))) >= 2
        ]


class WordUniverse:
    """wordfreq-backed word ranks for the target language (§6.1)."""

    def __init__(self, target: str, top_n: int = 60000) -> None:
        try:
            from wordfreq import top_n_list
        except ImportError as e:  # pragma: no cover
            raise BuildError(
                "wordfreq is required to resolve word: items "
                "(pip install wordfreq — see dja/requirements.txt)"
            ) from e
        base = target.split("-")[0].lower()
        self.words = top_n_list(base, top_n)
        self.rank: Dict[str, int] = {w: i + 1 for i, w in enumerate(self.words)}


# ---------------------------------------------------------------------------
# Build pipeline (§6.2)
# ---------------------------------------------------------------------------


def _seed_b(
    cefr: str, freq_rank: Optional[int], band: Optional[Tuple[int, int]]
) -> float:
    center = CEFR_CENTERS[cefr]
    b = center
    if freq_rank and band and band[0] < band[1]:
        band_center = (band[0] + band[1]) / 2.0
        b = center + 0.4 * math.log10(max(freq_rank, 1) / band_center)
    # Clamp to the V-14 difficulty-sanity floor: preA1/A0 center is -3.5, so
    # the CEFR-center band (center - 0.7 = -4.2) could emit b < -4.0 and trip
    # the gate for low-frequency preA1 word items (W7 seam, fixed by W10).
    lo = max(center - 0.7, -4.0)
    return max(lo, min(center + 0.7, b))


def resolve_items(c: Course, corpus: Corpus) -> None:
    """§6.2 steps 2–3: resolve refs, expand autos, mint grammarNode/phoneme items."""
    used_refs: set = set()
    word_universe: Optional[WordUniverse] = None

    # skills first (needed by items)
    for u in c.units:
        for s in u.skills:
            if s.id in c.skills:
                raise BuildError(f"skill {s.id} declared in more than one unit")
            c.skills[s.id] = {
                "id": s.id, "unit_id": u.id, "kind": s.kind,
                "title": s.title, "b": s.b, "prereqs": list(s.prereqs),
            }

    def add_item(
        ref: ItemRef, unit: UnitYaml, skills: List[str], importance: int,
        probe: bool, substitutable: bool, b: Optional[float],
        freq_rank: Optional[int], text: str, sort3: int,
    ) -> None:
        key = item_ref_key(ref)
        if key in used_refs:
            raise BuildError(f"duplicate item ref {key} (unit {unit.id})")
        used_refs.add(key)
        arc = c.arc_by_id[unit.arc]
        if b is None:
            band = None
            if unit.vocab_band:
                band = (unit.vocab_band.lo, unit.vocab_band.hi)
            b = _seed_b(arc.cefr, freq_rank, band)
        c.items.append({
            "id": key, "kind": ref.kind, "source": ref.source, "ref_id": ref.id,
            "unit_id": unit.id, "difficulty_b": round(b, 4),
            "importance": importance, "is_probe": 1 if probe else 0,
            "substitutable": 1 if substitutable else 0,
            "freq_rank": freq_rank, "text_len": nfc_len(text), "text": text,
            "skills": skills, "_sort3": sort3,
        })

    # Pass 1: explicit (pinned) refs across ALL units — pins always win over
    # auto expansion, so a later unit's pin is never consumed by an earlier
    # unit's auto block (V-10 "pinned includes ... not excluded elsewhere").
    for u in c.units:
        for entry in u.items:
            if (entry.ref is None) == (entry.auto is None):
                raise BuildError(
                    f"unit {u.id}: each items entry needs exactly one of ref:/auto:"
                )
            if entry.ref is not None:
                ref = parse_item_ref(entry.ref)
                if ref is None or ref.kind not in (
                    "phrase", "word", "char", "segment", "concept"
                ):
                    raise BuildError(f"unit {u.id}: bad explicit ref {entry.ref!r}")
                if ref.kind == "phrase":
                    if ref.source == "base":
                        text = corpus.entry_text(int(ref.id)) or ""
                        level = corpus.entry_level(int(ref.id))
                        if not text or level is None:
                            raise BuildError(
                                f"unit {u.id}: phrase:base:{ref.id} unresolvable"
                            )
                        b = entry.b
                        if b is None:
                            b = _seed_b(level, None, None)
                        add_item(ref, u, entry.skills, entry.importance,
                                 entry.probe, entry.substitutable, b, None,
                                 text, 10**9)
                    else:
                        texts = corpus.phrase_pack_texts(ref.source)
                        idx = int(ref.id)
                        if idx < 0 or idx >= len(texts):
                            raise BuildError(
                                f"unit {u.id}: {entry.ref} out of range for pack"
                            )
                        add_item(ref, u, entry.skills, entry.importance,
                                 entry.probe, entry.substitutable, entry.b,
                                 None, texts[idx], 10**9)
                elif ref.kind == "word":
                    if word_universe is None:
                        word_universe = WordUniverse(c.target)
                    rank = word_universe.rank.get(ref.id)
                    if rank is None:
                        raise BuildError(
                            f"unit {u.id}: word {ref.id!r} not in the word universe"
                        )
                    add_item(ref, u, entry.skills, entry.importance,
                             entry.probe, entry.substitutable, entry.b,
                             rank, ref.id, rank)
                else:
                    raise BuildError(
                        f"unit {u.id}: item kind {ref.kind!r} is a v0.1 schema stub "
                        "(char/segment/concept refs do not ship yet)"
                    )

    # Pass 2: auto blocks (fill from the corpora, excluding everything pinned).
    for u in c.units:
        for entry in u.items:
            if entry.auto is not None:
                auto = entry.auto
                if auto.kind == "phrase":
                    source = auto.source or "base"
                    if source != "base":
                        raise BuildError(
                            f"unit {u.id}: auto phrase blocks support source=base only "
                            "(pin gap-pack phrases with explicit refs)"
                        )
                    pool = corpus.candidate_pool(
                        auto.domains or u.phrase_domains, auto.level
                    )
                    pool = [(eid, t) for eid, t in pool
                            if item_ref_key(ItemRef("phrase", "base", str(eid)))
                            not in used_refs]
                    c.auto_pools.setdefault(u.id, []).append(
                        ("phrase", len(pool), auto.count)
                    )
                    if len(pool) < auto.count:
                        raise BuildError(
                            f"unit {u.id}: auto phrase pool {len(pool)} < count {auto.count}"
                        )
                    # seeded-stable: sort by (freq_rank, source, ref_id) —
                    # phrases carry no freq_rank, so (source, entry id) decides.
                    pool.sort(key=lambda p: p[0])
                    for eid, text in pool[: auto.count]:
                        level = corpus.entry_level(eid) or "A1"
                        add_item(
                            ItemRef("phrase", "base", str(eid)), u,
                            auto.skills, auto.importance, False,
                            auto.substitutable, _seed_b(level, None, None),
                            None, text, 10**9,
                        )
                elif auto.kind == "word":
                    if word_universe is None:
                        word_universe = WordUniverse(c.target)
                    if not auto.rank_band:
                        raise BuildError(
                            f"unit {u.id}: auto word blocks need rank_band"
                        )
                    lo, hi = auto.rank_band
                    cands = [
                        (w, r) for w, r in word_universe.rank.items()
                        if lo <= r <= hi and w.isalpha()
                        and item_ref_key(ItemRef("word", c.target, w)) not in used_refs
                    ]
                    cands.sort(key=lambda p: p[1])
                    c.auto_pools.setdefault(u.id, []).append(
                        ("word", len(cands), auto.count)
                    )
                    if len(cands) < auto.count:
                        raise BuildError(
                            f"unit {u.id}: auto word pool {len(cands)} < count {auto.count}"
                        )
                    for w, r in cands[: auto.count]:
                        add_item(
                            ItemRef("word", c.target, w), u, auto.skills,
                            auto.importance, False, auto.substitutable,
                            None, r, w, r,
                        )
                else:
                    raise BuildError(
                        f"unit {u.id}: unsupported auto kind {auto.kind!r}"
                    )

    # ---- mint grammarNode items (one per node referenced by a unit) ----
    node_by_id = {n.id: n for n in c.grammar.nodes}
    introduced: Dict[str, str] = {}
    for u in c.units:
        for nid in u.grammar_nodes:
            if nid not in node_by_id:
                raise BuildError(f"unit {u.id}: grammar node {nid!r} not in grammar.yaml")
            if nid in introduced:
                raise BuildError(
                    f"grammar node {nid} introduced by both {introduced[nid]} and {u.id}"
                )
            introduced[nid] = u.id
            n = node_by_id[nid]
            c.grammar_nodes[nid] = {
                "id": nid, "skill_id": n.skill, "node_order": n.order,
                "cefr": n.cefr, "title": n.title, "note": n.note,
                "late_acquired": 1 if n.late_acquired else 0, "unit_id": u.id,
            }
            ref = ItemRef("grammarNode", c.course_id, nid)
            add_item(ref, u, [n.skill], 2, False, False,
                     _seed_b(n.cefr, None, None), None, n.title, n.order)

    # ---- mint phoneme items (union of overlay phoneme_pair contrasts) ----
    # Communicative-first (V-23): phonemes must NOT default into the FIRST
    # launchpad unit (the learner's opener). Prefer the LAST launchpad unit so
    # unmapped contrasts land in a later phonology slot, never the opener.
    launchpad_units = sorted(
        (u for u in c.units if c.arc_by_id[u.arc].index == 0),
        key=lambda u: c.unit_index[u.id],
    )
    default_phon_unit = launchpad_units[-1] if launchpad_units else None
    seen_contrasts: Dict[str, UnitYaml] = {}
    for ov in c.overlays:
        for pp in ov.phoneme_pairs:
            if pp.contrast in seen_contrasts:
                continue
            unit = None
            if pp.unit:
                unit = next((u for u in c.units if u.id == pp.unit), None)
                if unit is None:
                    raise BuildError(
                        f"overlay {ov.l1}: phoneme pair {pp.contrast} names "
                        f"unknown unit {pp.unit!r}"
                    )
            unit = unit or default_phon_unit
            if unit is None:
                raise BuildError(
                    "phoneme items need a launchpad unit (arc index 0) to land in"
                )
            seen_contrasts[pp.contrast] = unit
            phon_skills = [
                s.id for s in unit.skills if s.kind == "phonology"
            ]
            ref = ItemRef("phoneme", c.course_id, pp.contrast)
            arc = c.arc_by_id[unit.arc]
            add_item(ref, unit, phon_skills, 2, False, False,
                     _seed_b(arc.cefr, None, None), None, pp.contrast, 10**8)


def assign_intro_order(c: Course) -> None:
    """§6.2 step 4: stable sort by (arc_index, unit_index, lexical-or-node key, id)."""
    def key(it: Dict[str, Any]) -> Tuple[int, int, int, str]:
        arc_idx, unit_idx = c.unit_order[it["unit_id"]]
        return (arc_idx, unit_idx, it["_sort3"], it["id"])

    c.items.sort(key=key)
    for i, it in enumerate(c.items, start=1):
        it["intro_order"] = i


def compile_strings(c: Course) -> None:
    """§6.2 step 6: mint namespaced keys from authored text; merge strings files.

    en text comes from the authored YAML; strings/<lang>.json files supply the
    other languages (translations are source code — authored, git-tracked).
    A strings/en.json file, when present, must agree with the YAML-authored text.
    """
    def put(key: str, lang: str, text: str) -> None:
        c.strings[(key, lang)] = text

    for arc in c.course.arcs:
        put(f"arc.{arc.id}.title", "en", arc.title)
    for u in c.units:
        put(f"unit.{u.id}.theme", "en", u.theme)
        for cd in u.cando:
            put(f"cando.{u.id}.{cd.key}", "en", cd.text)
        for s in u.skills:
            put(f"skill.{s.id}.title", "en", s.title)
    for n in c.grammar_nodes.values():
        put(f"gn.{n['id']}.title", "en", n["title"])
        put(f"gn.{n['id']}.note", "en", n["note"])
    for r in c.recipes.recipes:
        put(f"recipe.{r.id}.title", "en", r.title)
    for ov in c.overlays:
        for note in ov.contrastive_notes:
            put(f"ovl.{ov.l1}.{note.ref}.note", "en", note.note)

    minted_en = {k: v for (k, lang), v in c.strings.items() if lang == "en"}
    for lang, table in c.strings_files.items():
        for key, text in table.items():
            if lang == "en":
                if key in minted_en and minted_en[key] != text:
                    raise BuildError(
                        f"strings/en.json[{key!r}] disagrees with the YAML-authored text"
                    )
                put(key, "en", text)
            else:
                put(key, lang, text)


def emit_sqlite(c: Course, out_db: Path, corpus: Corpus) -> None:
    """§6.2 step 7."""
    out_db.parent.mkdir(parents=True, exist_ok=True)
    if out_db.exists():
        out_db.unlink()
    db = sqlite3.connect(out_db)
    db.execute("PRAGMA application_id = 0x434F5250")
    db.execute(f"PRAGMA user_version = {JOURNEY_SCHEMA_VERSION}")
    db.execute("PRAGMA journal_mode = OFF")
    db.execute("PRAGMA page_size = 4096")
    db.executescript(DDL)

    string_langs = sorted(
        {lang for (_k, lang) in c.strings},
        key=lambda l: ALL_LANGUAGES.index(l) if l in ALL_LANGUAGES else 999,
    )
    meta = {
        "schema_version": str(JOURNEY_SCHEMA_VERSION),
        "course_id": c.course_id,
        "target_lang": c.target,
        "content_version": c.course.version,
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "builder_git_sha": git_short_sha(),
        "arc_count": str(len(c.course.arcs)),
        "unit_count": str(len(c.units)),
        "item_count": str(len(c.items)),
        "skill_count": str(len(c.skills)),
        "string_lang_count": str(len(string_langs)),
        "string_langs": ",".join(string_langs),
        "corpus_base_sha": sha256_file(corpus.core_db_path),
        "launchpad_units": str(c.course.launchpad_units),
        "script_track": "1" if c.course.script_track else "0",
        # L1s with full native-face coverage (gates V-21/V-22 read this).
        "l1_full_support": ",".join(c.course.l1_full_support),
    }
    db.executemany("INSERT INTO pack_meta VALUES (?,?)", meta.items())

    for arc in c.course.arcs:
        db.execute(
            "INSERT INTO arcs VALUES (?,?,?,?)",
            (arc.id, arc.index, arc.cefr, f"arc.{arc.id}.title"),
        )
    for u in c.units:
        db.execute(
            "INSERT INTO units VALUES (?,?,?,?,?,?,?,?,?,?)",
            (
                u.id, u.arc, c.unit_index[u.id], f"unit.{u.id}.theme",
                json.dumps([f"cando.{u.id}.{cd.key}" for cd in u.cando]),
                u.vocab_band.lo if u.vocab_band else None,
                u.vocab_band.hi if u.vocab_band else None,
                json.dumps(u.phrase_domains) if u.phrase_domains else None,
                u.anchor.provider if u.anchor else None,
                json.dumps(u.anchor.config) if u.anchor and u.anchor.config else None,
            ),
        )
    for s in c.skills.values():
        db.execute(
            "INSERT INTO skills VALUES (?,?,?,?,?)",
            (s["id"], s["unit_id"], s["kind"], f"skill.{s['id']}.title", s["b"]),
        )
        for p in s["prereqs"]:
            db.execute("INSERT INTO skill_edges VALUES (?,?)", (p, s["id"]))
    for n in c.grammar_nodes.values():
        db.execute(
            "INSERT INTO grammar_nodes VALUES (?,?,?,?,?,?,?)",
            (
                n["id"], n["skill_id"], n["node_order"], n["cefr"],
                f"gn.{n['id']}.title", f"gn.{n['id']}.note", n["late_acquired"],
            ),
        )
    for it in c.items:
        db.execute(
            "INSERT INTO items (id,kind,source,ref_id,unit_id,intro_order,"
            "difficulty_b,importance,is_probe,substitutable,freq_rank,text_len) "
            "VALUES (?,?,?,?,?,?,?,?,?,?,?,?)",
            (
                it["id"], it["kind"], it["source"], it["ref_id"], it["unit_id"],
                it["intro_order"], it["difficulty_b"], it["importance"],
                it["is_probe"], it["substitutable"], it["freq_rank"],
                it["text_len"],
            ),
        )
        for sk in dict.fromkeys(it["skills"]):
            if sk not in c.skills:
                raise BuildError(f"item {it['id']}: unknown skill {sk!r}")
            db.execute("INSERT INTO item_skills VALUES (?,?)", (it["id"], sk))
    for r in c.recipes.recipes:
        db.execute(
            "INSERT INTO lesson_recipes VALUES (?,?,?)",
            (r.id, f"recipe.{r.id}.title", r.est_minutes),
        )
        for i, slot in enumerate(r.slots):
            db.execute(
                "INSERT INTO recipe_slots VALUES (?,?,?,?,?,?,?)",
                (
                    r.id, i, slot.slot_type, json.dumps(slot.activity_types),
                    slot.item_selector,
                    json.dumps(slot.params) if slot.params else None,
                    1 if slot.optional else 0,
                ),
            )
    recipe_ids = {r.id for r in c.recipes.recipes}
    for u in c.units:
        for i, rid in enumerate(u.lessons):
            if rid not in recipe_ids:
                raise BuildError(f"unit {u.id}: unknown lesson recipe {rid!r}")
            db.execute(
                "INSERT INTO unit_lessons VALUES (?,?,?,?)", (u.id, i, rid, None)
            )
        db.execute(
            "INSERT INTO checkpoints VALUES (?,?,?,?,?,?,?)",
            (
                f"{u.id}.boss", "unit", u.id, None, "boss",
                u.boss.pass_score,
                json.dumps(u.boss.params) if u.boss.params else None,
            ),
        )
    for arc in c.course.arcs:
        db.execute(
            "INSERT INTO checkpoints VALUES (?,?,?,?,?,?,?)",
            (
                f"{arc.id}.gate", "arc", None, arc.id, "boss",
                arc.gate.pass_score,
                json.dumps(arc.gate.params) if arc.gate.params else None,
            ),
        )
    for rc in c.rare_cards:
        db.execute(
            "INSERT INTO rare_cards VALUES (?,?,?,?,?,?,?,?)",
            (
                rc.id, rc.card_type, rc.rarity_weight, rc.min_unit,
                rc.provider, rc.item, rc.coverage_gate,
                json.dumps(rc.params) if rc.params else None,
            ),
        )
    for ov in c.overlays:
        for note in ov.contrastive_notes:
            db.execute(
                "INSERT INTO l1_overlays VALUES (?,?,?,?,?,?)",
                (
                    ov.l1, "contrastive_note", note.ref_kind, note.ref,
                    f"ovl.{ov.l1}.{note.ref}.note", None,
                ),
            )
        for cg in ov.cognate_credits:
            db.execute(
                "INSERT INTO l1_overlays VALUES (?,?,?,?,?,?)",
                (
                    ov.l1, "cognate_credit", cg.ref_kind,
                    cg.ref or c.course_id, None,
                    json.dumps({
                        "items": cg.items, "seedForm": cg.seed_form,
                        "stabilityBoost": cg.stability_boost,
                    }),
                ),
            )
        for pp in ov.phoneme_pairs:
            item_id = item_ref_key(ItemRef("phoneme", c.course_id, pp.contrast))
            db.execute(
                "INSERT INTO l1_overlays VALUES (?,?,?,?,?,?)",
                (
                    ov.l1, "phoneme_pair", "item", item_id, None,
                    json.dumps({
                        "contrast": pp.contrast,
                        "minimalPairs": [list(p) for p in pp.minimal_pairs],
                    }),
                ),
            )
    db.executemany(
        "INSERT INTO strings VALUES (?,?,?)",
        [(k, lang, text) for (k, lang), text in sorted(c.strings.items())],
    )

    fk = db.execute("PRAGMA foreign_key_check").fetchall()
    if fk:
        raise BuildError(f"foreign_key_check failed: {fk[:5]}")
    db.commit()
    db.execute("ANALYZE")
    db.commit()
    db.execute("VACUUM")
    db.close()


def emit_manifest(c: Course) -> Dict[str, Any]:
    manifest: Dict[str, Any] = {
        "id": c.course_id,
        "name": c.course.name,
        "version": c.course.version,
        "entryType": "data",
        "packType": "data",
        "sdkVersion": "0.1.0",
        "databases": {"main": "data/course.sqlite3"},
        "languages": [c.target],
        "journey": {
            "targetLang": c.target,
            "schemaVersion": JOURNEY_SCHEMA_VERSION,
        },
    }
    if c.course.name_localized:
        manifest["nameLocalized"] = {"en": c.course.name, **c.course.name_localized}
    manifest["descriptionLocalized"] = {
        "en": c.course.description, **c.course.description_localized,
    }
    manifest["description"] = c.course.description
    return manifest


def build(
    target: str,
    course_dir: Path,
    core_db: Path,
    packs_dir: Path,
    recipes_path: Path,
    out_dir: Path,
    skip_validate: bool = False,
) -> Path:
    c = load_course_tree(target, course_dir, recipes_path)
    corpus = Corpus(core_db, packs_dir, target)
    resolve_items(c, corpus)
    assign_intro_order(c)
    compile_strings(c)

    stage = out_dir / c.course_id
    emit_sqlite(c, stage / "data" / "course.sqlite3", corpus)
    manifest = emit_manifest(c)
    (stage / "manifest.json").write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )

    zip_path = out_dir / f"{c.course_id}-{c.course.version}.zip"
    if zip_path.exists():
        zip_path.unlink()
    with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED) as zf:
        zf.write(stage / "manifest.json", "manifest.json")
        zf.write(stage / "data" / "course.sqlite3", "data/course.sqlite3")

    db_size = (stage / "data" / "course.sqlite3").stat().st_size
    zip_size = zip_path.stat().st_size
    print(f"built {zip_path}")
    print(f"  sha256   {sha256_file(zip_path)}")
    print(f"  sqlite   {db_size / 1e6:.2f} MB   zip {zip_size / 1e6:.2f} MB")
    # §9 budget ceilings: 8 MB sqlite / 4 MB zip, warn at 80%.
    if db_size > 0.8 * 8_000_000 or zip_size > 0.8 * 4_000_000:
        print("  WARNING: within 20% of the v0.1 size budget (8 MB sqlite / 4 MB zip)")
    if db_size > 8_000_000 or zip_size > 4_000_000:
        raise BuildError("size budget exceeded (8 MB sqlite / 4 MB zip)")

    if not skip_validate:
        import validate_journey_pack as v

        report = v.validate(
            target=target, course_dir=course_dir, dist_dir=out_dir,
            core_db=core_db, packs_dir=packs_dir, recipes_path=recipes_path,
        )
        v.print_report(report)
        if v.has_errors(report):
            raise BuildError("validation failed (see gate report above)")
    return zip_path


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("target", help="target language code, e.g. en")
    ap.add_argument("--course-dir", type=Path, default=None,
                    help="authored course tree (default courses/<target>)")
    ap.add_argument("--core-db", type=Path, default=DJA_DIR / "release.sqlite3")
    ap.add_argument("--packs-dir", type=Path,
                    default=CORPAN_DIR / "tools" / "phrase-packs")
    ap.add_argument("--recipes", type=Path, default=HERE / "recipes.yaml")
    ap.add_argument("--out", type=Path, default=HERE / "dist")
    ap.add_argument("--skip-validate", action="store_true")
    args = ap.parse_args()

    course_dir = args.course_dir or (HERE / "courses" / args.target)
    try:
        build(
            args.target, course_dir, args.core_db, args.packs_dir,
            args.recipes, args.out, skip_validate=args.skip_validate,
        )
    except BuildError as e:
        print(f"BUILD ERROR: {e}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
