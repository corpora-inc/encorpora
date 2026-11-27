"""Built-in enrichment tasks: terms, facts, explanations, applicability.

Each is a worked example of the task interface (tasks/base.py). They are corpus-agnostic: the
equipment taxonomy for `applicability` comes from the corpus YAML.
"""

from __future__ import annotations

import json
import re

from ..stage import Stage
from ..textutil import norm_ws, sha256_text, slug
from ..verify import (check_inline_quotes, check_new_numbers, check_no_outside_standard, check_numbers,
                      check_quote, check_unit)
from .base import Task, TaskInput, register_task
from .units import section_units

GROUNDING = (
    "You work only from the source text you are given. Never add facts, numbers, requirements or "
    "standards content that the text does not state. Quotes are copied character for character from "
    "one bracketed line (or several consecutive lines of the same bracketed id's subtree). Cite the most "
    "specific bracketed id whose text contains the quote. Consensus standards (for example ASME B30) "
    "may be named by number only when the text names them; never describe their content."
)


def _unit_inputs(stage: Stage, opts: dict, pattern: str | None = None) -> list[TaskInput]:
    units = section_units(stage, max_chars=int(opts.get("max_chars", 12000)),
                          source_ids=set(opts["sources"]) if opts.get("sources") else None)
    rx = re.compile(pattern, re.I) if pattern else None
    out = []
    for u in units:
        body = "\n".join(t for _, t in u.lines)
        if rx and not rx.search(body):
            continue
        out.append(TaskInput(key=u.key, material=u.material(),
                             data={"ids": u.ids, "root": u.root_id, "source_text": body}))
    return out


def _item_id(*parts: str) -> str:
    return sha256_text("␟".join(parts))[:12]


# ------------------------------------------------------------------------------------------
@register_task
class TermsTask(Task):
    """Defined terms with a verbatim definition quote. The example task the README walks through."""

    name = "terms"
    prompt_version = "1"
    tables = ("term",)
    system = (
        "You extract defined terms from regulatory and technical text for a glossary. " + GROUNDING
    )
    schema = {
        "type": "object", "additionalProperties": False, "required": ["items"],
        "properties": {"items": {"type": "array", "items": {
            "type": "object", "additionalProperties": False,
            "required": ["term", "definition", "quote", "section_id"],
            "properties": {
                "term": {"type": "string", "description": "the term exactly as the text writes it"},
                "definition": {"type": "string", "description": "one or two plain-language sentences"},
                "quote": {"type": "string", "description": "the verbatim sentence that defines the term"},
                "section_id": {"type": "string"},
            }}}},
    }
    judge_rubric = (
        "Pass only if: the quote actually defines or explicitly explains the term; the plain-language "
        "definition says nothing the quote does not support and leaves out nothing essential (scope "
        "limits, exceptions); the term is a real term of art, not an ordinary word. Fail otherwise. "
        "Use needs_review only when the source itself is ambiguous."
    )
    # Units with definitional language; others rarely define anything.
    PATTERN = r"\bmeans\b|\bdefin|\brefers? to\b|\bis an? \b|\bare those\b|\bincludes?\b"

    def select(self, stage):
        return _unit_inputs(stage, self.options, self.options.get("pattern", self.PATTERN))

    def prompt(self, inp):
        return ("List every term this text defines or explicitly explains (\"X means ...\", \"X is a ...\","
                " definitions lists). Skip terms only mentioned. Return an empty list if there are none.\n\n"
                + inp.material)

    def check(self, item, inp, stage):
        p = check_quote(item, stage, inp.data["ids"])
        if not p and norm_ws(item["term"]).lower() not in item["quote"].lower():
            p.append("term does not appear in its quote")
        p += check_no_outside_standard([item["definition"]], inp.data["source_text"])
        p += check_new_numbers(item["definition"], item.get("quote", ""))
        return p

    def rows(self, item, inp, stage):
        tid = f"{slug(item['term'])}@{item['section_id']}"
        return {"term": [{"term_id": tid, "term": norm_ws(item["term"]), "definition": norm_ws(item["definition"]),
                          "section_id": item["section_id"], "quote": item["quote"], "lang": "en"}]}


# ------------------------------------------------------------------------------------------
FACT_KINDS = ["limit", "clearance", "interval", "capacity", "requirement", "prohibition", "definition"]


@register_task
class FactsTask(Task):
    name = "facts"
    prompt_version = "1"
    tables = ("fact",)
    system = (
        "You extract the testable facts in regulatory and technical text: limits, clearances, intervals, "
        "capacities, requirements, prohibitions and definitions. " + GROUNDING
    )
    schema = {
        "type": "object", "additionalProperties": False, "required": ["items"],
        "properties": {"items": {"type": "array", "items": {
            "type": "object", "additionalProperties": False,
            "required": ["kind", "statement", "quote", "value", "unit", "section_id"],
            "properties": {
                "kind": {"type": "string", "enum": FACT_KINDS},
                "statement": {"type": "string", "description": "the fact in one plain sentence; who must do what, when"},
                "quote": {"type": "string", "description": "the shortest verbatim span that states the fact"},
                "value": {"type": ["string", "null"], "description": "the number or threshold, as written; null if none"},
                "unit": {"type": ["string", "null"], "description": "unit of value as written (feet, kV, mph); null if none"},
                "section_id": {"type": "string"},
            }}}},
    }
    judge_rubric = (
        "Pass only if: the statement is exactly what the quote requires (same actor, condition, number, "
        "unit, exceptions; no stronger or weaker duty); kind is right; value/unit match the quote; the fact "
        "is worth testing. Fail any statement that adds, drops or distorts a condition."
    )

    def select(self, stage):
        return _unit_inputs(stage, self.options)

    def prompt(self, inp):
        return ("Extract every distinct testable fact. One fact per requirement; split compound "
                "requirements; keep conditions and exceptions in the statement. Quote the exact words.\n\n"
                + inp.material)

    def check(self, item, inp, stage):
        p = check_quote(item, stage, inp.data["ids"])
        if p:
            return p
        p += check_numbers(item.get("value"), item["quote"], "value")
        p += check_numbers(item["statement"], item["quote"], "statement")
        p += check_unit(item.get("unit"), item["quote"])
        p += check_no_outside_standard([item["statement"]], inp.data["source_text"])
        return p

    def rows(self, item, inp, stage):
        fid = f"{item['section_id']}#f{_item_id(item['kind'], item['quote'], item['statement'])}"
        return {"fact": [{"fact_id": fid, "section_id": item["section_id"], "kind": item["kind"],
                          "statement": norm_ws(item["statement"]), "quote": item["quote"],
                          "value": item.get("value"), "unit": item.get("unit"), "lang": "en"}]}


# ------------------------------------------------------------------------------------------
LEVELS = ["trainee", "operator", "inspector"]


@register_task
class ExplanationsTask(Task):
    name = "explanations"
    prompt_version = "1"
    tables = ("explanation",)
    system = (
        "You explain regulatory and technical sections to the people who must apply them, at three "
        "levels: trainee (new to the work; plain words, why it matters, what to do), operator (does the "
        "work daily; the duties, limits and decisions in practice), inspector (verifies compliance; "
        "exact conditions, exceptions, what to check and the cross-references). " + GROUNDING +
        " State numbers exactly as the text does. Put any quotation in double quotes, copied exactly."
    )
    schema = {
        "type": "object", "additionalProperties": False, "required": ["items"],
        "properties": {"items": {"type": "array", "items": {
            "type": "object", "additionalProperties": False, "required": ["level", "body"],
            "properties": {"level": {"type": "string", "enum": LEVELS},
                           "body": {"type": "string", "description": "80-220 words, plain prose, no headings"}},
        }}},
    }
    judge_rubric = (
        "Pass only if the explanation is accurate to the section, complete on its main duties and limits, "
        "fits its level, and adds no requirement, number or standard content the section lacks. Fail any "
        "error of fact, invented duty, or wrong number."
    )

    def select(self, stage):
        # Whole sections: an explanation covers the section the learner opens.
        units = section_units(stage, max_chars=10 ** 9, split=False,
                              source_ids=set(self.options["sources"]) if self.options.get("sources") else None)
        out = []
        for u in units:
            body = "\n".join(t for _, t in u.lines)
            if len(body) < int(self.options.get("min_chars", 200)):
                continue
            out.append(TaskInput(key=u.key, material=u.material(), data={"ids": u.ids, "root": u.root_id,
                                                                         "source_text": body}))
        return out

    def prompt(self, inp):
        return ("Write one explanation of this section for each level: trainee, operator, inspector.\n\n"
                + inp.material)

    def check(self, item, inp, stage):
        src = inp.data["source_text"]
        p = check_inline_quotes(item["body"], src)
        p += check_new_numbers(item["body"], src)
        p += check_no_outside_standard([item["body"]], src)
        if len(item["body"].split()) < 30:
            p.append("explanation too short")
        return p

    def rows(self, item, inp, stage):
        return {"explanation": [{"section_id": inp.data["root"], "level": item["level"],
                                 "body": item["body"].strip(), "lang": "en"}]}


# ------------------------------------------------------------------------------------------
@register_task
class ApplicabilityTask(Task):
    """Which equipment variants a section or paragraph applies to, from the corpus taxonomy."""

    name = "applicability"
    prompt_version = "1"
    tables = ("applies_to",)
    system = (
        "You map regulatory text to the equipment types it applies to, using only the given taxonomy ids. "
        + GROUNDING
    )
    judge_rubric = (
        "Pass only if the quote shows the text applies to (or specifically addresses) that equipment type. "
        "Fail mappings that rest on general requirements that apply to all equipment, or on a mention that "
        "excludes the equipment."
    )

    def __init__(self, **options):
        super().__init__(**options)
        self._ids: list[str] = []

    @property
    def schema(self):  # enum filled from the taxonomy at select time
        return {
            "type": "object", "additionalProperties": False, "required": ["items"],
            "properties": {"items": {"type": "array", "items": {
                "type": "object", "additionalProperties": False, "required": ["equip_id", "section_id", "quote"],
                "properties": {"equip_id": {"type": "string", **({"enum": self._ids} if self._ids else {})},
                               "section_id": {"type": "string"}, "quote": {"type": "string"}},
            }}},
        }

    def select(self, stage):
        eq = stage.equipment()
        self._ids = [e["equip_id"] for e in eq]
        if not eq:
            return []
        tax = "\n".join(f"- {e['equip_id']}: {e['name']}" + (f" (also: {', '.join(json.loads(e['aliases']))})"
                                                              if json.loads(e["aliases"]) else "") for e in eq)
        out = []
        for inp in _unit_inputs(stage, self.options):
            inp.material = f"<taxonomy>\n{tax}\n</taxonomy>\n{inp.material}"
            out.append(inp)
        return out

    def prompt(self, inp):
        return ("For each equipment type this text specifically applies to, give the id, the most specific "
                "section id, and the verbatim words that show it. A section that applies to all equipment in "
                "scope needs no rows. Exclusions are not applicability. Return an empty list if none.\n\n"
                + inp.material)

    def check(self, item, inp, stage):
        p = [] if item["equip_id"] in self._ids else [f"unknown equipment id {item['equip_id']!r}"]
        return p + check_quote(item, stage, inp.data["ids"])

    def rows(self, item, inp, stage):
        return {"applies_to": [{"ref_kind": "section", "ref_id": item["section_id"], "equip_id": item["equip_id"]}]}
