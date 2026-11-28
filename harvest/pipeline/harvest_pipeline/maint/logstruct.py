"""Structured log sources (JSON, JSON lines, XML, delimited text with irregular headers): one record per
record element, fields by path, roles induced and validated on every record.

Records:
  * JSON / JSON lines: each object (a line, or an element of the top-level array) is one record;
  * XML: the record element is the child of the root that repeats most ("Rec" under the export root);
  * delimited text: the delimiter is the one that splits rows most consistently; title rows and
    several header rows above the data are folded into one name per column ("UNIT / Fleet no");
    data starts at the first row whose cells mostly hold values.
Each record is flattened to paths ("unit.sn", "meter.hours", "items[].text", "Machine@serial",
"Gauge[HRS]@value"); a list keeps its items in order (joined for text). The roles (unit, date, hours,
part, symptom, action, tech) are induced on all records by logschema.induce_columns, which refuses a map
that parses poorly; when the path words leave a text role open, the model may propose a path chosen from
the paths present (closed answer), and code checks it the same way.
Times with an offset or "Z" become the station's local date: a station's offset is the one its other
stamps print (the most common), so a "Z" stamp after local midnight lands on the next local day.
"""

from __future__ import annotations

import collections
import csv
import datetime as dt
import io
import json
import re
import xml.etree.ElementTree as ET
from pathlib import Path


def _flat(obj, prefix="", out=None) -> dict:
    out = {} if out is None else out
    if isinstance(obj, dict):
        for k, v in obj.items():
            _flat(v, f"{prefix}.{k}" if prefix else str(k), out)
    elif isinstance(obj, list):
        for v in obj:
            _flat(v, f"{prefix}[]", out)
    elif obj is not None and str(obj).strip() != "":
        key = prefix
        out[key] = f"{out[key]}; {obj}" if key in out else str(obj)
    return out


def json_records(text: str) -> list[tuple[int, dict]]:
    """(char offset, flattened record)."""
    t = text.lstrip()
    if t.startswith("["):
        arr = json.loads(t)
        return [(0, _flat(o)) for o in arr if isinstance(o, dict)]
    out, pos = [], 0
    for ln in text.splitlines(keepends=True):
        s = ln.strip()
        if s.startswith("{"):
            try:
                out.append((pos, _flat(json.loads(s))))
            except ValueError:
                pass
        pos += len(ln)
    return out


def xml_records(text: str) -> list[tuple[int, dict]]:
    root = ET.fromstring(text)
    tags = collections.Counter(c.tag for c in root)
    tag = tags.most_common(1)[0][0] if tags else None
    out = []
    offsets = [m.start() for m in re.finditer(rf"<{re.escape(tag)}[\s>]", text)] if tag else []
    for k, el in enumerate(c for c in root if c.tag == tag):
        rec = {f"@{a}": v for a, v in el.attrib.items()}
        for ch in el:
            typ = ch.attrib.get("type")
            name = f"{ch.tag}[{typ}]" if typ else ch.tag
            for a, v in ch.attrib.items():
                if a != "type" and v.strip():
                    rec[f"{name}@{a}"] = v
            if (ch.text or "").strip():
                rec[name] = " ".join(ch.text.split())
        out.append((offsets[k] if k < len(offsets) else 0, rec))
    return out


def delimited_records(text: str) -> list[tuple[int, dict]]:
    lines = text.splitlines(keepends=True)
    best = None
    for d in ("\t", ",", ";", "|"):
        counts = [len(next(csv.reader([ln], delimiter=d))) for ln in lines if ln.strip()]
        common = collections.Counter(counts).most_common(1)[0] if counts else (1, 0)
        if common[0] > 1 and (best is None or common[1] > best[1]):
            best = (d, common[1], common[0])
    if best is None:
        return []
    d, _, width = best
    rows = []
    pos = 0
    for ln in lines:
        cells = next(csv.reader([ln], delimiter=d)) if ln.strip() else []
        rows.append((pos, cells))
        pos += len(ln)

    def valueish(c: str) -> bool:
        return bool(re.search(r"\d", c))

    start = next((k for k, (_, c) in enumerate(rows) if len(c) >= max(2, width // 2)
                  and sum(valueish(x) for x in c) >= max(2, len([x for x in c if x.strip()]) // 2)), None)
    if start is None:
        return []
    heads = [cells for _, cells in rows[:start] if len([x for x in cells if x.strip()]) >= 2]
    names = []
    for j in range(width):
        parts, last = [], ""
        for h in heads:
            v = h[j].strip() if j < len(h) else ""
            if not v and j > 0 and h is heads[0]:
                v = ""
            if v and v != last:
                parts.append(v)
                last = v
        names.append(" / ".join(parts) or f"col{j + 1}")
    seen = collections.Counter()
    for j, n in enumerate(names):
        seen[n] += 1
        if seen[n] > 1:
            names[j] = f"{n} ({seen[n]})"
    out = []
    for p, cells in rows[start:]:
        if len([x for x in cells if x.strip()]) < 2:
            continue
        out.append((p, {names[j]: cells[j].strip() for j in range(min(width, len(cells))) if cells[j].strip()}))
    return out


def records_of(path: Path, kind: str = "auto") -> tuple[str, list[tuple[int, dict]]]:
    text = path.read_text(errors="replace")
    if kind == "auto":
        ext = path.suffix.lower()
        kind = {".json": "json", ".jsonl": "json", ".ndjson": "json", ".xml": "xml", ".tsv": "delimited",
                ".csv": "delimited"}.get(ext)
        if kind is None:
            s = text.lstrip()
            kind = "json" if s.startswith(("{", "[")) else "xml" if s.startswith("<") else "delimited"
    fn = {"json": json_records, "xml": xml_records, "delimited": delimited_records}[kind]
    return kind, fn(text)


def station_offsets(values: list[tuple[str, str]]) -> dict[str, dt.timedelta]:
    """station -> its usual UTC offset, from the stamps that print one."""
    seen: dict[str, collections.Counter] = collections.defaultdict(collections.Counter)
    for st, v in values:
        m = re.search(r"T\d{2}:\d{2}(?::\d{2})?([+-]\d{2}):?(\d{2})$", v or "")
        if st and m:
            sign = -1 if m.group(1).startswith("-") else 1
            seen[st][sign * (abs(int(m.group(1))) * 60 + int(m.group(2)))] += 1
    return {st: dt.timedelta(minutes=c.most_common(1)[0][0]) for st, c in seen.items()}


def local_date(value: str, offset: dt.timedelta | None) -> str | None:
    """An ISO stamp as the local calendar date: an offset stamp by its own clock; a Z (UTC) stamp moved by
    the station's offset when known."""
    v = (value or "").strip()
    m = re.match(r"^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})(?::\d{2})?(Z|[+-]\d{2}:?\d{2})?$", v)
    if not m:
        return None
    if m.group(4) == "Z" and offset is not None:
        t = dt.datetime.fromisoformat(v.replace("Z", "+00:00")) + offset
        return t.date().isoformat()
    return m.group(1)


def header_date(text: str) -> dt.date | None:
    """A message's own date ("Date: Sat, 18 May 2024 18:25:00 +0800"), in its own clock."""
    from email.utils import parsedate_to_datetime
    m = re.search(r"(?im)^Date:\s*(.+)$", text or "")
    if not m:
        return None
    try:
        return parsedate_to_datetime(m.group(1).strip()).date()
    except (TypeError, ValueError):
        return None


_MON = {m: k for k, m in enumerate(["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"], 1)}


def partial_date(text: str, anchor: dt.date) -> dt.date | None:
    """'18/5', '18/5 0650', '13 jun' in a message body: day and month, the year from the message's
    own date (the nearest such date not after it by more than a few days)."""
    m = re.search(r"\b(\d{1,2})/(\d{1,2})(?!/)\b", text or "")
    if m:
        d, mo = int(m.group(1)), int(m.group(2))
    else:
        m = re.search(r"\b(\d{1,2})\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\b", (text or "").lower())
        if not m:
            return None
        d, mo = int(m.group(1)), _MON[m.group(2)]
    best = None
    for y in (anchor.year - 1, anchor.year, anchor.year + 1):
        try:
            c = dt.date(y, mo, d)
        except ValueError:
            continue
        if c <= anchor + dt.timedelta(days=3) and (best is None or c > best):
            best = c
    return best
