"""T1, symptom mapping: the engine's ranked candidates, then (optionally) a model's closed decision.

The model sees the technician's words and the first K candidates of `symptom.search`, each described
only by the pack (title, the tree's symptom statement, the open causes). It returns one of:
  {"decision": "pick", "candidate": i}         -- candidate i (1-based) is what was described
  {"decision": "none"}                          -- no candidate fits
  {"decision": "clarify", "between": [i, j]}    -- ask ONE question: which of these 2-3 is it?
The app renders the clarifying question from the chosen candidates' own text, so the model writes no
words the technician reads. It can never name a symptom that is not a candidate.
"""
from __future__ import annotations

import json
from functools import lru_cache

from .engine import Engine

PROMPT_VERSION = "t1-2026-11-28.1"


class Candidates:
    """Describes symptoms from the pack: title, the tree's symptom statement, and the open causes."""

    def __init__(self, eng: Engine):
        self.eng = eng
        self._trees: dict = {}
        self._facets: dict = {}

    def _tree(self, pack_id: str, tree_id: str) -> dict:
        k = (pack_id, tree_id)
        if k not in self._trees:
            self._trees[k] = self.eng.tree(pack_id, tree_id)
        return self._trees[k]

    def _open_facet(self, pack_id: str) -> str:
        if pack_id not in self._facets:
            info = self.eng.pack_info(pack_id)
            self._facets[pack_id] = info.get("open_facet") or "possible"
        return self._facets[pack_id]

    def describe(self, pack_id: str, sym: dict, max_causes: int = 4, synonyms: bool = False) -> dict:
        t = self._tree(pack_id, sym["tree_id"])
        nodes = {n["node_id"]: n for n in t["nodes"]}
        entry = nodes.get(t["tree"]["entry_node"])
        statement = entry["text"] if entry and entry["kind"] == "symptom" else None
        if statement and statement.strip().rstrip(".").lower() == sym["title"].strip().rstrip(".").lower():
            statement = None
        of = self._open_facet(pack_id)
        # The first node (in tree order from the entry) that lists open causes.
        causes: list[str] = []
        order = _bfs(t)
        by_node: dict[str, list[str]] = {}
        for f in t.get("facets") or []:
            if f.get("facet") == of:
                by_node.setdefault(f["node_id"], []).append(f["text"])
        for nid in order:
            if nid in by_node:
                causes = by_node[nid][:max_causes]
                break
        d = {"symptom_id": sym["symptom_id"], "title": sym["title"], "statement": statement, "causes": causes,
             "system": sym.get("system")}
        if synonyms:
            d["also"] = (sym.get("synonyms") or [])[:4]
        return d


def _bfs(t: dict) -> list[str]:
    adj: dict[str, list[str]] = {}
    for e in t.get("edges") or []:
        adj.setdefault(e["from_node"], []).append(e["to_node"])
    seen, q = [], [t["tree"]["entry_node"]]
    while q:
        n = q.pop(0)
        if n in seen:
            continue
        seen.append(n)
        q.extend(adj.get(n, []))
    return seen


# -- the model interface ------------------------------------------------------

SYSTEM = """You are the symptom-matching step of an offline maintenance assistant. A technician described a problem in their own words (possibly with typos or speech-recognition errors). The manual's search returned numbered candidate entries from its troubleshooting index. Decide:
- "pick": one candidate clearly matches what the technician described. Give its number.
- "none": no candidate matches the problem described (the manual's index does not cover it). Do not pick a candidate just because it shares a word.
- "clarify": the description fits two or three candidates about equally and one question would tell them apart. Give their numbers (2 or 3). Use this only when a careful expert could not choose without asking.
Read typos and misheard words generously: "excel" may be "accel", "jeepee ess" may be "GPS". Answer with JSON only."""


SYSTEM_STRICT = SYSTEM.replace(
    "Answer with JSON only.",
    "The right entry is often NOT among the candidates: the search returns entries that share words with the "
    "report, about the same part or system, but a different message or fault. Pick a candidate only if its title "
    "or statement matches what the technician actually reports (the message they saw, or the fault they describe). "
    "If the report names or describes a different message or fault, answer none. A wrong pick sends the technician "
    "down the wrong procedure; none just shows them the list. Answer with JSON only.")


def schema(k: int, reason: bool = False, twostep: bool = False) -> dict:
    idx = list(range(1, k + 1))
    pick = {"type": "object", "properties": {"decision": {"const": "pick"}, "candidate": {"type": "integer", "enum": idx}},
            "required": ["decision", "candidate"], "additionalProperties": False}
    none = {"type": "object", "properties": {"decision": {"const": "none"}}, "required": ["decision"],
            "additionalProperties": False}
    clar = {"type": "object", "properties": {"decision": {"const": "clarify"},
                                             "between": {"type": "array", "items": {"type": "integer", "enum": idx},
                                                         "minItems": 2, "maxItems": 3}},
            "required": ["decision", "between"], "additionalProperties": False}
    if twostep:
        # Two-step form in one constrained output: the grammar makes the model first say whether the
        # right entry is among the candidates; "no" forces none.
        return {"anyOf": [
            {"type": "object", "properties": {"present": {"const": "no"}, "answer": none},
             "required": ["present", "answer"], "additionalProperties": False},
            {"type": "object", "properties": {"present": {"enum": ["yes", "not_sure"]},
                                              "answer": {"anyOf": [pick, none, clar]}},
             "required": ["present", "answer"], "additionalProperties": False}]}
    if not reason:
        return {"anyOf": [pick, none, clar]}
    # Variant: a short free note first (bounded), then the decision. The note is never shown.
    return {"type": "object", "properties": {"note": {"type": "string", "maxLength": 160},
                                             "answer": {"anyOf": [pick, none, clar]}},
            "required": ["note", "answer"], "additionalProperties": False}


def render(text: str, equipment: str, cands: list[dict], scores: bool = False, twostep: bool = False) -> str:
    lines = []
    for i, c in enumerate(cands, 1):
        s = f"{i}. {c['title']}"
        if scores and c.get("match") is not None:
            s += f" [search match {c['match']:.2f}]"
        if c.get("statement"):
            s += f" — {c['statement']}"
        if c.get("causes"):
            s += f" (causes: {'; '.join(c['causes'])})"
        if c.get("also"):
            s += f" (also said as: {'; '.join(c['also'])})"
        lines.append(s)
    head = ""
    if scores:
        head = ("Each candidate shows the search's match strength (0 to 1; above about 0.7 is a strong match, "
                "below 0.55 weak). A weak top match often means the right entry is not listed.\n")
    ask = ("\n\nFirst say whether the entry the technician describes is among the candidates (present: yes, "
           "not_sure or no), then decide. Answer as JSON." if twostep else "\n\nDecision as JSON.")
    return (f"Equipment: {equipment}\nTechnician: \"{text}\"\n\n{head}Candidates:\n" + "\n".join(lines) + ask)


def parse(out, k: int) -> dict:
    """Normalise a model output to {decision, candidate?, between?}; anything malformed is an error."""
    while isinstance(out, dict) and "answer" in out and "decision" not in out:
        out = out["answer"]
    if not isinstance(out, dict):
        return {"decision": "error"}
    d = out.get("decision")
    if d == "pick" and isinstance(out.get("candidate"), int) and 1 <= out["candidate"] <= k:
        return {"decision": "pick", "candidate": out["candidate"]}
    if d == "none":
        return {"decision": "none"}
    if d == "clarify":
        b = sorted({x for x in out.get("between") or [] if isinstance(x, int) and 1 <= x <= k})
        if len(b) >= 2:
            return {"decision": "clarify", "between": b[:3]}
        if len(b) == 1:
            return {"decision": "pick", "candidate": b[0], "coerced": True}
    return {"decision": "error"}


# -- scoring --------------------------------------------------------------------

def score(item: dict, cand_ids: list[str], dec: dict) -> dict:
    """Per-item outcome. cand_ids: the symptom ids the model saw, in order."""
    gold = set(item["gold"])
    kind = item["kind"]
    picked = cand_ids[dec["candidate"] - 1] if dec.get("decision") == "pick" else None
    between = {cand_ids[i - 1] for i in dec.get("between", [])} if dec.get("decision") == "clarify" else set()
    gold_in = gold & set(cand_ids)
    r = {"decision": dec.get("decision"), "picked": picked, "between": sorted(between),
         "gold_in_candidates": bool(gold_in) if gold else None}
    if kind == "single":
        r["correct"] = picked in gold
        r["wrong_pick"] = picked is not None and picked not in gold
        r["clarify_has_gold"] = bool(between & gold)
    elif kind == "decline":
        r["correct"] = dec.get("decision") == "none"
        r["wrong_pick"] = picked is not None
        r["clarify_has_gold"] = None
    else:  # ambiguous: correct = a question that separates the gold candidates the model was shown
        r["separates"] = dec.get("decision") == "clarify" and len(between & gold) >= 2 and gold_in <= between
        if len(gold_in) >= 2:
            r["correct"] = r["separates"]
        else:  # the search showed at most one of them: picking it, or asking with it, is the best possible
            r["correct"] = (picked in gold) or (bool(gold_in) and gold_in <= between)
        r["pick_in_gold"] = picked in gold if picked else False
        r["wrong_pick"] = picked is not None and picked not in gold
        r["clarify_has_gold"] = bool(between & gold)
    return r


def engine_decision(search: dict, k: int) -> dict:
    """What the app does with the model off: go straight to the first hit when it is `confident`;
    otherwise show the list (no pick). Never clarifies."""
    hits = search.get("hits") or []
    if hits and hits[0].get("confidence") == "confident":
        return {"decision": "pick", "candidate": 1}
    return {"decision": "none"}
