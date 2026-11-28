"""Verified structure -> stage rows: sections from layout regions, the maintenance tables, and one
provenance row per generated row.

Sections are built here, not by a parser, because what a region is (a question, a facet box, a
step, a warning) is the extraction's finding: one section per region, its text the region's
words exactly (a WARNING/CAUTION/NOTE or facet heading line goes to `heading`), nested
chapter > tree or task > question or step > facet box, with each section's page, label and box in
`section_loc`. Regions no structure claims still become paragraph sections under the nearest
container, so every word of an ingested page is in the pack and searchable.

Verdicts are per row: a span that is not in the text layer, a branch whose drawn arrow says
otherwise, a numeric condition whose numbers are not in its label, an unresolved branch target,
fail that row with the reason. A tree ships only whole: it fails when any of its nodes fails (its
own notes say which), and again when the core's graph validation reports it (`build.py`).
Edges and facets have no provenance column; they ship with their node.
"""

from __future__ import annotations

import json
import re
from dataclasses import dataclass, field

from ..model import Node as SecNode, ParsedDoc
from ..stage import Stage
from ..textutil import canonical_json, numbers_in, sha256_text, slug
from .layout import PageModel, Region
from .spans import Located, locate

VERIFIER = "maint-spans:v1"
PROMPT_ID = "harvest.maint.extract"
GUARD_WORDS = {"WARNING": "warning", "CAUTION": "caution", "NOTE": "note", "DANGER": "warning"}
_SERIAL = re.compile(r"^\s*([A-Za-z0-9]*?[-/]?)(\d+)\s*(?:to|through|thru|-|–|—|~)\s*([A-Za-z0-9]*?[-/]?)(\d+)\s*$")
_J1939 = re.compile(r"\bSPN\s*(\d+)\s*(?:/|,)?\s*FMI\s*(\d+)\b", re.I)


def fold(s: str) -> str:
    return " ".join((s or "").split()).lower()


def ref_key(s: str | None) -> str:
    return fold(re.sub(r"[.,:;]+$", "", s or ""))


def _bx(j: str) -> tuple:
    """A stored normalized box (json {x0, y0, x1, y1}) as (x0, y0, x1, y1)."""
    d = json.loads(j) if isinstance(j, str) else j
    return (d["x0"], d["y0"], d["x1"], d["y1"]) if isinstance(d, dict) else tuple(d)


def split_by_symptom(trees: list[dict]) -> list[dict]:
    """A tree has one symptom. A reading that put several printed malfunctions in one tree (several
    symptom nodes) becomes one tree per symptom, holding the nodes reachable from it, titled by the
    symptom's own printed words; the shared setup, guards and applicability go with each."""
    out = []
    for t in trees:
        nodes = t.get("nodes") or []
        syms = [n for n in nodes if n.get("kind") == "symptom"]
        if len(syms) < 2:
            out.append(t)
            continue
        by_id = {n.get("id"): n for n in nodes}
        for k, sym in enumerate(syms):
            seen, stack = [], [sym.get("id")]
            while stack:
                nid = stack.pop()
                if nid in seen or nid not in by_id or (nid != sym.get("id") and by_id[nid].get("kind") == "symptom"):
                    continue
                seen.append(nid)
                stack += [b.get("to") for b in by_id[nid].get("branches") or [] if b.get("to")]
            # the ref names the malfunction by its printed words, so continuation sheets of the same
            # malfunction still join and different malfunctions never do
            stext = " ".join(((sym.get("text") or {}).get("text") or f"symptom {k + 1}").split())[:80]
            out.append({**t, "ref": f"{t.get('ref') or 'tree'}: {stext}", "title": sym.get("text") or t.get("title"),
                        "nodes": [by_id[i] for i in seen], "_split_from": t.get("ref")})
    return out


@dataclass
class Prov:
    """What one generated row rests on."""
    problems: list[str] = field(default_factory=list)
    notes: list[str] = field(default_factory=list)

    @property
    def ok(self) -> bool:
        return not self.problems


@dataclass
class Ctx:
    stage: Stage
    pages: dict[tuple[str, int], PageModel]      # (source_id, page index) -> model
    source_id: str
    prefix: str
    arm_spec: str
    entry: dict                                   # the cache entry of this unit
    unit_key: str
    prompt_sha: str


class Assembly:
    """Everything one arm's outputs produce for one source, before writing."""

    def __init__(self, stage: Stage, source_id: str, models: list[PageModel], prefix: str, citation_prefix: str,
                 options: dict | None = None):
        self.stage = stage
        self.source_id = source_id
        self.models = {m.index: m for m in models}
        self.prefix = prefix
        self.cite = citation_prefix
        self.o = options or {}
        self.order = {}            # region id -> global reading position
        k = 0
        for m in models:
            for r in m.regions:
                self.order[r.id] = k
                k += 1
        self.sections: dict[str, dict] = {}        # region id -> section record
        self.used_ids: set[str] = set()
        self.rows: list[tuple[str, dict, str]] = []  # (table, row, prov_id)
        self.provs: dict[str, dict] = {}
        self.text_locs: list[dict] = []
        self.trees: dict[str, dict] = {}            # ref key -> merged tree
        self.procs: list[dict] = []
        self.report: dict = {"rows": {}, "verdicts": {"pass": 0, "fail": 0, "needs_review": 0}, "problems": []}
        self.facet_labels: dict[str, str] = {}
        self.consumed_labels: set[str] = set()
        self.equipment: dict[str, dict] = {}
        self.forced: dict = (self.o.get("forced") or {})   # (table, key) -> reason, from the core's graph check
        self.review_of: dict = (self.o.get("review") or {})  # (table, key) -> reason, from cross-arm agreement
        self.guard_recs: list = []
        self.edge_recs: list = []
        self.node_recs: list = []
        self.plausibility_on = bool(self.o.get("plausibility", True))
        self._unit_pages: list[int] = []

    # ---- spans --------------------------------------------------------------------------------
    def span(self, sp: dict | None, prov: Prov, what: str) -> Located | None:
        if not sp:
            return None
        rid = sp.get("region") or ""
        m = re.match(r"p(\d+)\.r\d+$", rid)
        page = int(m.group(1)) if m else None
        if page is None or page not in self.models:
            # an unknown region id: search the unit's pages for the text
            for idx in self._unit_pages:
                loc, _ = locate(self.models, idx, None, sp.get("text", ""))
                if loc:
                    prov.notes.append(f"{what}: region {rid!r} unknown; found on page {idx}")
                    return loc
            prov.problems.append(f"{what}: region {rid!r} is not on these pages")
            return None
        loc, problem = locate(self.models, page, rid, sp.get("text", ""))
        if problem:
            prov.problems.append(f"{what}: {problem}")
            return None
        if loc.moved_from:
            prov.notes.append(f"{what}: found in {loc.region}, not the cited {loc.moved_from}")
        return loc

    # ---- sections -----------------------------------------------------------------------------
    def region(self, rid: str) -> tuple[PageModel, Region]:
        page = int(rid.split(".")[0][1:])
        pm = self.models[page]
        return pm, pm.region(rid)

    def sid(self, base: str) -> str:
        s = base
        k = 2
        while s in self.used_ids:
            s = f"{base}~{k}"
            k += 1
        self.used_ids.add(s)
        return s

    def claim(self, rid: str, kind: str, sid_base: str, citation: str, parent_rid: str | None = None,
              strip_heading: bool = False, heading: str | None = None) -> dict:
        """The section of a region (created on first claim)."""
        if rid in self.sections:
            return self.sections[rid]
        pm, reg = self.region(rid)
        lines = [" ".join(pm.words[i].text for i in ln) for ln in reg.lines]
        if strip_heading and lines:
            first = lines[0].strip()
            if first.isupper() and len(first.split()) <= 5:
                heading = heading or first
                lines = lines[1:]
        rec = {"rid": rid, "sid": self.sid(sid_base), "kind": kind, "citation": citation, "heading": heading,
               "text": "\n".join(lines), "parent_rid": parent_rid, "page": pm.index, "label": pm.label,
               "bbox": reg.bbox, "pm": pm}
        self.sections[rid] = rec
        return rec

    # ---- provenance -----------------------------------------------------------------------------
    def prov(self, ctx: Ctx, table: str, key: str, item, p: Prov, extra_problems: list[str] | None = None) -> str:
        problems = p.problems + (extra_problems or [])
        if isinstance(item, dict):   # the rules arm says which rule decided, and how sure it is
            for e in item.get("_ev") or []:
                if e not in p.notes:
                    p.notes.append(e if isinstance(e, str) else str(e))
            if item.get("_conf") == "low":
                p.notes.append("low-confidence rule decision")
        if (table, key) in self.forced:
            problems = problems + [self.forced[(table, key)]]
        verdict = "fail" if problems else "pass"
        review = [self.review_of[(table, key)]] if (table, key) in self.review_of else []
        if review and verdict == "pass":
            verdict = "needs_review"
        pid = sha256_text(f"{ctx.arm_spec}|{ctx.unit_key}|{table}|{key}")[:20]
        out_sha = sha256_text(canonical_json(item))
        self.provs[pid] = {
            "prov_id": pid, "backend": ctx.entry.get("backend", ""), "model": ctx.entry.get("model_id") or ctx.arm_spec,
            "prompt_id": PROMPT_ID, "prompt_version": str(ctx.entry.get("prompt_version", "")),
            "prompt_sha256": ctx.prompt_sha, "input_sha256": ctx.entry.get("input_sha256", ""),
            "output_sha256": out_sha, "created_at": ctx.entry.get("created_at", ""), "verifier": VERIFIER,
            "verdict": verdict,
            "notes": json.dumps({"unit": ctx.unit_key, "row": f"{table}:{key}", "problems": problems + review,
                                 "notes": p.notes}, ensure_ascii=False),
        }
        return pid

    def review(self, pid: str, reason: str) -> None:
        """A keyless signal says a human should look: pass becomes needs_review (fail stays fail)."""
        pr = self.provs[pid]
        n = json.loads(pr["notes"])
        if reason not in n["problems"]:
            n["problems"].append(reason)
        pr["notes"] = json.dumps(n, ensure_ascii=False)
        if pr["verdict"] == "pass":
            pr["verdict"] = "needs_review"

    def plausibility(self) -> dict:
        """Attachments that contradict the page geometry become needs_review (no answer key needed):
        a guard on another page than its step, below it, or with a nearer step in between; a guard of
        a whole procedure printed below one of its steps; a facet box not beside its question; an edge
        with no drawn arrow behind it on a page that draws its arrows."""
        if not self.plausibility_on:
            return {}
        counts = {"guards": 0, "facets": 0, "edges": 0}
        steps_of: dict = {}
        for s in self.sections.values():
            if s["kind"] == "step" and s.get("parent_rid"):
                steps_of.setdefault(s["parent_rid"], []).append(s)
        for pid, grid, tsec in self.guard_recs:
            if grid is None or self.provs[pid]["verdict"] != "pass":
                continue
            gpm, g = self.region(grid)
            why = None
            if tsec["kind"] == "step":
                if gpm.index != tsec["page"]:
                    why = f"the guard is on page {gpm.label}, its step on page {tsec['label']}"
                elif g.bbox[1] > tsec["bbox"][3]:
                    why = "the guard is printed below the step it guards"
                else:
                    between = [s for s in steps_of.get(tsec.get("parent_rid"), []) if s is not tsec
                               and s["page"] == gpm.index and g.bbox[3] <= s["bbox"][1] < tsec["bbox"][1]
                               and min(s["bbox"][2], g.bbox[2]) - max(s["bbox"][0], g.bbox[0]) > 0]
                    if between:
                        why = f"a nearer step ({between[0]['sid']}) lies between the guard and its step"
                    elif g.bbox[3] > tsec["bbox"][1] + 2:   # beside, not above: the nearest step by vertical overlap
                        near = [s for s in steps_of.get(tsec.get("parent_rid"), []) if s["page"] == gpm.index]
                        best = min(near, key=lambda s: abs((s["bbox"][1] + s["bbox"][3]) / 2 - (g.bbox[1] + g.bbox[3]) / 2))
                        if best is not tsec:
                            why = f"the guard sits beside {best['sid']}, not the step it is attached to"
            elif tsec["kind"] in ("section",):
                kids = [s for s in steps_of.get(tsec["rid"], []) if s["page"] == gpm.index and s["bbox"][3] <= g.bbox[1]
                        and min(s["bbox"][2], g.bbox[2]) - max(s["bbox"][0], g.bbox[0]) > 0]
                if kids:
                    why = "the guard of the whole task is printed below one of its steps"
                elif gpm.index < tsec["page"]:
                    why = "the guard is printed before the title of what it guards"
            elif tsec["kind"] == "chapter" and gpm.index != tsec["page"]:
                why = "the guard is not on its heading's page"
            if why:
                counts["guards"] += 1
                self.review(pid, f"geometry: {why}")
        for rec, tr in self.node_recs:
            pid = rec.get("pid")
            if not pid or self.provs[pid]["verdict"] != "pass" or not rec.get("loc"):
                continue
            npm, nreg = self.region(rec["loc"].region)
            checks = [r2 for r2, _ in self.node_recs if r2.get("loc") and r2["raw"].get("kind") == "check"
                      and r2["loc"].page == rec["loc"].page and r2 is not rec]
            for f in rec.get("facets", []):
                fsec = next((s for s in self.sections.values() if s["sid"] == f["section_id"]), None)
                if fsec is None:
                    continue
                why = None
                if fsec["page"] != npm.index:
                    why = f"facet box on page {fsec['label']}, its question on page {npm.label}"
                else:
                    nxt = [c["loc"] for c in checks if c["loc"].bbox[1] > nreg.bbox[1]]
                    limit = min((l.bbox[1] for l in nxt), default=1e9)
                    if not (nreg.bbox[1] - 2 <= fsec["bbox"][1] < limit - 2):
                        why = "facet box is not beside its question (it starts above it or beside the next one)"
                if why:
                    counts["facets"] += 1
                    self.review(pid, f"geometry: {why}")
                    break
        for a, b, label in self.edge_recs:
            pid = a.get("pid")
            if not pid or self.provs[pid]["verdict"] != "pass" or not a.get("loc") or not b.get("loc"):
                continue
            pm = self.models[a["loc"].page]
            if not pm.connectors:
                continue          # no drawn arrows on this page (scan or text-only layout): nothing to check
            out_c = [c for c in pm.connectors if c.tail == a["loc"].region]
            if a["loc"].page == b["loc"].page:
                ok = any(c.head == b["loc"].region for c in out_c)
            else:
                ok = any(c.head and (re.match(r"^(?:Go|GO|Continue|CONTINUE)\s+(?:to|TO)\b",
                                              pm.region_text(pm.region(c.head)) or "")
                                     or re.fullmatch(r"[A-Z0-9]{1,2}", (pm.region_text(pm.region(c.head)) or "").strip()))
                         for c in out_c)
            if not ok and a["raw"].get("kind") != "symptom":
                # A branch whose arrow the page model did not find leaving this box, on a page where some arrows
                # lost their tail,
                # is a gap in the page model, not evidence against the reading: the stated edge stands,
                # marked lower confidence, when an arrow (tail unknown) ends in the target or carries the
                # label, or the target is on another page. Only an arrow that leaves this box and goes
                # elsewhere, or a page whose arrows all have tails, holds the question.
                tailless = [c for c in pm.connectors if not c.tail]
                lab_hit = any(c.label and fold(pm.region_text(pm.region(c.label)) or "") == fold(label) for c in tailless)
                head_hit = any(c.head == b["loc"].region for c in tailless)
                mine = [c for c in out_c if c.label and fold(pm.region_text(pm.region(c.label)) or "") == fold(label)]
                plain = fold(label) in ("continue", "") and not out_c   # an action's one onward arrow
                if not mine and tailless and (lab_hit or head_hit or plain or a["loc"].page != b["loc"].page):
                    n = json.loads(self.provs[pid]["notes"])
                    msg = (f"lower confidence: branch {label!r} kept from the reading; the page model found no arrow "
                           f"tail at {a['loc'].region}")
                    if msg not in n["notes"]:
                        n["notes"].append(msg)
                    self.provs[pid]["notes"] = json.dumps(n, ensure_ascii=False)
                    counts["edges_lower_confidence"] = counts.get("edges_lower_confidence", 0) + 1
                    continue
                counts["edges"] += 1
                self.review(pid, f"geometry: no drawn arrow from {a['loc'].region} to {b['loc'].region} ({label})")
        # a tree with a node under review is under review
        for tr in self.trees.values():
            if not tr.get("pid"):
                continue
            bad = [r["node_id"] for r in tr.get("nodes", {}).values()
                   if r.get("pid") and self.provs[r["pid"]]["verdict"] == "needs_review"]
            if bad:
                self.review(tr["pid"], f"nodes need review: {', '.join(bad)}")
        self.report["plausibility"] = counts
        return counts

    def fail(self, pid: str, reason: str) -> None:
        pr = self.provs[pid]
        n = json.loads(pr["notes"])
        if reason not in n["problems"]:
            n["problems"].append(reason)
        pr["notes"] = json.dumps(n, ensure_ascii=False)
        pr["verdict"] = "fail"

    def loc(self, ref_kind: str, ref_id: str, fld: str, l: Located) -> None:
        pm = self.models[l.page]
        self.text_locs.append({"ref_kind": ref_kind, "ref_id": ref_id, "field": fld, "source_id": self.source_id,
                               "page_index": l.page, "page_label": pm.label, "region_id": l.region,
                               "bbox": json.dumps(pm.norm_box(l.bbox))})

    # ---- one unit's output ----------------------------------------------------------------------
    def add_unit(self, ctx: Ctx, unit_pages: list[int], out: dict) -> None:
        self._unit_pages = unit_pages
        for hk, h in enumerate(out.get("headings") or []):
            p = Prov()
            loc = self.span(h.get("text"), p, "heading")
            if not loc:
                self.report["problems"].append(f"{ctx.unit_key} heading {hk}: {p.problems}")
                continue
            m = re.search(r"(\d+)", loc.text)
            sec = self.claim(loc.region, "chapter", f"{self.prefix}:{slug(loc.text, 40)}", f"{self.cite} {loc.text}".strip(),
                             heading=loc.text)
            for gk, g in enumerate(h.get("guards") or []):
                self.guard(ctx, g, sec, f"heading{hk}.g{gk}", loc.region)
            _ = m
        proc_by_key: dict[str, dict] = {}
        from .applic import Variants, statement
        from .subproc import split_by_heading
        _v = Variants([e for e in self.equipment.values() if e["parent"] and not e.get("_serial_child")])
        for pk, pr in enumerate(split_by_heading(out.get("procedures") or [], self.models,
                                                 lambda t: bool(_v.leaves) and statement(t, _v) is not None)):
            rec = self.procedure(ctx, pr, pk)
            if rec:
                proc_by_key[pr.get("key") or f"proc{pk}"] = rec
        for tk, t in enumerate(split_by_symptom(out.get("trees") or [])):
            self.tree(ctx, t, tk, proc_by_key)
        self._pending_symptoms = getattr(self, "_pending_symptoms", []) + [(ctx, s) for s in out.get("symptoms") or []]
        self._pending_codes = getattr(self, "_pending_codes", []) + [(ctx, c) for c in out.get("codes") or []]
        for ek, e in enumerate(out.get("equipment") or []):
            self.equip(ctx, e, ek)

    # ---- guards ---------------------------------------------------------------------------------
    def guard(self, ctx: Ctx, g: dict, target: dict, key: str, container_rid: str) -> None:
        p = Prov()
        loc = self.span(g.get("text"), p, f"guard {key}")
        kind = g.get("kind")
        if loc:
            pm, reg = self.region(loc.region)
            first_line = pm.region_text(reg, "\n").split("\n")[0].strip()
            word = re.match(r"^([A-Za-z]+)S?\b", first_line)
            head = (word.group(1).upper() if word else "")
            printed = GUARD_WORDS.get(head) if (first_line.rstrip(":").upper() in GUARD_WORDS
                                                or first_line[len(head):len(head) + 2].lstrip("S").startswith(":")) else None
            if printed is None:
                above = self._heading_above(pm, reg)
                if above:
                    printed = GUARD_WORDS.get(above)
                    p.notes.append(f"guard {key}: its {above} heading is printed as a separate line above the block")
            if printed is None and g.get("_typed"):
                p.notes.append(f"guard {key}: typed {kind} by the source's schema")
            elif printed is None:
                # a guard is what the manual prints as one: a WARNING, CAUTION or NOTE block
                p.problems.append(f"guard {key}: region {loc.region} is not printed as a WARNING, CAUTION or NOTE block")
            elif printed != kind:
                p.problems.append(f"guard {key}: the block is printed {head}, not {kind}")
            frag = self._fragment(pm, reg, loc)
            if frag:
                # a partial warning misleads; a missing one fails coverage loudly
                p.problems.append(f"guard {key}: {frag}")
            sec = self.claim(loc.region, "paragraph" if frag else (kind or "note"), f"{target['sid']}/{kind}",
                             f"{target['citation']}, {kind.title()}", parent_rid=container_rid, strip_heading=True)
            if frag:
                pass               # its words stay as plain text; never as a warning, caution or note
            elif sec["kind"] not in GUARD_WORDS.values():
                p.problems.append(f"guard {key}: its region is already a {sec['kind']}")
        row = {"from_id": None, "to_id": target["sid"], "kind": "guards"}
        gkey = f"guard:{self.sections[loc.region]['sid']}->{target['sid']}" if loc else f"{key}:{target['sid']}"
        pid = self.prov(ctx, "xref", gkey, g, p)
        self.guard_recs.append((pid, loc.region if loc else None, target))
        if loc:
            row["from_id"] = self.sections[loc.region]["sid"]
            self.rows.append(("xref", row, pid))
            self.loc("guard", row["from_id"], "text", loc)
            for ak, a in enumerate(g.get("applies") or []):
                self.applies(ctx, a, "section", row["from_id"], f"{key}.applies{ak}")
        self.tally("xref", pid)

    def tally(self, table: str, pid: str) -> None:
        self.report["rows"].setdefault(table, 0)
        self.report["rows"][table] += 1

    # ---- applicability --------------------------------------------------------------------------
    def applies(self, ctx: Ctx, sp: dict, ref_kind: str, ref_id: str, key: str) -> None:
        self._pending_applies = getattr(self, "_pending_applies", []) + [(ctx, sp, ref_kind, ref_id, key, self._unit_pages)]

    # ---- requirements ---------------------------------------------------------------------------
    def requirements(self, ctx: Ctx, items: list, ref_kind: str, ref_id_fn, container: dict, key: str) -> list:
        """Setup lines -> requirement rows; returns (row, pid) pairs (ref_id filled later)."""
        out = []
        for k, r in enumerate(items or [], 1):
            p = Prov()
            loc = self.span(r.get("text"), p, f"setup {key}#{k}")
            if r.get("kind") not in ("tool", "part", "consumable", "personnel", "condition", "reference"):
                p.problems.append(f"unknown requirement kind {r.get('kind')!r}")
            sec = None
            if loc:
                sec = self.claim(loc.region, "paragraph", f"{container['sid']}/setup", f"{container['citation']}, Initial setup",
                                 parent_rid=container["rid"], strip_heading=True)
            ident = r.get("ident")
            if ident and loc and ident not in self.models[loc.page].region_text(self.region(loc.region)[1]):
                p.notes.append(f"ident {ident!r} not printed in the setup; dropped")
                ident = None
            row = {"ref_kind": ref_kind, "ref_id": ref_id_fn(), "ord": k, "kind": r.get("kind"),
                   "text": loc.text if loc else (r.get("text") or {}).get("text", ""), "ident": ident,
                   "qty": r.get("qty"), "section_id": sec["sid"] if sec else None}
            pid = self.prov(ctx, "requirement", f"{ref_kind}:{row['ref_id']}#{k}", r, p)
            self.rows.append(("requirement", row, pid))
            if loc:
                self.loc("requirement", f"{ref_kind}:{row['ref_id']}#{k}", "text", loc)
            out.append((row, pid))
        return out

    # ---- procedures -----------------------------------------------------------------------------
    def procedure(self, ctx: Ctx, pr: dict, pk: int) -> dict | None:
        p = Prov()
        tloc = self.span(pr.get("title"), p, f"procedure {pk} title")
        ref = pr.get("ref")
        base = slug(ref or (tloc.text if tloc else f"proc-{pk}"), 40)
        rec = {"key": pr.get("key"), "ref": ref, "kind": pr.get("kind") or "maintenance", "raw": pr, "prov": p,
               "tloc": tloc, "ctx": ctx, "base": base, "steps": [], "proc_id": None, "pk": pk,
               "unit_pages": self._unit_pages}
        self.procs.append(rec)
        return rec

    def finish_procedure(self, rec: dict, parent: dict | None, proc_id: str, citation: str) -> None:
        """Write a procedure once its place (under a question, or a chapter) is known."""
        ctx, pr, p, tloc = rec["ctx"], rec["raw"], rec["prov"], rec["tloc"]
        self._unit_pages = rec["unit_pages"]
        rec["proc_id"] = proc_id
        if tloc:
            title_sec = self.claim(tloc.region, "section", f"{parent['sid'] if parent else self.prefix}:{rec['base']}"
                                   if parent is None else f"{parent['sid']}/test", citation,
                                   parent_rid=parent["rid"] if parent else self._container_before(tloc.region),
                                   heading=tloc.text)
        else:
            title_sec = None
        step_ids = []
        for sk, s in enumerate(pr.get("steps") or [], 1):
            sp = Prov()
            sloc = self.span(s.get("text"), sp, f"step {sk}")
            if s.get("check_kind") not in ("pass_fail", "value", "note", "photo"):
                sp.problems.append(f"unknown check_kind {s.get('check_kind')!r}")
            if title_sec is None:
                sp.problems.append("its procedure's title was not found")
            ssec = None
            if sloc and title_sec:
                ssec = self.claim(sloc.region, "step", f"{title_sec['sid']}/s{sk}", f"{citation}, Step {sk}",
                                  parent_rid=title_sec["rid"])
                for gk, g in enumerate(s.get("guards") or []):
                    self.guard(ctx, g, ssec, f"{proc_id}#{sk}.g{gk}", title_sec["rid"])
            row = {"proc_id": proc_id, "ord": sk, "text": sloc.text if sloc else "", "detail": "{}",
                   "check_kind": s.get("check_kind") or "pass_fail",
                   "section_ids": json.dumps([ssec["sid"]] if ssec else []), "deficiency": None, "lang": "en"}
            pid = self.prov(ctx, "proc_step", f"{proc_id}#{sk}", s, sp)
            rec["steps"].append(pid)
            self.rows.append(("proc_step", row, pid))
            if sloc:
                self.loc("proc_step", f"{proc_id}#{sk}", "text", sloc)
            step_ids.append(pid)
            self.tally("proc_step", pid)
        if title_sec:
            for gk, g in enumerate(pr.get("guards") or []):
                self.guard(ctx, g, title_sec, f"{proc_id}.g{gk}", title_sec["rid"])
            self.requirements(ctx, pr.get("setup"), "procedure", lambda: proc_id, title_sec, proc_id)
            for ak, a in enumerate(pr.get("applies") or []):
                self.applies(ctx, a, "procedure", proc_id, f"{proc_id}.applies{ak}")
                self.applies(ctx, a, "section", title_sec["sid"], f"{proc_id}.sapplies{ak}")
        if not pr.get("steps") and not pr.get("_has_groups"):
            p.problems.append("procedure has no steps")
        bad = [self.provs[s] for s in step_ids if self.provs[s]["verdict"] == "fail"]
        held = [self.provs[s] for s in step_ids if self.provs[s]["verdict"] == "needs_review"]
        if bad:
            p.problems.append(f"{len(bad)} of its steps failed verification")
        row = {"proc_id": proc_id, "title": tloc.text if tloc else "", "kind": rec["kind"],
               "summary": tloc.text if tloc else "", "roles": json.dumps(self.o.get("roles") or []), "lang": "en"}
        pid = self.prov(ctx, "procedure", proc_id, {k: v for k, v in pr.items() if k != "steps"}, p)
        rec["pid"] = pid
        if held:
            self.review(pid, f"{len(held)} of its steps need review")
        self.rows.append(("procedure", row, pid))
        if tloc:
            self.loc("procedure", proc_id, "title", tloc)
        self.tally("procedure", pid)

    def _container_before(self, rid: str) -> str | None:
        """The nearest chapter section before a region in reading order."""
        pos = self.order.get(rid, 0)
        best = None
        for r, sec in self.sections.items():
            if sec["kind"] == "chapter" and self.order.get(r, 0) < pos:
                if best is None or self.order[r] > self.order[best]:
                    best = r
        return best

    # ---- trees ----------------------------------------------------------------------------------
    def tree(self, ctx: Ctx, t: dict, tk: int, procs: dict[str, dict]) -> None:
        key = ref_key(t.get("ref")) or f"{ctx.unit_key}#tree{tk}"
        tr = self.trees.get(key)
        if tr is None:
            tr = {"ref": t.get("ref"), "key": key, "parts": [], "tree_id": f"t-{slug(t.get('ref') or str(tk), 40)}"}
            self.trees[key] = tr
        tr["parts"].append({"ctx": ctx, "raw": t, "procs": procs, "unit_pages": self._unit_pages})

    def finish_trees(self) -> None:
        for tr in self.trees.values():
            self._finish_tree(tr)

    def _finish_tree(self, tr: dict) -> None:
        tree_id = tr["tree_id"]
        ref = tr["ref"] or tree_id
        tp = Prov()
        title_loc, title_sec, entry = None, None, None
        nodes: dict[str, dict] = {}       # global node key -> node record
        by_number: dict[str, str] = {}
        ctx0 = tr["parts"][0]["ctx"]
        # pass 1: title, setup, nodes and their sections
        for part_no, part in enumerate(tr["parts"]):
            ctx, t = part["ctx"], part["raw"]
            self._unit_pages = part["unit_pages"]
            if title_loc is None:
                title_loc = self.span(t.get("title"), tp, "tree title")
                if title_loc:
                    title_sec = self.claim(title_loc.region, "section", f"{self.prefix}:{slug(ref, 40)}",
                                           f"{self.cite} {ref}".strip(), parent_rid=self._container_before(title_loc.region),
                                           heading=title_loc.text)
            for k, n in enumerate(t.get("nodes") or []):
                gk = f"{part_no}:{n.get('id') or k}"
                p = Prov()
                loc = self.span(n.get("text"), p, f"node {n.get('id')}")
                nodes[gk] = {"raw": n, "prov": p, "loc": loc, "ctx": ctx, "part": part_no, "procs": part["procs"],
                             "unit_pages": part["unit_pages"]}
                num = (n.get("number") or "").strip().rstrip(".")
                if num:
                    by_number.setdefault(num, gk)
        if title_sec is None:
            tp.problems.append("tree title not found in the text layer")
        # node ids: numbered checks by their number, others in reading order
        used = set()
        ordered = sorted(nodes.items(), key=lambda kv: (self.order.get(kv[1]["loc"].region, 1 << 30) if kv[1]["loc"]
                                                        else 1 << 30))
        counters: dict[str, int] = {}
        for gk, rec in ordered:
            n = rec["raw"]
            num = (n.get("number") or "").strip().rstrip(".")
            kind = n.get("kind") or "check"
            if num and by_number.get(num) == gk:
                nid = f"{tree_id}.q{slug(num, 12)}"
            else:
                counters[kind] = counters.get(kind, 0) + 1
                nid = f"{tree_id}.{kind[:2]}{counters[kind]}"
            while nid in used:
                nid += "x"
            used.add(nid)
            rec["node_id"] = nid
        for gk, rec in ordered:
            loc = rec["loc"]
            if loc and title_sec:
                kind = rec["raw"].get("kind") or "check"
                num = (rec["raw"].get("number") or "").strip().rstrip(".")
                cit = f"{self.cite} {ref}, Question {num}".strip() if num and kind == "check" else \
                    f"{self.cite} {ref}, page {self.models[loc.page].label or loc.page + 1}".strip()
                rec["sec"] = self.claim(loc.region, "step", f"{title_sec['sid']}/{rec['node_id'].split('.')[-1]}", cit,
                                        parent_rid=title_sec["rid"])
            elif loc:
                rec["prov"].problems.append("its tree's title was not found")
        # pass 2: branches, facets, guards, procedures, targets
        part_nodes: dict[int, dict[str, str]] = {}
        for gk, rec in nodes.items():
            part_nodes.setdefault(rec["part"], {})[rec["raw"].get("id")] = gk
        edges_out = []
        for gk, rec in ordered:
            n, p, ctx = rec["raw"], rec["prov"], rec["ctx"]
            self._unit_pages = rec["unit_pages"]
            nid = rec["node_id"]
            kind = n.get("kind")
            if kind not in ("symptom", "check", "action", "goto", "escalate", "end"):
                p.problems.append(f"unknown node kind {kind!r}")
            expect = self._expect(n.get("expect"), p)
            # facets
            facets = []
            for fk, f in enumerate(n.get("facets") or []):
                floc = self.span(f.get("text"), p, f"facet {f.get('facet')}")
                if not floc or not rec.get("sec"):
                    continue
                pm, reg = self.region(floc.region)
                head = pm.region_text(reg, "\n").split("\n")[0].strip()
                fsec = self.claim(floc.region, "paragraph", f"{rec['sec']['sid']}/{slug(f.get('facet') or 'facet', 16)}",
                                  f"{rec['sec']['citation']}, {head.title() if head.isupper() else f.get('facet')}",
                                  parent_rid=rec["sec"]["rid"], strip_heading=True)
                if fsec["heading"] and f.get("facet"):
                    self.facet_labels.setdefault(f["facet"], fsec["heading"])
                ordn = 1 + sum(1 for x in facets if x["facet"] == f.get("facet"))
                facets.append({"node_id": nid, "facet": f.get("facet"), "ord": ordn, "text": floc.text,
                               "section_id": fsec["sid"]})
                self.loc("fault_facet", f"{nid}/{f.get('facet')}#{ordn}", "text", floc)
            rec["facets"] = facets
            # branches
            self._conditions = False
            drawn = self._drawn(rec)
            for bk, b in enumerate(n.get("branches") or [], 1):
                to = b.get("to") or ""
                tgt = part_nodes.get(rec["part"], {}).get(to)
                if tgt is None and "#" in to:
                    r2, num = to.rsplit("#", 1)
                    if ref_key(r2) == tr["key"]:
                        tgt = by_number.get(num.strip().rstrip("."))
                    else:
                        p.problems.append(f"branch {bk} goes to another tree ({to}); use a goto node")
                        continue
                if tgt is None:
                    p.problems.append(f"branch {bk}: target {to!r} is not a node of this tree")
                    continue
                tmp = Prov()
                lab_loc = self.span(b.get("label"), tmp, f"branch {bk} label") if b.get("label") else None
                if lab_loc is None and nodes[tgt].get("loc") and (nodes[tgt]["raw"].get("kind") or "") != "check":
                    # a decision list prints "If <condition>, <action>": the condition just before the
                    # action's printed words, on its line, is the branch's printed label
                    cond_loc = self._condition_before(nodes[tgt]["loc"])
                    if cond_loc:
                        lab_loc = cond_loc
                        p.notes.append(f"branch {bk}: label is the printed condition {cond_loc.text!r} before its action")
                        tmp.problems.clear()
                p.problems += tmp.problems
                p.notes += tmp.notes
                if lab_loc:
                    self.consumed_labels.add(lab_loc.region)
                outcome = fold(b.get("outcome") or "")
                cond = self._cond(b.get("cond"), lab_loc, p, bk, expect)
                label = self._label(expect, outcome, lab_loc, p, bk, bool(b.get("retry")))
                # the drawing, when it shows this arrow, must agree
                tgt_rec = nodes[tgt]
                if drawn and rec.get("loc") and tgt_rec.get("loc"):
                    self._check_drawn(rec, tgt_rec, lab_loc, label, drawn, p, bk)
                edges_out.append({"from": gk, "to": tgt, "ord": bk, "label": label, "cond": cond,
                                  "retry": bool(b.get("retry"))})
            if n.get("kind") == "goto" and ("as_text", nid) in self.forced:
                p.notes.append("go-to kept as its printed instruction: " + self.forced[("as_text", nid)])
            if expect and expect.get("kind") in ("yes_no", "pass_fail", "choice") and self._conditions:
                mine = [e for e in edges_out if e["from"] == gk]
                expect = {"kind": "choice", "options": [e["label"] for e in mine]}
                p.notes.append("branches printed as conditions: kept as a choice of the printed conditions")
            if expect and expect.get("kind") == "value" and ("as_choice", nid) in self.forced:
                mine = [e for e in edges_out if e["from"] == gk]
                expect = {"kind": "choice", "options": [e["label"] for e in mine]}
                for e in mine:
                    e["cond"] = None
                p.notes.append("measured value kept as a choice of its printed branch labels: "
                               + self.forced[("as_choice", nid)])
            # test procedure, target
            proc_id = None
            tpk = n.get("test_procedure")
            if tpk:
                prec = rec["procs"].get(tpk)
                if prec is None:
                    p.notes.append(f"test procedure {tpk!r} not in this unit; dropped")
                else:
                    proc_id = f"{nid}.test"
                    num = (n.get("number") or "").strip().rstrip(".")
                    self.finish_procedure(prec, rec.get("sec"), proc_id,
                                          f"{self.cite} {ref}, Question {num}, Test procedure".strip())
                    prec["used"] = True
                    if self.provs[prec["pid"]]["verdict"] != "pass":
                        p.problems.append(f"its test procedure {proc_id} failed verification")
            rec["proc_id"] = proc_id
            rec["target"] = n.get("target")
            rec["expect"] = expect
            if rec.get("sec"):
                for gk2, g in enumerate(n.get("guards") or []):
                    self.guard(ctx, g, rec["sec"], f"{nid}.g{gk2}", title_sec["rid"] if title_sec else rec["sec"]["rid"])
        # entry: the symptom node, else the first node in reading order with no incoming edge
        incoming = {e["to"] for e in edges_out}
        sym = [gk for gk, r in ordered if r["raw"].get("kind") == "symptom"]
        roots = [gk for gk, _ in ordered if gk not in incoming]
        entry = (sym or roots or [gk for gk, _ in ordered] or [None])[0]
        # tree-level setup, guards, applicability
        if title_sec:
            for part in tr["parts"]:
                self._unit_pages = part["unit_pages"]
                t = part["raw"]
                self.requirements(part["ctx"], t.get("setup"), "fault_tree", lambda: tree_id, title_sec, tree_id)
                for gk2, g in enumerate(t.get("guards") or []):
                    self.guard(part["ctx"], g, title_sec, f"{tree_id}.g{gk2}", title_sec["rid"])
                for ak, a in enumerate(t.get("applies") or []):
                    self.applies(part["ctx"], a, "fault_tree", tree_id, f"{tree_id}.applies{ak}")
                    self.applies(part["ctx"], a, "section", title_sec["sid"], f"{tree_id}.sapplies{ak}")
        # rows
        failed_nodes = []
        for gk, rec in ordered:
            n = rec["raw"]
            row = {"node_id": rec["node_id"], "tree_id": tree_id, "kind": n.get("kind"),
                   "text": rec["loc"].text if rec["loc"] else (n.get("text") or {}).get("text", ""),
                   "section_id": rec["sec"]["sid"] if rec.get("sec") else "",
                   "expect": canonical_json(rec["expect"]) if rec["expect"] else None,
                   "target": None, "proc_id": rec["proc_id"], "lang": "en"}
            ref = self._reference(rec)
            if ref and "reference" in self._node_cols():
                row["reference"] = ref        # the printed cross-reference, verbatim from the node's text
            rec["row"] = row
            pid = self.prov(rec["ctx"], "fault_node", rec["node_id"], n, rec["prov"])
            rec["pid"] = pid
            if rec["prov"].problems:
                failed_nodes.append(rec["node_id"])
            self.rows.append(("fault_node", row, pid))
            if rec["loc"]:
                self.loc("fault_node", rec["node_id"], "text", rec["loc"])
            for f in rec.get("facets", []):
                self.rows.append(("fault_facet", f, pid))
            self.tally("fault_node", pid)
        for gk, rec in ordered:
            self.node_recs.append((rec, tr))
        for e in edges_out:
            self.edge_recs.append((nodes[e["from"]], nodes[e["to"]], e["label"]))
            self.rows.append(("fault_edge", {"from_node": nodes[e["from"]]["node_id"], "ord": e["ord"],
                                             "label": e["label"], "cond": canonical_json(e["cond"]) if e["cond"] else None,
                                             "to_node": nodes[e["to"]]["node_id"], "retry": int(e["retry"])},
                              nodes[e["from"]]["pid"]))
        if failed_nodes:
            tp.problems.append(f"nodes failed verification: {', '.join(failed_nodes)}")
        if entry is None:
            tp.problems.append("tree has no nodes")
        row = {"tree_id": tree_id, "title": title_loc.text if title_loc else "", "system": None,
               "entry_node": nodes[entry]["node_id"] if entry else "",
               "section_ids": json.dumps([title_sec["sid"]] if title_sec else []), "lang": "en"}
        pid = self.prov(ctx0, "fault_tree", tree_id, {"ref": tr["ref"], "parts": len(tr["parts"])}, tp)
        tr["pid"], tr["nodes"], tr["title_sec"] = pid, nodes, title_sec
        held = [r["node_id"] for _, r in ordered if r.get("pid") and self.provs[r["pid"]]["verdict"] == "needs_review"]
        if held:
            self.review(pid, f"nodes need review: {', '.join(held)}")
        self.rows.append(("fault_tree", row, pid))
        if title_loc:
            self.loc("fault_tree", tree_id, "title", title_loc)
        self.tally("fault_tree", pid)

    def _condition_before(self, loc: Located) -> Located | None:
        """The printed 'If ...,' / 'When ...,' clause immediately before an action's words in its region."""
        pm = self.models[loc.page]
        reg = pm.region(loc.region)
        if reg is None or not loc.words or loc.words[0] not in reg.words:
            return None
        k = reg.words.index(loc.words[0])
        if k == 0 or not pm.words[reg.words[k - 1]].text.endswith(","):
            return None
        for j in range(k - 1, max(-1, k - 30), -1):
            w = pm.words[reg.words[j]].text
            if re.fullmatch(r"(?i)if|when|where|after|unless", w):
                idxs = reg.words[j:k]
                text = " ".join(pm.words[i].text for i in idxs)
                ws = [pm.words[i] for i in idxs]
                return Located(text.rstrip(","), loc.page, reg.id, idxs,
                               (min(x.x0 for x in ws), min(x.top for x in ws), max(x.x1 for x in ws),
                                max(x.bottom for x in ws)))
            if j < k - 1 and (w.endswith(".") or re.fullmatch(r"[a-z0-9]{1,3}[.)]", w)):
                return None          # crossed into the previous sentence or item: no condition here
        return None

    @staticmethod
    def _fragment(pm: PageModel, reg: Region, loc: Located) -> str | None:
        """Why a guard's text is only part of its printed block, or None. It starts mid-sentence (a
        lowercase start, or the block directly above in the same column runs on into it), or it stops
        mid-sentence while the block directly below continues it."""
        text = loc.text.strip()
        body = re.sub(r"^(?:WARNINGS?|CAUTIONS?|NOTES?|DANGER)\b:?\s*", "", text)
        if body[:1].islower():
            return f"starts mid-sentence ({body[:30]!r}): only part of a printed block"
        lh = max((pm.words[i].bottom - pm.words[i].top for i in reg.words), default=10) or 10

        def near(r, above: bool) -> bool:
            if r is reg or not r.words or r.kind in ("header", "footer"):
                return False
            gap = reg.bbox[1] - r.bbox[3] if above else r.bbox[1] - reg.bbox[3]
            return -2 <= gap <= 1.6 * lh and min(r.bbox[2], reg.bbox[2]) - max(r.bbox[0], reg.bbox[0]) > 0.3 * (
                reg.bbox[2] - reg.bbox[0])
        first_word = reg.words.index(loc.words[0]) == 0 if loc.words and loc.words[0] in reg.words else False
        last_word = reg.words.index(loc.words[-1]) == len(reg.words) - 1 if loc.words and loc.words[-1] in reg.words else False
        if first_word:
            for r in pm.regions:
                if near(r, True):
                    t = pm.region_text(r).strip()
                    if t and t.rstrip(":").upper() not in GUARD_WORDS and t.upper() != t and not re.search(r"[.!?:]$", t):
                        return f"the block above runs on into it ({t[-30:]!r}): only part of a printed block"
        if last_word and not re.search(r"[.!?]$", text):
            for r in pm.regions:
                if near(r, False):
                    t = pm.region_text(r).strip()
                    if t[:1].islower() or not re.match(r"^(?:\(?\w{1,3}[.)]|[A-Z]{3,}\b)", t):
                        return f"stops mid-sentence and the block below continues it ({t[:30]!r}): only part of a printed block"
        return None

    @staticmethod
    def _heading_above(pm: PageModel, reg: Region) -> str | None:
        """A WARNING / CAUTION / NOTE heading the page model split from its body: a region holding only
        that word, directly above the body (small gap) and overlapping it horizontally."""
        best = None
        for r in pm.regions:
            if r is reg or not r.words or r.bbox[3] > reg.bbox[1] + 1 or reg.bbox[1] - r.bbox[3] > 18:
                continue
            if min(r.bbox[2], reg.bbox[2]) - max(r.bbox[0], reg.bbox[0]) <= 0:
                continue
            w = pm.region_text(r).strip().rstrip(":").upper()
            w = w[:-1] if w.endswith("S") and w[:-1] in GUARD_WORDS else w
            if w in GUARD_WORDS and (best is None or r.bbox[3] > best[0]):
                best = (r.bbox[3], w)
        return best[1] if best else None

    def _node_cols(self) -> list[str]:
        if not hasattr(self, "_ncols"):
            from ..schema import table_columns
            self._ncols = table_columns(self.stage.conn, "fault_node")
        return self._ncols

    @staticmethod
    def _reference(rec: dict) -> str | None:
        t = rec["raw"].get("target") or {}
        loc = rec.get("loc")
        if not t.get("ref") or not loc:
            return None
        words = t["ref"].split()
        m = re.search(r"\s+".join(re.escape(w) for w in words), loc.text, re.I)
        return m.group(0) if m else None

    def resolve_targets(self) -> None:
        """Action targets name a task or table by its printed reference; resolve across units."""
        procs = {ref_key(r["ref"]): r for r in self.procs if r.get("ref") and r.get("proc_id")}
        refs = self.report.setdefault("references", {"printed": 0, "resolved": 0, "unresolved": {}})
        for tr in self.trees.values():
            for rec in tr.get("nodes", {}).values():
                t = rec.get("target")
                if not t or not rec.get("row"):
                    continue
                key = ref_key(t.get("ref"))
                refs["printed"] += 1
                if (t.get("kind") == "procedure" and key in procs) or (t.get("kind") == "tree" and key in self.trees):
                    refs["resolved"] += 1
                else:
                    refs["unresolved"][t.get("ref")] = refs["unresolved"].get(t.get("ref"), 0) + 1
                if ("as_text", rec["row"]["node_id"]) in self.forced:
                    rec["row"]["kind"] = "action"      # its target did not ship: the printed instruction stays
                elif t.get("kind") == "procedure" and key in procs:
                    rec["row"]["target"] = f"procedure:{procs[key]['proc_id']}"
                elif t.get("kind") == "tree" and key in self.trees:
                    rec["row"]["target"] = f"tree:{self.trees[key]['tree_id']}"
                else:
                    n = json.loads(self.provs[rec["pid"]]["notes"])
                    n["notes"].append(f"target {t.get('ref')!r} is not in this pack; left out")
                    self.provs[rec["pid"]]["notes"] = json.dumps(n, ensure_ascii=False)
                    if rec["raw"].get("kind") == "goto":
                        # never fail a node for a reference: the box is kept as the printed instruction
                        rec["row"]["kind"] = "action"
                        n["notes"].append(f"go-to {t.get('ref')!r} not in this pack: kept as a printed instruction")
                        self.provs[rec["pid"]]["notes"] = json.dumps(n, ensure_ascii=False)

    def standalone_procedures(self) -> None:
        for rec in self.procs:
            if rec.get("used") or rec.get("proc_id"):
                continue
            base = rec["base"]
            proc_id = f"p-{base}"
            self.finish_procedure(rec, None, proc_id, f"{self.cite} {rec['ref'] or (rec['tloc'].text if rec['tloc'] else base)}".strip())

    # ---- helpers --------------------------------------------------------------------------------
    def _expect(self, e: dict | None, p: Prov) -> dict | None:
        if not e:
            return None
        k = e.get("kind")
        if k == "choice":
            opts = [o for o in (e.get("options") or []) if o]
            return {"kind": "choice", "options": opts}
        if k == "value":
            out = {"kind": "value", "unit": e.get("unit") or ""}
            if not out["unit"]:
                p.problems.append("a value question with no unit")
            return out
        if k in ("yes_no", "pass_fail", "ack"):
            return {"kind": k}
        p.problems.append(f"unknown expect kind {k!r}")
        return None

    def _cond(self, c: dict | None, lab: Located | None, p: Prov, bk: int, expect: dict | None) -> dict | None:
        if not c:
            if expect and expect.get("kind") == "value":
                if lab is not None and any(re.fullmatch(r"-?\d+(?:\.\d+)?", x) for x in numbers_in(lab.text)):
                    p.problems.append(f"branch {bk} of a value question: its label {lab.text!r} prints a number "
                                      "but the branch has no numeric condition")
                else:
                    p.notes.append(f"branch {bk} of a value question is categorical ({lab.text if lab else 'no label'!r})")
            return None
        out = {"op": c.get("op")}
        nums = []
        for k in ("value", "min", "max"):
            if c.get(k) is not None:
                out[k] = c[k]
                nums.append(c[k])
        if lab is None:
            p.problems.append(f"branch {bk}: a numeric condition with no printed label to check it against")
        else:
            have = {float(x) for x in numbers_in(lab.text) if re.fullmatch(r"-?\d+(?:\.\d+)?", x)}
            missing = [n for n in nums if float(n) not in have]
            if missing:
                from .rules import outcome_of
                _, printed = outcome_of(lab.text)
                if printed:
                    # the reading's numbers are not the printed ones (e.g. nudged to make ranges meet);
                    # the printed label states the condition itself
                    p.notes.append(f"branch {bk}: condition {out} replaced by the one its label prints {lab.text!r}")
                    return {k: v for k, v in printed.items() if v is not None}
                p.problems.append(f"branch {bk}: condition numbers {missing} are not in its label {lab.text!r}")
        if expect and expect.get("unit") and lab and expect["unit"] not in lab.text:
            p.notes.append(f"branch {bk}: label does not repeat the unit {expect['unit']!r}")
        return out

    def _label(self, expect: dict | None, outcome: str, lab: Located | None, p: Prov, bk: int,
               retry: bool = False) -> str:
        """The branch's label: always a verified printed span. Nothing unprinted ships: a branch the
        manual labels, whose label the reading did not point at on the page, holds its node. The one
        exception is an arrow the manual draws with no label at all (an acknowledged step's single
        onward arrow, or a retry loop): it carries no text of its own, and the app shows it as such."""
        k = (expect or {}).get("kind")
        printed = lab.text if lab else None
        if printed is None and not (k == "ack" or retry):
            p.problems.append(f"branch {bk}: its label {outcome!r} is not a printed span on the page; held")
            return outcome or "?"
        if k in ("yes_no", "pass_fail") and printed and fold(printed) not in {"yes_no": ("yes", "no"),
                                                                             "pass_fail": ("pass", "fail")}[k]:
            # the manual prints the branch as a condition ("If there is no continuity"): the question is a
            # choice of its printed conditions (`_conditions` turns the node into one after its branches)
            p.notes.append(f"branch {bk}: printed as a condition {printed!r}")
            self._conditions = True
            return printed
        if k in ("yes_no", "pass_fail"):
            want = {"yes_no": ("yes", "no"), "pass_fail": ("pass", "fail")}[k]
            o = outcome if outcome in want else (fold(printed) if printed and fold(printed) in want else None)
            if o is None:
                p.problems.append(f"branch {bk}: outcome {outcome!r} is not one of {want}")
                return outcome or "?"
            if printed and fold(printed) != o:
                p.problems.append(f"branch {bk}: printed label {printed!r} says otherwise than outcome {o!r}")
            return printed
        if k == "choice":
            opts = [fold(x) for x in (expect.get("options") or [])]
            if fold(printed) not in opts:
                # the reading named the option in its own words; the printed label is what ships, and the
                # question's options become its printed labels
                p.notes.append(f"branch {bk}: printed label {printed!r} ships, not the reading's option {outcome!r}")
                self._conditions = True
            return printed
        if k == "ack":
            return printed or "Continue"
        return printed if printed is not None else ""

    def _drawn(self, rec: dict) -> list:
        loc = rec.get("loc")
        if not loc:
            return []
        pm = self.models[loc.page]
        return [c for c in pm.connectors if c.tail == loc.region]

    def _check_drawn(self, rec, tgt_rec, lab_loc, label, drawn, p: Prov, bk: int) -> None:
        """An arrow drawn from this node's box: if one carries this branch's label, it must end in the
        target's box; if one ends in the target's box, its label must be this branch's."""
        pm = self.models[rec["loc"].page]
        same_page = tgt_rec["loc"].page == rec["loc"].page
        for c in drawn:
            lab = pm.region(c.label) if c.label else None
            lab_text = fold(pm.region_text(lab)) if lab else None
            if lab_text and lab_text == fold(label) and same_page and c.head and c.head != tgt_rec["loc"].region:
                p.problems.append(f"branch {bk} {label!r}: the drawn arrow with that label ends in {c.head}, "
                                  f"not {tgt_rec['loc'].region}")
            if same_page and c.head == tgt_rec["loc"].region and lab_text and lab_text != fold(label):
                p.problems.append(f"branch {bk}: the drawn arrow to {c.head} is labelled {pm.region_text(lab)!r}, "
                                  f"not {label!r}")

    # ---- index tables ---------------------------------------------------------------------------
    def table_section(self, rid: str, container_rid: str | None, title: str | None) -> dict:
        pm, cell = self.region(rid)
        trid = cell.parent if cell.kind == "cell" and cell.parent else rid
        if trid in self.sections:
            return self.sections[trid]
        treg = pm.region(trid)
        cells = sorted((r for r in pm.regions if r.parent == trid and r.kind == "cell"), key=lambda r: (r.row, r.col))
        rows: dict[int, list[str]] = {}
        for c in cells:
            rows.setdefault(c.row, []).append(pm.region_text(c))
        text = "\n".join(" | ".join(v) for _, v in sorted(rows.items())) if cells else pm.region_text(treg, "\n")
        cap = self._caption_before(pm, treg)
        cap_text = pm.region_text(cap) if cap else (title or "Table")
        rec = {"rid": trid, "sid": self.sid(f"{self.prefix}:{slug(cap_text, 40)}"), "kind": "table",
               "citation": f"{self.cite} {cap_text}".strip(), "heading": cap_text, "text": text,
               "parent_rid": container_rid, "page": pm.index, "label": pm.label, "bbox": treg.bbox, "pm": pm}
        self.sections[trid] = rec
        if cap:
            self.sections[cap.id] = {**rec, "alias_of": trid}
        return rec

    def _caption_before(self, pm: PageModel, treg: Region) -> Region | None:
        cands = [r for r in pm.regions if r.kind == "text" and r.words and r.bbox[3] <= treg.bbox[1] + 1
                 and treg.bbox[1] - r.bbox[3] <= 16]
        return max(cands, key=lambda r: r.bbox[3]) if cands else None

    def index_rows(self) -> None:
        trees = {k: t for k, t in self.trees.items() if t.get("pid")}
        for ctx, s in getattr(self, "_pending_symptoms", []):
            p = Prov()
            self._unit_pages = [int(s.get("title", {}).get("region", "p0").split(".")[0][1:] or 0)] \
                if s.get("title", {}).get("region", "").startswith("p") else []
            loc = self.span(s.get("title"), p, "symptom")
            tr = trees.get(ref_key(s.get("tree_ref")))
            if tr is None:
                p.problems.append(f"symptom points to {s.get('tree_ref')!r}, not a tree in this pack")
            sid = f"s-{slug(loc.text if loc else str(s), 40)}"
            if loc:
                self.table_section(loc.region, self._container_before(loc.region), None)
            row = {"symptom_id": sid, "tree_id": tr["tree_id"] if tr else "", "title": loc.text if loc else "",
                   "system": None, "synonyms": "[]", "lang": "en"}
            pid = self.prov(ctx, "symptom", sid, s, p)
            self.rows.append(("symptom", row, pid))
            if loc:
                self.loc("symptom", sid, "title", loc)
            self.tally("symptom", pid)
        for ctx, c in getattr(self, "_pending_codes", []):
            p = Prov()
            rid = (c.get("code") or {}).get("region", "")
            self._unit_pages = [int(rid.split(".")[0][1:])] if re.match(r"p\d+\.", rid) else []
            cl = self.span(c.get("code"), p, "code")
            ml = self.span(c.get("meaning"), p, "meaning")
            tr = trees.get(ref_key(c.get("tree_ref")))
            node_id = None
            if tr is None:
                p.problems.append(f"code points to {c.get('tree_ref')!r}, not a tree in this pack")
            elif c.get("question"):
                num = str(c["question"]).strip().rstrip(".")
                node_id = next((r["node_id"] for r in tr["nodes"].values()
                                if (r["raw"].get("number") or "").strip().rstrip(".") == num), None)
                if node_id is None:
                    p.problems.append(f"question {num} is not a node of {tr['ref']}")
            sec = self.table_section(cl.region, self._container_before(cl.region), None) if cl else None
            if cl:
                m = _J1939.search(cl.text)
                kind, pattern = ("j1939.dm1", f"spn:{m.group(1)}/fmi:{m.group(2)}") if m else \
                    (self.o.get("signal_kind_default", "display"), cl.text)
            else:
                kind, pattern = "?", "?"
            row = {"signal_kind": kind, "pattern": pattern, "title": ml.text if ml else (cl.text if cl else ""),
                   "tree_id": tr["tree_id"] if tr else "", "node_id": node_id,
                   "section_id": sec["sid"] if sec else None, "quote": cl.text if cl else None}
            pid = self.prov(ctx, "signal_map", f"{kind}:{pattern}", c, p)
            self.rows.append(("signal_map", row, pid))
            if cl:
                self.loc("signal_map", f"{kind}:{pattern}", "code", cl)
            self.tally("signal_map", pid)

    # ---- equipment ------------------------------------------------------------------------------
    def equip(self, ctx: Ctx, e: dict, ek: int) -> None:
        p = Prov()
        nl = self.span(e.get("name"), p, "equipment name")
        if not nl:
            self.report["problems"].append(f"equipment {ek}: {p.problems}")
            return
        parent = e.get("parent")
        if parent:
            pages = {i: self.models[i] for i in self._unit_pages}
            found = any(fold(parent) in fold(" ".join(w.text for w in pm.words)) for pm in pages.values())
            if not found:
                p.notes.append(f"parent {parent!r} is not printed on these pages; dropped")
                parent = None
        eid = slug(nl.text, 40)
        rec = self.equipment.setdefault(eid, {"equip_id": eid, "name": nl.text, "parent": None, "idents": [],
                                              "attrs": [], "ctx": ctx, "prov": p})
        if parent:
            pid_ = slug(parent, 40)
            self.equipment.setdefault(pid_, {"equip_id": pid_, "name": parent, "parent": None, "idents": [],
                                             "attrs": [], "ctx": ctx, "prov": Prov()})
            rec["parent"] = pid_
        ml = self.span(e.get("model"), p, "model") if e.get("model") else None
        if ml:
            rec["idents"].append(("model", ml.text))
        sl = self.span(e.get("serials"), p, "serials") if e.get("serials") else None
        if sl:
            m = _SERIAL.match(sl.text)
            if m and (m.group(1) or "") == (m.group(3) or m.group(1) or ""):
                rec["idents"].append(("serial_range", f"{m.group(1)}{m.group(2)}..{m.group(3) or m.group(1)}{m.group(4)}"))
            else:
                p.notes.append(f"serial range {sl.text!r} not understood; left out")
        for a in e.get("attrs") or []:
            al = self.span(a.get("value"), p, f"attr {a.get('key')}")
            if al and a.get("key"):
                rec["attrs"].append((slug(a["key"], 30).replace("-", "_"), al.text))

    def resolve_applies(self) -> None:
        """Applicability as printed (applic.py): a statement names variants by their distinguishing words
        or serial range, and applies to what it is printed on. A model's applicability span counts only
        when it is a statement; statements the reading did not attach are scoped by position."""
        from .applic import Variants, prefix_statement, statement
        leaves = [e for e in self.equipment.values() if e["parent"] and not e.get("_serial_child")]
        v = Variants(leaves)
        v.effectivity([pm.region_text(r) for pm in self.models.values() for r in pm.regions if r.words])
        used: set = set()

        def targets(st: dict) -> list[str]:
            if st["serial"] and v.serial:
                parts = dict(v.by_serial(st["serial"]))
                pick = st["named"] or list(parts)
                out = []
                for eid in pick:
                    if eid not in parts:
                        continue
                    out.append(self._serial_child(eid, parts[eid]) if parts[eid] else eid)
                return out
            return list(st["named"])

        def emit(ctx, sp, ref_kind, ref_id, key, hits, p):
            for eid in hits:
                row = {"ref_kind": ref_kind, "ref_id": ref_id, "equip_id": eid}
                pid = self.prov(ctx, "applies_to", f"{ref_kind}:{ref_id}:{eid}", sp, p)
                self.rows.append(("applies_to", row, pid))
                self.tally("applies_to", pid)

        # position first: every printed statement scoped by where it is printed
        self._printed_applies(v, targets, emit, used)
        for ctx, sp, ref_kind, ref_id, key, pages in getattr(self, "_pending_applies", []):
            self._unit_pages = pages
            p = Prov()
            loc = self.span(sp, p, f"applies {key}")
            hits = []
            if loc and sp.get("_equip"):      # the source says which variants (S1000D applic asserts)
                hits = [e for e in sp["_equip"] if e in self.equipment]
                p.notes.extend(sp.get("_ev") or [])
            elif loc:
                pm = self.models[loc.page]
                reg = pm.region(loc.region)
                line = next((ln for ln in (reg.lines or [reg.words]) if set(ln) & set(loc.words)), loc.words)
                ltext = " ".join(pm.words[i].text for i in line)
                m = re.search(r"\(([^()]{2,80})\)\s*$", ltext)
                st = statement(ltext, v) or (prefix_statement(ltext, v) or (None,))[0] or \
                    (statement(m.group(1), v) if m else None)
                if st is None:
                    p.notes.append(f"{ltext[:60]!r} is not an applicability statement: nothing scoped")
                elif (loc.page, line[0]) in used:
                    p.notes.append("scoped by where it is printed")
                else:
                    hits = targets(st)
            emit(ctx, sp, ref_kind, ref_id, key, hits, p)

    def _serial_child(self, eid: str, rng: tuple[int, int]) -> str:
        """A variant restricted to part of its serial range, as a child the engine resolves by plate."""
        par = self.equipment[eid]
        lo, hi = rng
        open_end = hi == 10 ** len(str(hi)) - 1
        cid = f"{eid}.sn{lo}-{'up' if open_end else hi}"
        if cid not in self.equipment:
            span = f"{lo} and subsequent" if open_end else f"{lo} through {hi}"
            self.equipment[cid] = {"equip_id": cid, "name": f"{par['name']}, serial numbers {span}", "parent": eid,
                                   "idents": [("serial_range", f"{lo}..{hi}")], "attrs": [], "ctx": par.get("ctx"),
                                   "prov": par.get("prov"), "_serial_child": True}
        return cid

    def _printed_applies(self, v, targets, emit, used: set) -> None:
        """Statements printed on the pages that no reading attached, scoped by where they are printed:
        inside a question box -> that question; leading a step or inside it -> that step; a line of its
        own under a procedure, sub-procedure or tree title (before its first step) -> that procedure or
        tree; inside a WARNING / CAUTION / NOTE -> what that block guards."""
        from .applic import prefix_statement, statement
        if not v.leaves:
            return
        locs: dict[tuple, list] = {}
        for t in self.text_locs:
            locs.setdefault((t["page_index"], t["region_id"]), []).append(t)
        sec_of_step = {}
        for kind, row, pid in self.rows:
            if kind == "proc_step":
                for sid in json.loads(row["section_ids"] or "[]"):
                    sec_of_step[f"{row['proc_id']}#{row['ord']}"] = sid
        node_sec = {row["node_id"]: row["section_id"] for kind, row, pid in self.rows if kind == "fault_node"}
        ok_pids = {pid for _, _, pid in self.rows if self.provs.get(pid, {}).get("verdict") != "fail"}
        ok = {(k, (r.get("node_id") or r.get("proc_id") or r.get("tree_id"))) for k, r, pid in self.rows
              if pid in ok_pids and k in ("fault_node", "procedure", "fault_tree")}
        proc_node = {row["proc_id"]: row["node_id"] for kind, row, pid in self.rows
                      if kind == "fault_node" and row.get("proc_id")}
        guard_targets: dict[str, list] = {}
        for kind, row, pid in self.rows:
            if kind == "xref" and row.get("kind") == "guards" and pid in ok_pids:
                guard_targets.setdefault(row["from_id"], []).append(row["to_id"])
        titles = [t for t in self.text_locs if t["field"] == "title" and t["ref_kind"] in ("procedure", "fault_tree")]
        firsts = {}
        for t in self.text_locs:
            if t["ref_kind"] == "proc_step":
                pid_, _ = t["ref_id"].split("#")
                b = _bx(t["bbox"])
                cur = firsts.get(pid_)
                if cur is None or (t["page_index"], b[1]) < cur:
                    firsts[pid_] = (t["page_index"], b[1])
        ctx = next((c for c, *_ in getattr(self, "_pending_applies", [])), None) or getattr(self, "_last_ctx", None)
        if ctx is None:
            return
        for idx, pm in self.models.items():
            for r in pm.regions:
                if not r.words or r.kind in ("header", "footer"):
                    continue
                for ln in r.lines or [r.words]:
                    text = " ".join(pm.words[i].text for i in ln)
                    st = statement(text, v)
                    if st and len(r.lines or []) > 1:
                        # a line of its own only in a block without prose: a wrapped sentence that happens
                        # to end in a model name is not a statement
                        from .subproc import is_heading
                        others = [" ".join(pm.words[i].text for i in x) for x in r.lines if x is not ln]
                        if any(not (statement(o, v) or is_heading(o, False)) for o in others):
                            st = None
                    pre = None if st else prefix_statement(text, v)
                    paren = None
                    if not st and not pre:
                        m = re.search(r"\(([^()]{2,80})\)\s*$", text)
                        paren = statement(m.group(1), v) if m else None
                        if not paren:
                            continue
                        st = paren
                    st = st or pre[0]
                    ws = [pm.words[i] for i in ln]
                    box = _bx(json.dumps(pm.norm_box((min(w.x0 for w in ws), min(w.top for w in ws),
                                                      max(w.x1 for w in ws), max(w.bottom for w in ws)))))
                    scope = self._applies_scope(idx, r, box, bool(pre), locs, titles, firsts, guard_targets,
                                                bool(paren), proc_node)
                    if not scope:
                        continue
                    used.add((idx, ln[0]))
                    hits = targets(st)
                    sp = {"region": r.id, "text": text}
                    p = Prov(notes=[f"printed statement {text[:60]!r} scoped by position to {scope[0]}"])
                    for ref_kind, ref_id in scope[1]:
                        if ref_kind in ("fault_node", "procedure", "fault_tree") and (ref_kind, ref_id) not in ok:
                            continue
                        if ref_kind != "proc_step":
                            emit(ctx, sp, ref_kind, ref_id, f"printed:{r.id}", hits, p)
                        if ref_kind == "fault_node" and node_sec.get(ref_id):
                            emit(ctx, sp, "section", node_sec[ref_id], f"printed:{r.id}", hits, p)
                        if ref_kind == "proc_step" and sec_of_step.get(ref_id):
                            emit(ctx, sp, "section", sec_of_step[ref_id], f"printed:{r.id}", hits, p)

    def _applies_scope(self, idx, r, box, prefix, locs, titles, firsts, guard_targets, paren=False, proc_node=None):
        here = locs.get((idx, r.id), [])
        if paren:
            # "(DGT-30 ONLY)" closing a printed title: that procedure or tree, and the question a test
            # procedure answers
            for t in here:
                if t["field"] == "title" and t["ref_kind"] in ("procedure", "fault_tree"):
                    out = [(t["ref_kind"], t["ref_id"])]
                    if t["ref_kind"] == "procedure" and (proc_node or {}).get(t["ref_id"]):
                        out.append(("fault_node", proc_node[t["ref_id"]]))
                    return ("title", out)
            return None
        # a table row: a statement in a column, on the printed line of a row's code
        for (pg, _), ts in locs.items():
            if pg != idx:
                continue
            for t in ts:
                if t["ref_kind"] == "signal_map":
                    b = _bx(t["bbox"])
                    if abs((b[1] + b[3]) / 2 - (box[1] + box[3]) / 2) < 0.4 * max(b[3] - b[1], 0.004) \
                            and (pg, r.id) != (pg, t["region_id"]):
                        return ("table row", [("signal_map", t["ref_id"])])

        def inside(t):
            b = _bx(t["bbox"])
            return b[1] - 0.002 <= box[1] and box[3] <= b[3] + 0.002 or (b[1] <= box[3] and box[1] <= b[3])
        for kind in ("fault_node", "proc_step"):
            cands = [t for t in here if t["ref_kind"] == kind and t["field"] == "text"]
            if prefix:
                # the step or box whose printed text starts on this line
                cands = [t for t in cands if abs(_bx(t["bbox"])[1] - box[1]) < 0.006]
            else:
                cands = [t for t in cands if inside(t)]
            if cands:
                def ov(t):
                    b = _bx(t["bbox"])
                    return min(b[3], box[3]) - max(b[1], box[1])
                t = max(cands, key=ov)
                if kind == "proc_step":
                    return ("step", [("proc_step", t["ref_id"])])
                return ("question", [("fault_node", t["ref_id"])])
        sec = self.sections.get(r.id)
        if sec and sec.get("kind") in ("warning", "caution", "note"):
            tg = guard_targets.get(sec["sid"])
            if tg:
                return ("guarded", [("section", x) for x in tg])
        # a line of its own: the nearest title above it on its page, before that procedure's first step
        above = []
        for t in titles:
            if t["page_index"] != idx:
                continue
            b = _bx(t["bbox"])
            if b[1] <= box[1] + 0.002:
                first = firsts.get(t["ref_id"])
                if t["ref_kind"] == "procedure" and first and (first[0], first[1]) < (idx, box[1]):
                    continue
                above.append((b[1], t))
        if above:
            t = max(above, key=lambda x: x[0])[1]
            return ("title", [(t["ref_kind"], t["ref_id"])])
        return None

    # ---- leftovers and writing ------------------------------------------------------------------
    def leftovers(self) -> None:
        """Every unclaimed text region becomes a paragraph under the nearest earlier section's container."""
        claimed = sorted(self.sections, key=lambda r: self.order.get(r, 0))
        for pm in self.models.values():
            for r in pm.regions:
                if r.id in self.sections or not r.words or r.kind in ("header", "footer", "table"):
                    continue
                if r.id in self.consumed_labels:
                    continue
                if r.kind == "cell" and r.parent:
                    self.table_section(r.id, self._container_before(r.id), None)
                    continue
                pos = self.order[r.id]
                prev = [c for c in claimed if self.order.get(c, 0) < pos]
                parent = None
                for c in reversed(prev):
                    sec = self.sections[c]
                    if sec["kind"] in ("chapter", "section", "table"):
                        parent = sec["rid"] if sec["kind"] != "table" else sec.get("parent_rid")
                        break
                    if sec.get("parent_rid"):
                        parent = sec["parent_rid"]
                        while parent and self.sections.get(parent, {}).get("kind") in ("step", "paragraph"):
                            parent = self.sections[parent].get("parent_rid")
                        break
                text = pm.region_text(r)
                kind = "figure" if r.kind == "figure" else "paragraph"
                if re.match(r"^(Figure|FIGURE)\s+\S+", text) and r.kind == "text":
                    kind = "figure"
                base = f"{self.sections[parent]['sid']}-p" if parent in self.sections else f"{self.prefix}:p{pm.index + 1}"
                cit = self.sections[parent]["citation"] if parent in self.sections else f"{self.cite} page {pm.label}".strip()
                self.claim(r.id, kind, base, cit, parent_rid=parent)
                claimed.append(r.id)
                claimed.sort(key=lambda x: self.order.get(x, 0))

    def write(self, assets: dict[int, str] | None = None) -> dict:
        """Sections (as a parsed doc), locations, then every generated row and its provenance."""
        st = self.stage
        nodes: dict[str, SecNode] = {}
        real = {rid: s for rid, s in self.sections.items() if not s.get("alias_of")}
        for rid, s in sorted(real.items(), key=lambda kv: self.order.get(kv[0], 0)):
            nodes[rid] = SecNode(s["sid"], s["kind"], s["citation"], heading=s["heading"], own_text=s["text"])
        roots = []
        for rid, s in sorted(real.items(), key=lambda kv: self.order.get(kv[0], 0)):
            par = s.get("parent_rid")
            while par and par in self.sections and self.sections[par].get("alias_of"):
                par = self.sections[par]["alias_of"]
            if par and par in nodes and par != rid:
                nodes[par].add(nodes[rid])
            else:
                roots.append(nodes[rid])
        doc = ParsedDoc(self.source_id, roots)
        st.add_doc(doc)
        for rid, s in real.items():
            pm = s["pm"]
            fig = None
            if s["kind"] == "figure":
                m = re.match(r"^((?:Figure|FIGURE)\s+[A-Z0-9][\w.\-]*?)\.?(?:\s|$)", s["text"])
                fig = m.group(1) if m else None
            st.conn.execute("INSERT OR REPLACE INTO section_loc (section_id, page_label, page_index, figure_label, boxes)"
                            " VALUES (?,?,?,?,?)", (s["sid"], pm.label, pm.index + 1, fig,
                                                    json.dumps([pm.norm_box(s["bbox"])])))
            st.conn.execute("INSERT OR IGNORE INTO _text_loc VALUES (?,?,?,?,?,?,?,?)",
                            ("section", s["sid"], "region", self.source_id, pm.index, pm.label, rid,
                             json.dumps(pm.norm_box(s["bbox"]))))
            if assets and pm.index in assets:
                st.conn.execute("INSERT OR IGNORE INTO section_asset VALUES (?,?,?)", (s["sid"], assets[pm.index], "page"))
        for pr in self.provs.values():
            st.add_provenance(pr)
        cols_cache: dict[str, list[str]] = {}
        for table, row, pid in self.rows:
            if table not in cols_cache:
                from ..schema import table_columns
                cols_cache[table] = table_columns(st.conn, table)
            r = dict(row)
            if "prov_id" in cols_cache[table]:
                r["prov_id"] = pid
            st.insert(table, r, prov_id=pid if "prov_id" not in cols_cache[table] else None)
        for t in self.text_locs:
            st.conn.execute("INSERT OR REPLACE INTO _text_loc VALUES (?,?,?,?,?,?,?,?)",
                            (t["ref_kind"], t["ref_id"], t["field"], t["source_id"], t["page_index"], t["page_label"],
                             t["region_id"], t["bbox"]))
        for e in self.equipment.values():
            st.conn.execute("INSERT OR IGNORE INTO equipment (equip_id, parent_id, name, aliases) VALUES (?,?,?,?)",
                            (e["equip_id"], e["parent"], e["name"], "[]"))
            for kind, pat in e["idents"]:
                st.conn.execute("INSERT OR IGNORE INTO equip_ident VALUES (?,?,?)", (e["equip_id"], kind, pat))
            for k, v in e["attrs"]:
                st.conn.execute("INSERT OR IGNORE INTO equip_attr VALUES (?,?,?)", (e["equip_id"], k, v))
        st.commit()
        for pr in self.provs.values():
            self.report["verdicts"][pr["verdict"]] += 1
        return self.report
