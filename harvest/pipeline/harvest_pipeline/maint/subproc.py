"""Sub-procedures under printed headings, and the scope of the guards printed before them.

A maintenance task often prints its steps in groups under headings ("REMOVAL", "INSTALLATION",
"Filling", whatever the manual calls them), numbering restarting under each. A reading that returned
one procedure for the whole task is split here, by the page alone: a heading is a printed line that
looks like one (short, capitalised or bold, no closing period, not a numbered step, not a WARNING /
CAUTION / NOTE word, not a running header or footer) and sits between two steps, or directly above the
first step (only guard blocks between). Each group becomes its own procedure, titled by its printed
heading; the task keeps its title, setup, applicability and the guards printed before its first
heading. A guard printed under a heading and before that group's first step guards the group (its
position says so), not the step the reading may have hung it on. No heading word list exists here.
"""

from __future__ import annotations

import re

from .layout import PageModel
from .spans import locate

GUARD_WORDS = {"WARNING", "WARNINGS", "CAUTION", "CAUTIONS", "NOTE", "NOTES", "DANGER"}
_MARKER = re.compile(r"^\(?(?:\d{1,3}|[a-zA-Z])[.)]\s")


def _lines(pm: PageModel):
    """(top, bottom, x0, region, word ids, text, bold) for every printed line of body text."""
    out = []
    for r in pm.regions:
        if not r.words or r.kind in ("header", "footer", "figure"):
            continue
        for ln in r.lines or [r.words]:
            ws = [pm.words[i] for i in ln]
            out.append((min(w.top for w in ws), max(w.bottom for w in ws), min(w.x0 for w in ws), r, ln,
                        " ".join(w.text for w in ws), all(w.bold for w in ws)))
    return sorted(out, key=lambda x: (x[0], x[2]))


def is_heading(text: str, bold: bool) -> bool:
    t = text.strip()
    words = t.split()
    letters = [c for c in t if c.isalpha()]
    if not words or len(words) > 7 or not letters or _MARKER.match(t + " "):
        return False
    if re.search(r"[.;:,]$", t) or t.rstrip(":").upper() in GUARD_WORDS or re.search(r"(?i)\(cont", t):
        return False
    if re.fullmatch(r"[\dA-Z]{1,4}-\d{1,4}", t):         # a page label
        return False
    upper = sum(c.isupper() for c in letters) / len(letters)
    return upper >= 0.8 or bold


def _guard_region(pm: PageModel, r) -> bool:
    first = pm.region_text(r).strip().split(" ")[0].rstrip(":").upper() if r.words else ""
    return first in GUARD_WORDS or r.kind == "box"


def _at(models: dict, sp: dict | None):
    if not sp or not sp.get("region"):
        return None
    m = re.match(r"p(\d+)\.", sp["region"])
    if not m or int(m.group(1)) not in models:
        return None
    loc, _ = locate(models, int(m.group(1)), sp["region"], sp.get("text") or "")
    return loc


def _heading_between(models, a, b, not_heading=None):
    """The heading line printed after location `a` (or None: from the top of b's page) and before `b`."""
    pm = models[b.page]
    lo = (a.bbox[3] if a and a.page == b.page else -1)
    best = None
    for top, bot, x0, r, ln, text, bold in _lines(pm):
        if top <= lo - 0.5 or bot > b.bbox[1] + 0.5:
            continue
        if set(ln) & set(b.words) or (a and set(ln) & set(a.words)):
            continue
        if _guard_region(pm, r):
            continue
        if not_heading and not_heading(text):
            continue                         # a statement under the heading, not a heading itself
        if is_heading(text, bold):
            best = (r, ln, text)
        elif a is None:
            best = None                      # body text after the heading: not directly above the step
    return best


def split_by_heading(procs: list[dict], models: dict, not_heading=None) -> list[dict]:
    """`not_heading(text)`: lines that look like headings but are something else the caller can tell
    (an applicability statement such as "SERIAL NUMBERS 1001 THROUGH 1249" printed under a heading)."""
    out = []
    for pr in procs:
        steps = pr.get("steps") or []
        if pr.get("kind") == "test" or len(steps) < 2:
            out.append(pr)
            continue
        locs = [_at(models, s.get("text")) for s in steps]
        if any(x is None for x in locs):
            out.append(pr)
            continue
        cuts = []                            # (step index, heading span)
        own = " ".join(((pr.get("title") or {}).get("text") or "").lower().split())
        for k, loc in enumerate(locs):
            h = _heading_between(models, locs[k - 1] if k else None, loc, not_heading)
            if h and own and own in " ".join(h[2].lower().split()):
                h = None                     # the procedure's own title repeated (a continuation header)
            if h:
                cuts.append((k, {"region": h[0].id, "text": h[2]}))
        if not cuts:
            out.append(pr)
            continue
        parent_steps = steps[:cuts[0][0]]
        parent = {**pr, "steps": parent_steps, "_has_groups": True}
        out.append(parent)
        guards = list(pr.get("guards") or [])
        for j, (k, head) in enumerate(cuts):
            end = cuts[j + 1][0] if j + 1 < len(cuts) else len(steps)
            group = [dict(s) for s in steps[k:end]]
            first = locs[k]
            hloc = _at(models, head)
            mine = []
            # guards the reading hung on the group's first step, or on the whole task, that are printed
            # under this heading and before the group's first step: they guard the group
            cands = [("step", g) for g in group[0].get("guards") or []] + [("task", g) for g in guards]
            for where, g in cands:
                gl = _at(models, g.get("text"))
                if gl is None or hloc is None:
                    continue
                after_head = (gl.page, gl.bbox[1]) > (hloc.page, hloc.bbox[1])
                before_step = (gl.page, gl.bbox[1]) < (first.page, first.bbox[1])
                if after_head and before_step:
                    mine.append(g)
                    if where == "step":
                        group[0]["guards"] = [x for x in group[0]["guards"] if x is not g]
                    else:
                        guards = [x for x in guards if x is not g]
            out.append({**pr, "key": f"{pr.get('key') or pr.get('ref') or 'proc'}/{j + 1}",
                        "ref": f"{pr.get('ref') or (pr.get('title') or {}).get('text', 'proc')}: {head['text']}",
                        "title": head, "steps": group, "guards": mine, "setup": [], "applies": [],
                        "_group_of": pr.get("key")})
        parent["guards"] = guards
    return out
