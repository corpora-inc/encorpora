"""What a guard guards, when position alone does not settle it.

A reading attaches each WARNING, CAUTION or NOTE to a target. Position says which targets are
plausible for a block:
- the next step or question below it;
- the question box it sits beside;
- the sub-procedure under the nearest heading above it;
- the whole task;
- the table row it sits in.

Steps and questions are placed by their own verified spans, not their regions: one printed region
often holds several of them. When those candidates and the reading's own choice collapse to one, or
position supports the reading's choice, nothing is asked. Otherwise a closed question goes to a
model: the candidates are numbered options and the model can only choose among them. An answer
that differs from the reading moves the guard and sends it to review: two readings disagree, so a
person decides. The layout-plausibility check (`Assembly.plausibility`) still runs afterwards as
the keyless cross-check, and a placement the page geometry contradicts goes to review.

A guard that ends on a step or question sharing its region with others gets that item's own section
(a span of exactly its words), so the guard names one step, not the region.

Answers come from a response cache; `harvest-bake maint targets` fills it, and a build only reads it.
On a cache miss the reading's choice stands.
"""

from __future__ import annotations

import json
import sys
import time
from dataclasses import dataclass, field
from pathlib import Path

from ..cache import ResponseCache
from ..textutil import sha256_json
from .rules import Question

TASK = "maint.targets"
VERSION = "1"
SYSTEM = ("You answer closed questions about the layout of pages from a technical maintenance manual. Each question "
          "names a WARNING, CAUTION or NOTE block and lists the things it might apply to, as numbered options. "
          "Answer each with the number of the option the block applies to, as a technician reading the page would "
          "understand it. Use the region ids and positions (points from the top-left) to judge what sits above, "
          "below or beside what.")


@dataclass
class Candidate:
    tag: str                     # read | next | beside | sub | task | row | table
    label: str
    sec: dict | None = None      # a section target (a task, sub-procedure, table, row) ...
    item: str | None = None      # ... or a step or question (Assembly.items key)

    def same(self, o: "Candidate") -> bool:
        return (self.item is not None and self.item == o.item) or (self.item is None and o.item is None
                                                                  and self.sec is o.sec)


@dataclass
class Ask:
    info: dict                   # the guard as assembled (Assembly.guard_info entry)
    cands: list[Candidate]
    question: Question
    pages: list[int] = field(default_factory=list)


def _clip(t: str) -> str:
    return " ".join((t or "").split())[:90]


def _sec_text(sec: dict) -> str:
    return _clip(sec.get("heading") or sec.get("text"))


def _overlap(a, b) -> float:
    return min(a[3], b[3]) - max(a[1], b[1])


def _item_pos(asm, it: dict) -> tuple:
    loc = it["loc"]
    return (asm.order.get(loc.region, 0), loc.words[0] if loc.words else 0)


def candidates(asm, info: dict) -> tuple[list[Candidate], bool]:
    """The targets position makes plausible for one guard, the reading's own choice first; and whether
    position supports the reading's choice (then nothing is asked)."""
    gp, gb = info["page"], info["bbox"]
    gpos = (asm.order.get(info["region"], 0), info["word0"])
    items = asm.items
    out: list[Candidate] = []

    def add(c: Candidate | None):
        if c is not None and not any(c.same(o) for o in out):
            out.append(c)

    def of_item(tag: str, key: str | None, what_step: str, what_node: str) -> Candidate | None:
        if key is None or key not in items:
            return None
        it = items[key]
        return Candidate(tag, f"{what_node if it['kind'] == 'node' else what_step}: {_clip(it['loc'].text)}", item=key)

    def of_sec(tag: str, sec: dict | None, what: str) -> Candidate | None:
        return Candidate(tag, f"{what}: {_sec_text(sec)}", sec=sec) if sec is not None else None

    # the reading's choice: the step or question it named, else the section
    read = info["target"]
    if info.get("item") in items:
        add(of_item("read", info["item"], "the step", "the question box"))
    else:
        add(of_sec("read", read, {"section": "the task", "chapter": "everything under the heading",
                                  "table": "the table", "step": "the step"}.get(read["kind"], f"the {read['kind']}")))
    # the next step or question below it, in reading order (this page, else the top of the next)
    here = [(k, it) for k, it in items.items() if it["loc"].page == gp]
    after = sorted(((k, it) for k, it in here if _item_pos(asm, it) > gpos), key=lambda kv: _item_pos(asm, kv[1]))
    if not after:
        after = sorted(((k, it) for k, it in items.items() if it["loc"].page == gp + 1),
                       key=lambda kv: _item_pos(asm, kv[1]))
    nxt = after[0][0] if after else None
    # the box it sits beside: a step or question at the same height, left or right of it
    side = [(k, it) for k, it in here
            if _overlap(it["loc"].bbox, gb) > 0.5 * min(it["loc"].bbox[3] - it["loc"].bbox[1], gb[3] - gb[1])
            and (it["loc"].bbox[2] <= gb[0] + 2 or it["loc"].bbox[0] >= gb[2] - 2)]
    beside = min(side, key=lambda kv: min(abs(kv[1]["loc"].bbox[0] - gb[2]), abs(gb[0] - kv[1]["loc"].bbox[2])))[0] \
        if side else None
    # the nearest title above it, and the whole task it belongs to
    secs = list(asm.sections.values())
    titles = [s for s in secs if s["kind"] == "section" and asm.order.get(s["rid"], 0) < gpos[0]
              and gp - 2 <= s["page"] <= gp]
    near = max(titles, key=lambda s: asm.order.get(s["rid"], 0)) if titles else None
    top = near
    while top is not None and top.get("parent_rid") in asm.sections and asm.sections[top["parent_rid"]]["kind"] == "section":
        top = asm.sections[top["parent_rid"]]
    # the table it sits in, and the row whose text carries its words
    row = table = None
    cx, cy = (gb[0] + gb[2]) / 2, (gb[1] + gb[3]) / 2
    for t in secs:
        if t["kind"] == "table" and t["page"] == gp and t["bbox"][0] <= cx <= t["bbox"][2] and t["bbox"][1] <= cy <= t["bbox"][3]:
            table = t
            words = " ".join((info["gsec"].get("text") or "").lower().split()[:5])
            row = next((r for r in secs if r.get("parent_rid") == t["rid"] and words
                        and words in " ".join((r.get("text") or "").lower().split())), None)
            break

    add(of_item("beside", beside, "the step beside it", "the question box beside it"))
    add(of_item("next", nxt, "the next step", "the next question"))
    if near is not None and near is not top:
        add(of_sec("sub", near, "the sub-procedure"))
    add(of_sec("task", top, "the whole task"))
    add(of_sec("row", row, "the table row"))
    if row is None:
        add(of_sec("table", table, "the table"))

    # position supports the reading when it named the step or question right below the block or beside it,
    # the table or row the block sits in, or a task or sub-procedure whose title is above the block and whose
    # first step is below it
    first = None
    if near is not None:
        under = [it for it in items.values() if it["sec"].get("parent_rid") == near["rid"]]
        first = min((_item_pos(asm, it) for it in under), default=None)
    r = out[0]
    supported = ((r.item is not None and r.item in (nxt, beside))
                 or (r.item is None and r.sec is not None and r.sec in [x for x in (row, table) if x is not None])
                 or (r.item is None and r.sec is not None and near is not None and r.sec in (near, top)
                     and (first is None or gpos < first)))
    return out, supported


def questions(asm) -> list[Ask]:
    """One closed question per guard whose target position does not settle."""
    asks = []
    stats = asm.report.setdefault("targets", {"guards": 0, "settled": 0, "asked": 0, "answered": 0, "moved": 0,
                                               "missing": 0, "own_section": 0})
    for info in asm.guard_info:
        stats["guards"] += 1
        cands, supported = candidates(asm, info)
        if len(cands) < 2 or supported:
            stats["settled"] += 1          # one candidate, or position agrees with the reading
            continue
        g = info["gsec"]
        word = (g.get("heading") or g["kind"]).upper()
        q = Question(f"tg-{g['sid']}", f"Which does the {word} block ({info['region']}: \"{_clip(g.get('text'))}\") "
                                       f"apply to?", [c.label for c in cands], 0, "target", {})
        pages = sorted({info["page"]} | {(asm.items[c.item]["loc"].page if c.item else c.sec["page"]) for c in cands})
        asks.append(Ask(info, cands, q, pages))
    stats["asked"] = len(asks)
    return asks


def _requests(asm, asks: list[Ask], images: bool = False):
    """One request per unit: its asked pages as the model reads them (with their page images when the
    resolver reads images), and its questions."""
    from . import resolve
    by_unit: dict[str, list[Ask]] = {}
    for a in asks:
        by_unit.setdefault(a.info["unit"], []).append(a)
    for unit, group in sorted(by_unit.items()):
        pages = sorted({p for a in group for p in a.pages})
        req = resolve.request([a.question for a in group], resolve.pages_text(pages, {p: asm.models[p] for p in pages}))
        req.system = SYSTEM
        if images:
            req.images = [("image/webp", Path(asm.models[p].image).read_bytes()) for p in pages
                          if asm.models[p].image and Path(asm.models[p].image).exists()]
        yield unit, group, req


def answer(asm, author: dict | None, cache_dir: Path | None, call: bool = False, ledger=None,
           log=sys.stderr) -> dict:
    """Ask (or look up) every open question and move the guards the answers move; then give each guard on a
    shared-region step or question that item's own section. Returns the stats."""
    asks = questions(asm)
    stats = asm.report["targets"]
    if asks and author and cache_dir is not None:
        _ask(asm, asks, author, cache_dir, call, ledger, log, stats)
    else:
        stats["missing"] = len(asks)
    for info in asm.guard_info:
        key = info.get("item")
        if key in asm.items and _shared(asm, key):
            if move(asm, info, own_section(asm, key), "the guard names one step of a region that holds several"):
                stats["own_section"] += 1
    return stats


def _ask(asm, asks, author, cache_dir, call, ledger, log, stats) -> None:
    from ..backends import BackendError, Runner, UsageLimitReached, make_backend
    from .extract import Arm, _now
    images = bool(author.get("images"))
    author = {k: v for k, v in author.items() if k != "images"}
    spec = Arm("targets", author, images=images).spec
    stats["spec"] = spec
    cache = ResponseCache(cache_dir)
    backend = make_backend(author) if call else None
    runner = Runner(backend, 1) if backend else None
    usage = stats.setdefault("usage", {"calls": 0, "cached": 0, "input_tokens": 0, "output_tokens": 0, "seconds": 0.0})
    try:
        for unit, group, req in _requests(asm, asks, images):
            isha = sha256_json({"system": req.system, "schema": req.schema, "prompt": req.prompt})
            hit = cache.get(TASK, VERSION, isha, spec)
            if hit is not None:
                ans = hit["output"]["answers"]
                u = hit.get("usage") or {}
                usage["cached"] += 1
            elif runner is not None:
                t0 = time.monotonic()
                try:
                    resp = runner.call(req)
                except (BackendError, UsageLimitReached) as e:
                    print(f"[targets] {unit}: {e}", file=log)
                    stats["missing"] += len(group)
                    continue
                u = {**resp.usage, "seconds": round(time.monotonic() - t0, 2)}
                ans = resp.output["answers"]
                cache.put({"task": TASK, "prompt_version": VERSION, "input_sha256": isha, "model": spec, "key": unit,
                           "backend": backend.name, "model_id": resp.model_id, "created_at": _now(),
                           "output": resp.output, "usage": u})
                usage["calls"] += 1
                if ledger:
                    ledger.add({"at": _now(), "arm": f"targets:{spec}", "backend": backend.name, "model": resp.model_id,
                                "unit": unit, "questions": len(group), "input_tokens": u.get("input_tokens", 0),
                                "output_tokens": u.get("output_tokens", 0),
                                "cost_usd": round(float(u.get("cost_usd", 0.0)), 6), "seconds": u["seconds"]})
            else:
                stats["missing"] += len(group)
                continue
            for k in ("input_tokens", "output_tokens", "seconds"):
                usage[k] += u.get(k, 0) or 0
            for a in group:
                choice = ans.get(a.question.id)
                if choice is None or not 0 <= int(choice) < len(a.cands):
                    stats["missing"] += 1
                    continue
                stats["answered"] += 1
                c = a.cands[int(choice)]
                if c.same(a.cands[0]):
                    continue
                why = f"closed question {a.question.id}: {spec} chose {c.label[:70]!r}"
                a.info["item"] = c.item
                if move(asm, a.info, asm.items[c.item]["sec"] if c.item else c.sec, why):
                    # the reading and the question disagree: a person decides, whatever the geometry says
                    asm.review(a.info["pid"], f"the reading and a closed question disagree on what it guards ({why})")
                    stats["moved"] += 1
                    stats.setdefault("moved_to", {}).setdefault(c.tag, 0)
                    stats["moved_to"][c.tag] += 1
    finally:
        cache.close()


def _shared(asm, key: str) -> bool:
    sec = asm.items[key]["sec"]
    return sum(1 for it in asm.items.values() if it["sec"] is sec) > 1


def own_section(asm, key: str) -> dict:
    """A step or question's own section when its region holds others too: exactly its words, under the
    region's section; its row points at it."""
    it = asm.items[key]
    if "own" not in it:
        own = asm.claim_span(it["loc"], "step", it["sid_base"], it["citation"], parent_rid=it["sec"]["rid"])
        it["row"][it["field"]] = json.dumps([own["sid"]]) if it["field"] == "section_ids" else own["sid"]
        it["own"] = own
    return it["own"]


def move(asm, info: dict, sec: dict, why: str) -> bool:
    """Point a guard at another section; the plausibility check that follows judges the new placement."""
    if sec is info["target"]:
        return False
    info["row"]["to_id"] = sec["sid"]
    asm.guard_recs = [(pid, grid, sec if pid == info["pid"] else t) for pid, grid, t in asm.guard_recs]
    info["target"] = sec
    pr = asm.provs.get(info["pid"])
    if pr is not None:
        n = json.loads(pr["notes"])
        n.setdefault("notes", []).append(why)
        pr["notes"] = json.dumps(n, ensure_ascii=False)
    return True
