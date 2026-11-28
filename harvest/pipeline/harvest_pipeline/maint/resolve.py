"""Closed questions for what the rules leave open, answered by a model through enumerated choices.

One request per unit: the unit's pages (page model text) and the questions, each with numbered
options. The schema makes every answer an index into that question's options, so the model can
only choose; it never writes text. With no resolver, or on a cache miss in a build, the rules'
default answer stands and the decision keeps its low confidence.
"""

from __future__ import annotations

from ..backends import Request
from .render import page_text
from .rules import Question

SYSTEM = ("You answer closed questions about the layout of pages from a technical maintenance manual. Each "
          "question lists numbered options; answer each with the number of the option the pages support. "
          "Use the region ids and positions (points from the top-left) to judge what sits beside or above what.")


def request(questions: list[Question], pages_text: str) -> Request:
    props = {q.id: {"type": "integer", "enum": list(range(len(q.options)))} for q in questions}
    schema = {"type": "object", "additionalProperties": False, "required": ["answers"],
              "properties": {"answers": {"type": "object", "additionalProperties": False,
                                         "required": [q.id for q in questions], "properties": props}}}
    qs = "\n".join(f"[{q.id}] {q.text}\n" + "\n".join(f"  {k}: {o}" for k, o in enumerate(q.options))
                   for q in questions)
    return Request(system=SYSTEM, prompt=f"{pages_text}\n\nQuestions:\n{qs}", schema=schema, name="answers",
                   max_tokens=2000)


def pages_text(unit_pages, pages) -> str:
    return "\n\n".join(page_text(pages[i]) for i in unit_pages)


def apply(out: dict, q: Question, choice: int, by: str) -> None:
    """Change the rules' output to the chosen option."""
    note = f"closed question {q.id}: {by} chose {choice} ({q.options[choice][:60]!r}); rules said {q.default}"
    if q.apply == "facet":
        region = q.data["region"]
        target = q.data["cands"][choice] if choice < len(q.data["cands"]) else None
        for t in out["trees"]:
            moved = []
            for n in t["nodes"]:
                keep = []
                for f in n["facets"]:
                    (moved if f["text"]["region"] == region else keep).append(f)
                n["facets"] = keep
            for n in t["nodes"]:
                if n["id"] == target:
                    for f in moved:
                        f["_conf"] = "resolved"
                        f.setdefault("_ev", []).append(note)
                    n["facets"].extend(moved)
    elif q.apply == "parent":
        parent = q.options[choice] if choice < len(q.options) - 1 else None
        for e in out["equipment"]:
            e["parent"] = parent
            e.setdefault("_ev", []).append(note)
    elif q.apply == "guard":
        g = q.data["guard"]
        for owner in q.data["owners"]:
            if g in owner:
                owner.remove(g)
        q.data["owners"][choice].append(g)
        g["_conf"] = "resolved"
        g.setdefault("_ev", []).append(note)
