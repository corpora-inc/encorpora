"""Maintenance logs and history: messy service records -> validated history, failure modes, repeats.

Rules first, model last, as for manuals. Per record:
  1. parse: CSV exports by a per-source column map (a shop's house style is configuration),
     free-text narratives and scans (OCR) by patterns for dates, units, hours, parts, initials;
  2. normalize and validate against the asset registry, the parts catalog and the manual's pack:
     unit (asset id, "Pump 103", "#103", serial), date (several formats; outside the log period is
     wrong), hours (<= 0 or far off the unit's own hours-over-time line is invalid), part (catalog),
     test and training entries; the symptom (pack symptoms, by words the pack prints and the
     shop's abbreviation table) and the corrective action (the action nodes of that symptom's tree);
  3. correct only with evidence: a unit id whose hours sit on another unit's line (and not on
     its own) moves to that unit; a date outside the period whose day-month swap or year fix
     lands on the unit's line is fixed; anything else stays as written or becomes unknown;
  4. what the rules cannot settle goes to a model as closed questions with enumerated answers
     (which symptom, which corrective action, is this a test entry), the record text the only input;
  5. each record ends `accept`, `corrected` (every changed field with from, to and why) or `reject`
     (why), and every field carries its evidence. An unknown stays unknown: nothing is invented.
Outputs: `history` rows, `failure_mode` clusters per variant and tree (counts, share, example
records), a `harvest-assets/1` registry with each asset's events, and the repeat discrepancies
(same asset, same symptom, within the window). `score()` measures all of it against a truth table.
"""

from __future__ import annotations

import csv
import datetime as dt
import io
import json
import re
import statistics
import sys
import time
from dataclasses import dataclass, field
from pathlib import Path

from ..textutil import sha256_json, slug

STOP = {"the", "a", "an", "and", "or", "to", "of", "on", "in", "with", "then", "is", "it", "for", "at", "by", "from",
        "was", "were", "be", "not", "no", "up", "out", "now", "does", "do"}


# ---- the manual's side: symptoms and actions, from the pack ----------------------------------------
@dataclass
class Manual:
    symptoms: dict            # symptom_id -> {title, tree_id, words}
    actions: dict             # tree_id -> [(node_id, text, words)]
    variants: dict            # tree_id -> [equip_id] it applies to (empty: all)
    signals: list             # (pattern, tree_id)


def _words(text: str, abbrev: dict | None = None) -> set[str]:
    t = text.lower()
    for k, v in (abbrev or {}).items():
        t = re.sub(rf"(?<![\w&]){re.escape(k.lower())}(?![\w&])", v.lower(), t)
    return {w for w in re.findall(r"[a-z][a-z0-9]+|[a-z]\d+|\d+[a-z]+", t) if w not in STOP}


def _stem(w: str) -> str:
    for suf in ("ing", "ed", "es", "s"):
        if w.endswith(suf) and len(w) - len(suf) >= 4:
            return w[: -len(suf)]
    return w


def _match(a: set[str], b: set[str]) -> set[str]:
    """Words of a that b has, by stem or as a prefix of at least four letters ("temp" ~ "temperature")."""
    sb = {_stem(x) for x in b}
    hits = set()
    for w in a:
        s = _stem(w)
        if s in sb or (len(w) >= 4 and any(x.startswith(w) or x.startswith(s) for x in b)) \
                or any(len(x) >= 4 and s.startswith(_stem(x)) for x in b):
            hits.add(w)
    return hits


def load_manual(pack_db: str) -> Manual:
    import sqlite3
    c = sqlite3.connect(pack_db)
    syms, acts, variants = {}, {}, {}
    tree_words: dict[str, set] = {}
    for tid, title in c.execute("SELECT tree_id, title FROM fault_tree"):
        ws = _words(title)
        for (t,) in c.execute("SELECT text FROM fault_node WHERE tree_id=? AND kind IN ('symptom')", (tid,)):
            ws |= _words(t)
        tree_words[tid] = ws
        variants[tid] = [r[0] for r in c.execute(
            "SELECT equip_id FROM applies_to WHERE ref_kind='fault_tree' AND ref_id=?", (tid,))]
        acts[tid] = [(nid, text, _words(text)) for nid, text in c.execute(
            "SELECT node_id, text FROM fault_node WHERE tree_id=? AND kind IN ('action','escalate') ORDER BY node_id",
            (tid,))]
    # a tree's own words: those no other tree's title or symptom uses
    for sid, tid, title, syn in c.execute("SELECT symptom_id, tree_id, title, synonyms FROM symptom"):
        own = set(tree_words.get(tid, set()))
        for o, ws in tree_words.items():
            if o != tid:
                own -= ws
        own |= _words(" ".join(json.loads(syn or "[]")))
        syms[sid] = {"title": title, "tree_id": tid, "words": own}
    sig = [(p, t) for p, t in c.execute("SELECT pattern, tree_id FROM signal_map")]
    return Manual(syms, acts, variants, sig)


# ---- records ---------------------------------------------------------------------------------------
@dataclass
class Record:
    rec_id: str
    source: str
    text: str
    unit_raw: str | None = None
    date_raw: str | None = None
    hours_raw: str | None = None
    symptom_text: str = ""
    action_text: str = ""
    part_raw: str | None = None
    tech_raw: str | None = None
    out: dict = field(default_factory=dict)
    date_fmt: str | None = None
    unit_alt: str | None = None
    ev: dict = field(default_factory=dict)
    corrections: dict = field(default_factory=dict)
    decision: str = "accept"
    reasons: list = field(default_factory=list)
    flags: set = field(default_factory=set)


_UNIT = re.compile(r"\b(unit-\d{3}|Pump\s+\d{3}|#\d{3}|P40[DE]-\d{4})\b|(?<![\d-])\b(\d{3})\b(?=\s*(?:[:,)]|reported\b))")
_HRS = re.compile(r"(-?\d+(?:\.\d+)?)\s*(?:hrs|hr|hours|h)\b", re.I)
_PART = re.compile(r"\b([A-Z]\d{2}-\d{3})\b")
_DATES = [("%Y-%m-%d", r"\d{4}-\d{2}-\d{2}"), ("%m/%d/%Y", r"\d{1,2}/\d{1,2}/\d{4}"),
          ("%d %b %y", r"\d{1,2} [A-Z][a-z]{2} \d{2}"), ("%d %B %Y", r"\d{1,2} [A-Z][a-z]+ \d{4}")]


IMAGE_TYPES = ("*.png", "*.jpg", "*.jpeg", "*.tif", "*.tiff", "*.bmp", "*.webp", "*.gif")


def make_image_reader(author: dict, cache_dir: Path, offline: bool, ledger=None, log=sys.stderr):
    """A model that transcribes an image entry (a card, a photo of a page) as written; code then
    validates what it says (unit against the registry, date, part against the catalog) like any text.
    Cached and ledgered; without `--call` only the cache answers."""
    from ..backends import BackendError, Request, Runner, UsageLimitReached, make_backend
    from ..cache import ResponseCache
    from .extract import Arm, _now
    spec = Arm("image-reader", author, images=True).spec
    system = ("Transcribe this maintenance record image exactly as written, line by line, keeping each printed "
              "field label with its handwritten value. Do not correct, expand or guess: copy what is written; "
              "write [illegible] for what cannot be read.")
    schema = {"type": "object", "additionalProperties": False, "required": ["text"],
              "properties": {"text": {"type": "string"}}}
    st = {"calls": 0, "cached": 0, "missing": 0}

    def read(path: Path) -> str | None:
        data = path.read_bytes()
        mt = {"jpg": "image/jpeg", "jpeg": "image/jpeg", "png": "image/png", "webp": "image/webp", "gif": "image/gif"}.get(
            path.suffix.lower().lstrip("."))
        if mt is None:                     # tif, bmp: as PNG
            from PIL import Image
            buf = io.BytesIO()
            Image.open(path).save(buf, format="PNG")
            data, mt = buf.getvalue(), "image/png"
        isha = sha256_json({"system": system, "image": __import__("hashlib").sha256(data).hexdigest()})
        cache = ResponseCache(cache_dir)
        try:
            hit = cache.get("maint.logs.image", "1", isha, spec)
            if hit is not None:
                st["cached"] += 1
                return hit["output"]["text"]
            if offline:
                st["missing"] += 1
                return None
            backend = make_backend(author)
            t0 = time.monotonic()
            try:
                resp = Runner(backend, 1).call(Request(system=system, prompt=f"Image file: {path.name}", schema=schema,
                                                        name="transcription", max_tokens=2000, images=[(mt, data)]))
            except (BackendError, UsageLimitReached) as e:
                print(f"[logs] image {path.name}: {e}", file=log)
                return None
            secs = round(time.monotonic() - t0, 2)
            cache.put({"task": "maint.logs.image", "prompt_version": "1", "input_sha256": isha, "model": spec,
                       "key": path.name, "backend": backend.name, "model_id": resp.model_id, "created_at": _now(),
                       "output": resp.output, "usage": {**resp.usage, "seconds": secs}})
            st["calls"] += 1
            if ledger:
                ledger.add({"at": _now(), "arm": "logs:image-reader", "backend": backend.name, "model": resp.model_id,
                            "unit": path.name, "questions": 1, "input_tokens": resp.usage.get("input_tokens", 0),
                            "output_tokens": resp.usage.get("output_tokens", 0),
                            "cost_usd": round(float(resp.usage.get("cost_usd", 0.0)), 6), "seconds": secs})
            return resp.output["text"]
        finally:
            cache.close()

    read.stats = st
    return read


def parse_sources(base: Path, sources: list[dict], ocr_lang: str = "eng", fleet=None,
                  report: dict | None = None, image_reader=None) -> list[Record]:
    from .logschema import entries, hours_in, induce_columns, parts_in, part_index, unit_index, units_in
    out: list[Record] = []
    rep = report if report is not None else {}
    for s in sources:
        p = (base / s["path"]).resolve()
        kind = s.get("kind", "csv")
        if kind == "csv":
            rows = list(csv.DictReader(io.StringIO(p.read_text())))
            cm = s["columns"]
            if cm == "auto":
                if fleet is None:
                    raise SystemExit(f"log source {s['id']}: columns: auto needs the fleet registry")
                cm, crep = induce_columns(list(rows[0]) if rows else [], rows, fleet, float(s.get("min_parse", 0.6)))
                rep[s["id"] + ":" + p.name] = {"columns": cm, "parse": crep}
            for k, r in enumerate(rows, 2):
                get = lambda f: (r.get(cm[f]) or "").strip() if f in cm else None  # noqa: E731
                text = " | ".join(f"{h}: {v}" for h, v in r.items() if v)
                rec = Record(f"{p.name}:{k}", s["id"], text, get("unit"), get("date"), get("hours"), part_raw=get("part"),
                             tech_raw=get("tech"))
                rec.date_fmt = cm.get("date_format")
                rec.unit_alt = get("unit_alt")
                if "text" in cm:
                    body = get("text") or ""
                    sym, _, act = body.partition(";")
                    rec.symptom_text, rec.action_text = sym.strip(), act.strip()
                else:
                    rec.symptom_text, rec.action_text = get("symptom") or "", get("action") or ""
                out.append(rec)
        elif kind in ("text", "scans"):
            if kind == "text" and s.get("entries", "auto") == "auto" and fleet is not None:
                # entries induced from the text: each line or block naming a fleet unit, dated by what it
                # or its heading prints (logschema.entries); the rec id names its first character
                uidx, pidx = unit_index(fleet.assets), part_index(fleet.parts)
                txt = p.read_text()
                ents = entries(txt, uidx)
                rep[s["id"] + ":" + p.name] = {"entries": len(ents)}
                for st, en, body, d in ents:
                    rec = _narrative(f"{p.name}@{st}", s["id"], body)
                    names = units_in(body, uidx)
                    rec.unit_raw = names[0][0] if names else rec.unit_raw
                    rec.date_raw = d or rec.date_raw
                    rec.hours_raw = hours_in(body) or rec.hours_raw
                    pp = parts_in(body, pidx)
                    rec.part_raw = pp[0] if pp else rec.part_raw
                    out.append(rec)
                continue
            if kind == "text":
                blocks = [b.strip() for b in p.read_text().split("\n\n") if b.strip()]
                items = [(f"{p.name}:{k}", b) for k, b in enumerate(blocks, 1)]
            else:
                files = sorted({f for pat in IMAGE_TYPES for f in p.glob(pat)} | {f for pat in IMAGE_TYPES
                                                                                  for f in p.glob(pat.upper())})
                items = []
                for f in files:
                    t = _ocr(f, ocr_lang)
                    if image_reader is not None and fleet is not None:
                        from .logschema import date_in
                        if not (units_in(t, unit_index(fleet.assets)) and date_in(t)):
                            # OCR did not yield a fleet unit and a date: the image reader transcribes it
                            mt = image_reader(f)
                            if mt:
                                t = " ".join(mt.split())
                    items.append((f"scans/{f.name}", t))
            for rid, b in items:
                rec = _narrative(rid, s["id"], b)
                if fleet is not None and kind == "scans":
                    uidx, pidx = unit_index(fleet.assets), part_index(fleet.parts)
                    names = units_in(b, uidx)
                    rec.unit_raw = names[0][0] if names else rec.unit_raw
                    rec.hours_raw = hours_in(b) or rec.hours_raw
                    from .logschema import date_in
                    rec.date_raw = date_in(b) or rec.date_raw
                    pp = parts_in(b, pidx)
                    rec.part_raw = pp[0] if pp else rec.part_raw
                out.append(rec)
        else:
            raise SystemExit(f"log source {s['id']}: unknown kind {kind!r}")
    return out


def _ocr(path: Path, lang: str) -> str:
    import shutil
    import subprocess
    exe = shutil.which("tesseract")
    if not exe:
        raise SystemExit("scanned logs need the tesseract binary")
    r = subprocess.run([exe, str(path), "stdout", "-l", lang, "--psm", "6"], capture_output=True, text=True)
    return " ".join(r.stdout.split())


def _narrative(rid: str, src: str, text: str) -> Record:
    rec = Record(rid, src, text)
    for _, rx in _DATES:
        m = re.search(rx, text)
        if m:
            rec.date_raw = m.group(0)
            break
    m = _UNIT.search(text)
    if m:
        rec.unit_raw = m.group(1) or m.group(2)
    m = _HRS.search(text)
    rec.hours_raw = m.group(1) if m else None
    m = _PART.search(text)
    rec.part_raw = m.group(1) if m else None
    m = re.search(r"Reported by ([A-Z]\. [A-Z][a-z]+)|-\s?([A-Z]{2,3})\s*$", text)
    rec.tech_raw = (m.group(1) or m.group(2)) if m else None
    body = text
    if m and rec.unit_raw:
        body = text.split(rec.unit_raw, 1)[-1]
    rec.symptom_text = body
    rec.action_text = body
    return rec


# ---- the ingest --------------------------------------------------------------------------------------
@dataclass
class Fleet:
    assets: dict              # asset_id -> registry entry
    by_label: dict            # normalized label -> asset_id
    parts: dict
    techs: dict               # initials or surname -> full name
    period: tuple[dt.date, dt.date]
    window: int = 30


def load_fleet(base: Path, cfg: dict) -> Fleet:
    reg = json.loads((base / cfg["registry"]).read_text())
    assets, labels = {}, {}
    for a in reg["assets"]:
        assets[a["asset_id"]] = a
        n = a["asset_id"].split("-")[-1]
        for lbl in (a["asset_id"], a.get("serial"), a.get("name"), f"#{n}", n):
            if lbl:
                labels[_norm_unit(lbl)] = a["asset_id"]
    parts = json.loads((base / cfg["parts"]).read_text())
    techs = {}
    for t in cfg.get("technicians") or []:
        ini = "".join(w[0] for w in t.replace(".", "").split())
        techs[ini.upper()] = t
        techs[t.split()[-1].upper()] = t
        techs[t.upper()] = t
    p0, p1 = (dt.date.fromisoformat(x) for x in cfg["period"])
    return Fleet(assets, labels, parts, techs, (p0, p1), int(cfg.get("window_days", 30)))


def _norm_unit(s: str) -> str:
    return re.sub(r"\s+", " ", s.strip().lower())


def _parse_date(raw: str | None) -> dt.date | None:
    if not raw:
        return None
    for fmt, rx in _DATES:
        if re.fullmatch(rx, raw.strip()):
            try:
                return dt.datetime.strptime(raw.strip(), fmt).date()
            except ValueError:
                return None
    return None


def ingest(records: list[Record], fleet: Fleet, manual: Manual, cfg: dict, resolver=None) -> list[Record]:
    abbrev = cfg.get("abbreviations") or {}
    test_rx = re.compile(cfg.get("test_regex", r"(?i)\b(test entry|test record|training|demo|do not use|ignore)\b"))
    test_techs = {t.lower() for t in cfg.get("test_technicians", ["trainee", "admin"])}
    for r in records:
        # unit
        from .logschema import norm_label, parse_date as _any_date, part_index, parts_in, unit_index
        if not hasattr(fleet, "_uidx"):
            fleet._uidx, fleet._pidx = unit_index(fleet.assets), part_index(fleet.parts)
        u = fleet.by_label.get(_norm_unit(r.unit_raw or "")) or fleet._uidx.get(norm_label(r.unit_raw or ""))
        if not u and r.unit_alt:
            u = fleet.by_label.get(_norm_unit(r.unit_alt)) or fleet._uidx.get(norm_label(r.unit_alt))
            if u:
                r.corrections["unit"] = {"from": r.unit_raw or None, "to": u,
                                         "why": f"unit from the record's other unit column ({r.unit_alt!r})"}
        r.out["asset_id"] = u
        r.ev["asset_id"] = f"registry label {r.unit_raw!r}" if u else f"no fleet unit is labelled {r.unit_raw!r}"
        # date
        d = _parse_date(r.date_raw) or _any_date(r.date_raw, r.date_fmt)
        r.out["date"] = d
        if d and not (fleet.period[0] <= d <= fleet.period[1]):
            r.flags.add("date_out_of_period")
        # hours
        h = None
        if r.hours_raw:
            try:
                h = float(re.sub(r"[^\d.\-]", "", r.hours_raw))
            except ValueError:
                h = None
        r.out["hours"] = h
        if h is not None and h <= 0:
            r.flags.add("hours_invalid")
        # part
        pm = _PART.search(r.part_raw or "") if r.part_raw else None
        part = pm.group(1) if pm else None
        if r.part_raw and (part is None or part not in fleet.parts):
            cat = parts_in(r.part_raw, fleet._pidx)
            if cat:
                part = cat[0]
            elif part is None and re.search(r"\d", r.part_raw or "") and re.search(r"[-\d]{5,}", r.part_raw):
                part = r.part_raw.split(";")[0].split("/")[0].split("(")[0].strip()
        if part and part not in fleet.parts:
            r.flags.add("part_unknown")
            r.reasons.append(f"part {part} is not in the catalog: left unknown")
            part = None
        r.out["part"] = part
        # technician
        t = (r.tech_raw or "").strip()
        r.out["tech"] = fleet.techs.get(t.upper()) or (t if t in fleet.techs.values() else None)
        # test and training entries
        if test_rx.search(r.text) or t.lower() in test_techs:
            r.flags.add("test")
            r.ev["test"] = "test/training wording or a test account"
        # symptom and action by the pack's words
        _classify(r, manual, abbrev)
    _timeline(records, fleet)
    if resolver is not None:
        resolver(records, manual, abbrev)
    for r in records:
        _decide(r, fleet, manual)
    return records


def _classify(r: Record, manual: Manual, abbrev: dict) -> None:
    ws = _words(r.symptom_text or r.text, abbrev)
    scores = {sid: _match(ws, s["words"]) for sid, s in manual.symptoms.items()}
    best = sorted(scores.items(), key=lambda kv: -len(kv[1]))
    for p, tid in manual.signals:            # a code the pack maps (E21, SPN 110 FMI 0)
        if p.startswith("re:") or p.startswith("glob:") or p.startswith("prefix:"):
            continue
        if p.lower() in r.text.lower():
            sid = next((s for s, v in manual.symptoms.items() if v["tree_id"] == tid), None)
            if sid:
                best = [(sid, {f"code {p}"})] + best
                break
    if best and best[0][1] and (len(best) == 1 or len(best[0][1]) > len(best[1][1])):
        r.out["symptom_id"] = best[0][0]
        r.ev["symptom_id"] = f"words {sorted(best[0][1])}"
    else:
        r.out["symptom_id"] = None
        r.flags.add("symptom_open" if any(v for _, v in best) or ws else "symptom_none")
        r.ev["symptom_id"] = "no pack symptom's words" if not any(v for _, v in best) else "tie between symptoms"
    r.out["action"] = None
    _classify_action(r, manual, abbrev)


def _classify_action(r: Record, manual: Manual, abbrev: dict) -> None:
    tid = manual.symptoms[r.out["symptom_id"]]["tree_id"] if r.out.get("symptom_id") else None
    if tid:
        aw = _words(r.action_text or r.text, abbrev)
        sc = [(nid, text, _match(aw, w)) for nid, text, w in manual.actions.get(tid, [])]
        sc.sort(key=lambda x: -len(x[2]))
        if sc and sc[0][2] and (len(sc) == 1 or len(sc[0][2]) > len(sc[1][2])):
            r.out["action"] = sc[0][1]
            r.out["action_node"] = sc[0][0]
            r.ev["action"] = f"words {sorted(sc[0][2])}"
        elif (r.action_text or "").strip() or r.source in ("narratives", "scans"):
            r.flags.add("action_open")
            r.ev["action"] = "tie between actions" if sc and sc[0][2] else "no action's words"


def _theil_sen(pts: list[tuple[float, float]]) -> tuple[float, float] | None:
    if len(pts) < 3:
        return None
    slopes = [(b[1] - a[1]) / (b[0] - a[0]) for i, a in enumerate(pts) for b in pts[i + 1:] if b[0] != a[0]]
    if not slopes:
        return None
    m = statistics.median(slopes)
    c = statistics.median(y - m * x for x, y in pts)
    return m, c


def _timeline(records: list[Record], fleet: Fleet) -> None:
    """Each unit's hours over time (robust line). Flags hours far off it, moves misattributed records,
    and repairs out-of-period dates that land on the line."""
    epoch = fleet.period[0]
    x = lambda d: (d - epoch).days  # noqa: E731
    lines = {}
    for aid in fleet.assets:
        pts = [(x(r.out["date"]), r.out["hours"]) for r in records if r.out.get("asset_id") == aid and r.out.get("date")
               and r.out.get("hours") and r.out["hours"] > 0 and "date_out_of_period" not in r.flags]
        lines[aid] = _theil_sen(pts)
    tol = lambda pred: 40.0 + 0.01 * pred  # noqa: E731

    def resid(aid, d, h):
        ln = lines.get(aid)
        if not ln or d is None or h is None:
            return None
        return abs(h - (ln[0] * x(d) + ln[1]))

    def fits(aid, d, h):
        r_ = resid(aid, d, h)
        if r_ is None:
            return None
        ln = lines[aid]
        return r_ <= tol(ln[0] * x(d) + ln[1])

    for r in records:
        aid, d, h = r.out.get("asset_id"), r.out.get("date"), r.out.get("hours")
        if h is not None and h > 0 and aid and d and "date_out_of_period" not in r.flags:
            own = fits(aid, d, h)
            if own is False:
                # another unit's line, and clearly the nearest one (half the distance of the runner-up)
                rs = sorted((resid(a, d, h), a) for a in fleet.assets if a != aid and resid(a, d, h) is not None)
                others = [rs[0][1]] if rs and fits(rs[0][1], d, h) and (len(rs) < 2 or rs[0][0] <= 0.5 * rs[1][0]) \
                    else [a for _, a in rs if fits(a, d, h)][:2]
                ln = lines.get(aid)
                pred = ln[0] * x(d) + ln[1] if ln else None
                if len(others) == 1:
                    r.corrections["asset_id"] = {"from": aid, "to": others[0], "why": f"{h:g} h on {d} lies on "
                                                 f"{others[0]}'s hours line, not on {aid}'s (expected about {pred:.0f})"}
                    r.out["asset_id"] = others[0]
                elif pred and (h > 3 * pred or h < pred / 3):
                    r.corrections["hours"] = {"from": h, "to": None, "why": f"{h:g} h is far off {aid}'s hours line "
                                              f"(about {pred:.0f} on {d}): left unknown"}
                    r.out["hours"] = None
                else:
                    r.flags.add("hours_off_line")
        if h is not None and h <= 0:
            r.corrections["hours"] = {"from": h, "to": None, "why": "hours must be positive: left unknown"}
            r.out["hours"] = None
        if "date_out_of_period" in r.flags and d:
            cands = []
            if d.day <= 12:
                try:
                    cands.append(dt.date(d.year, d.day, d.month))
                except ValueError:
                    pass
            for y in range(fleet.period[0].year, fleet.period[1].year + 1):
                try:
                    cands.append(dt.date(y, d.month, d.day))
                except ValueError:
                    pass
            cands = [c for c in dict.fromkeys(cands) if fleet.period[0] <= c <= fleet.period[1]]
            good = [c for c in cands if fits(aid, c, h)] if aid and h else []
            if len(good) == 1:
                r.corrections["date"] = {"from": d.isoformat(), "to": good[0].isoformat(),
                                         "why": "outside the log period; this date puts the hours on the unit's line"}
                r.out["date"] = good[0]
                r.flags.discard("date_out_of_period")


def _decide(r: Record, fleet: Fleet, manual: Manual) -> None:
    if "test" in r.flags:
        r.decision, r.reasons = "reject", r.reasons + ["a test or training entry"]
        return
    if not r.out.get("asset_id"):
        r.decision, r.reasons = "reject", r.reasons + [f"unit {r.unit_raw!r} is not in the fleet"]
        return
    if not r.out.get("date") or "date_out_of_period" in r.flags:
        r.decision, r.reasons = "reject", r.reasons + [f"no usable date ({r.date_raw!r})"]
        return
    sid = r.out.get("symptom_id")
    if sid:
        tid = manual.symptoms[sid]["tree_id"]
        allowed = manual.variants.get(tid) or []
        eq = fleet.assets[r.out["asset_id"]].get("equip_id")
        if allowed and eq not in allowed:
            r.reasons.append(f"{manual.symptoms[sid]['title']!r} applies to {allowed}, not {eq}: kept, flagged")
            r.flags.add("variant_mismatch")
    r.decision = "corrected" if r.corrections else "accept"


# ---- closed questions --------------------------------------------------------------------------------
def make_resolver(author: dict, cache_dir: Path, offline: bool, ledger=None, log=sys.stderr, batch: int = 12):
    """Questions for the rules' open decisions; one call per batch of records, text only."""
    from ..backends import BackendError, Request, Runner, UsageLimitReached, make_backend
    from ..cache import ResponseCache
    from .extract import Arm, _now
    spec = Arm("logs", author, images=False).spec
    stats = {"questions": 0, "answered": 0, "calls": 0, "cached": 0, "missing": 0}

    def resolve(records: list[Record], manual: Manual, abbrev: dict | None = None) -> None:
        cache = ResponseCache(cache_dir)
        backend = None if offline else make_backend(author)
        st.update(cache=cache, backend=backend, runner=Runner(backend, 1) if backend else None,
                  syms=list(manual.symptoms.items()), manual=manual)
        syms = st["syms"]
        try:
            # phase 1: symptoms and test entries; phase 2: actions (also of symptoms phase 1 settled)
            qs = []
            for r in records:
                if "symptom_open" in r.flags or "symptom_none" in r.flags:
                    qs.append((r, "symptom", [s["title"] for _, s in syms] + ["none of these (routine or other work)"]))
                if "test" not in r.flags and r.out.get("tech") is None and r.tech_raw:
                    qs.append((r, "test", ["no, real work", "yes, a test or training entry"]))
            _ask(qs)
            for r in records:
                if r.out.get("symptom_id") and not r.out.get("action") and "action_open" not in r.flags \
                        and str(r.ev.get("symptom_id", "")).startswith(spec):
                    _classify_action(r, manual, abbrev or {})
            qs = []
            for r in records:
                if "action_open" in r.flags and r.out.get("symptom_id"):
                    acts = manual.actions[manual.symptoms[r.out["symptom_id"]]["tree_id"]]
                    qs.append((r, "action", [t for _, t, _ in acts] + ["none of these / not recorded"]))
            _ask(qs)
        finally:
            cache.close()

        return None

    st: dict = {}

    def _ask(qs):
        cache, backend, runner, syms, manual = st["cache"], st["backend"], st["runner"], st["syms"], st["manual"]
        stats["questions"] += len(qs)
        if True:
            for i in range(0, len(qs), batch):
                chunk = qs[i:i + batch]
                ids = [f"q{k}" for k in range(len(chunk))]
                props = {qid: {"type": "integer", "enum": list(range(len(opts)))} for qid, (_, _, opts) in zip(ids, chunk)}
                schema = {"type": "object", "additionalProperties": False, "required": ["answers"],
                          "properties": {"answers": {"type": "object", "additionalProperties": False,
                                                     "required": ids, "properties": props}}}
                what = {"symptom": "Which symptom does this maintenance record describe?",
                        "action": "Which corrective action does this record say was done?",
                        "test": "Is this record a test or training entry rather than real work?"}
                prompt = "\n\n".join(f"[{qid}] {what[kind]}\nRecord: {r.text}\n" +
                                     "\n".join(f"  {k}: {o}" for k, o in enumerate(opts))
                                     for qid, (r, kind, opts) in zip(ids, chunk))
                req = Request(system="You read technicians' maintenance records (abbreviations and misspellings "
                                     "are normal) and answer each closed question with the number of the option "
                                     "the record supports. Choose 'none' when the record does not say.",
                              prompt=prompt, schema=schema, name="answers", max_tokens=1500)
                isha = sha256_json({"system": req.system, "schema": schema, "prompt": prompt})
                hit = cache.get("maint.logs", "1", isha, spec)
                ans = None
                if hit is not None:
                    stats["cached"] += 1
                    ans = hit["output"]["answers"]
                elif runner is not None:
                    t0 = time.monotonic()
                    try:
                        resp = runner.call(req)
                    except (BackendError, UsageLimitReached) as e:
                        print(f"[logs] batch {i}: {e}", file=log)
                        continue
                    secs = round(time.monotonic() - t0, 2)
                    cache.put({"task": "maint.logs", "prompt_version": "1", "input_sha256": isha, "model": spec,
                               "key": f"batch {i}", "backend": backend.name, "model_id": resp.model_id,
                               "created_at": _now(), "output": resp.output, "usage": {**resp.usage, "seconds": secs}})
                    stats["calls"] += 1
                    ans = resp.output["answers"]
                    if ledger:
                        ledger.add({"at": _now(), "arm": f"logs:{spec}", "backend": backend.name, "model": resp.model_id,
                                    "unit": f"batch {i}", "questions": len(chunk),
                                    "input_tokens": resp.usage.get("input_tokens", 0),
                                    "output_tokens": resp.usage.get("output_tokens", 0),
                                    "cost_usd": round(float(resp.usage.get("cost_usd", 0.0)), 6), "seconds": secs})
                else:
                    stats["missing"] += 1
                if ans is None:
                    continue
                for qid, (r, kind, opts) in zip(ids, chunk):
                    if qid not in ans:
                        continue
                    k = int(ans[qid])
                    stats["answered"] += 1
                    note = f"{spec} chose {opts[k]!r}"
                    if kind == "symptom":
                        r.flags.discard("symptom_open")
                        r.flags.discard("symptom_none")
                        r.out["symptom_id"] = syms[k][0] if k < len(syms) else None
                        r.ev["symptom_id"] = note
                    elif kind == "action":
                        acts = manual.actions[manual.symptoms[r.out["symptom_id"]]["tree_id"]]
                        r.flags.discard("action_open")
                        if k < len(acts):
                            r.out["action"], r.out["action_node"] = acts[k][1], acts[k][0]
                        r.ev["action"] = note
                    elif kind == "test" and k == 1:
                        r.flags.add("test")
                        r.ev["test"] = note
    resolve.stats = stats
    return resolve


# ---- outputs -----------------------------------------------------------------------------------------
def repeats(records: list[Record], window: int) -> set[str]:
    ok = [r for r in records if r.decision != "reject" and r.out.get("symptom_id")]
    out = set()
    for r in ok:
        for o in ok:
            if o is not r and o.out["asset_id"] == r.out["asset_id"] and o.out["symptom_id"] == r.out["symptom_id"] \
                    and 0 < (r.out["date"] - o.out["date"]).days <= window:
                out.add(r.rec_id)
    return out


def outputs(records: list[Record], fleet: Fleet, manual: Manual) -> dict:
    keep = [r for r in records if r.decision != "reject"]
    reps = repeats(records, fleet.window)
    history, by_mode, assets = [], {}, {a: {**v, "events": []} for a, v in fleet.assets.items()}
    for r in keep:
        aid = r.out["asset_id"]
        eq = fleet.assets[aid].get("equip_id")
        sid = r.out.get("symptom_id")
        tid = manual.symptoms[sid]["tree_id"] if sid else None
        attrs = {"asset_id": aid, "hours": r.out.get("hours"), "symptom_id": sid, "tree_id": tid,
                 "action": r.out.get("action"), "action_node": r.out.get("action_node"), "part": r.out.get("part"),
                 "tech": r.out.get("tech"), "decision": r.decision, "corrections": r.corrections,
                 "evidence": r.ev, "repeat": r.rec_id in reps, "record": r.rec_id}
        history.append({"event_id": f"log:{slug(r.rec_id, 60)}", "equip_id": eq, "system": tid,
                        "date": r.out["date"].isoformat(), "text": r.text, "source_id": r.source,
                        "attrs": json.dumps(attrs, ensure_ascii=False, sort_keys=True, default=str)})
        assets[aid]["events"].append({"date": r.out["date"].isoformat(), "system": tid, "symptom_id": sid,
                                      "tree_id": tid, "text": r.text})
        if tid and r.out.get("action_node"):
            m = by_mode.setdefault((eq, tid, r.out["action_node"]), {"title": r.out["action"], "examples": [], "count": 0})
            m["count"] += 1
            if len(m["examples"]) < 3:
                m["examples"].append(r.text)
    totals: dict = {}
    for (eq, tid, _), m in by_mode.items():
        totals[(eq, tid)] = totals.get((eq, tid), 0) + m["count"]
    modes = [{"mode_id": f"fm-{slug(eq or 'all', 24)}-{slug(node, 40)}", "equip_id": eq, "system": tid,
              "title": m["title"], "count": m["count"], "share": round(m["count"] / totals[(eq, tid)], 4), "tree_id": tid,
              "examples": json.dumps(m["examples"], ensure_ascii=False)}
             for (eq, tid, node), m in sorted(by_mode.items(), key=lambda kv: (kv[0][0] or "", kv[0][1], -kv[1]["count"]))]
    reg = {"format": "harvest-assets/1", "assets": [
        {k: v for k, v in a.items() if k in ("asset_id", "equip_id", "serial", "name", "attrs", "hours", "miles", "events")}
        for a in assets.values()]}
    return {"history": history, "failure_modes": modes, "registry": reg, "repeats": sorted(reps)}


# ---- scoring against a truth table -------------------------------------------------------------------
FIELDS = ("asset_id", "date", "hours", "symptom_id", "action", "part", "tech")


def score(records: list[Record], truth: dict, window: int) -> dict:
    by = {t["rec_id"]: t for t in truth["records"]}
    res = {"records": len(records), "fields": {f: {"right": 0, "n": 0} for f in FIELDS}, "noise": {},
           "decisions": {}, "false_corrections": 0, "corrections": 0}
    for r in records:
        t = by.get(r.rec_id)
        if t is None:
            continue
        res["decisions"][r.decision] = res["decisions"].get(r.decision, 0) + 1
        noise = t["noise"]
        for n in noise or ["clean"]:
            s = res["noise"].setdefault(n, {"records": 0, "detected": 0, "corrected": 0, "right_outcome": 0})
            s["records"] += 1
        if t["test_record"]:
            ok = r.decision == "reject"
            res["noise"]["test_record"]["detected"] += ok
            res["noise"]["test_record"]["right_outcome"] += ok
            continue
        tr = t["truth"]
        if tr["asset_id"] is None:      # out of fleet: the right outcome is a reject
            ok = r.decision == "reject"
            s = res["noise"]["out_of_fleet"]
            s["detected"] += ok
            s["right_outcome"] += ok
            continue
        got = dict(r.out)
        got["date"] = got["date"].isoformat() if got.get("date") else None
        right = {}
        for f in FIELDS:
            want = tr.get(f)
            g = got.get(f)
            if f == "hours" and g is not None and want is not None:
                ok = abs(g - want) < 1.0
            else:
                ok = g == want
            if r.decision == "reject":
                ok = False
            right[f] = ok
            res["fields"][f]["n"] += 1
            res["fields"][f]["right"] += ok
        for f, c in r.corrections.items():
            res["corrections"] += 1
            if not right.get(f):
                res["false_corrections"] += 1
            elif not noise:
                res["false_corrections"] += 1
        if not noise:
            res["noise"]["clean"]["right_outcome"] += bool(all(right.values()))
        for n in noise:
            s = res["noise"][n]
            flagged = bool(r.corrections) or r.decision == "reject" or bool(r.flags - {"symptom_none", "action_open"})
            s["detected"] += flagged
            target = {"id_misalign": "asset_id", "wrong_date": "date", "invalid": "hours", "missing": None}.get(n)
            fixed = right.get(target) if target else all(right.values())
            s["corrected"] += bool(fixed and r.decision != "reject" and (r.corrections or n == "missing"))
            s["right_outcome"] += bool(all(right.values()))
    for f, v in res["fields"].items():
        v["accuracy"] = round(v["right"] / v["n"], 4) if v["n"] else None
    tot_r = sum(v["right"] for v in res["fields"].values())
    tot_n = sum(v["n"] for v in res["fields"].values())
    res["field_accuracy"] = round(tot_r / tot_n, 4) if tot_n else None
    for s in res["noise"].values():
        s["detection_rate"] = round(s["detected"] / s["records"], 4) if s["records"] else None
        s["outcome_rate"] = round(s["right_outcome"] / s["records"], 4) if s["records"] else None
    want = {t["rec_id"] for t in truth["records"] if t.get("repeat")}
    got = repeats(records, window)
    tp = len(want & got)
    res["repeats"] = {"truth": len(want), "found": len(got), "tp": tp,
                      "precision": round(tp / len(got), 4) if got else None, "recall": round(tp / len(want), 4) if want else None}
    return res


def run_logs(config_path: Path, arm_name: str, call: bool, harvest: str | None = None, log=sys.stderr,
             pack_db: str | None = None) -> dict:
    """Parse, validate, resolve (cache; model calls only with `call`), decide, output, score."""
    import yaml
    from ..corpus import load_corpus
    from .build import build as build_pack, ledger as corpus_ledger, work
    from .extract import Ledger
    base = config_path.resolve().parent
    cfg = yaml.safe_load(config_path.read_text())
    corpus = load_corpus(base / cfg["pack"]["corpus"])
    if pack_db is None:
        pack_dir = work(corpus) / f"logs-pack-{cfg['pack']['arm']}"
        if not (pack_dir / "manifest.json").exists():
            build_pack(corpus, cfg["pack"]["arm"], pack_dir, harvest or "harvest", log=None)
        pack_db = str(next(pack_dir.glob("*.sqlite")))
    db = pack_db
    manual = load_manual(str(db))
    fleet = load_fleet(base, cfg["fleet"])
    schema_rep: dict = {}
    img = cfg.get("image_reader")
    image_reader = make_image_reader(img["author"], base / cfg.get("cache_dir", "cache-logs") / "image-reader",
                                     offline=not call, ledger=Ledger(base / cfg.get("ledger", "cache-logs/ledger.jsonl")),
                                     log=log) if img else None
    records = parse_sources(base, cfg["sources"], fleet=fleet, report=schema_rep, image_reader=image_reader)
    arm = (cfg.get("arms") or {}).get(arm_name)
    if arm is None:
        raise SystemExit(f"unknown arm {arm_name!r}; config has {sorted(cfg.get('arms') or {})}")
    resolver = None
    if arm.get("resolver"):
        resolver = make_resolver(arm["resolver"], base / cfg.get("cache_dir", "cache-logs") / arm_name, offline=not call,
                                 ledger=Ledger(base / cfg.get("ledger", "cache-logs/ledger.jsonl")), log=log)
    ingest(records, fleet, manual, cfg, resolver)
    out = outputs(records, fleet, manual)
    # a source the ingest did not understand stops it: rejecting nearly everything is not a result
    by_src: dict = {}
    for r in records:
        b = by_src.setdefault(r.source, {"records": 0, "rejected": 0, "reasons": {}})
        b["records"] += 1
        if r.decision == "reject":
            b["rejected"] += 1
            why = re.sub(r"'[^']*'|\([^)]*\)", "…", (r.reasons or ["?"])[-1])[:60]
            b["reasons"][why] = b["reasons"].get(why, 0) + 1
    limit = float(cfg.get("max_reject_share", 0.5))
    not_understood = {k: v for k, v in by_src.items() if v["records"] >= 5 and v["rejected"] / v["records"] > limit}
    res = {"arm": arm_name, "records": len(records), "resolver": getattr(resolver, "stats", None),
           "schema": schema_rep, "sources": by_src, "not_understood": not_understood,
           "history": len(out["history"]), "failure_modes": out["failure_modes"], "repeats": len(out["repeats"])}
    if cfg.get("truth"):
        res["score"] = score(records, json.loads((base / cfg["truth"]).read_text()), fleet.window)
    wd = work(corpus) / f"logs-{arm_name}"
    wd.mkdir(parents=True, exist_ok=True)
    (wd / "history.jsonl").write_text("".join(json.dumps(h, ensure_ascii=False) + "\n" for h in out["history"]))
    (wd / "failure_modes.json").write_text(json.dumps(out["failure_modes"], indent=1, ensure_ascii=False))
    (wd / "registry.json").write_text(json.dumps(out["registry"], indent=1, ensure_ascii=False))
    (wd / "records.jsonl").write_text("".join(json.dumps({"rec_id": r.rec_id, "decision": r.decision, "out": r.out,
                                                          "corrections": r.corrections, "reasons": r.reasons,
                                                          "evidence": r.ev, "flags": sorted(r.flags)},
                                                         default=str, ensure_ascii=False) + "\n" for r in records))
    res["outputs"] = str(wd)
    res["_out"] = out
    if not_understood:
        (wd / "summary.json").write_text(json.dumps({k: v for k, v in res.items() if k != "_out"}, indent=1, default=str))
        raise SystemExit("maint logs: sources not understood (more than "
                         f"{limit:.0%} of their records rejected; outputs kept in {wd} for diagnosis): "
                         + json.dumps(not_understood, default=str))
    return res
