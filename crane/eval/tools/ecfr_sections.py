#!/usr/bin/env python3
"""Fetch eCFR XML for the crane corpus and split it into citation-path sections.

This is the eval lane's own, independent reading of the source text. It exists
so every gold section id and quote in heldout-v1.jsonl can be checked against
the official text without trusting the ingest pipeline.

    python3 crane/eval/tools/ecfr_sections.py fetch  --date 2026-11-24 --out <dir>
    python3 crane/eval/tools/ecfr_sections.py split  --src <dir> --out sections.jsonl

Section id scheme (CONTRACT.md "stable citation paths"):
    29cfr1926.1408            section
    29cfr1926.1408(a)(2)(i)   paragraph (eCFR levels a / 1 / i / A / italic 1 / italic i)
    29cfr1926.1408-tableA     table, by its caption letter/number
    29cfr1926-subpartCC-appC  appendix; its paragraphs as 29cfr1926-subpartCC-appC(a)(1)
Text is the exact source text with whitespace collapsed and paragraph labels
stripped from the front. Unlabeled paragraphs (definitions, notes) are appended
to the paragraph they follow.
"""
from __future__ import annotations

import argparse
import hashlib
import html
import json
import re
import sys
import urllib.request
import xml.etree.ElementTree as ET
from pathlib import Path

SOURCES = [
    # (source_id, file, query)
    ("ecfr-29-1926-cc", "1926-CC.xml", "part=1926&subpart=CC"),
    ("ecfr-29-1910-179", "1910.179.xml", "part=1910&section=1910.179"),
    ("ecfr-29-1910-180", "1910.180.xml", "part=1910&section=1910.180"),
    ("ecfr-29-1910-184", "1910.184.xml", "part=1910&section=1910.184"),
]
API = "https://www.ecfr.gov/api/versioner/v1"


def fetch(date: str, out: Path) -> None:
    out.mkdir(parents=True, exist_ok=True)
    registry = []
    with urllib.request.urlopen(urllib.request.Request(f"{API}/titles.json", headers={"Accept-Encoding": "gzip"})) as r:
        data = r.read()
        if r.headers.get("Content-Encoding") == "gzip":
            import gzip
            data = gzip.decompress(data)
    title = next(t for t in json.loads(data)["titles"] if t["number"] == 29)
    for source_id, fname, q in SOURCES:
        url = f"{API}/full/{date}/title-29.xml?{q}"
        # The API refuses uncompressed responses (HTTP 406), so ask for gzip.
        req = urllib.request.Request(url, headers={"Accept-Encoding": "gzip"})
        with urllib.request.urlopen(req) as r:
            body = r.read()
            if r.headers.get("Content-Encoding") == "gzip":
                import gzip
                body = gzip.decompress(body)
        (out / fname).write_bytes(body)
        registry.append({"source_id": source_id, "url": url, "file": fname, "edition_date": date,
                         "up_to_date_as_of": title["up_to_date_as_of"],
                         "latest_amended_on": title["latest_amended_on"],
                         "sha256": hashlib.sha256(body).hexdigest(), "bytes": len(body),
                         "license": "public-domain-us-gov"})
    (out / "registry.json").write_text(json.dumps(registry, indent=2) + "\n")
    print(json.dumps(registry, indent=2))


def norm(s: str) -> str:
    return re.sub(r"\s+", " ", s).strip()


def text_of(el: ET.Element) -> str:
    return norm(html.unescape("".join(el.itertext())))


ROMAN = ["i", "ii", "iii", "iv", "v", "vi", "vii", "viii", "ix", "x", "xi", "xii", "xiii", "xiv", "xv",
         "xvi", "xvii", "xviii", "xix", "xx", "xxi", "xxii", "xxiii", "xxiv", "xxv", "xxvi", "xxvii",
         "xxviii", "xxix", "xxx"]
LOWER = [chr(c) for c in range(ord("a"), ord("z") + 1)] + ["aa", "bb", "cc", "dd", "ee", "ff"]
UPPER = [chr(c) for c in range(ord("A"), ord("Z") + 1)]
DIGITS = [str(n) for n in range(1, 200)]
SEQ = {1: LOWER, 2: DIGITS, 3: ROMAN, 4: UPPER, 5: DIGITS, 6: ROMAN}


def levels_for(label: str, italic: bool) -> list[int]:
    if italic:
        return [lv for lv in (5, 6) if label in SEQ[lv]]
    return [lv for lv in (1, 2, 3, 4) if label in SEQ[lv]]


CTX = ""


def _candidates(label: str, italic: bool, stack: list[str | None]) -> list[int]:
    depth = max([lv for lv in range(1, 7) if stack[lv] is not None], default=0)
    out = []
    for lv in levels_for(label, italic):
        seq = SEQ[lv]
        if lv == depth + 1 and label == seq[0]:
            out.append(lv)  # first child
        elif lv <= depth and stack[lv] in seq and seq.index(stack[lv]) + 1 < len(seq) \
                and seq[seq.index(stack[lv]) + 1] == label:
            out.append(lv)  # next sibling here or at an ancestor level
    return sorted(out, reverse=True)


def _place(stack: list[str | None], lv: int, label: str) -> list[str | None]:
    st = list(stack)
    st[lv] = label
    for d in range(lv + 1, 7):
        st[d] = None
    return st


def choose_level(label: str, italic: bool, stack: list[str | None],
                 following: list[tuple[str, bool]]) -> int:
    """stack[lv] is the current label at level lv (index 0 unused).

    "(i)", "(v)", "(x)" can be a letter (level 1) or a roman numeral (level 3).
    Pick the deepest reading under which the following labels still place.
    """
    cands = _candidates(label, italic, stack)
    if not cands:
        # The source skips a number (e.g. 1926.1412(b)(1) is followed by (b)(4)).
        # Accept a later label at a level already open, and say so.
        depth = max([lv for lv in range(1, 7) if stack[lv] is not None], default=0)
        gap = [lv for lv in levels_for(label, italic) if lv <= depth and stack[lv] in SEQ[lv]
               and SEQ[lv].index(label) > SEQ[lv].index(stack[lv])]
        if gap:
            print(f"warning: label gap ({stack[max(gap)]}) -> ({label}) at {CTX}", file=sys.stderr)
            return max(gap)
        raise ValueError(f"cannot place label ({label}) italic={italic} stack={stack} ctx={CTX}")
    if len(cands) == 1:
        return cands[0]

    def ok(st: list[str | None], rest: list[tuple[str, bool]]) -> bool:
        if not rest:
            return True
        lab, it = rest[0]
        return any(ok(_place(st, lv, lab), rest[1:]) for lv in _candidates(lab, it, st))

    for lv in cands:
        if ok(_place(stack, lv, label), following[:6]):
            return lv
    return cands[0]


LABEL_RE = re.compile(r"^\(([0-9]{1,3}|[a-z]{1,5}|[A-Z])\)\s*")


def leading_labels(p: ET.Element) -> tuple[list[tuple[str, bool]], str]:
    """Return [(label, italic)] at the front of a <P> and the remaining text.

    Chained labels ("(d) <I>Heading.</I> (1) text", "(17) Heading. (i) text") are
    split; the heading text stays with the outer label as "__HEAD__<text>".
    """
    raw = ET.tostring(p, encoding="unicode").strip()
    s = re.sub(r"^<P[^>]*>", "", raw)
    s = re.sub(r"</P>\s*$", "", s)
    s = html.unescape(s)
    labels: list[tuple[str, bool]] = []
    m = re.match(r"^\s*<I>\(([0-9]{1,3}|[ivx]{1,5})\)</I>\s*", s)
    if m:
        labels.append((m.group(1), True))
        s = s[m.end():]
    else:
        while True:
            m = LABEL_RE.match(s.lstrip())
            if not m:
                break
            labels.append((m.group(1), False))
            s = s.lstrip()[m.end():]
            # an optional heading, then a chained first-of-list label
            m2 = re.match(r"^((?:\s*<I>[^<]*</I>\s*—?)+|[^()<]{1,80}?\.)\s*(?=\((?:a|1|i|A)\)\s)", s)
            if m2:
                heading = norm(re.sub(r"<[^>]+>", "", m2.group(1)))
                labels.append(("__HEAD__" + heading, False))
                s = s[m2.end():]
                continue
            break
    rest = norm(re.sub(r"<[^>]+>", "", s))
    return labels, rest


def split(src: Path, out: Path) -> None:
    rows: list[dict] = []
    ord_ = 0

    def add(**kw):
        nonlocal ord_
        ord_ += 1
        kw["ord"] = ord_
        rows.append(kw)
        return kw

    registry = {r["file"]: r for r in json.loads((src / "registry.json").read_text())}
    for source_id, fname, _ in SOURCES:
        root = ET.fromstring((src / fname).read_bytes())
        part = "1926" if fname.startswith("1926") else "1910"
        divs = [root] if root.get("TYPE") == "SECTION" else [d for d in root if d.tag in ("DIV8", "DIV9")]
        for div in divs:
            head = div.find("HEAD")
            heading = text_of(head) if head is not None else ""
            if div.get("TYPE") == "SECTION":
                base = f"29cfr{div.get('N')}"
                citation = f"§{div.get('N')}"
            else:
                letter = re.search(r"Appendix ([A-Z])", div.get("N")).group(1)
                base = f"29cfr{part}-subpartCC-app{letter}"
                citation = f"Appendix {letter} to Subpart CC of Part 1926"
            sec = add(section_id=base, source_id=source_id, parent_id=None, depth=0,
                      kind="section" if div.get("TYPE") == "SECTION" else "appendix",
                      citation=citation, heading=heading, text="")
            stack: list[str | None] = [None] * 7
            node_at: list[dict | None] = [None] * 7
            last = sec
            elems = [e for e in div.iter() if e is not div]
            plabels = {}
            for e in elems:
                if e.tag == "P" and not _inside(div, e, ("TABLE", "CAPTION", "NOTE")):
                    labs = [l for l in leading_labels(e)[0] if not l[0].startswith("__HEAD__")]
                    if labs:
                        plabels[id(e)] = labs
            flat = []  # every label in document order, with the element that carries it
            for e in elems:
                for l in plabels.get(id(e), []):
                    flat.append((id(e), l))
            for el in elems:
                if el.tag == "TABLE":
                    cap = el.find("CAPTION")
                    captxt = text_of(cap) if cap is not None else ""
                    m = re.match(r"Table ([A-Z0-9]+(?:-[A-Z0-9]+)*)", captxt)
                    tid = f"{base}-table{m.group(1)}" if m else f"{base}-table{sum(1 for r in rows if r['section_id'].startswith(base + '-table')) + 1}"
                    cells = []
                    for tr in el.iter("TR"):
                        cells.append(" | ".join(text_of(c) for c in tr if c.tag in ("TH", "TD")))
                    add(section_id=tid, source_id=source_id, parent_id=base, depth=1, kind="table",
                        citation=f"{citation} {captxt.split('—')[0]}".strip(), heading=captxt,
                        text=norm(captxt + " " + " ; ".join(cells)))
                    continue
                if el.tag != "P" or _inside(div, el, ("TABLE", "CAPTION")):
                    continue
                in_note = _inside(div, el, ("NOTE",))
                labels, rest = leading_labels(el)
                if not labels or in_note:
                    target = last
                    target["text"] = norm(target["text"] + " " + text_of(el)) if not labels else \
                        norm(target["text"] + " " + text_of(el))
                    continue
                pending_head = None
                for lab, italic in labels:
                    if lab.startswith("__HEAD__"):
                        pending_head = lab[len("__HEAD__"):]
                        if last is not sec:
                            last["text"] = norm(last["text"] + " " + pending_head)
                        continue
                    global CTX
                    CTX = base + " " + rest[:60]
                    i0 = next(k for k, (eid, l) in enumerate(flat) if eid == id(el) and l == (lab, italic))
                    flat[i0] = (None, (lab, italic))
                    lv = choose_level(lab, italic, stack, [l for _, l in flat[i0 + 1:]])
                    stack[lv] = lab
                    for d in range(lv + 1, 7):
                        stack[d] = None
                        node_at[d] = None
                    path = "".join(f"({stack[d]})" for d in range(1, lv + 1))
                    parent = node_at[lv - 1] if lv > 1 else sec
                    node = add(section_id=base + path, source_id=source_id,
                               parent_id=parent["section_id"] if parent else base, depth=lv,
                               kind="paragraph", citation=citation + path, heading=None, text="")
                    node_at[lv] = node
                    last = node
                last["text"] = norm(last["text"] + " " + rest)
    # subtree text and hashes
    by_id = {r["section_id"]: r for r in rows}
    if len(by_id) != len(rows):
        dups = sorted({r["section_id"] for r in rows if sum(1 for x in rows if x["section_id"] == r["section_id"]) > 1})
        raise SystemExit(f"duplicate section ids: {dups[:20]}")
    children: dict[str, list[str]] = {}
    for r in rows:
        if r["parent_id"]:
            children.setdefault(r["parent_id"], []).append(r["section_id"])

    def subtree(sid: str) -> str:
        r = by_id[sid]
        parts = [r["text"]] + [subtree(c) for c in children.get(sid, [])]
        return norm(" ".join(p for p in parts if p))

    with out.open("w") as f:
        for r in rows:
            r["subtree_text"] = subtree(r["section_id"])
            r["text_sha256"] = hashlib.sha256(r["text"].encode()).hexdigest()
            r["source_sha256"] = registry[next(fn for sid, fn, _ in SOURCES if sid == r["source_id"])]["sha256"]
            r["lang"] = "en"
            f.write(json.dumps(r, ensure_ascii=False) + "\n")
    print(f"{len(rows)} sections -> {out}", file=sys.stderr)


_parents: dict[int, dict] = {}


def _inside(div: ET.Element, el: ET.Element, tags: tuple[str, ...]) -> bool:
    key = id(div)
    if key not in _parents:
        _parents[key] = {id(c): p for p in div.iter() for c in p}
    pm = _parents[key]
    cur = pm.get(id(el))
    while cur is not None and cur is not div:
        if cur.tag in tags:
            return True
        cur = pm.get(id(cur))
    return False


def main() -> None:
    ap = argparse.ArgumentParser()
    sub = ap.add_subparsers(dest="cmd", required=True)
    f = sub.add_parser("fetch")
    f.add_argument("--date", required=True)
    f.add_argument("--out", type=Path, required=True)
    s = sub.add_parser("split")
    s.add_argument("--src", type=Path, required=True)
    s.add_argument("--out", type=Path, required=True)
    a = ap.parse_args()
    if a.cmd == "fetch":
        fetch(a.date, a.out)
    else:
        split(a.src, a.out)


if __name__ == "__main__":
    main()
