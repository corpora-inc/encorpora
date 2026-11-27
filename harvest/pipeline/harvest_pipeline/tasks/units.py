"""Enrichment units: a section (or appendix) shown to a model as id-labelled lines.

    <document source="ecfr-29-1926-cc" citation="§1926.1408" heading="Power line safety ..." part="1/2">
    [29cfr1926.1408(a)] (a) Hazard assessments and precautions inherent in equipment assembly ...
    [29cfr1926.1408(a)(1)] (1) Identify the work zone ...
    </document>

Every line is exactly one node's own text, so a model can cite the most specific id and a
verifier can check its quote against that id's text. Long sections are split into parts at
top-level paragraph boundaries.
"""

from __future__ import annotations

from dataclasses import dataclass, field

from ..stage import Stage


@dataclass
class Unit:
    key: str
    root_id: str
    source_id: str
    citation: str
    heading: str | None
    lines: list[tuple[str, str]] = field(default_factory=list)   # (section_id, text)
    part: tuple[int, int] = (1, 1)

    @property
    def ids(self) -> list[str]:
        seen, out = set(), []
        for sid, _ in self.lines:
            if sid not in seen:
                seen.add(sid)
                out.append(sid)
        return out

    @property
    def chars(self) -> int:
        return sum(len(t) + len(s) + 4 for s, t in self.lines)

    def material(self) -> str:
        head = (f'<document source="{self.source_id}" citation="{self.citation}" '
                f'heading="{(self.heading or "").replace(chr(34), chr(39))}"')
        if self.part[1] > 1:
            head += f' part="{self.part[0]}/{self.part[1]}"'
        body = "\n".join(f"[{sid}] {text}" for sid, text in self.lines)
        return f"{head}>\n{body}\n</document>"


def own_lines(stage: Stage, section_id: str) -> list[str]:
    """A node's own lines: its text minus the text its (non-figure) children contribute."""
    text = stage.text(section_id) or ""
    lines = text.split("\n") if text else []
    kids = [k for k in stage.children(section_id) if k["kind"] != "figure"]
    child_lines = sum(len(k["text"].split("\n")) for k in kids if k["text"])
    return lines[: max(0, len(lines) - child_lines)]


def _flat(stage: Stage, root_id: str) -> list[tuple[str, str, bool]]:
    """(id, line, starts_top_level_block) in document order, figures skipped."""
    out: list[tuple[str, str, bool]] = []
    for line in own_lines(stage, root_id):
        out.append((root_id, line, True))

    def rec(sid: str, top: bool):
        first = True
        for line in own_lines(stage, sid):
            out.append((sid, line, top and first))
            first = False
        for k in stage.children(sid):
            if k["kind"] != "figure":
                rec(k["section_id"], False)

    for k in stage.children(root_id):
        if k["kind"] != "figure":
            rec(k["section_id"], True)
    return out


def section_units(stage: Stage, max_chars: int = 12000, kinds: tuple[str, ...] = ("section", "appendix"),
                  source_ids: set[str] | None = None, split: bool = True) -> list[Unit]:
    units: list[Unit] = []
    for sec in stage.sections(kinds, source_ids):
        flat = _flat(stage, sec["section_id"])
        if not flat:
            continue
        chunks: list[list[tuple[str, str, bool]]] = []
        cur: list[tuple[str, str, bool]] = []
        size = 0
        for item in flat:
            n = len(item[1]) + len(item[0]) + 4
            if split and cur and size + n > max_chars:
                # cut at the last top-level boundary past 40% of the budget, else here
                cut = None
                acc = 0
                for i, it in enumerate(cur):
                    if it[2] and i > 0 and acc > 0.4 * max_chars:
                        cut = i
                    acc += len(it[1]) + len(it[0]) + 4
                if cut is None:
                    chunks.append(cur)
                    cur, size = [], 0
                else:
                    chunks.append(cur[:cut])
                    cur = cur[cut:]
                    size = sum(len(it[1]) + len(it[0]) + 4 for it in cur)
            cur.append(item)
            size += n
        if cur:
            chunks.append(cur)
        total = len(chunks)
        for i, ch in enumerate(chunks, 1):
            units.append(Unit(
                key=sec["section_id"] if total == 1 else f"{sec['section_id']}#{i}",
                root_id=sec["section_id"], source_id=sec["source_id"], citation=sec["citation"],
                heading=sec["heading"], lines=[(s, t) for s, t, _ in ch], part=(i, total),
            ))
    return units
