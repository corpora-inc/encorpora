"""Troubleshooting tables (failure message | cause | solution) -> a verified pack, structure by rules.

For documentation that states its troubleshooting as one table instead of drawn trees (a wiki page
in reStructuredText, rendered to HTML), structure is deterministic and needs no model:

  * every table row becomes a symptom (title = the message as printed), a small fault tree and a
    signal map row: the message is the symptom node, the cause is a `possible` facet (verbatim),
    and the solution's sentences, in order, are action nodes chained by "Done" (a solution of one
    sentence is one action);
  * a message printed on several rows becomes one tree whose causes are asked in order ("Is this
    the cause?" is never written: the cause text itself is the check, Yes -> its solution, No -> the
    next cause; the last cause leads straight to its solution);
  * the page's prose is kept as sections, and a warning admonition guards the section it is in;
  * a signal pattern matches the message as the device sends it: an optional "PreArm: "-style
    prefix (`signal_prefix`), numbers where the table prints numbers, and instance placeholders
    (x, X, y, z, "SERVOx") filled by digits; checked against generated example strings, and any
    example two patterns both match is reported.

Only `symptom.synonyms` (plain technician phrasings) come from a model: a cached, ledgered task
whose only input is the row's own text; they are checked (no number, unit or parameter name that
the row does not print) and dropped when a check fails.
"""

from __future__ import annotations

import html
import json
import re
import sys
from dataclasses import dataclass, field
from html.parser import HTMLParser

from ..model import Node as SecNode, ParsedDoc
from ..stage import Stage
from ..textutil import canonical_json, is_verbatim, norm_ws, sha256_json, sha256_text, slug

BLOCK = {"p", "li", "td", "th", "tr", "div", "h1", "h2", "h3", "h4", "caption", "br", "section", "ol", "ul", "table"}
VERIFIER = "maint-table:v1"


# ---- HTML -> blocks ---------------------------------------------------------------------------
@dataclass
class Block:
    kind: str                 # heading | para | item | warning | note | caption | row
    text: str = ""
    level: int = 0
    cells: list[str] = field(default_factory=list)


class _Doc(HTMLParser):
    """The article body as blocks; inline markup (links, emphasis) adds no spaces."""

    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.blocks: list[Block] = []
        self.buf: list[str] = []
        self.inbody = False
        self.depth = 0
        self.stack: list[str] = []
        self.adm: str | None = None
        self.adm_depth = 0
        self.row: list[str] | None = None
        self.cell: list[str] | None = None
        self.skip = 0
        self.title_p = False

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        if tag == "div" and a.get("itemprop") == "articleBody":
            self.inbody = True
            self.depth = 0
        if not self.inbody:
            return
        if tag == "div":
            self.depth += 1
            cls = a.get("class") or ""
            m = re.search(r"\badmonition (warning|caution|note|danger|tip|important)\b", cls)
            if m:
                self.adm, self.adm_depth = m.group(1), self.depth
            if "rst-footer" in cls or "footer" in cls:
                self.skip += 1
        if tag in ("script", "style", "iframe"):
            self.skip += 1
        if tag == "a" and a.get("class") == "headerlink":
            self.skip += 1
            self.stack.append("headerlink")
            return
        if tag == "p" and "admonition-title" in (a.get("class") or ""):
            self.title_p = True
        if tag == "tr":
            self.row = []
        if tag in ("td", "th"):
            self.cell = []
        if tag in BLOCK:
            self._flush()
        self.stack.append(tag)

    def handle_endtag(self, tag):
        if not self.inbody:
            return
        if self.stack and self.stack[-1] == "headerlink" and tag == "a":
            self.stack.pop()
            self.skip -= 1
            return
        if tag in ("script", "style", "iframe"):
            self.skip -= 1
        if tag in ("td", "th") and self.cell is not None and self.row is not None:
            self.row.append(norm_ws("".join(self.cell)))
            self.cell = None
            self.buf = []
        elif tag == "tr" and self.row is not None:
            self.blocks.append(Block("row", cells=self.row))
            self.row = None
        elif tag in BLOCK:
            kind = {"h1": "heading", "h2": "heading", "h3": "heading", "h4": "heading", "li": "item",
                    "caption": "caption"}.get(tag, "para")
            self._flush(kind, int(tag[1]) if tag in ("h1", "h2", "h3", "h4") else 0)
        if tag == "div":
            if self.adm and self.depth == self.adm_depth:
                self.adm = None
            self.depth -= 1
            if self.depth <= 0:
                self.inbody = False
        if self.stack:
            self.stack.pop()

    def handle_data(self, data):
        if not self.inbody or self.skip:
            return
        if self.cell is not None:
            self.cell.append(data)
        else:
            self.buf.append(data)

    def _flush(self, kind="para", level=0):
        text = norm_ws("".join(self.buf))
        self.buf = []
        if not text or text == "¶":
            return
        if self.title_p:
            self.title_p = False
            return              # "Warning": the admonition's own title
        if self.adm in ("warning", "caution", "danger", "note") and kind in ("para", "item"):
            kind = "note" if self.adm == "note" else ("caution" if self.adm == "caution" else "warning")
        self.blocks.append(Block(kind, text, level))


def html_blocks(data: bytes) -> list[Block]:
    p = _Doc()
    p.feed(data.decode("utf-8", errors="replace"))
    p._flush()
    return p.blocks


# ---- signal patterns --------------------------------------------------------------------------
_META = set(r"\.^$|?*+()[]{}")
NUM = r"-?\d+(?:\.\d+)?"
INST = r"[0-9A-Za-z.+-]+"


def _esc(s: str) -> str:
    return "".join("\\" + ch if ch in _META else ch for ch in s)


# Component nouns a device may follow with an instance number the documentation leaves out
# ("Battery below minimum arming voltage" is sent as "Battery 1 below ..."): an optional number after
# the message's leading component noun. Configurable per corpus (`instance_nouns`).
INSTANCE_NOUNS = ["Accel", "Accels", "ADSB", "AHRS", "Airspeed", "Baro", "Battery", "Compass", "Compasses", "EKF3",
                  "ESC", "Fence", "Generator", "GPS", "Gyro", "Gyros", "INS", "Logging", "Mag", "Motors", "Mount",
                  "Proximity", "Rangefinder", "Relay", "RPM", "Servo", "Terrain", "VisOdom"]


def message_regex(msg: str, instance_nouns: list[str] | None = None) -> str:
    """A regex (Rust regex-lite syntax, case-insensitive in the core) for the message as sent: numbers and
    placeholders filled, an optional instance number after a leading component noun, whitespace and
    the punctuation : , . ; optional and flexible."""
    nouns = instance_nouns if instance_nouns is not None else INSTANCE_NOUNS
    first = re.match(r"^([A-Za-z][A-Za-z0-9]*)(?=[\s:,]|$)", msg)
    inst = bool(first and first.group(1).lower() in {n.lower() for n in nouns}
                and not re.match(r"^\S+\s+(?:\d|[xX]\b)", msg))      # the table already shows an instance
    out = []
    pos = 0
    tokens = re.finditer(
        r"(?P<idx>(?:(?<=[A-Z]{2})|(?<=_))[xyz](?=_|\b|[A-Z]|$))"     # SERVOx_MAX, RCx, BTN_PINx, EK3_SRCx_
        r"|(?P<unit>\b[xyXY](?=(?:Hz|v|V|%|m|s|deg)\b))"             # xHz, yHz, Xv
        r"|(?P<ph>(?:\bX\b|(?:(?<=[:=<>])|(?<=: )|(?<=\bmax )|(?<=\bmin ))[xyz]\b))"   # Compass X; a value after : = < > max min (not an axis name like "(z diff")
        r"|(?P<num>(?<![A-Za-z0-9_.])-?\d+(?:\.\d+)?(?![A-Z_]|\.\d))", msg)  # 875, 4.3-5.8v (not 3D, EK3)
    for m in tokens:
        out.append(_lit(msg[pos:m.start()]))
        if m.group("idx"):
            out.append(r"\d+")
        elif m.group("unit"):
            out.append(NUM)
        elif m.group("ph"):
            out.append(INST)
        else:
            out.append(NUM)
        pos = m.end()
    out.append(_lit(msg[pos:].rstrip(".")))      # a closing period may be absent (pattern_for allows one)
    body = "".join(out)
    if inst:
        head = _esc(first.group(1))
        body = head + r"(?:\s*\d+)?" + body[len(head):]
    return body


def _lit(s: str) -> str:
    """Literal text: whitespace flexible, and : , ; optional with any spacing ("Airspeed: 1" ~ "Airspeed 1")."""
    out = []
    for part in re.split(r"(\s*[:,;]\s*|\s+)", s):
        if not part:
            continue
        if re.fullmatch(r"\s*[:,;]\s*", part):
            out.append(r"\s*" + _esc(part.strip()) + r"?\s*")
        elif part.isspace():
            out.append(r"\s+")
        else:
            out.append(_esc(part))
    return "".join(out)


def pattern_for(msg: str, prefix: str, instance_nouns: list[str] | None = None) -> str:
    pre = f"(?:{_esc(prefix.strip().rstrip(':'))}\\s*:?\\s*)?" if prefix else ""
    return f"re:^\\s*{pre}{message_regex(msg, instance_nouns)}\\s*\\.?\\s*$"


def examples_for(msg: str, prefix: str, instance_nouns: list[str] | None = None) -> list[str]:
    """The table's form, and the device's form with an instance number after a component noun."""
    ex = [example_for(msg, prefix)]
    nouns = {n.lower() for n in (instance_nouns if instance_nouns is not None else INSTANCE_NOUNS)}
    m = re.match(r"^([A-Za-z][A-Za-z0-9]*)(?=[\s:,]|$)", msg)
    if m and m.group(1).lower() in nouns and not re.match(r"^\S+\s+(?:\d|[xX]\b)", msg):
        ex.append(example_for(msg[:m.end()] + " 1" + msg[m.end():], prefix))
    return ex


def example_for(msg: str, prefix: str) -> str:
    """What a device might send: placeholders filled with plausible values."""
    s = re.sub(r"(?:(?<=[A-Z]{2})|(?<=_))[xyz](?=_|\b|[A-Z]|$)", "2", msg)
    s = re.sub(r"\b[xyXY](?=(?:Hz|v|V|%|m|s|deg)\b)", "4.9", s)
    s = re.sub(r"(?:\bX\b|(?:(?<=[:=<>])|(?<=: )|(?<=\bmax )|(?<=\bmin ))[xyz]\b)", "3", s)
    s = re.sub(r"(?<![A-Za-z0-9_.])(\d+)(?![A-Z_]|\.\d|\d)", lambda m: str(int(m.group(1)) + 1), s)
    return f"{prefix}{s}" if prefix else s


# ---- rows -> structure ------------------------------------------------------------------------
_SENT = re.compile(r"(?<=[.!?;])\s+(?=[A-Z(])")


def sentences(text: str) -> list[str]:
    """The solution's sentences in order (split after . ! ? ; before a capital)."""
    parts = [p.strip() for p in _SENT.split(text) if p.strip()]
    return parts or ([text.strip()] if text.strip() else [])


@dataclass
class TableBuild:
    stage: Stage
    source_id: str
    prefix: str
    cite: str
    signal_kind: str
    signal_prefix: str
    instance_nouns: list | None = None
    report: dict = field(default_factory=lambda: {"rows": 0, "trees": 0, "symptoms": 0, "signals": 0,
                                                  "unfit": [], "pattern_collisions": [], "pattern_misses": []})
    provs: dict = field(default_factory=dict)


def build_table_pack(stage: Stage, rec: dict, data: bytes, o: dict, synonyms: dict[int, dict] | None = None) -> dict:
    """Stage rows for a message/cause/solution table page. Returns the report."""
    blocks = html_blocks(data)
    sid_ = rec["source_id"]
    prefix = o.get("id_prefix", sid_)
    cite = o.get("citation_prefix", "")
    tb = TableBuild(stage, sid_, prefix, cite, o.get("signal_kind", "message"), o.get("signal_prefix", ""),
                    o.get("instance_nouns"))
    cols = o.get("columns", {"message": 0, "cause": 1, "solution": 2})
    used: set[str] = set()

    def uid(s: str) -> str:
        base, k = s, 2
        while s in used:
            s = f"{base}~{k}"
            k += 1
        used.add(s)
        return s

    roots: list[SecNode] = []
    current: SecNode | None = None
    containers: list[tuple[int, SecNode]] = []
    table_node: SecNode | None = None
    guards: list[tuple[str, str]] = []
    pcount: dict[str, int] = {}
    rows: list[tuple[SecNode, list[str], int]] = []
    header = None
    for b in blocks:
        if b.kind == "heading":
            while containers and containers[-1][0] >= b.level:
                containers.pop()
            parent = containers[-1][1] if containers else None
            node = SecNode(uid(f"{prefix}:{slug(b.text, 48)}"), "section", f"{cite} {b.text}".strip(), heading=b.text,
                           own_text=b.text)
            (parent.add(node) if parent else roots.append(node))
            containers.append((b.level, node))
            current, table_node = node, None
            continue
        if current is None:
            current = SecNode(uid(f"{prefix}:page"), "section", cite or prefix, own_text="")
            roots.append(current)
        host = current
        if b.kind in ("warning", "caution", "note"):
            pcount[host.section_id] = pcount.get(host.section_id, 0) + 1
            g = SecNode(uid(f"{host.section_id}/{b.kind}-{pcount[host.section_id]}"), b.kind, f"{host.citation}, {b.kind.title()}",
                        heading=b.kind.upper(), own_text=b.text)
            host.add(g)
            guards.append((g.section_id, host.section_id))
            continue
        if b.kind == "caption":
            table_node = SecNode(uid(f"{prefix}:{slug(b.text, 48)}"), "table", f"{cite} {b.text}".strip(), heading=b.text,
                                 own_text=b.text)
            host.add(table_node)
            continue
        if b.kind == "row":
            if header is None:
                header = b.cells
                if table_node is not None:
                    table_node.own_text = norm_ws(table_node.own_text + " " + " | ".join(header))
                continue
            tb.report["rows"] += 1
            k = tb.report["rows"]
            msg = b.cells[cols["message"]] if len(b.cells) > cols["message"] else ""
            row_node = SecNode(uid(f"{prefix}:msg/{slug(msg, 56)}"), "section", f"{cite} message: {msg}".strip(),
                               heading=msg, own_text=msg)
            (table_node or host).add(row_node)
            rows.append((row_node, b.cells, k))
            continue
        pcount[host.section_id] = pcount.get(host.section_id, 0) + 1
        host.add(SecNode(uid(f"{host.section_id}-p{pcount[host.section_id]}"), "paragraph",
                         f"{host.citation} ¶{pcount[host.section_id]}", own_text=b.text))
    # rows: cause and solution sections under the row (so node and facet text is verbatim in them)
    by_msg: dict[str, list] = {}
    for row_node, cells, k in rows:
        cause = cells[cols["cause"]] if len(cells) > cols["cause"] else ""
        sol = cells[cols["solution"]] if len(cells) > cols["solution"] else ""
        cs = ss = None
        if cause:
            cs = SecNode(uid(f"{row_node.section_id}/cause"), "paragraph", f"{row_node.citation}, Cause",
                         heading=header[cols["cause"]] if header else "Cause", own_text=cause)
            row_node.add(cs)
        if sol:
            ss = SecNode(uid(f"{row_node.section_id}/solution"), "step", f"{row_node.citation}, Solution",
                         heading=header[cols["solution"]] if header else "Solution", own_text=sol)
            row_node.add(ss)
        by_msg.setdefault(norm_ws(row_node.heading or "").lower(), []).append((row_node, cells, k, cause, sol, cs, ss))
    stage.add_doc(ParsedDoc(sid_, roots))
    for g, host in guards:
        stage.conn.execute("INSERT OR IGNORE INTO xref VALUES (?,?,'guards')", (g, host))
        pid = _prov(tb, "xref", f"guard:{g}->{host}", {"guard": g, "host": host}, [], "deterministic", "rules",
                    ["an admonition guards the section it is printed in"])
        stage.conn.execute("INSERT OR IGNORE INTO _row_prov VALUES ('xref', ?, ?)",
                           (json.dumps([g, host, "guards"], separators=(",", ":")), pid))
    _trees(tb, by_msg, synonyms or {})
    _check_patterns(tb)
    for pr in tb.provs.values():
        stage.add_provenance(pr)
    stage.commit()
    return tb.report


def _prov(tb: TableBuild, table: str, key: str, item, problems: list[str], backend: str, model: str,
          notes: list[str], created_at: str = "") -> str:
    pid = sha256_text(f"{tb.source_id}|{table}|{key}")[:20]
    tb.provs[pid] = {"prov_id": pid, "backend": backend, "model": model, "prompt_id": "harvest.maint.table",
                     "prompt_version": "1", "prompt_sha256": sha256_text(VERIFIER), "input_sha256": sha256_json(item),
                     "output_sha256": sha256_text(canonical_json(item)), "created_at": created_at,
                     "verifier": VERIFIER, "verdict": "fail" if problems else "pass",
                     "notes": json.dumps({"row": f"{table}:{key}", "problems": problems, "notes": notes},
                                         ensure_ascii=False)}
    return pid


def _trees(tb: TableBuild, by_msg: dict, synonyms: dict[int, dict]) -> None:
    st = tb.stage
    tids: set[str] = set()
    for key, rows in by_msg.items():
        row_node = rows[0][0]
        msg = row_node.heading
        tid = "t-" + slug(msg, 48)
        while tid in tids:
            tid += "x"
        tids.add(tid)
        if not any(r[4] for r in rows):
            tb.report["unfit"].append({"row": rows[0][2], "message": msg, "why": "no solution is printed: a symptom "
                                       "with nothing to do cannot be a tree (a path must end in an action)"})
            continue
        problems: list[str] = []
        nodes, edges, facets = [], [], []
        sym = f"{tid}.sy"
        nodes.append((sym, "symptom", msg, row_node.section_id, {"kind": "ack"}))
        prev = sym
        chains = []
        for i, (rn, cells, k, cause, sol, cs, ss) in enumerate(rows, 1):
            acts = sentences(sol) if sol else []
            chain = []
            for j, a in enumerate(acts, 1):
                nid = f"{tid}.r{i}a{j}"
                chain.append((nid, a))
            chains.append((rn, k, cause, cs, ss, chain))
        if len(chains) == 1:
            rn, k, cause, cs, ss, chain = chains[0]
            if cause:
                facets.append((sym, "possible", 1, cause, cs.section_id))
            edges.append((sym, 1, "Continue", chain[0][0], 0))
            _chain(nodes, edges, chain, ss)
        else:
            # several rows for one message: ask each printed cause in order, the last one leads straight on
            for i, (rn, k, cause, cs, ss, chain) in enumerate(chains):
                if cause:
                    facets.append((sym, "possible", i + 1, cause, cs.section_id))
            first = True
            for i, (rn, k, cause, cs, ss, chain) in enumerate(chains):
                if not chain:
                    tb.report["unfit"].append({"row": k, "message": msg, "why": "one of several causes has no solution"})
                    continue
                last = i == len(chains) - 1
                if last or not cause:
                    edges.append((prev, 1 if first else 2, "Continue" if first else "No", chain[0][0], 0))
                    _chain(nodes, edges, chain, ss)
                    break
                cid = f"{tid}.c{i + 1}"
                nodes.append((cid, "check", cause, cs.section_id, {"kind": "yes_no"}))
                edges.append((prev, 1 if first else 2, "Continue" if first else "No", cid, 0))
                edges.append((cid, 1, "Yes", chain[0][0], 0))
                _chain(nodes, edges, chain, ss)
                prev, first = cid, False
        # verbatim, as the core will check on read
        texts = {s: st.text(s) for s in {n[3] for n in nodes} | {f[4] for f in facets}}
        for n in nodes:
            if not is_verbatim(n[2], texts[n[3]] or ""):
                problems.append(f"node {n[0]} text is not verbatim in {n[3]}")
        for f in facets:
            if not is_verbatim(f[3], texts[f[4]] or ""):
                problems.append(f"facet of {f[0]} is not verbatim in {f[4]}")
        pid = _prov(tb, "fault_tree", tid, {"message": msg, "rows": [r[2] for r in rows]}, problems, "deterministic",
                    "rules", [f"table rows {', '.join(str(r[2]) for r in rows)}"])
        st.conn.execute("INSERT INTO fault_tree VALUES (?,?,?,?,?,?,?)",
                        (tid, msg, None, sym, json.dumps([row_node.section_id]), "en", pid))
        for nid, kind, text, sec, expect in nodes:
            npid = _prov(tb, "fault_node", nid, {"text": text, "kind": kind}, problems, "deterministic", "rules", [])
            st.conn.execute("INSERT INTO fault_node VALUES (?,?,?,?,?,?,?,?,?,?)",
                            (nid, tid, kind, text, sec, canonical_json(expect) if expect else None, None, None, "en", npid))
        for frm, ordn, label, to, retry in edges:
            st.conn.execute("INSERT INTO fault_edge VALUES (?,?,?,?,?,?)", (frm, ordn, label, None, to, retry))
        for node, facet, ordn, text, sec in facets:
            st.conn.execute("INSERT INTO fault_facet VALUES (?,?,?,?,?)", (node, facet, ordn, text, sec))
        tb.report["trees"] += 1
        # symptom, with the cached plain-language synonyms when they passed their checks
        k = rows[0][2]
        syn = synonyms.get(k) or {}
        syn_ok = [s for s in syn.get("synonyms", []) if not _synonym_problem(s, msg, " ".join(rows[0][1]))]
        dropped = [s for s in syn.get("synonyms", []) if s not in syn_ok]
        spid = _prov(tb, "symptom", f"s-{tid[2:]}", {"title": msg, "synonyms": syn_ok}, problems,
                     syn.get("backend", "deterministic"), syn.get("model_id", "rules"),
                     ([f"synonyms from {syn.get('model_id')}, row text only"] if syn else [])
                     + [f"synonym dropped: {d!r}" for d in dropped], syn.get("created_at", ""))
        st.conn.execute("INSERT INTO symptom VALUES (?,?,?,?,?,?,?)",
                        (f"s-{tid[2:]}", tid, msg, None, json.dumps(syn_ok, ensure_ascii=False), "en", spid))
        tb.report["symptoms"] += 1
        pat = pattern_for(msg, tb.signal_prefix, tb.instance_nouns)
        gpid = _prov(tb, "signal_map", f"{tb.signal_kind}:{pat}", {"pattern": pat, "message": msg}, problems,
                     "deterministic", "rules", [f"example: {example_for(msg, tb.signal_prefix)!r}"])
        st.conn.execute("INSERT INTO signal_map VALUES (?,?,?,?,?,?,?,?)",
                        (tb.signal_kind, pat, msg, tid, sym, row_node.section_id, msg, gpid))
        tb.report["signals"] += 1


def _chain(nodes, edges, chain, ss) -> None:
    for j, (nid, text) in enumerate(chain):
        last = j == len(chain) - 1
        nodes.append((nid, "action", text, ss.section_id, None if last else {"kind": "ack"}))
        if not last:
            edges.append((nid, 1, "Done", chain[j + 1][0], 0))


_PARAM = re.compile(r"\b[A-Z][A-Z0-9]*_[A-Z0-9_]+\b")


def _synonym_problem(s: str, msg: str, row_text: str) -> str | None:
    if not isinstance(s, str) or not s.strip() or len(s) > 90:
        return "empty or too long"
    if any(n not in row_text for n in re.findall(r"\d+(?:\.\d+)?", s)):
        return "a number the row does not print"
    if any(p not in row_text for p in _PARAM.findall(s)):
        return "a parameter name the row does not print"
    if norm_ws(s).lower() == norm_ws(msg).lower():
        return "the title itself"
    return None


def _check_patterns(tb: TableBuild) -> None:
    """Every pattern matches its own example; report examples that a second pattern also matches."""
    pats = [(r[0], r[1], r[2]) for r in tb.stage.conn.execute("SELECT pattern, title, tree_id FROM signal_map")]
    comp = []
    for p, title, tid in pats:
        try:
            comp.append((re.compile(p[3:], re.I), title, tid, p))
        except re.error as e:
            tb.report["pattern_misses"].append({"message": title, "why": f"does not compile: {e}"})
    n_ex = 0
    for rx, title, tid, p in comp:
        for ex in examples_for(title, tb.signal_prefix, tb.instance_nouns):
            n_ex += 1
            if not rx.match(ex.strip()):
                tb.report["pattern_misses"].append({"message": title, "example": ex})
            others = [t for r2, t, _, _ in comp if r2 is not rx and r2.match(ex.strip())]
            if others:
                tb.report["pattern_collisions"].append({"example": ex, "also": others})
    tb.report["pattern_examples"] = n_ex
    tb.report["pattern_basis"] = {
        "derived_from": "documentation (the table's message column), not the firmware's format strings",
        "verified_against_firmware": False,
        "firmware_verification": None,   # slot: {source, strings, hit_rate, ambiguous, misses: [...]} once run
    }


# ---- synonyms (the one model task) ------------------------------------------------------------
SYN_SYSTEM = ("You write the words a technician might say or type when they see a device's failure message. "
              "For each row you get only that row: the message, its cause and its solution. Give 3 to 6 short "
              "phrasings in plain language, the way a person describes what they see (\"won't arm\", \"battery "
              "too low to arm\"). Never add a number, unit or parameter name that the row does not print, never "
              "repeat the message itself, never give advice.")
SYN_SCHEMA = {"type": "object", "additionalProperties": False, "required": ["rows"],
              "properties": {"rows": {"type": "array", "items": {
                  "type": "object", "additionalProperties": False, "required": ["row", "synonyms"],
                  "properties": {"row": {"type": "integer"},
                                 "synonyms": {"type": "array", "items": {"type": "string"}}}}}}}


def synonym_requests(data: bytes, cols: dict, batch: int = 25) -> list[tuple[list[int], str]]:
    rows = []
    header = None
    for b in html_blocks(data):
        if b.kind != "row":
            continue
        if header is None:
            header = b.cells
            continue
        rows.append(b.cells)
    out = []
    for i in range(0, len(rows), batch):
        chunk = list(enumerate(rows[i:i + batch], i + 1))
        prompt = "\n".join(f"[{k}] message: {c[cols['message']]} | cause: {c[cols['cause']] if len(c) > 1 else ''} | "
                           f"solution: {c[cols['solution']] if len(c) > 2 else ''}" for k, c in chunk)
        out.append(([k for k, _ in chunk], prompt + "\n\nReturn phrasings for every row number."))
    return out


def run_synonyms(data: bytes, cols: dict, author: dict | None, cache_dir, offline: bool, ledger=None,
                 log=sys.stderr) -> tuple[dict[int, dict], dict]:
    from ..backends import BackendError, Request, Runner, UsageLimitReached, make_backend
    from ..cache import ResponseCache
    from .extract import Arm, _now
    rep = {"calls": 0, "cached": 0, "missing": 0, "failed": 0}
    out: dict[int, dict] = {}
    if not author:
        return out, rep
    spec = Arm("synonyms", author, images=False).spec
    cache = ResponseCache(cache_dir)
    backend = None if offline else make_backend(author)
    runner = Runner(backend, 1) if backend else None
    try:
        for ks, prompt in synonym_requests(data, cols):
            req = Request(system=SYN_SYSTEM, prompt=prompt, schema=SYN_SCHEMA, name="synonyms", max_tokens=8000)
            isha = sha256_json({"system": req.system, "schema": req.schema, "prompt": req.prompt})
            hit = cache.get("maint.synonyms", "1", isha, spec)
            entry = hit
            if hit is not None:
                rep["cached"] += 1
            elif runner is None:
                rep["missing"] += 1
            else:
                import time
                t0 = time.monotonic()
                try:
                    resp = runner.call(req)
                except (BackendError, UsageLimitReached) as e:
                    rep["failed"] += 1
                    print(f"[synonyms] rows {ks[0]}-{ks[-1]}: {e}", file=log)
                    continue
                secs = round(time.monotonic() - t0, 2)
                entry = {"task": "maint.synonyms", "prompt_version": "1", "input_sha256": isha, "model": spec,
                         "key": f"rows {ks[0]}-{ks[-1]}", "backend": backend.name, "model_id": resp.model_id,
                         "created_at": _now(), "output": resp.output, "usage": {**resp.usage, "seconds": secs}}
                cache.put(entry)
                rep["calls"] += 1
                if ledger:
                    ledger.add({"at": entry["created_at"], "arm": "synonyms", "backend": backend.name,
                                "model": resp.model_id, "unit": entry["key"], "pages": 0, "images": 0,
                                "input_tokens": resp.usage.get("input_tokens", 0),
                                "output_tokens": resp.usage.get("output_tokens", 0),
                                "cost_usd": round(float(resp.usage.get("cost_usd", 0.0)), 6), "seconds": secs})
            if entry is None:
                continue
            for r in entry["output"].get("rows", []):
                if r.get("row") in ks:
                    out[r["row"]] = {"synonyms": r.get("synonyms") or [], "backend": entry["backend"],
                                     "model_id": entry["model_id"], "created_at": entry["created_at"]}
    finally:
        cache.close()
    return out, rep


def html_unescape(s: str) -> str:
    return html.unescape(s)
