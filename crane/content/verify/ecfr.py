"""Fetch the crane rules from the eCFR and index them by citation path.

This is the content lane's own index, used to verify every quote and
section_id in crane/content before the pipeline bakes it. It follows the
CONTRACT section_id scheme ('29cfr1926.1408(a)(2)'). Tables and appendices:

    29cfr1926.1408          section (text = every paragraph and table row, in order)
    29cfr1926.1408(a)(2)    paragraph (own text, marker stripped)
    29cfr1926.cc.appA       Appendix A to Subpart CC (B, C likewise)

Usage:
    python ecfr.py [--date YYYY-MM-DD] [--out sections.json]

A table is its caption, then one row per line with cells joined by " | ",
the same rendering as the pipeline's stage (harvest/pipeline parsers/ecfr.py),
so a quote that verifies here also verifies at bake time. A node's `own` keeps
the older space-joined rendering, which the generation prompts were built from
(changing it would re-key every cached output); `own_cells` holds the rows
when they differ, and `text` is built from it.

The fetch is cached under $HARVEST_CACHE (default ~/.cache/crane-content).
Standard library only.
"""

from __future__ import annotations

import argparse
import hashlib
import html
import json
import os
import re
import sys
import urllib.request
from pathlib import Path

API = "https://www.ecfr.gov/api/versioner/v1"
SOURCES = {
    # source_id: (query, label)
    "ecfr-29-1926-cc": ("part=1926&subpart=CC", "29 CFR 1926 Subpart CC"),
    "ecfr-29-1910-179": ("part=1910&section=1910.179", "29 CFR 1910.179"),
    "ecfr-29-1910-180": ("part=1910&section=1910.180", "29 CFR 1910.180"),
    "ecfr-29-1910-184": ("part=1910&section=1910.184", "29 CFR 1910.184"),
}
CACHE = Path(os.environ.get("HARVEST_CACHE", Path.home() / ".cache" / "crane-content"))


def _get(url: str) -> bytes:
    req = urllib.request.Request(url, headers={"Accept-Encoding": "gzip", "User-Agent": "harvest-content/1"})
    with urllib.request.urlopen(req, timeout=60) as r:
        data = r.read()
        if r.headers.get("Content-Encoding") == "gzip":
            import gzip

            data = gzip.decompress(data)
    return data


def up_to_date_as_of() -> str:
    titles = json.loads(_get(f"{API}/titles.json"))["titles"]
    return next(t for t in titles if t["number"] == 29)["up_to_date_as_of"]


def fetch(date: str) -> dict[str, Path]:
    out = {}
    d = CACHE / date
    d.mkdir(parents=True, exist_ok=True)
    for sid, (q, _) in SOURCES.items():
        p = d / f"{sid}.xml"
        if not p.exists() or p.stat().st_size < 1000:
            p.write_bytes(_get(f"{API}/full/{date}/title-29.xml?{q}"))
        out[sid] = p
    return out


# ---------------------------------------------------------------- text

def norm(s: str) -> str:
    """Whitespace normalization only (the CONTRACT rule)."""
    return re.sub(r"\s+", " ", s).strip()


def strip_tags(s: str) -> str:
    s = re.sub(r"<br\s*/?>", " ", s)
    s = re.sub(r"<sup>(\d+)</sup>\s*⁄\s*<sub>(\d+)</sub>", r"\1/\2", s)  # fractions
    s = re.sub(r"<[^>]+>", "", s)
    return html.unescape(s)


ROMAN = {v: i + 1 for i, v in enumerate(
    "i ii iii iv v vi vii viii ix x xi xii xiii xiv xv xvi xvii xviii xix xx xxi xxii xxiii xxiv xxv".split())}

# A marker at the start of the remaining paragraph text. Italic markers are
# '(<I>a</I>)' or '<I>(a)</I>'.
MARK = re.compile(r"^\s*(?:\((<I>)?([0-9]{1,3}|[ivx]{1,6}|[a-z]{1,2}|[A-Z])(?:</I>)?\)|<I>\(([0-9]{1,3}|[ivx]{1,6}|[a-z]{1,2})\)</I>)")
# After a marker, an optional italic heading, then an optional dash, then maybe another marker.
HEAD_THEN_MARK = re.compile(r"^\s*((?:<I>[^<]*</I>\s*(?:\u2014|&#x2014;)?\s*)+|[A-Z][^()<.]{0,80}\.\s+(?=\((?:i|1|A)\)\s))(?=\(|<I>\()")


def classify(tok: str, italic: bool) -> list[int]:
    """Candidate levels: 1 (a), 2 (1), 3 (i), 4 (A) or italic (a), 5 italic (1), 6 italic (i)."""
    if italic:
        if tok.isdigit():
            return [5]
        if tok in ROMAN and tok not in ("a",):
            return [6, 4] if len(tok) > 1 or tok in ("i", "v", "x") else [4]
        return [4]
    if tok.isdigit():
        return [2]
    if tok.isupper():
        return [4]
    cands = []
    if tok in ROMAN:
        cands.append(3)
    if len(tok) == 1 or (len(tok) == 2 and tok[0] == tok[1]):
        cands.append(1)
    return cands or [1]


def ordinal(tok: str, level: int) -> int:
    if level in (2, 5):
        return int(tok)
    if level in (3, 6):
        return ROMAN.get(tok, 0)
    t = tok.lower()
    if len(t) == 2:  # (aa)
        return 26 + ord(t[0]) - 96
    return ord(t[0]) - 96 if t else 0


class Builder:
    def __init__(self, base: str, source_id: str):
        self.base = base
        self.source_id = source_id
        self.nodes: dict[str, dict] = {}
        self.order: list[str] = []
        self.stack: list[tuple[int, str, int]] = []  # (level, token, ordinal)

    def add(self, sid, parent, kind, citation, heading, text, cells=None):
        n = self.nodes.get(sid)
        if n is None:
            n = self.nodes[sid] = {"section_id": sid, "parent_id": parent, "kind": kind, "citation": citation,
                                   "heading": heading, "own": "", "source_id": self.source_id}
            self.order.append(sid)
        if cells is not None or "own_cells" in n:
            n["own_cells"] = norm(n.get("own_cells", n["own"]) + " " + (cells if cells is not None else text))
        n["own"] = norm(n["own"] + " " + text)

    def path(self):
        return self.base + "".join(f"({t})" for _, t, _ in self.stack)

    def pick_level(self, tok, italic, lookahead):
        cands = classify(tok, italic)
        if len(cands) == 1:
            return cands[0]
        ok = []
        for lv in cands:
            o = ordinal(tok, lv)
            same = [s for s in self.stack if s[0] == lv]
            if same:
                if o == same[-1][2] + 1:
                    ok.append(lv)
            elif o == 1:
                # a new deeper level must sit directly under its parent level
                if not self.stack or self.stack[-1][0] < lv:
                    ok.append(lv)
        if len(ok) == 1:
            return ok[0]
        if not ok:
            return cands[0]
        # both fit: (i) after (h) vs first roman. Look at the next marker.
        if lookahead:
            nt, nital = lookahead
            if nt == "ii":
                return 3 if 3 in ok else ok[0]
            if nt.isdigit() or nt == chr(ord(tok[0]) + 1):
                return 1 if 1 in ok else ok[0]
        return 3 if 3 in ok else ok[0]

    def push(self, tok, italic, lookahead):
        lv = self.pick_level(tok, italic, lookahead)
        while self.stack and self.stack[-1][0] >= lv:
            self.stack.pop()
        self.stack.append((lv, tok, ordinal(tok, lv)))
        return lv


def split_markers(raw: str):
    """Yield (token, italic, heading_html, rest_html) pieces for one <P>."""
    pieces = []
    s = raw
    while True:
        m = MARK.match(s)
        if not m:
            break
        italic = bool(m.group(1)) or bool(m.group(3))
        tok = m.group(2) or m.group(3)
        s = s[m.end():]
        h = HEAD_THEN_MARK.match(s)
        if h and MARK.match(s[h.end():]):
            pieces.append([tok, italic, h.group(1)])
            s = s[h.end():]
            continue
        # a bare second marker right after the first, e.g. '(a)(1)'
        if MARK.match(s) and not s.lstrip().startswith("(<I>see") and re.match(r"^\s*\(", s):
            nm = MARK.match(s)
            nt = nm.group(2) or nm.group(3)
            if nt and len(nt) <= 4:
                pieces.append([tok, italic, ""])
                continue
        pieces.append([tok, italic, s])
        s = ""
        break
    return pieces, s


def parse_div8(xml: str, base: str, source_id: str, b: Builder):
    head = re.search(r"<HEAD>(.*?)</HEAD>", xml, re.S)
    heading = norm(strip_tags(head.group(1))) if head else ""
    sec_num = base.replace("29cfr", "")
    b.add(base, None, "section", f"§{sec_num}", heading, "")
    b.stack = []
    body = xml[head.end():] if head else xml
    # paragraphs and tables in document order
    items = re.findall(r"(<P(?: [^>]*)?>.*?</P>|<TABLE.*?</TABLE>|<HED>.*?</HED>)", body, re.S)
    plist = []
    for it in items:
        if it.startswith("<TABLE"):
            plist.append(("table", it))
        elif it.startswith("<HED>"):
            plist.append(("hed", re.sub(r"</?HED>", "", it)))
        else:
            if 'class="title"' in it:
                continue  # table caption, handled with the table
            plist.append(("p", re.sub(r"^<P[^>]*>|</P>$", "", it)))
    for idx, (kind, raw) in enumerate(plist):
        if kind == "table":
            cap = re.search(r'<P class="title">(.*?)</P>', raw, re.S)
            caption = [norm(strip_tags(cap.group(1)))] if cap else []
            rows = [[norm(strip_tags(c)) for c in re.findall(r"<T[HD][^>]*>(.*?)</T[HD]>", tr, re.S)]
                    for tr in re.findall(r"<TR[^>]*>(.*?)</TR>", raw, re.S)]
            text = " ".join(caption + [c for r in rows for c in r])
            cells = "\n".join(caption + [" | ".join(r) for r in rows if r])
            # tables belong to the section, not the last paragraph
            b.add(base, None, "x", "", None, text, cells)
            continue
        if kind == "hed":
            continue
        pieces, rest = split_markers(raw)
        if not pieces:
            target = b.path() if b.stack else base
            b.add(target, None, "x", "", None, strip_tags(raw))
            continue
        # lookahead token for ambiguous romans
        la = None
        for k2, r2 in plist[idx + 1:]:  # the next MARKED paragraph, skipping tables and unmarked text
            if k2 == "p":
                m2 = MARK.match(r2)
                if m2:
                    la = (m2.group(2) or m2.group(3), bool(m2.group(1) or m2.group(3)))
                    break
        for j, (tok, italic, txt) in enumerate(pieces):
            nxt = (pieces[j + 1][0], pieces[j + 1][1]) if j + 1 < len(pieces) else la
            b.push(tok, italic, nxt)
            sid = b.path()
            parent = base + "".join(f"({t})" for _, t, _ in b.stack[:-1])
            hm = re.match(r"^\s*<I>([^<]*)</I>", txt)
            ph = norm(strip_tags(hm.group(1))).rstrip(".— ") if hm else None
            b.add(sid, parent, "paragraph", "§" + sid.replace("29cfr", ""), ph, strip_tags(txt))


def parse_source(source_id: str, xml: str, b_all: dict, order: list):
    for m in re.finditer(r'<DIV8 N="([0-9.]+)" TYPE="SECTION"[^>]*>(.*?)</DIV8>', xml, re.S):
        num, body = m.group(1), m.group(2)
        b = Builder(f"29cfr{num}", source_id)
        parse_div8(body, f"29cfr{num}", source_id, b)
        for sid in b.order:
            b_all[sid] = b.nodes[sid]
            order.append(sid)
    for m in re.finditer(r'<DIV9 N="Appendix ([A-Z]) to Subpart CC of Part 1926" TYPE="APPENDIX"[^>]*>(.*?)</DIV9>', xml, re.S):
        letter, body = m.group(1), m.group(2)
        sid = f"29cfr1926.cc.app{letter}"
        head = re.search(r"<HEAD>(.*?)</HEAD>", body, re.S)
        paras = [strip_tags(p) for p in re.findall(r"<P(?: [^>]*)?>(.*?)</P>", body, re.S)]
        b_all[sid] = {"section_id": sid, "parent_id": None, "kind": "appendix",
                      "citation": f"Appendix {letter} to Subpart CC of Part 1926",
                      "heading": norm(strip_tags(head.group(1))) if head else "", "own": norm(" ".join(paras)),
                      "source_id": source_id,
                      "figures": re.findall(r'<img src="([^"]+)"', body)}
        order.append(sid)


def build(date: str | None = None) -> dict:
    date = date or up_to_date_as_of()
    files = fetch(date)
    nodes: dict[str, dict] = {}
    order: list[str] = []
    sources = {}
    for sid, p in files.items():
        raw = p.read_bytes()
        sources[sid] = {"source_id": sid, "title": SOURCES[sid][1], "publisher": "eCFR (Office of the Federal Register / GPO)",
                        "url": f"{API}/full/{date}/title-29.xml?{SOURCES[sid][0]}", "edition": f"up to date as of {date}",
                        "sha256": hashlib.sha256(raw).hexdigest(), "license": "public-domain-us-gov"}
        parse_source(sid, raw.decode("utf-8"), nodes, order)
    # full text = own text of the node and all descendants, in order
    children: dict[str, list[str]] = {}
    for sid in order:
        p = nodes[sid]["parent_id"]
        if p is None and nodes[sid]["kind"] == "paragraph":
            p = re.sub(r"\([^()]*\)$", "", sid)
        if p:
            children.setdefault(p, []).append(sid)
    # paragraph parents: the section is the parent of top-level paragraphs
    for sid in order:
        n = nodes[sid]
        if n["kind"] == "paragraph" and n["parent_id"] not in nodes:
            n["parent_id"] = re.sub(r"\([^()]*\)$", "", sid)

    def full(sid):
        n = nodes[sid]
        parts = [n.get("own_cells", n["own"])] + [full(c) for c in children.get(sid, [])]
        return norm(" ".join(x for x in parts if x))

    for sid in order:
        nodes[sid]["text"] = full(sid)
    return {"date": date, "sources": sources, "order": order, "sections": nodes}


def load(path: str | Path | None = None) -> dict:
    """Load a built index (sections.json), building it if missing."""
    p = Path(path) if path else CACHE / "sections.json"
    if not p.exists():
        idx = build()
        p.parent.mkdir(parents=True, exist_ok=True)
        p.write_text(json.dumps(idx))
        return idx
    return json.loads(p.read_text())


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--date")
    ap.add_argument("--out", default=str(CACHE / "sections.json"))
    a = ap.parse_args()
    idx = build(a.date)
    Path(a.out).parent.mkdir(parents=True, exist_ok=True)
    Path(a.out).write_text(json.dumps(idx))
    kinds = {}
    for n in idx["sections"].values():
        kinds[n["kind"]] = kinds.get(n["kind"], 0) + 1
    print(f"eCFR up to date as of {idx['date']}: {len(idx['sections'])} nodes {kinds} -> {a.out}", file=sys.stderr)
