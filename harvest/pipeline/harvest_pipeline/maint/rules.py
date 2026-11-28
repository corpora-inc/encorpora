"""Rules first, model last: structure derived from the page model by deterministic rules.

Layout carries most of a manual's structure: printed headings type the regions (WARNING, CAUTION,
NOTE, INITIAL SETUP, TEST OPTIONS, REASON FOR QUESTION, KNOWN INFO, POSSIBLE PROBLEMS), drawn
arrows and their printed labels give the branches, numbered boxes are questions, numbered free
text is steps, the facet boxes sit beside their question, a warning sits above the step it guards.
`derive(unit, pages)` returns the same structure the model task returns (extract.SCHEMA), so
assembly and verification are shared, plus closed questions for what the rules cannot settle.
Every decision carries `_ev` (the rule and its evidence) and `_conf` (high | low); a low-
confidence decision is one a closed question may overturn.

Closed questions (`Question`) have enumerated options; a resolver model answers them through a
schema whose answers are those enums (`resolve.py`). With no resolver the rules' default stands.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field

from .layout import PageModel, Region

FACET_HEADINGS = {"TEST OPTIONS": "test_option", "REASON FOR QUESTION": "reason", "KNOWN INFO": "known",
                  "POSSIBLE PROBLEMS": "possible"}
GUARD_HEADS = {"WARNING": "warning", "WARNINGS": "warning", "CAUTION": "caution", "CAUTIONS": "caution",
               "NOTE": "note", "NOTES": "note", "DANGER": "warning"}
SETUP_LABELS = [("equipment condition", "condition"), ("equipment conditions", "condition"),
                ("special tools", "tool"), ("tools", "tool"), ("test equipment", "tool"), ("parts", "part"),
                ("materials/parts", "part"), ("materials", "consumable"), ("consumables", "consumable"),
                ("references", "reference"), ("reference", "reference"), ("personnel required", "personnel"),
                ("personnel", "personnel")]
SPLIT_KINDS = {"tool", "consumable"}           # comma lists of separate items
DEFAULTS = {
    "tree_title": r"^(?P<ref>(?:Table|TABLE|Troubleshooting\s+Procedure)\s+\d+-\d+)\.\s+(?P<title>.+?)\.?"
                  r"(?:\s*\((?:Sheet|SHEET|Continued|CONTINUED|CONT|Cont)[^)]*\))?\s*$",
    "task_title": r"^(?P<ref>(?:Task|TASK)\s+\d+-\d+)\.\s+(?P<title>.+?)\.?(?:\s*\((?:Continued|CONTINUED|CONT)[^)]*\))?\s*$",
    "test_title": r"^TEST PROCEDURE FOR (?:QUESTION|STEP)\s+(?P<n>\d+)\.\s+(?P<title>.+?)\.?\s*$",
    "heading": r"^(?:CHAPTER|Chapter|SECTION|Section)\s+\d+[.:]\s+\S",
    "step": r"^(?P<n>\d{1,3})\.\s+(?P<text>\S.*)$",
    "substep": r"^(?P<n>[a-z])\.\s+(?P<text>\S.*)$",
    "applies": r"\b(?:variants?|only|models?|serial)\b",
    "escalate": r"(?i)\b(?:refer to (?:field|depot|higher)|send (?:the )?.+? to (?:the )?.*?shop|report to|notify)\b",
    "end": r"(?i)\b(?:fault is corrected|return (?:the )?.+? to service|problem (?:is )?corrected)\b",
    "goto_box": r"^(?:Go|GO|Continue|CONTINUE)\s+(?:to|TO)\s+(?:Question|QUESTION|Step|STEP)\s+(?P<n>\w+)\b",
    "from_box": r"^(?:From|FROM)\s+(?:Question|QUESTION|Step|STEP)\s+\w+",
    "target": r"\b(?:Refer to|refer to|See|see|Go to|go to)\s+(?P<ref>(?:task|Task|TASK|table|Table|TABLE|para|paragraph)\s+[\w.-]+?)\.?(?:\s|$)",
}


@dataclass
class Question:
    """A closed question the rules could not settle. `default` is the rules' own best answer."""
    id: str
    text: str
    options: list[str]
    default: int
    apply: str                      # what the answer changes (for the applier)
    data: dict = field(default_factory=dict)


def _lines(pm: PageModel, r: Region) -> list[str]:
    return [" ".join(pm.words[i].text for i in ln) for ln in r.lines]


def _sp(r: Region, text: str) -> dict:
    return {"region": r.id, "text": text}


def _xover(a, b) -> float:
    return min(a[2], b[2]) - max(a[0], b[0])


def _heading(line: str) -> str:
    return line.strip().rstrip(":").upper()


def _items(lines: list[str]) -> list[str]:
    """Numbered items of a box ('1. A.', wrapped lines joined); unnumbered lines are one item."""
    out: list[str] = []
    for ln in lines:
        m = re.match(r"^\s*\d+[.)]\s+(.*)$", ln)
        if m:
            out.append(m.group(1))
        elif out:
            out[-1] += " " + ln
        else:
            out.append(ln)
    return [o.strip() for o in out if o.strip()]


def outcome_of(label: str) -> tuple[str, dict | None]:
    """A printed branch label -> (outcome, numeric condition or None)."""
    t = " ".join(label.split())
    low = t.lower().rstrip(".:")
    if low in ("yes", "no", "pass", "fail", "passed", "failed", "ok"):
        return {"passed": "pass", "failed": "fail", "ok": "pass"}.get(low, low), None
    num = r"(-?\d+(?:\.\d+)?)"
    for rx, op in ((rf"^(?:below|less than|under)\s+{num}", "<"), (rf"^(?:above|more than|over|greater than)\s+{num}", ">"),
                   (rf"^{num}\s*\S*\s+or (?:more|greater|higher|above)", ">="), (rf"^{num}\s*\S*\s+or (?:less|lower|below)", "<=")):
        m = re.match(rx, low)
        if m:
            return low, {"op": op, "value": float(m.group(1)), "min": None, "max": None}
    m = re.match(rf"^(?:from\s+)?{num}\s*\S*\s+(?:to|-|–)\s+{num}", low)
    if m:
        return low, {"op": "between", "value": None, "min": float(m.group(1)), "max": float(m.group(2))}
    return low, None


@dataclass
class _Node:
    rid: str
    page: int
    kind: str
    text: str
    number: str | None = None
    top: float = 0.0
    bbox: tuple = (0, 0, 0, 0)
    branches: list = field(default_factory=list)
    facets: list = field(default_factory=list)
    expect: dict | None = None
    target: dict | None = None
    test_procedure: str | None = None
    guards: list = field(default_factory=list)
    ev: list = field(default_factory=list)
    id: str = ""


def derive(unit_pages: list[int], pages: dict[int, PageModel], options: dict | None = None) -> tuple[dict, list[Question]]:
    o = {**DEFAULTS, **{k: v for k, v in (options or {}).items() if k in DEFAULTS}}
    rx = {k: re.compile(v) for k, v in o.items()}
    out = {"headings": [], "trees": [], "procedures": [], "symptoms": [], "codes": [], "equipment": []}
    questions: list[Question] = []
    tree = None            # the open tree dict
    nodes: dict[str, _Node] = {}  # region id -> node of the open tree (this unit)
    proc = None            # the open procedure dict
    heading = None
    pending_guards: list[tuple] = []   # (guard, region, page) waiting for the next step
    beside_guards: dict[str, list] = {}  # step region id -> guards printed beside it
    ev = lambda d, *e: d.setdefault("_ev", []).extend(e)  # noqa: E731

    def close_proc():
        nonlocal proc
        if proc is not None:
            for g, r, pg in pending_guards:
                (proc["steps"][-1]["guards"] if proc["steps"] else proc["guards"]).append(g)
                ev(g, f"guard after the last step of {proc['key']}: attached to it (low)")
                g["_conf"] = "low"
            pending_guards.clear()
        proc = None

    for pi in unit_pages:
        pm = pages[pi]
        regs = [r for r in pm.regions if r.words and r.kind not in ("header", "footer")]
        box_has_arrows = {c.tail for c in pm.connectors} | {c.head for c in pm.connectors}
        label_regions = {c.label for c in pm.connectors if c.label}
        flow_page = bool(pm.connectors)
        cells_by_table: dict[str, list[Region]] = {}
        for r in regs:
            if r.kind == "cell" and r.parent:
                cells_by_table.setdefault(r.parent, []).append(r)
        seen_tables = set()
        for k, r in enumerate(regs):
            if r.id in label_regions or r.kind == "figure":
                continue
            lines = _lines(pm, r)
            text = " ".join(lines)
            head = _heading(lines[0]) if lines else ""
            # ---- titles and headings
            # a tree title only on a page with drawn arrows (a table caption elsewhere is a table's)
            m = rx["tree_title"].match(text) if r.kind == "text" and flow_page else None
            if m:
                close_proc()
                ref = " ".join(m.group("ref").split())
                if tree is None or tree["ref"] != ref:
                    tree = {"ref": ref, "title": _sp(r, m.group("title")), "applies": [], "setup": [], "guards": [],
                            "nodes": [], "_nodes": {}, "_ev": [f"title rule: {text[:60]!r}"]}
                    out["trees"].append(tree)
                    nodes = tree["_nodes"]
                _maybe_applies(regs, k, pm, rx, tree)
                continue
            m = rx["test_title"].match(text) if r.kind == "text" else None
            if m:
                close_proc()
                proc = {"key": f"tp{m.group('n')}", "ref": None, "kind": "test", "title": _sp(r, m.group("title")),
                        "applies": [], "setup": [], "guards": [], "steps": [], "_for": m.group("n"),
                        "_ev": [f"test procedure title rule: {text[:60]!r}"]}
                out["procedures"].append(proc)
                continue
            m = rx["task_title"].match(text) if r.kind == "text" else None
            if m:
                ref = " ".join(m.group("ref").split())
                if proc is None or proc.get("ref") != ref:
                    close_proc()
                    tree, nodes = None, {}
                    proc = {"key": ref, "ref": ref, "kind": "maintenance", "title": _sp(r, m.group("title")),
                            "applies": [], "setup": [], "guards": [], "steps": [], "_ev": [f"task title rule: {text[:60]!r}"]}
                    out["procedures"].append(proc)
                    _maybe_applies(regs, k, pm, rx, proc)
                continue
            if rx["heading"].match(text) and r.kind == "text":
                close_proc()
                tree, nodes = None, {}
                heading = {"text": _sp(r, text), "guards": [], "_ev": ["heading rule"]}
                out["headings"].append(heading)
                continue
            # ---- typed blocks
            if head in GUARD_HEADS or re.match(r"^(WARNING|CAUTION|NOTE)S?:\s", lines[0] if lines else ""):
                g = _guard(pm, r, lines, head, rx)
                target_open = proc if proc is not None else None
                if proc is not None:
                    steps_here = [x for x in regs if x.kind == "text" and rx["step"].match(_lines(pm, x)[0] if x.lines else "")
                                  or (x.kind == "text" and rx["substep"].match(_lines(pm, x)[0] if x.lines else ""))]
                    beside = steps_here and not any(_xover(x.bbox, r.bbox) > 0 for x in steps_here)
                    if beside:
                        # a block in a side column guards the step it sits beside (nearest vertical centre)
                        cy = (r.bbox[1] + r.bbox[3]) / 2
                        ranked = sorted(steps_here, key=lambda x: abs((x.bbox[1] + x.bbox[3]) / 2 - cy))
                        best = ranked[0]
                        overl = [x for x in steps_here if min(x.bbox[3], r.bbox[3]) - max(x.bbox[1], r.bbox[1]) > 0]
                        g["_conf"] = "high" if len(overl) == 1 and overl[0] is best else "low"
                        ev(g, f"block beside the steps column: guards the step at the same height ({best.id})")
                        beside_guards.setdefault(best.id, []).append(g)
                        if g["_conf"] == "low" and len(ranked) > 1:
                            questions.append(Question(f"beside-{r.id}", f"Which step does the {g['kind']} block {r.id} "
                                                      "printed beside the steps guard?", [pm.region_text(x)[:80] for x in ranked[:4]],
                                                      0, "beside", {"guard": g, "regions": [x.id for x in ranked[:4]]}))
                        done = next((st for st in proc["steps"] if st["text"]["region"] == best.id), None)
                        if done is not None:
                            done["guards"].append(g)
                            beside_guards[best.id].remove(g)
                    else:
                        pending_guards.append((g, r, pi))
                elif tree is not None:
                    tree["guards"].append(g)
                    ev(g, "guard on a tree page above the flowchart: guards the tree")
                elif heading is not None:
                    heading["guards"].append(g)
                    ev(g, "guard under a chapter heading: guards the heading")
                else:
                    questions.append(Question(f"orphan-guard-{r.id}", f"A {g['kind']} block with no task, tree or heading "
                                              "before it on these pages", ["leave it unattached"], 0, "none"))
                _ = target_open
                continue
            if head == "INITIAL SETUP" or any(text.lower().startswith(lbl + ":") for lbl, _ in SETUP_LABELS):
                owner = proc if proc is not None else tree
                if owner is not None:
                    owner["setup"].extend(_setup(pm, r, lines))
                continue
            if head in FACET_HEADINGS:
                if tree is not None:
                    tree.setdefault("_facets", []).append((r, pi, FACET_HEADINGS[head], _items(lines[1:])))
                continue
            # ---- tables
            if r.kind == "cell":
                if r.parent not in seen_tables:
                    seen_tables.add(r.parent)
                    _table(pm, cells_by_table.get(r.parent, []), out, questions, regs)
                continue
            # ---- flowchart boxes
            if r.kind == "box" and tree is not None and flow_page and r.id in box_has_arrows:
                if rx["from_box"].match(text):
                    continue
                n = _Node(r.id, pi, "action", text, top=r.bbox[1], bbox=r.bbox)
                if re.fullmatch(r"[A-Z0-9]{1,2}", text.strip()):
                    n.kind, n.number = "letter", text.strip()     # an off-page connector: circle A
                    n.ev.append(f"off-page connector {text.strip()}")
                    nodes[r.id] = n
                    continue
                gm = rx["goto_box"].match(text)
                if gm:
                    n.kind = "offpage"
                    n.number = gm.group("n")
                    nodes[r.id] = n
                    continue
                m = re.match(r"^(\d+)[.)]\s+(.*)$", text)
                if m:
                    n.kind, n.number, n.text = "check", m.group(1), m.group(2)
                    n.ev.append(f"numbered box {m.group(1)}: question")
                elif rx["escalate"].search(text):
                    n.kind = "escalate"
                    n.ev.append("escalate wording")
                elif rx["end"].search(text):
                    n.kind = "end"
                    n.ev.append("end wording")
                tm = rx["target"].search(n.text)
                if tm and n.kind == "action":
                    ref = tm.group("ref")
                    kind = "tree" if ref.lower().startswith("table") else "procedure"
                    n.target = {"kind": kind, "ref": ref[0].upper() + ref[1:]}
                nodes[r.id] = n
                continue
            # ---- steps
            if proc is not None and r.kind == "text":
                m = rx["step"].match(lines[0] if lines else "")
                sm = rx["substep"].match(lines[0] if lines else "")
                if m or (sm and proc["steps"]):
                    body = " ".join([(m or sm).group("text"), *lines[1:]]).strip()
                    step = {"text": _sp(r, body), "check_kind": _check_kind(body), "guards": [],
                            "_ev": [f"numbered step {(m or sm).group('n')}"]}
                    for g, gr, gpi in pending_guards:
                        if not proc["steps"] and not _sub(sm):
                            proc["guards"].append(g)
                            ev(g, "guard before the first step: guards the whole procedure")
                        else:
                            step["guards"].append(g)
                            same_col = gpi == pi and _xover(gr.bbox, r.bbox) > 0
                            ev(g, f"guard directly above step {(m or sm).group('n')}"
                                  + ("" if same_col else " (other column or page)"))
                            g["_conf"] = "high" if same_col else "low"
                    pending_guards.clear()
                    step["guards"].extend(beside_guards.pop(r.id, []))
                    proc["steps"].append(step)
                    continue
                if text.lower().startswith("tools:") and proc is not None:
                    proc["setup"].extend(_setup(pm, r, lines))
                    continue
        # end of page: wire the tree's boxes on this page
        if tree is not None:
            _wire(pm, tree, nodes, questions)
    close_proc()
    for t in out["trees"]:
        if not t.pop("_done", False):      # charts printed as tables are complete already
            _finish_tree(t, out, questions)
    for p in out["procedures"]:
        p.pop("_for", None)
    _equipment_parent(out, pages, unit_pages, questions)
    asks = set((options or {}).get("ask") or [])
    if asks:
        _ask_all(out, pages, questions, asks)
    return out, questions


def _ask_all(out: dict, pages: dict[int, PageModel], questions: list[Question], asks: set[str]) -> None:
    """Measurement mode: pose every guard placement and facet box as a closed question (the rules'
    choice is only the default), so a resolver's accuracy on closed questions can be scored."""
    page_of = lambda rid: int(rid.split(".")[0][1:])  # noqa: E731
    if "guards" in asks:
        for p in out["procedures"]:
            holders = [("the whole procedure: " + p["title"]["text"], p["guards"], None)]
            holders += [(f"step {k}: {st['text']['text'][:70]}", st["guards"], st) for k, st in enumerate(p["steps"], 1)]
            for _, lst, _ in list(holders):
                for g in list(lst):
                    pg = page_of(g["text"]["region"])
                    opts = [h for h in holders if h[2] is None or page_of(h[2]["text"]["region"]) == pg]
                    if len(opts) < 2:
                        continue
                    default = next(i for i, h in enumerate(opts) if h[1] is lst)
                    gtext = g["text"]["text"][:80]
                    questions.append(Question(f"ask-guard-{g['text']['region']}",
                                              f"Which does the {g['kind'].upper()} block ({g['text']['region']}: "
                                              f"\"{gtext}\") guard?", [h[0] for h in opts], default, "guard",
                                              {"guard": g, "owners": [h[1] for h in opts]}))
    if "facets" in asks:
        for t in out["trees"]:
            regions = {}
            for n in t["nodes"]:
                for f in n["facets"]:
                    regions.setdefault(f["text"]["region"], (f["facet"], n["id"]))
            for rid, (facet, owner) in regions.items():
                pg = page_of(rid)
                cands = [n for n in t["nodes"] if n["kind"] == "check" and page_of(n["text"]["region"]) == pg]
                if len(cands) < 2:
                    continue
                default = next((i for i, n in enumerate(cands) if n["id"] == owner), 0)
                questions.append(Question(f"ask-facet-{rid}", f"Which question does the {facet} box {rid} belong to?",
                                          [c["text"]["text"][:90] for c in cands], default, "facet",
                                          {"region": rid, "cands": [c["id"] for c in cands]}))


def _sub(m) -> bool:
    return bool(m)


def _check_kind(text: str) -> str:
    low = text.lower()
    if re.match(r"^(read|measure|record the (?:reading|value)|note the reading)\b", low):
        return "value"
    if low.startswith("record"):
        return "note"
    return "pass_fail"


def _maybe_applies(regs, k, pm, rx, owner):
    """A short line right under a title that names variants is the title's applicability."""
    for r in regs[k + 1:k + 3]:
        if r.kind != "text":
            continue
        t = pm.region_text(r)
        if len(t.split()) <= 8 and rx["applies"].search(t.lower()) and not t.lower().startswith("all "):
            owner["applies"].append(_sp(r, t))
            owner.setdefault("_ev", []).append(f"applicability line under the title: {t!r}")
        break


def _guard(pm, r, lines, head, rx) -> dict:
    kind = GUARD_HEADS.get(head) or GUARD_HEADS[re.match(r"^(\w+)", lines[0]).group(1).upper()]
    body = lines[1:] if head in GUARD_HEADS else [re.sub(r"^\w+:\s*", "", lines[0])] + lines[1:]
    applies = []
    if body and len(body[0].split()) <= 4 and rx["applies"].search(body[0].lower()):
        applies.append(_sp(r, body[0]))
        body = body[1:]
    return {"kind": kind, "text": _sp(r, " ".join(body)), "applies": applies, "_ev": [f"printed {head} block"]}


def _setup(pm, r, lines) -> list[dict]:
    out = []
    for ln in lines:
        low = ln.lower()
        hit = next(((lbl, kind) for lbl, kind in SETUP_LABELS if low.startswith(lbl + ":")), None)
        if not hit:
            continue
        rest = ln[len(hit[0]) + 1:].strip()
        kind = hit[1]
        if kind in SPLIT_KINDS:
            parts = [p.strip() for p in rest.rstrip(".").split(",") if p.strip()]
        else:
            parts = [rest]
        for p in parts:
            ident = qty = None
            text = p
            if kind == "part":
                im = re.search(r"\(([A-Z0-9][\w./-]*\d[\w./-]*)\)", p)
                qm = re.search(r"\bquantity\s+(\d+)", p, re.I)
                ident = im.group(1) if im else None
                qty = qm.group(1) if qm else None
                text = p[:im.start()].strip().rstrip(",") if im else p
            out.append({"kind": kind, "text": _sp(r, text), "ident": ident, "qty": qty,
                        "_ev": [f"setup line {hit[0]!r}"]})
    return out


def _wire(pm: PageModel, tree: dict, nodes: dict[str, _Node], questions: list[Question]) -> None:
    """Branches from the drawn arrows of this page."""
    for c in pm.connectors:
        a = nodes.get(c.tail)
        if a is None or a.page != pm.index:
            continue
        b = nodes.get(c.head)
        if b is None:
            continue
        lab = pm.region(c.label) if c.label else None
        label = pm.region_text(lab) if lab else None
        a.branches.append({"label": _sp(lab, label) if lab else None, "_to": b, "_label": label,
                           "_ev": f"arrow {c.tail} -> {c.head}" + (f" labelled {label!r}" if label else "")})


def _finish_tree(t: dict, out: dict, questions: list[Question]) -> None:
    nodes: dict[str, _Node] = t.pop("_nodes")
    order = sorted(nodes.values(), key=lambda n: (n.page, n.top, n.bbox[0]))
    # off-page connectors: branches into them go to the numbered question of the same tree
    real = [n for n in order if n.kind not in ("offpage", "letter")]
    # a lettered connector: the arrow into circle L continues from the circle L that has an arrow out
    entries = {n.number: n for n in order if n.kind == "letter" and n.branches}
    for k, n in enumerate(real, 1):
        n.id = f"n{k}"
    # symptom: a box with no incoming arrow, before the first question, with one plain arrow out
    incoming = {id(b["_to"]) for n in real for b in n.branches}
    first_q = next((n for n in real if n.kind == "check"), None)
    for n in real:
        if id(n) not in incoming and n.kind == "action" and first_q is not None and \
                (n.page, n.top) < (first_q.page, first_q.top) and len(n.branches) == 1 and not n.branches[0]["_label"]:
            n.kind = "symptom"
            n.ev.append("box above the first question with no arrow in: the symptom")
    pos = {id(n): k for k, n in enumerate(real)}
    for n in real:
        labels = [b["_label"] for b in n.branches]
        outs = [outcome_of(lb) if lb else (None, None) for lb in labels]
        kinds = {o for o, _ in outs}
        if not n.branches:
            n.expect = None
        elif len(n.branches) == 1 and not labels[0]:
            n.expect = {"kind": "ack", "unit": None, "options": []}
        elif kinds <= {"yes", "no"}:
            n.expect = {"kind": "yes_no", "unit": None, "options": []}
        elif kinds <= {"pass", "fail"}:
            n.expect = {"kind": "pass_fail", "unit": None, "options": []}
        elif all(cnd for o, cnd in outs if o != "retry") and any(cnd for _, cnd in outs):
            unit = _unit([lb for lb in labels if lb])
            n.expect = {"kind": "value", "unit": unit, "options": []}
        elif len(n.branches) == 1:
            n.expect = {"kind": "ack", "unit": None, "options": []}
        else:
            n.expect = {"kind": "choice", "unit": None, "options": [lb for lb in labels if lb]}
        bout = []
        for b, (oc, cnd) in zip(n.branches, outs):
            tgt: _Node = b["_to"]
            via = ""
            if tgt.kind == "letter":
                entry = entries.get(tgt.number)
                if entry is None or not entry.branches:
                    questions.append(Question(f"connector-{tgt.rid}", f"Off-page connector {tgt.number} has no "
                                              "matching connector on these pages", ["leave the branch out"], 0, "none"))
                    continue
                via = f" through off-page connector {tgt.number}"
                tgt = entry.branches[0]["_to"]
            if tgt.kind == "offpage":
                to = f"{t['ref']}#{tgt.number}"
            else:
                to = tgt.id
            retry = tgt.kind != "offpage" and pos.get(id(tgt), 1 << 30) < pos[id(n)]
            outcome = "done" if n.expect and n.expect["kind"] == "ack" else (oc or "")
            bout.append({"label": b["label"], "outcome": outcome, "cond": cnd, "to": to, "retry": retry,
                         "_ev": b["_ev"] + via + (" (back to an earlier box: a retry loop)" if retry else "")})
        n.branches = bout
        if n.kind == "action" and n.expect and n.expect["kind"] in ("yes_no", "pass_fail", "choice") and \
                not n.text.rstrip().endswith("?"):
            n.ev.append("an action box with branches")
    # facets: each facet box belongs to the question whose box starts at or above it on the same page
    for r, pi, facet, items in t.pop("_facets", []):
        cands = [n for n in real if n.kind == "check" and n.page == pi and _xover(n.bbox, r.bbox) <= 0]
        above = [n for n in cands if n.top <= r.bbox[1] + 2]
        if not cands:
            questions.append(Question(f"facet-{r.id}", f"Which question does the {facet} box {r.id} belong to?",
                                      ["none of them"], 0, "none"))
            continue
        owner = max(above, key=lambda n: n.top) if above else min(cands, key=lambda n: n.top)
        conf = "high" if above else "low"
        nxt = [n for n in cands if n.top > owner.top]
        if nxt and r.bbox[1] >= min(n.top for n in nxt) - 2:
            conf = "low"
        if conf == "low" and len(cands) > 1:
            qid = f"facet-{r.id}"
            opts = [c.text for c in cands]
            questions.append(Question(qid, f"Which question does the box headed {facet!r} (region {r.id}) "
                                           "belong to?", opts, cands.index(owner), "facet",
                                      {"items": items, "facet": facet, "region": r.id, "cands": [c.id for c in cands]}))
        for it in items:
            owner.facets.append({"facet": facet, "text": {"region": r.id, "text": it},
                                 "_ev": [f"{facet} box beside question {owner.number}"], "_conf": conf})
    t["nodes"] = [{"id": n.id, "kind": n.kind, "number": n.number, "text": {"region": n.rid, "text": n.text},
                   "expect": n.expect, "facets": n.facets, "branches": n.branches, "test_procedure": None,
                   "target": n.target, "guards": n.guards, "_ev": n.ev} for n in real]
    # test procedures name their question by number
    for p in out["procedures"]:
        if p.get("_for"):
            q = next((x for x in t["nodes"] if x["number"] == p["_for"]), None)
            if q is not None:
                q["test_procedure"] = p["key"]


def _unit(labels: list[str]) -> str | None:
    units = set()
    for lb in labels:
        m = re.search(r"\d(?:\.\d+)?\s*([A-Za-z%°]+)\b", lb)
        if m:
            units.add(m.group(1))
    return units.pop() if len(units) == 1 else None


def _table(pm: PageModel, cells: list[Region], out: dict, questions: list[Question], regs) -> None:
    rows: dict[int, list[Region]] = {}
    for c in cells:
        rows.setdefault(c.row, []).append(c)
    if not rows:
        return
    grid = [sorted(v, key=lambda c: c.col) for _, v in sorted(rows.items())]
    head = [pm.region_text(c).lower() for c in grid[0]]
    body = grid[1:]
    col = lambda *ws: next((i for i, h in enumerate(head) if any(w in h for w in ws)), None)  # noqa: E731
    if col("step") is not None and col("result") is not None and col("next", "action", "do") is not None:
        _chart(pm, grid, head, col, out, regs)
        return
    if col("symptom") is not None and col("troubleshooting", "table") is not None:
        ci, ti = col("symptom"), col("troubleshooting", "table")
        for r in body:
            out["symptoms"].append({"title": _sp(r[ci], pm.region_text(r[ci])),
                                    "tree_ref": pm.region_text(r[ti]), "_ev": ["symptom index row"]})
        return
    if col("code") is not None:
        ci = col("code")
        mi = col("meaning", "description", "fault")
        pi = col("perform", "troubleshoot", "task")
        for r in body:
            ref = pm.region_text(r[pi]) if pi is not None else ""
            m = re.match(r"^\s*((?:Table|Task|TABLE|TASK)\s+\d+-\d+)(?:,\s*(?:Question|Step|QUESTION|STEP)\s+(\w+))?", ref)
            out["codes"].append({"code": _sp(r[ci], pm.region_text(r[ci])),
                                 "meaning": _sp(r[mi], pm.region_text(r[mi])) if mi is not None else None,
                                 "tree_ref": m.group(1) if m else ref, "question": m.group(2) if m else None,
                                 "_ev": ["code table row"]})
        return
    if col("variant") is not None or (col("model") is not None and col("serial") is not None):
        ni = col("variant") if col("variant") is not None else 0
        mi, si = col("model"), col("serial")
        for r in body:
            attrs = [{"key": head[i], "value": _sp(c, pm.region_text(c))} for i, c in enumerate(r)
                     if i not in (ni, mi, si) and pm.region_text(c)]
            out["equipment"].append({"name": _sp(r[ni], pm.region_text(r[ni])), "parent": None,
                                     "model": _sp(r[mi], pm.region_text(r[mi])) if mi is not None else None,
                                     "serials": _sp(r[si], pm.region_text(r[si])) if si is not None else None,
                                     "attrs": attrs, "_ev": ["variants table row"], "_page": pm.index})


def _equipment_parent(out: dict, pages: dict[int, PageModel], unit_pages: list[int], questions: list[Question]) -> None:
    """The machine the variants belong to: the printed phrase that extends the variants' common
    leading words ("Model 40" -> "Model 40 utility pump")."""
    eq = out["equipment"]
    if len(eq) < 2:
        return
    names = [e["name"]["text"].split() for e in eq]
    common = []
    for ws in zip(*names):
        if len({w.lower() for w in ws}) == 1:
            common.append(ws[0])
        else:
            break
    if not common:
        return
    prefix = " ".join(common)
    cands = set()
    stop = {"in", "its", "and", "or", "with", "for", "the", "of", "is", "are"}
    for pi in unit_pages:
        pm = pages[pi]
        for r in pm.regions:
            t = pm.region_text(r)
            for m in re.finditer(re.escape(prefix) + r"((?:\s+[A-Za-z][\w-]*){1,3})", t):
                tail = []
                for w in m.group(1).split():
                    if w.lower() in stop or w.endswith((",", ".")):
                        if w.endswith((",", ".")) and w.lower().rstrip(",.") not in stop:
                            tail.append(w.rstrip(",."))
                        break
                    tail.append(w)
                if tail and prefix + " " + " ".join(tail) not in [e["name"]["text"] for e in eq]:
                    cands.add(prefix + " " + " ".join(tail))
    cands = sorted(cands)
    if len(cands) == 1:
        for e in eq:
            e["parent"] = cands[0]
            e["_ev"].append(f"parent: the printed phrase {cands[0]!r} extends the variants' common words")
    elif cands:
        questions.append(Question("equipment-parent", "Which printed name is the machine these variants belong to?",
                                  cands + ["none of these"], len(cands), "parent", {}))


_GO = re.compile(r"(?i)\b(?:go|proceed|continue)\s+to\s+step\s+([A-Z0-9][\w.-]*?)\.?(?:\s|$)")


def _chart(pm: PageModel, grid: list, head: list[str], col, out: dict, regs) -> None:
    """A troubleshooting chart printed as a table: STEP | SEQUENCE (the test) | RESULT | WHAT TO DO NEXT.
    One check node per step (its test text), one branch per result row (the result as printed is the
    option), to the step the next-cell names ("Go to step 14-2") or to an action box of its own."""
    si, ti, ri, ni = col("step"), col("sequence", "test", "check", "procedure"), col("result"), col("next", "action", "do")
    if ti is None:
        return
    rows = []
    cur_step = cur_test = None
    for r in grid[1:]:
        cells = {c.col: c for c in r}
        st = cells.get(si)
        if st is not None and pm.region_text(st).strip():
            cur_step, cur_test = st, cells.get(ti)
        res, nxt = cells.get(ri), cells.get(ni)
        if cur_step is None or res is None or nxt is None:
            continue
        rows.append((cur_step, cur_test, res, nxt))
    if not rows:
        return
    cap = next((r for r in sorted((x for x in regs if x.kind == "text" and x.bbox[3] <= grid[0][0].bbox[1] + 1),
                                   key=lambda x: -x.bbox[3])), None)
    title = pm.region_text(cap) if cap else pm.region_text(grid[0][0])
    m = re.match(r"^(?P<ref>(?:CHART|Chart|TABLE|Table|FLASH CODE|Flash Code)\s+[\w-]+(?:\.\d+)?)[.:]?\s*(?P<title>.*)$", title)
    ref = m.group("ref") if m else title[:40]
    steps: dict[str, dict] = {}
    nodes: list[dict] = []
    for st, test, res, nxt in rows:
        sid = pm.region_text(st).strip()
        if sid not in steps:
            n = {"id": f"s{len(steps) + 1}", "kind": "check", "number": sid,
                 "text": _sp(test, pm.region_text(test)) if test is not None else _sp(st, sid),
                 "expect": {"kind": "choice", "unit": None, "options": []}, "facets": [], "branches": [],
                 "test_procedure": None, "target": None, "guards": [], "_ev": [f"chart step {sid}"]}
            steps[sid] = n
            nodes.append(n)
    acts = 0
    for st, test, res, nxt in rows:
        n = steps[pm.region_text(st).strip()]
        label = pm.region_text(res)
        nt = pm.region_text(nxt)
        n["expect"]["options"].append(label)
        g = _GO.search(nt)
        if g and g.group(1) in steps:
            to = steps[g.group(1)]["id"]
            ev = f"result {label!r}: {nt!r}"
        else:
            acts += 1
            kind = "escalate" if re.search(DEFAULTS["escalate"], nt) else "end" if re.search(DEFAULTS["end"], nt) \
                else "action"
            a = {"id": f"a{acts}", "kind": kind, "number": None, "text": _sp(nxt, nt), "expect": None, "facets": [],
                 "branches": [], "test_procedure": None, "target": None, "guards": [], "_ev": [f"chart action {nt[:40]!r}"]}
            tm = re.search(DEFAULTS["target"], nt)
            if tm:
                a["target"] = {"kind": "tree" if tm.group("ref").lower().startswith("table") else "procedure",
                               "ref": tm.group("ref")}
            nodes.append(a)
            to = a["id"]
            ev = f"result {label!r}: action in the same row"
        n["branches"].append({"label": _sp(res, label), "outcome": label.lower(), "cond": None, "to": to,
                              "retry": False, "_ev": ev})
    for n in nodes:
        if n["kind"] == "check":
            opts = n["expect"]["options"]
            folded = {o.strip().lower() for o in opts}
            if folded <= {"yes", "no"} and len(folded) == 2:
                n["expect"] = {"kind": "yes_no", "unit": None, "options": []}
            elif folded <= {"pass", "fail", "ok", "not ok"} and len(folded) == 2:
                n["expect"] = {"kind": "pass_fail", "unit": None, "options": []}
            elif len(opts) == 1:
                n["expect"] = {"kind": "ack", "unit": None, "options": []}
                for b in n["branches"]:
                    b["outcome"] = "done"
    out["trees"].append({"ref": ref, "title": _sp(cap, m.group("title") if m and m.group("title") else title)
                         if cap else _sp(grid[0][0], title), "applies": [], "setup": [], "guards": [], "nodes": nodes,
                         "_ev": ["troubleshooting chart as a table"], "_done": True})
