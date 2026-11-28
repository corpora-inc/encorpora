"""A log source's house style, induced from the source itself and checked on all of it.

No shop's spelling is a default here. For a CSV export with `columns: auto`, each typed role is the
column that parses best over every row:
  date   the share of cells one date format reads (formats tried per column, the best kept, so
         7/2/24 and 2/7/24 are read the same way throughout a file);
  unit   the share of cells naming a fleet unit (registry labels, spelling-insensitive);
  hours  the share of plain numbers in a plausible hour-meter range;
  part   the share of cells holding a catalog part number (dashes optional);
text roles (what was wrong, what was done) by the header's words, else the longest free-text
columns. A role whose best column parses under `min_parse` is left out and reported; a source
whose unit or date cannot be found is refused (`SourceNotUnderstood`), never ingested as noise.
For free text, an entry is a line or block that names a fleet unit; its date is the date it prints,
else the nearest dated heading above it, else "Day N" counted from the first date the file prints.
"""

from __future__ import annotations

import datetime as dt
import re

DATE_FORMATS = ["%Y-%m-%d", "%Y-%m-%dT%H:%M", "%Y-%m-%dT%H:%M:%S", "%Y-%m-%dT%H:%M:%S%z", "%Y-%m-%dT%H:%M%z",
                "%Y-%m-%d %H:%M", "%m/%d/%Y", "%m/%d/%y", "%d.%m.%y",
                "%d/%m/%Y", "%d/%m/%y", "%d%b%y", "%d%b%Y", "%d %b %y", "%d %b %Y", "%d %B %Y", "%d-%b-%y",
                "%d-%b-%Y", "%Y/%m/%d", "%b %d, %Y", "%B %d, %Y", "%d.%m.%Y"]
_DATE_TOKEN = re.compile(r"\b(\d{4}-\d{2}-\d{2}(?:[T ]\d{2}:\d{2}(?::\d{2})?)?|\d{1,2}/\d{1,2}/\d{2,4}|\d{1,2}[A-Za-z]{3}\d{2,4}"
                         r"|\d{1,2} [A-Z][a-z]{2,8} \d{2,4}|\d{1,2}-[A-Za-z]{3}-\d{2,4}|\d{4}/\d{2}/\d{2}"
                         r"|[A-Z][a-z]{2,8} \d{1,2}, \d{4}|\d{1,2}\.\d{1,2}\.\d{2,4})\b")
TEXT_ROLES = {"symptom": ("complaint", "write-up", "writeup", "symptom", "problem", "trouble", "defect", "fault",
                          "discrepancy", "reported"),
              "action": ("action", "fix", "repair", "work done", "corrective", "done", "resolution", "rect",
                         "rectif"),
              "station": ("stn", "station", "site", "base", "location"),
              "tech": ("tech", "mech", "mechanic", "technician", "by", "repairer")}


class SourceNotUnderstood(SystemExit):
    pass


def norm_label(s: str) -> str:
    return re.sub(r"[^a-z0-9]", "", (s or "").lower())


def parse_date(raw: str | None, fmt: str | None = None) -> dt.date | None:
    if not raw:
        return None
    s = " ".join(str(raw).split())
    for f in ([fmt] if fmt else []) + DATE_FORMATS:
        try:
            return dt.datetime.strptime(s, f).date()
        except ValueError:
            continue
    m = _DATE_TOKEN.search(s)
    if m and m.group(0) != s:
        return parse_date(m.group(0), fmt)
    return None


def best_date_format(cells: list[str]) -> tuple[str | None, float]:
    vals = [c for c in cells if c and c.strip()]
    if not vals:
        return None, 0.0
    best, rate = None, 0.0
    for f in DATE_FORMATS:
        ok = 0
        for c in vals:
            try:
                dt.datetime.strptime(" ".join(c.split()), f)
                ok += 1
            except ValueError:
                pass
        if ok / len(vals) > rate:
            best, rate = f, ok / len(vals)
    return best, rate


def unit_index(assets: dict) -> dict[str, str]:
    """Spelling-insensitive labels -> asset id; a label two assets share is dropped (ambiguous)."""
    seen: dict[str, set] = {}
    for aid, a in assets.items():
        n = re.sub(r"^\D*", "", aid)
        for lbl in {aid, a.get("serial"), a.get("name"), n, n.lstrip("0")}:
            if lbl:
                seen.setdefault(norm_label(str(lbl)), set()).add(aid)
    return {k: next(iter(v)) for k, v in seen.items() if len(v) == 1 and len(k) >= 2}


def units_in(text: str, index: dict[str, str]) -> list[tuple[str, str]]:
    """(as written, asset id) for each fleet unit a text names, in order. A bare number next to an
    hour word is a meter reading, not a unit."""
    out = []
    t = text or ""
    for m in re.finditer(r"(?<![\w-])\S{0,4}?[A-Za-z]{0,4}[-\s#]?\d{2,6}\b", t):
        tok = m.group(0).strip()
        if tok.isdigit() and (len(tok) < 3 or t[max(0, m.start() - 1):m.start()] in (":", "/", ".")
                              or t[m.end():m.end() + 1] in (":", "/")):
            continue                          # a bare short number, or part of a time or a date, is no unit id
        if re.match(rf"^{_HOUR_WORDS}\b", tok, re.I):
            continue                          # "HRS 1050": a meter reading, not a unit
        aid = index.get(norm_label(tok))
        prefix = re.sub(r"[\s\-#]*\d+$", "", tok)
        if not aid and prefix and re.search(r"[A-Za-z]", prefix) and re.search(r"[^A-Za-z0-9\s\-#]", prefix):
            # an id whose letters OCR or a pen damaged ("¢V-212"): its number, when that names one unit; an
            # ordinary word before a number ("shift 23") is not an id
            digits = re.sub(r"\D", "", tok)
            aid = index.get(digits) if len(digits) >= 3 else None
        if not aid:
            continue
        if tok.isdigit() and re.match(rf"\s*{_HOUR_WORDS}\b", t[m.end():], re.I):
            continue
        if tok.isdigit() and re.search(rf"\b{_HOUR_WORDS}\s*(?:read|reads|reading|at|was|=|:)?\s*$", t[:m.start()], re.I):
            continue
        out.append((tok, aid))
    return out


def part_index(parts: dict) -> dict[str, str]:
    return {norm_label(p): p for p in parts}


def parts_in(text: str, pindex: dict[str, str]) -> list[str]:
    out = []
    for m in re.finditer(r"[A-Za-z0-9][A-Za-z0-9\-]{3,}[A-Za-z0-9]", text or ""):
        p = pindex.get(norm_label(m.group(0)))
        if p and p not in out:
            out.append(p)
    return out


_HOUR_WORDS = r"(?:hrs?|hours?|h|meter|hour meter|hm|hobbs)"
_HOURS = [re.compile(rf"(\d[\d,]*(?:\.\d+)?)\s*{_HOUR_WORDS}\b", re.I),
          re.compile(rf"\b{_HOUR_WORDS}\s*(?:read|reads|reading|at|was|=|:)?\s*(\d[\d,]*(?:\.\d+)?)", re.I)]


def hours_in(text: str) -> str | None:
    for rx in _HOURS:
        m = rx.search(text or "")
        if m:
            return m.group(1)
    return None


ROLE_WORDS = {"date": ("date", "opened", "raised", "time", "when", "dt"),
              "hours": ("hr", "hour", "meter", "hobbs", "tach", "reading", "running"),
              "unit": ("unit", "asset", "equip", "fleet", "tail", "serial", "s/n", "sn", "bumper"),
              "part": ("part", "p/n", "pn")}


def induce_columns(header: list[str], rows: list[dict], fleet, min_parse: float = 0.6) -> tuple[dict, dict]:
    """Column (or path) map for a source's records, and the report (best column and parse rate per role).
    Every rate is over all records: a column most records leave empty does not read as the role."""
    uidx, pidx = unit_index(fleet.assets), part_index(fleet.parts)
    cols = {h: [(r.get(h) or "").strip() for r in rows] for h in header}
    total = max(len(rows), 1)
    rate = {}
    for h, cells in cols.items():
        filled = [c for c in cells if c]
        n = len(filled) or 1
        fmt, dr = best_date_format(filled)
        unit = sum(1 for c in filled if norm_label(c) in uidx) / total
        nums = [c for c in filled if re.fullmatch(r"\d[\d,]*(?:\.\d+)?h?", c)]
        clock = nums and all(re.fullmatch(r"[0-2]\d[0-5]\d", c) for c in nums)     # "2345": a time of day
        hours = len(nums) / total if nums and not clock and max(float(c.replace(",", "").rstrip("h")) for c in nums) >= 50 \
            else 0.0
        part = sum(1 for c in filled if parts_in(c, pidx)) / total
        rate[h] = {"date": (dr * len(filled) / total, fmt), "unit": unit, "hours": hours, "part": part,
                   "filled": len(filled) / total, "len": sum(len(c) for c in filled) / n}

    def score(h, role):
        v = rate[h][role][0] if role == "date" else rate[h][role]
        words = ROLE_WORDS.get(role, ())
        return v + (0.02 if any(w in h.lower() for w in words) else 0.0)   # the header's words break a tie

    cmap, rep, used = {}, {}, set()
    for role in ("date", "unit", "unit_alt", "part", "hours"):
        base = "unit" if role == "unit_alt" else role
        if role == "unit_alt" and "unit" not in cmap:
            continue
        best = max(((h, score(h, base)) for h in rate if h not in used), key=lambda x: x[1], default=(None, 0.0))
        raw = (rate[best[0]][base][0] if base == "date" else rate[best[0]][base]) if best[0] else 0.0
        rep[role] = {"column": best[0], "parse_rate": round(raw, 3)}
        if best[0] and raw >= (min_parse if role != "part" else 0.05):
            cmap[role] = best[0]
            used.add(best[0])
            if role == "date":
                cmap["date_format"] = rate[best[0]]["date"][1]
    for role, words in TEXT_ROLES.items():
        hit = [h for h in header if h not in used and any(w in h.lower() for w in words)]
        if hit:
            pick = max(hit, key=lambda h: rate[h]["len"] * rate[h]["filled"])   # the column that holds the text
            cmap[role] = pick
            used.add(pick)
            rep[role] = {"column": pick, "by": "header words, longest text"}
    if "symptom" not in cmap:
        free = sorted((h for h in header if h not in used), key=lambda h: -rate[h]["len"] * rate[h]["filled"])
        if free:
            cmap["symptom"] = free[0]
            used.add(free[0])
            rep["symptom"] = {"column": free[0], "by": "longest free text"}
    for role in ("unit", "date"):
        if role not in cmap:
            raise SourceNotUnderstood(f"no column reads as the {role} (best {rep[role]}); refusing this source")
    return cmap, rep


def entries(text: str, uidx: dict[str, str]) -> list[tuple[int, int, str, str | None]]:
    """(char start, char end, entry text, date as printed for it) for each line or block naming a unit."""
    lines, pos = [], 0
    for ln in text.splitlines(keepends=True):
        lines.append((pos, pos + len(ln.rstrip("\n")), ln.rstrip("\n")))
        pos += len(ln)
    first_date = None
    for _, _, ln in lines:
        m = _DATE_TOKEN.search(ln)
        if m and parse_date(m.group(0)):
            first_date = parse_date(m.group(0))
            break
    out, heading_date = [], None
    blocks: list[list[tuple[int, int, str]]] = []
    for st, en, ln in lines:
        if not ln.strip():
            blocks.append([])
            continue
        if not blocks:
            blocks.append([])
        blocks[-1].append((st, en, ln))
    line_mode = any(sum(1 for _, _, ln in b if units_in(ln, uidx)) > 1 for b in blocks)
    units_seen = False
    for b in blocks:
        groups = [[x] for x in b] if line_mode else ([b] if b else [])
        for g in groups:
            body = " ".join(x[2].strip() for x in g)
            m = _DATE_TOKEN.search(body)
            d = m.group(0) if m and parse_date(m.group(0)) else None
            names = units_in(body, uidx)
            if not names:
                if d and len(re.sub(r"[\W\d_]+", " ", body).split()) <= 6:
                    heading_date = d              # a dated heading ("== 10JUL24 NIGHT ==")
                continue
            units_seen = True
            if d is None:
                dm = re.search(r"\bDay\s+(\d{1,3})\b", body)
                if dm and first_date:
                    d = (first_date + dt.timedelta(days=int(dm.group(1)) - 1)).isoformat()
                else:
                    d = heading_date
            out.append((g[0][0], g[-1][1], body, d))
    _ = units_seen
    return out


def date_in(text: str) -> str | None:
    """The first date a free text prints, as written."""
    for m in _DATE_TOKEN.finditer(text or ""):
        if parse_date(m.group(0)):
            return m.group(0)
    return None


def typo_candidates(raw: str, index: dict[str, str]) -> list[str]:
    """Fleet units one slip away from a label no unit has: O for 0, I or l for 1, or two neighbouring
    digits swapped. Returns the distinct units that fit (the caller uses it only when there is one)."""
    t = norm_label(raw)
    if not t:
        return []
    forms = {t, re.sub(r"(?<=\d)o|o(?=\d)", "0", t), re.sub(r"(?<=\d)[il]|[il](?=\d)", "1", t)}
    forms.add(re.sub(r"(?<=\d)[il]|[il](?=\d)", "1", re.sub(r"(?<=\d)o|o(?=\d)", "0", t)))
    if re.match(r"^[a-z]", t):              # a letter prefix written with look-alike digits ("G5" for "GS")
        for k in range(1, len(t)):
            pre = t[:k].replace("5", "s").replace("8", "b").replace("0", "o").replace("1", "i")
            forms.add(pre + t[k:])
    more = set()
    for f in forms:
        for k in range(len(f) - 1):
            if f[k].isdigit() and f[k + 1].isdigit() and f[k] != f[k + 1]:
                more.add(f[:k] + f[k + 1] + f[k] + f[k + 2:])
            if f[k].isdigit() and f[k] == f[k + 1]:
                more.add(f[:k] + f[k + 1:])          # a digit written twice
    hits = {index[f] for f in forms | more if f in index and f != t}
    return sorted(hits)
