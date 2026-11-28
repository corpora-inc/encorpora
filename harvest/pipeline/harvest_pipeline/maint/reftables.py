"""Printed tables that are not trees: found on the page, columns and roles named, rows read cell by cell.

Two printed forms, one model:
  * ruled tables: the page model's cells (row and column from the rules);
  * column text: a header line whose word groups name columns ("Message  Cause  Resolution",
    "CODE  DESCRIPTION  MODELS  PERFORM TROUBLESHOOTING TASK"); every word below it goes to the
    column its left edge falls in, and a new row starts where the first column starts a new entry.
    Words, not regions: a text layer often runs one line across two columns.
A column's role comes from its header words (code, pattern, meaning, cause, check, remedy, value, unit,
limit, interval, item, applicability, reference), a header naming a variant (a value column for that
variant), else `text`; the first column with no role is the `key`. A cell is its words in printed
order; lines opening with a bullet or a number are the items of a list; a cell of a value or limit
column that prints numbers and a unit is a printed value (`text` as printed, numbers for lookup only).
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field

from .layout import PageModel

ROLE_WORDS = [
    ("code", r"\b(code|codes|error|err|dtc|fault code|fc|id)\b"),
    ("pattern", r"\b(pattern|led|blink|flash|lamp|indicator|indication|light)\b"),
    ("cause", r"\b(cause|causes|reason|probable)\b"),
    ("check", r"\b(check|test|inspection|inspect|verify)\b"),
    ("remedy", r"\b(remedy|resolution|corrective|solution|what to do|action|fix)\b"),
    ("interval", r"\b(interval|every|frequency|when|schedule|period)\b"),
    ("limit", r"\b(limit|service limit|wear limit|max|maximum|min|minimum|tolerance)\b"),
    ("value", r"\b(value|specification|spec|torque|clearance|pressure|capacity|setting|standard|nominal)\b"),
    ("unit", r"^\s*(unit|units)\s*$"),
    ("applicability", r"\b(model|models|applies|applicability|effectivity|variant|variants|year|firmware|revision)\b"),
    ("reference", r"\b(page|refer|ref|see|task|para|paragraph|section|perform)\b"),
    ("meaning", r"\b(meaning|description|message|display|definition|explanation|name|text|means|condition)\b"),
    ("item", r"\b(item|component|part|parameter|fastener|command|abbreviation|term|connector)\b"),
]
ROLES = {"key", "code", "pattern", "meaning", "cause", "check", "remedy", "value", "unit", "limit", "interval", "item",
         "applicability", "reference", "text"}
_LIST = re.compile(r"^\s*(?:[•·\-–▪◦*]|\(?\d{1,2}[.)])\s+")
_NUM = r"-?\d+(?:[.,]\d+)?"


@dataclass
class TableModel:
    page: int
    regions: list            # region ids the table's words come from
    columns: list            # [{"id","label","role","x0"}]
    rows: list               # [{col_id: [line strings]}]
    row_words: list          # [[word indices]] per row
    bbox: tuple
    caption: str | None = None
    source: str = "cells"
    header_words: list = field(default_factory=list)


def role_of(label: str, variants: list[str]) -> str:
    low = " ".join(label.lower().split())
    for v in variants:
        if low == v.lower():
            return "value"
    for role, rx in ROLE_WORDS:
        if re.search(rx, low):
            return role
    return "text"


def _col_ids(labels: list[str]) -> list[str]:
    out, seen = [], {}
    for lab in labels:
        base = re.sub(r"[^a-z0-9]+", "_", lab.lower()).strip("_")[:24] or "col"
        seen[base] = seen.get(base, 0) + 1
        out.append(base if seen[base] == 1 else f"{base}_{seen[base]}")
    return out


def _columns(labels: list[str], xs: list[float], variants: list[str]) -> list[dict]:
    roles = [role_of(lab, variants) for lab in labels]
    if roles and roles[0] == "applicability":
        roles[0] = "key"          # a first column naming variants is the row's identity, not a statement about it
    if "key" not in roles and "code" not in roles:
        for k, r in enumerate(roles):
            if r in ("text", "meaning", "item"):
                roles[k] = "key"
                break
    return [{"id": i, "label": lab, "role": r, "x0": x} for i, lab, r, x in zip(_col_ids(labels), labels, roles, xs)]


def from_cells(pm: PageModel, variants: list[str]) -> list[TableModel]:
    tables: dict[str, list] = {}
    for r in pm.regions:
        if r.kind == "cell" and r.parent:
            tables.setdefault(r.parent, []).append(r)
    out = []
    for tid, cells in tables.items():
        rows: dict[int, dict[int, object]] = {}
        for c in cells:
            rows.setdefault(c.row, {})[c.col] = c
        if 0 not in rows or len(rows) < 2:
            continue
        ncol = max(c.col for c in cells) + 1
        head = rows[0]
        labels = [" ".join(pm.region_text(head[k]).split()) if k in head else f"Column {k + 1}" for k in range(ncol)]
        xs = [head[k].bbox[0] if k in head else 0.0 for k in range(ncol)]
        cols = _columns(labels, xs, variants)
        body, words = [], []
        for rk in sorted(k for k in rows if k > 0):
            row, ws = {}, []
            for k, c in rows[rk].items():
                if k >= len(cols) or not c.words:
                    continue
                row[cols[k]["id"]] = [" ".join(pm.words[i].text for i in ln) for ln in (c.lines or [c.words])]
                ws += list(c.words)
            if row:
                body.append(row)
                words.append(ws)
        if body:
            regs = [c.id for c in cells]
            bb = (min(c.bbox[0] for c in cells), min(c.bbox[1] for c in cells), max(c.bbox[2] for c in cells),
                  max(c.bbox[3] for c in cells))
            out.append(TableModel(pm.index, regs, cols, body, words, bb, source="cells",
                                  header_words=[i for c in head.values() for i in c.words]))
    return out


def _lines(pm: PageModel):
    """Every printed line of the page as word index lists, top to bottom (header/footer excluded)."""
    out = []
    for r in pm.regions:
        if not r.words or r.kind in ("header", "footer", "cell"):
            continue
        for ln in r.lines or [r.words]:
            out.append(sorted(ln, key=lambda i: pm.words[i].x0))
    # merge lines that share a baseline across regions (one printed line split by the layout)
    out.sort(key=lambda ln: (round(pm.words[ln[0]].top), pm.words[ln[0]].x0))
    merged: list[list[int]] = []
    for ln in out:
        t = pm.words[ln[0]].top
        if merged and abs(pm.words[merged[-1][0]].top - t) <= 2.5:
            merged[-1] = sorted(merged[-1] + ln, key=lambda i: pm.words[i].x0)
        else:
            merged.append(ln)
    return merged


def _groups(pm: PageModel, ln: list[int]) -> list[list[int]]:
    sizes = [pm.words[i].bottom - pm.words[i].top for i in ln] or [10]
    gap = max(8.0, 1.1 * sorted(sizes)[len(sizes) // 2])
    groups = [[ln[0]]]
    for a, b in zip(ln, ln[1:]):
        if pm.words[b].x0 - pm.words[a].x1 > gap:
            groups.append([b])
        else:
            groups[-1].append(b)
    return groups


def from_columns(pm: PageModel, variants: list[str], taken: set[int]) -> list[TableModel]:
    lines = _lines(pm)
    out = []
    k = 0
    while k < len(lines):
        ln = [i for i in lines[k] if i not in taken]
        if len(ln) < 2:
            k += 1
            continue
        groups = _groups(pm, ln)
        labels = [" ".join(pm.words[i].text for i in g) for g in groups]
        roles = [role_of(lab, variants) for lab in labels]
        named = sum(1 for r in roles if r != "text")
        if len(groups) < 2 or named < 2 or any(len(lab.split()) > 4 for lab in labels) or \
                any(re.search(r"[.;]$", lab) for lab in labels):
            k += 1
            continue
        xs = [pm.words[g[0]].x0 for g in groups]
        cols = _columns(labels, xs, variants)
        hb = max(pm.words[i].bottom for i in ln)
        lh = max(pm.words[i].bottom - pm.words[i].top for i in ln) or 10
        body_lines = []
        j = k + 1
        last_bottom = hb
        while j < len(lines):
            cur = [i for i in lines[j] if i not in taken]
            if not cur:
                j += 1
                continue
            top = min(pm.words[i].top for i in cur)
            left = min(pm.words[i].x0 for i in cur)
            if top - last_bottom > 3.5 * lh or left < xs[0] - 3 * lh:
                break
            body_lines.append(cur)
            last_bottom = max(pm.words[i].bottom for i in cur)
            j += 1
        if len(body_lines) < 1:
            k += 1
            continue
        # rows: a new row where the first column starts an entry (a word at its left edge after a gap,
        # or a line whose first-column words open a new item); the other columns' lines join the row
        rows, words = [], []
        cur_row: dict[str, list] = {}
        cur_words: list[int] = []
        prev_top = None
        for bl in body_lines:
            by_col: dict[int, list[int]] = {}
            for i in bl:
                x = pm.words[i].x0
                c = max((ci for ci, cx in enumerate(xs) if x >= cx - 4), default=0)
                by_col.setdefault(c, []).append(i)
            top = min(pm.words[i].top for i in bl)
            first = pm.words[sorted(by_col.get(0, [0]), key=lambda i: pm.words[i].x0)[0]].text if 0 in by_col else ""
            close = prev_top is not None and top - prev_top <= 1.5 * lh
            starts = 0 in by_col and (not cur_row or not (close and (first[:1].islower() or first[:1] in "([")))
            if starts and cur_row:
                rows.append(cur_row)
                words.append(cur_words)
                cur_row, cur_words = {}, []
            for c, ws in by_col.items():
                cid = cols[c]["id"]
                cur_row.setdefault(cid, []).append(" ".join(pm.words[i].text for i in ws))
                cur_words += ws
            prev_top = top
        if cur_row:
            rows.append(cur_row)
            words.append(cur_words)
        if len(rows) >= 2 or (rows and named >= 3):
            regs = sorted({r.id for r in pm.regions for i in ln + [w for row in words for w in row] if i in r.words})
            all_w = ln + [w for row in words for w in row]
            bb = (min(pm.words[i].x0 for i in all_w), min(pm.words[i].top for i in all_w),
                  max(pm.words[i].x1 for i in all_w), max(pm.words[i].bottom for i in all_w))
            out.append(TableModel(pm.index, regs, cols, rows, words, bb, source="columns", header_words=list(ln)))
            taken.update(all_w)
            k = j
        else:
            k += 1
    return out


def cell_value(lines: list[str], role: str):
    """A cell as the pack stores it: a list of items, a printed value, or its text."""
    lines = [re.sub(r"\s*\.{4,}\s*", " ", ln).strip() for ln in lines]      # dot leaders are not content
    text = " ".join(" ".join(lines).split())
    if len(lines) > 1 and sum(1 for ln in lines if _LIST.match(ln)) >= 1 and _LIST.match(lines[0]):
        items, cur = [], None
        for ln in lines:
            if _LIST.match(ln):
                if cur:
                    items.append(cur)
                cur = _LIST.sub("", ln, count=1).strip()
            else:
                cur = f"{cur} {ln.strip()}" if cur else ln.strip()
        if cur:
            items.append(cur)
        return items if len(items) > 1 else (items[0] if items else text)
    if role in ("value", "limit") and text:
        m = re.match(rf"^\s*({_NUM})\s*(?:-|–|to|~)\s*({_NUM})\s*([^\d\s(][^\s(]*)?", text)
        if m:
            v = {"text": text, "min": float(m.group(1).replace(",", ".")), "max": float(m.group(2).replace(",", ".")),
                 "min_inclusive": True, "max_inclusive": True}
            if m.group(3):
                v["unit"] = m.group(3)
            return v
        m = re.match(rf"^\s*({_NUM})\s*([^\d\s(][^\s(]*)?", text)
        if m:
            v = {"text": text, "value": float(m.group(1).replace(",", "."))}
            if m.group(2):
                v["unit"] = m.group(2)
            return v
    return text


def kind_of(cols: list[dict]) -> str:
    roles = {c["role"] for c in cols}
    labels = " ".join(c["label"].lower() for c in cols)
    if "interval" in roles:
        return "schedule"
    if "pattern" in roles:
        return "indicator"
    if "code" in roles and ({"cause", "remedy", "meaning"} & roles):
        return "message"
    if "command" in labels:
        return "command"
    if "parameter" in labels:
        return "parameter"
    if "abbreviation" in labels or "abbr" in labels:
        return "abbreviation"
    if {"value", "limit"} & roles:
        return "spec"
    return "other"
