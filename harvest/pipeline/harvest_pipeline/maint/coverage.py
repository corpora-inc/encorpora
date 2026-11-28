"""Coverage, with no model: of the WARNING, CAUTION and NOTE blocks and the question boxes printed on
the ingested pages, how many reached the pack intact and attached.

Counted from the page model alone:
  * a guard block is a region whose first line is WARNING, CAUTION, NOTE or DANGER (a ruled box
    or a text block), or a text block that opens with one of those words and a colon;
    A heading printed as its own line above the body (the page model splits them) is one block.
  * a question box is a ruled box that two or more drawn arrows touch (leave or reach: a missed
    arrow tail must not hide a box), or whose text is a question ("3. Is more than 10 V present ...?",
    or any boxed text ending in "?").
No rate passes on an empty denominator: with nothing found the rate is null and `sanity` says why;
a page model that draws arrows but yields no question box is a failure, not 100%.
In the pack:
  * a guard block is attached when its region's section is a warning, caution or note whose text
    is the block's words (heading aside) and a shipped `guards` xref leads from it to a section;
  * a question box is attached when a shipped fault node cites its region's section.
Reads the pack's SQLite file directly (an evaluation tool).
"""

from __future__ import annotations

import json
import re
from pathlib import Path

from ..corpus import Corpus
from ..textutil import norm_ws
from .build import sources
from .blocks import _DEFINES, canon, class_of_block
from .score import _db


def _only_word(pm, r) -> bool:
    t = re.sub(r"[^A-Za-z ]", " ", pm.region_text(r)).split()
    return len(t) == 1 and canon(t[0]) is not None

QUESTION = re.compile(r"^\s*(?:STEP\s+)?\d+[.)]\s+.*\?\s*$", re.S)


def guard_blocks(pm) -> list[tuple[str, object, int | None, str]]:
    """The WARNING, CAUTION, NOTE ... blocks printed on a page, from the page model alone:
    (class, region, k, text) where k is the k-th block opened inside a longer region (None: the
    region is the block)."""
    out = []
    heading_only = {r.id for r in pm.regions if r.words and pm.region_text(r).strip().rstrip(":").upper() in
                    ("WARNING", "CAUTION", "NOTE", "DANGER", "WARNINGS", "CAUTIONS", "NOTES")}
    for r in pm.regions:
        if not r.words or r.kind in ("header", "footer") or r.id in heading_only:
            continue
        lines = [" ".join(pm.words[i].text for i in ln) for ln in r.lines]
        first = lines[0].strip() if lines else ""
        # blocks opened by a class word inside a longer region ("... NOTE: A battery ..."), one per line
        inner = [ln for ln in r.lines[1:] if ln and canon(pm.words[ln[0]].text)
                 and pm.words[ln[0]].text.rstrip().endswith((":", ".")) and len(ln) > 2]
        for k, ln in enumerate(inner):
            out.append((canon(pm.words[ln[0]].text).lower(), r, k, " ".join(pm.words[i].text for i in ln)))
        cw = None if (_only_word(pm, r) or _DEFINES.match(first)) else class_of_block(pm, r)
        if cw and len(pm.region_text(r).split()) >= 3:
            out.append((cw["word"].lower(), r, None, f"{cw['printed']} {pm.region_text(r)}"))
    return out


def question_boxes(pm) -> list:
    """The question boxes printed on a page: a ruled box two or more drawn arrows touch, or whose text
    is a question."""
    ends: dict[str, int] = {}
    for cn in pm.connectors:
        for end in {cn.tail, cn.head} - {None}:
            ends[end] = ends.get(end, 0) + 1
    out = []
    for r in pm.regions:
        if not r.words or r.kind != "box":
            continue
        text = " ".join(" ".join(pm.words[i].text for i in ln) for ln in r.lines)
        if ends.get(r.id, 0) >= 2 or QUESTION.match(text) or text.rstrip().endswith("?"):
            out.append(r)
    return out


WARNING_CLASSES = ("warning", "caution", "danger", "notice")


def coverage(corpus: Corpus, pack_dir: Path) -> dict:
    srcs = sources(corpus, log=None)
    regions_file = pack_dir.parent / f"{pack_dir.name}.regions.json"
    sec_of: dict[tuple, str] = {}
    spans_of: dict[tuple, list] = {}
    if regions_file.exists():
        for sid, r in json.loads(regions_file.read_text()).items():
            sec_of[(r["source"], r["region"])] = sid
            if "@" in r["region"]:            # a block's own section inside a shared region
                spans_of.setdefault((r["source"], r["region"].split("@")[0]), []).append(sid)
    c = _db(pack_dir)
    has = lambda t: c.execute("SELECT 1 FROM sqlite_master WHERE name=?", (t,)).fetchone() is not None  # noqa: E731
    secs = {r[0]: (r[1], r[2]) for r in c.execute("SELECT section_id, kind, text FROM section")}
    guards_from = {r[0] for r in c.execute("SELECT from_id, to_id FROM xref WHERE kind='guards'") if r[1] in secs}
    node_secs = {r[0]: r[1] for r in c.execute("SELECT section_id, kind FROM fault_node")} if has("fault_node") else {}
    out = {"guards": {}, "questions": {"present": 0, "attached": 0, "missing": []}, "pages": 0}
    nonguard = ("paragraph", "step", "section", "chapter", "table", "figure")
    for rec, models, _ in srcs:
        sid_ = rec["source_id"]
        for pm in models:
            out["pages"] += 1
            out["arrow_pages"] = out.get("arrow_pages", 0) + bool(pm.connectors)
            for kind, r, k, text in guard_blocks(pm):
                where = f"{pm.label or pm.index} {r.id}"
                g = out["guards"].setdefault(kind, {"present": 0, "attached": 0, "missing": []})
                g["present"] += 1
                if k is not None:
                    spans = [x for x in spans_of.get((sid_, r.id), []) if x in secs and x in guards_from]
                    ok = k < len(spans)
                else:
                    cands = [sec_of.get((sid_, r.id))] + spans_of.get((sid_, r.id), [])
                    ok = any(x and x in secs and secs[x][0] not in nonguard and x in guards_from for x in cands)
                if ok:
                    g["attached"] += 1
                else:
                    g["missing"].append(f"{where}: {text[:60]}")
            for r in question_boxes(pm):
                q = out["questions"]
                q["present"] += 1
                sec = sec_of.get((sid_, r.id))
                if sec and sec in node_secs:
                    q["attached"] += 1
                else:
                    q["missing"].append(f"{pm.label or pm.index} {r.id}: {pm.region_text(r)[:70]}")
    wc = [v for k, v in out["guards"].items() if k in WARNING_CLASSES]
    present = sum(v["present"] for v in wc)
    attached = sum(v["attached"] for v in wc)
    out["warnings_cautions"] = {"present": present, "attached": attached,
                                "rate": round(attached / present, 4) if present else None}
    allg = list(out["guards"].values())
    out["all_guards"] = {"present": sum(v["present"] for v in allg), "attached": sum(v["attached"] for v in allg)}
    q = out["questions"]
    q["rate"] = round(q["attached"] / q["present"], 4) if q["present"] else None
    sanity = []
    if not q["present"] and out.get("arrow_pages"):
        sanity.append(f"{out['arrow_pages']} pages draw arrows but no question box was found: the page model "
                      "does not see this manual's flowcharts")
    if not present and not out["all_guards"]["present"] and out["pages"] >= 5:
        sanity.append(f"no WARNING, CAUTION or NOTE block found on {out['pages']} pages")
    out["sanity"] = sanity
    return out


def format_coverage(r: dict) -> str:
    wc = r["warnings_cautions"]
    lines = [f"pages {r['pages']}",
             f"warnings + cautions attached: {wc['attached']}/{wc['present']} = "
             + (f"{wc['rate']:.1%}" if wc["rate"] is not None else "none found") + " (target 98%)"]
    for k, v in sorted(r["guards"].items()):
        lines.append(f"  {k:8} {v['attached']}/{v['present']}")
    q = r["questions"]
    lines.append(f"question boxes attached to a node: {q['attached']}/{q['present']} = "
                 + (f"{q['rate']:.1%}" if q["rate"] is not None else "none found"))
    lines += [f"SANITY: {x}" for x in r.get("sanity", [])]
    for k, v in sorted(r["guards"].items()):
        lines += [f"  missing {k}: {m}" for m in v["missing"][:10]]
    lines += [f"  missing question: {m}" for m in q["missing"][:10]]
    return "\n".join(lines)
