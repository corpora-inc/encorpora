"""Precision and recall of a built pack against a known answer key (`maint-expected/1`).

Items are compared by text, never by id (ids are the pipeline's): a node is (tree title, node
text), an edge (tree, from text, outcome, to text) where the outcome is the folded label for
categorical branches, the numeric condition for value branches ("<11.5", "11.5..12.5",
">=12.5"), "continue" for an acknowledged node and "retry" for a retry loop; a facet (node text,
facet, text); a guard (kind, text, what it guards: "tree:", "procedure:", "step:", "node:" or
"heading:" plus that thing's text); a step (procedure title, number, text); and so on. Text is
compared case-folded with trailing punctuation dropped; titles match when the pack's title
contains the expected one (a model may keep "TEST PROCEDURE FOR QUESTION 2." in front).
Reads the pack's SQLite file directly: this is an evaluation tool, not a reader the app uses.
"""

from __future__ import annotations

import json
import sqlite3
from pathlib import Path


def norm(s: str | None) -> str:
    return " ".join((s or "").split()).lower().rstrip(".:; ")


def _db(pack_dir: Path) -> sqlite3.Connection:
    m = json.loads((pack_dir / "manifest.json").read_text())
    db = next(f["path"] for f in m["files"] if f["path"].endswith(".sqlite"))
    c = sqlite3.connect(str(pack_dir / db))
    c.row_factory = sqlite3.Row
    return c


def _has(c, t) -> bool:
    return c.execute("SELECT 1 FROM sqlite_master WHERE name=?", (t,)).fetchone() is not None


def _num(x: float) -> str:
    return f"{x:g}"


def edge_key(expect: dict | None, label: str, cond: dict | None, retry: bool) -> str:
    if retry:
        return "retry"
    k = (expect or {}).get("kind")
    if k == "value" and cond:
        op = cond.get("op")
        if op == "between":
            return f"{_num(cond['min'])}..{_num(cond['max'])}"
        return f"{op}{_num(cond['value'])}"
    if k == "ack":
        return "continue"
    return norm(label)


def pack_items(pack_dir: Path) -> dict[str, set]:
    return db_items(_db(pack_dir))


def db_items(c: sqlite3.Connection, refs: dict | None = None) -> dict[str, set]:
    """Items of a pack or stage database. `refs`, when given, maps (category, item) to the
    provenance key of the row it rests on: (table, key), as the assembler names them."""
    c.row_factory = sqlite3.Row
    R = refs if refs is not None else {}
    out: dict[str, set] = {k: set() for k in ("trees", "nodes", "node_kinds", "edges", "facets", "guards", "steps",
                                              "procedures", "test_procedures", "targets", "setup", "symptoms",
                                              "signals", "equipment", "idents", "applies")}
    if not _has(c, "fault_tree"):
        return out
    sec = {r["section_id"]: r for r in c.execute("SELECT section_id, kind, heading, text FROM section")}
    trees = {r["tree_id"]: r for r in c.execute("SELECT * FROM fault_tree")}
    nodes = {r["node_id"]: r for r in c.execute("SELECT * FROM fault_node")}
    procs = {r["proc_id"]: r for r in c.execute("SELECT * FROM procedure")}
    steps = list(c.execute("SELECT * FROM proc_step"))
    ttitle = {t: norm(r["title"]) for t, r in trees.items()}
    ntext = {n: norm(r["text"]) for n, r in nodes.items()}
    ptitle = {p: norm(r["title"]) for p, r in procs.items()}
    for tid, t in ttitle.items():
        out["trees"].add(t)
        R[("trees", t)] = ("fault_tree", tid)
    for n, r in nodes.items():
        out["nodes"].add((ttitle.get(r["tree_id"]), ntext[n]))
        out["node_kinds"].add((ttitle.get(r["tree_id"]), ntext[n], r["kind"]))
        R[("nodes", (ttitle.get(r["tree_id"]), ntext[n]))] = ("fault_node", n)
        R[("node_kinds", (ttitle.get(r["tree_id"]), ntext[n], r["kind"]))] = ("fault_node", n)
        if r["proc_id"] and r["proc_id"] in ptitle:
            out["test_procedures"].add((ntext[n], ptitle[r["proc_id"]]))
            R[("test_procedures", (ntext[n], ptitle[r["proc_id"]]))] = ("fault_node", n)
        if r["target"] and r["target"].startswith("procedure:") and r["target"][10:] in ptitle:
            out["targets"].add((ntext[n], "procedure:" + ptitle[r["target"][10:]]))
    for e in c.execute("SELECT * FROM fault_edge"):
        f = nodes.get(e["from_node"])
        if f is None:
            continue
        ex = json.loads(f["expect"]) if f["expect"] else None
        cond = json.loads(e["cond"]) if e["cond"] else None
        it = (ttitle.get(f["tree_id"]), ntext[e["from_node"]], edge_key(ex, e["label"], cond, bool(e["retry"])),
              ntext.get(e["to_node"]))
        out["edges"].add(it)
        R[("edges", it)] = ("fault_node", e["from_node"])
    for f in c.execute("SELECT * FROM fault_facet"):
        out["facets"].add((ntext.get(f["node_id"]), f["facet"], norm(f["text"])))
        R[("facets", (ntext.get(f["node_id"]), f["facet"], norm(f["text"])))] = ("fault_node", f["node_id"])
    step_sec = {}
    for s in steps:
        out["steps"].add((ptitle.get(s["proc_id"]), s["ord"], norm(s["text"])))
        R[("steps", (ptitle.get(s["proc_id"]), s["ord"], norm(s["text"])))] = ("proc_step", f"{s['proc_id']}#{s['ord']}")
        for sid in json.loads(s["section_ids"] or "[]"):
            step_sec[sid] = "step:" + norm(s["text"])
    for p, t in ptitle.items():
        out["procedures"].add(t)
    tree_sec = {}
    for t, r in trees.items():
        for sid in json.loads(r["section_ids"] or "[]"):
            tree_sec[sid] = "tree:" + ttitle[t]
    node_sec = {r["section_id"]: "node:" + ntext[n] for n, r in nodes.items()}
    proc_sec = {}
    if _has(c, "requirement"):
        for r in c.execute("SELECT * FROM requirement"):
            owner = {"procedure": ptitle, "fault_tree": ttitle, "fault_node": ntext}.get(r["ref_kind"], {}).get(r["ref_id"])
            out["setup"].add((owner, r["kind"], norm(r["text"])))
            R[("setup", (owner, r["kind"], norm(r["text"])))] = ("requirement", f"{r['ref_kind']}:{r['ref_id']}#{r['ord']}")
    for sid, s in sec.items():
        h = norm(s["heading"])
        for p, t in ptitle.items():
            if s["kind"] == "section" and h and (h == t or t.endswith(h) or h.endswith(t)):
                proc_sec.setdefault(sid, "procedure:" + t)
    for x in c.execute("SELECT from_id, to_id FROM xref WHERE kind='guards'"):
        g = sec.get(x["from_id"])
        if g is None:
            continue
        tgt = step_sec.get(x["to_id"]) or node_sec.get(x["to_id"]) or tree_sec.get(x["to_id"]) \
            or proc_sec.get(x["to_id"])
        if tgt is None and x["to_id"] in sec:
            tgt = ("heading:" if sec[x["to_id"]]["kind"] == "chapter" else f"{sec[x['to_id']]['kind']}:") \
                + norm(sec[x["to_id"]]["heading"] or sec[x["to_id"]]["text"])
        out["guards"].add((g["kind"], norm(g["text"]), tgt))
        R[("guards", (g["kind"], norm(g["text"]), tgt))] = ("xref", f"guard:{x['from_id']}->{x['to_id']}")
    if _has(c, "symptom"):
        for s in c.execute("SELECT * FROM symptom"):
            out["symptoms"].add((norm(s["title"]), ttitle.get(s["tree_id"])))
            R[("symptoms", (norm(s["title"]), ttitle.get(s["tree_id"])))] = ("symptom", s["symptom_id"])
        for s in c.execute("SELECT * FROM signal_map"):
            it = (s["signal_kind"], norm(s["pattern"]), ttitle.get(s["tree_id"]),
                  ntext.get(s["node_id"]) if s["node_id"] else None)
            out["signals"].add(it)
            R[("signals", it)] = ("signal_map", f"{s['signal_kind']}:{s['pattern']}")
    eq = {r["equip_id"]: r for r in c.execute("SELECT * FROM equipment")}
    for e in eq.values():
        out["equipment"].add((norm(e["name"]), norm(eq[e["parent_id"]]["name"]) if e["parent_id"] in eq else None))
    if _has(c, "equip_ident"):
        for r in c.execute("SELECT * FROM equip_ident"):
            if r["equip_id"] in eq:
                out["idents"].add((norm(eq[r["equip_id"]]["name"]), r["kind"], norm(r["pattern"])))
    for r in c.execute("SELECT * FROM applies_to"):
        what = {"fault_tree": lambda i: "tree:" + ttitle.get(i, i), "procedure": lambda i: "procedure:" + ptitle.get(i, i)}
        if r["ref_kind"] in what and r["equip_id"] in eq:
            out["applies"].add((what[r["ref_kind"]](r["ref_id"]), norm(eq[r["equip_id"]]["name"])))
        elif r["ref_kind"] == "section" and r["ref_id"] in sec and sec[r["ref_id"]]["kind"] in ("warning", "caution", "note"):
            out["applies"].add(("guard:" + norm(sec[r["ref_id"]]["text"]), norm(eq[r["equip_id"]]["name"])
                                if r["equip_id"] in eq else r["equip_id"]))
    return out


def expected_items(x: dict) -> dict[str, set]:
    out: dict[str, set] = {k: set() for k in ("trees", "nodes", "node_kinds", "edges", "facets", "guards", "steps",
                                              "procedures", "test_procedures", "targets", "setup", "symptoms",
                                              "signals", "equipment", "idents", "applies")}
    for t in x.get("trees", []):
        tt = norm(t["title"])
        out["trees"].add(tt)
        for n in t["nodes"]:
            out["nodes"].add((tt, norm(n["text"])))
            out["node_kinds"].add((tt, norm(n["text"]), n["kind"]))
            if n.get("proc"):
                out["test_procedures"].add((norm(n["text"]), norm(n["proc"])))
            if n.get("target"):
                k, v = n["target"].split(":", 1)
                out["targets"].add((norm(n["text"]), f"{k}:{norm(v)}"))
        for e in t["edges"]:
            out["edges"].add((tt, norm(e["from"]), e["label"], norm(e["to"])))
        for f in t["facets"]:
            out["facets"].add((norm(f["node"]), f["facet"], norm(f["text"])))
        for s in t.get("setup", []):
            out["setup"].add((tt, s["kind"], norm(s["text"])))
        for eq in t.get("applies", []):
            out["applies"].add(("tree:" + tt, norm(eq)))
    for p in x.get("procedures", []):
        pt = norm(p["title"])
        out["procedures"].add(pt)
        for k, s in enumerate(p["steps"], 1):
            out["steps"].add((pt, k, norm(s)))
        for r in p.get("requirements", []):
            out["setup"].add((pt, r["kind"], norm(r["text"])))
        for eq in p.get("applies", []):
            out["applies"].add(("procedure:" + pt, norm(eq)))
    for g in x.get("guards", []):
        k, v = g["guards"].split(":", 1)
        out["guards"].add((g["kind"], norm(g["text"]), f"{k}:{norm(v)}"))
        for eq in g.get("applies", []):
            out["applies"].add(("guard:" + norm(g["text"]), norm(eq)))
    for s in x.get("symptoms", []):
        out["symptoms"].add((norm(s["title"]), norm(s["tree"])))
    for s in x.get("signals", []):
        out["signals"].add((s["kind"], norm(s["pattern"]), norm(s["tree"]), norm(s["node"]) if s.get("node") else None))
    for e in x.get("equipment", []):
        out["equipment"].add((norm(e["name"]), norm(e["parent"]) if e.get("parent") else None))
        for k, v in e.get("ident", []):
            out["idents"].add((norm(e["name"]), k, norm(v)))
    return out


def _str_match(x: str, y: str) -> bool:
    """Equal, or the pack's text ends with the expected (a title with its printed prefix kept);
    `kind:text` values compare kind exactly and text by the same rule."""
    if x == y:
        return True
    if not y:
        return False
    kx, _, rx = x.partition(":")
    ky, _, ry = y.partition(":")
    if rx and ry and kx == ky and kx in ("tree", "procedure", "step", "node", "heading", "guard"):
        return rx == ry or rx.endswith(" " + ry) or rx.endswith(". " + ry)
    return x.endswith(" " + y) or x.endswith(". " + y)


def _title_match(a, b) -> bool:
    if isinstance(a, tuple) and isinstance(b, tuple):
        return len(a) == len(b) and all(x == y or (isinstance(x, str) and isinstance(y, str) and _str_match(x, y))
                                        for x, y in zip(a, b))
    return a == b or (isinstance(a, str) and isinstance(b, str) and _str_match(a, b))


def compare(got: dict[str, set], want: dict[str, set]) -> dict:
    res = {}
    for k in want:
        g, w = got.get(k, set()), want[k]
        matched_w, matched_g = set(), set()
        for y in w:
            for x in g:
                if x not in matched_g and _title_match(x, y):
                    matched_w.add(y)
                    matched_g.add(x)
                    break
        tp = len(matched_w)
        res[k] = {"expected": len(w), "got": len(g), "tp": tp,
                  "precision": round(tp / len(g), 4) if g else (1.0 if not w else 0.0),
                  "recall": round(tp / len(w), 4) if w else 1.0,
                  "missing": sorted(map(str, w - matched_w))[:20], "extra": sorted(map(str, g - matched_g))[:20]}
    return res


def score_pack(pack_dir: Path, expected: dict) -> dict:
    return compare(pack_items(pack_dir), expected_items(expected))


def format_score(r: dict) -> str:
    lines = [f"{'item':16} {'expected':>8} {'got':>5} {'tp':>4} {'precision':>9} {'recall':>7}"]
    for k, v in r.items():
        lines.append(f"{k:16} {v['expected']:>8} {v['got']:>5} {v['tp']:>4} {v['precision']:>9.3f} {v['recall']:>7.3f}")
    for k, v in r.items():
        for m in v["missing"][:6]:
            lines.append(f"  missing {k}: {m}")
        for m in v["extra"][:6]:
            lines.append(f"  extra   {k}: {m}")
    return "\n".join(lines)


def score_labels(pack_dir: Path, sheet: Path) -> dict:
    """A hand-labelled sample of warning/caution/note attachments against a built pack: found,
    attached, attached to the labelled target (matched by the printed start of each text)."""
    import csv
    c = _db(pack_dir)
    sec = {r["section_id"]: r for r in c.execute("SELECT section_id, kind, heading, text FROM section")}
    loc = {r[0]: r[1] for r in c.execute("SELECT section_id, page_label FROM section_loc")} \
        if _has(c, "section_loc") else {}
    gx: dict[str, list[str]] = {}
    for x in c.execute("SELECT from_id, to_id FROM xref WHERE kind='guards'"):
        gx.setdefault(x["from_id"], []).append(x["to_id"])
    steps = {}
    for s in c.execute("SELECT text, section_ids FROM proc_step"):
        for sid in json.loads(s["section_ids"] or "[]"):
            steps[sid] = "step"
    trees = {sid: "tree" for (ids,) in c.execute("SELECT section_ids FROM fault_tree") for sid in json.loads(ids)} \
        if _has(c, "fault_tree") else {}
    nodes = {r[0]: "question" for r in c.execute("SELECT section_id FROM fault_node")} if _has(c, "fault_node") else {}
    procs = {r[0] for r in c.execute("SELECT title FROM procedure")}
    res = {"rows": 0, "found": 0, "attached": 0, "right": 0, "by_kind": {}, "disagree": []}
    start = lambda t: norm(t)[:40]  # noqa: E731
    for row in csv.DictReader(sheet.open()):
        if row.get("labeller") == "example":
            continue
        res["rows"] += 1
        k = res["by_kind"].setdefault(row["block_kind"].upper(), {"rows": 0, "found": 0, "attached": 0, "right": 0})
        k["rows"] += 1
        want = norm(row["block_text_start"])
        g = next((sid for sid, s in sec.items() if s["kind"] in ("warning", "caution", "note")
                  and want[:40] in norm(s["text"]) and (not row["page_label"] or loc.get(sid) == row["page_label"])),
                 None)
        if g is None:
            res["disagree"].append({"block": row["block_text_start"], "page": row["page_label"], "got": "not in the pack"})
            continue
        res["found"] += 1
        k["found"] += 1
        targets = gx.get(g, [])
        if targets:
            res["attached"] += 1
            k["attached"] += 1
        wt = norm(row["guards_text_start"])[:40]
        ok = False
        got = []
        for t in targets:
            s = sec.get(t)
            if s is None:
                continue
            what = steps.get(t) or trees.get(t) or nodes.get(t) or ("procedure" if s["heading"] in procs or
                                                                  any(norm(p).endswith(norm(s["heading"] or "x")) for p in procs)
                                                                  else ("heading" if s["kind"] in ("chapter", "section") else s["kind"]))
            txt = norm(s["heading"] or s["text"])
            got.append(f"{what}: {txt[:50]}")
            if what == row["guards"] and (txt.startswith(wt) or wt in txt):
                ok = True
        if ok:
            res["right"] += 1
            k["right"] += 1
        else:
            res["disagree"].append({"block": row["block_text_start"], "page": row["page_label"],
                                    "labelled": f"{row['guards']}: {row['guards_text_start']}", "got": got or "none"})
    return res
