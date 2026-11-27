"""Verify every citation and quote in crane/content against the eCFR text.

Walks YAML and JSON files and checks, wherever it finds them:

  * section_id / section_ids / cites: each id exists in the eCFR index;
  * {section_id, quote}: quote is an exact substring (after whitespace
    normalization) of the text of that section, paragraph or a descendant;
  * answer segments {t: quote, section_id, text} and {t: cite, section_id}.

Exit status 1 on any failure. Deterministic; no model.

    python verify.py [paths...] [--index sections.json] [--json]
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import ecfr  # noqa: E402

CONTENT = HERE.parent
SKIP_DIRS = {"node_modules", ".cache", "verify", "dist"}


class Index:
    def __init__(self, idx: dict):
        self.idx = idx
        self.s = idx["sections"]

    def exists(self, sid: str) -> bool:
        return sid in self.s

    def text(self, sid: str) -> str:
        return self.s[sid]["text"]

    def has_quote(self, sid: str, quote: str) -> bool:
        return sid in self.s and ecfr.norm(quote) in self.s[sid]["text"]

    def repair(self, sid: str, quote: str) -> str | None:
        """Return the exact source span matching quote modulo typography, or None."""
        if sid not in self.s:
            return None
        text = self.s[sid]["text"]
        q = ecfr.norm(quote)
        if q in text:
            return q

        def canon(s):
            # one character for one character, so positions in canon(text) are positions in text
            s = s.replace("’", "'").replace("‘", "'").replace("“", '"').replace("”", '"')
            s = s.replace("—", "-").replace("–", "-")
            return s.lower()

        ct, cq = canon(text), canon(q)
        i = ct.find(cq)
        if i >= 0:
            return text[i:i + len(cq)]
        # any run of whitespace for a space ('§1926' also matches '§ 1926'); a quote may
        # join table cells with a space where the source row has ' | '
        pat = re.escape(cq).replace(r"\ ", r"\s+(?:\|\s+)?").replace("§", r"§\s*")
        m = re.search(pat, ct)
        if m:
            return text[m.start():m.end()]
        return None


def load_index(path: str | None) -> Index:
    return Index(ecfr.load(path))


def iter_files(paths):
    for p in paths:
        p = Path(p)
        if p.is_file():
            yield p
            continue
        for f in sorted(p.rglob("*")):
            if any(part in SKIP_DIRS for part in f.relative_to(p).parts[:-1]):
                continue
            if f.suffix in (".yaml", ".yml", ".json") and f.is_file():
                yield f


def load_file(f: Path):
    if f.suffix == ".json":
        return json.loads(f.read_text())
    import yaml

    return yaml.safe_load(f.read_text())


def walk(node, path, out):
    """Collect (path, kind, section_id, quote) checks from any nested structure."""
    if isinstance(node, dict):
        if isinstance(node.get("prov"), dict) and node["prov"].get("verdict") != "pass":
            return  # a generated row its writer already failed: kept for the record, never shipped
        sid = node.get("section_id")
        if node.get("t") == "quote":
            out.append((path, "quote", node.get("section_id"), node.get("text")))
        elif node.get("t") == "cite":
            out.append((path, "cite", sid, None))
        elif isinstance(sid, str):
            q = node.get("quote")
            out.append((path, "quote" if q else "cite", sid, q))
        for key in ("section_ids", "related_section_ids", "cites", "sections"):
            v = node.get(key)
            if isinstance(v, list):
                for i, s in enumerate(v):
                    if isinstance(s, str) and s.startswith("29cfr"):
                        out.append((f"{path}.{key}[{i}]", "cite", s, None))
        for k, v in node.items():
            walk(v, f"{path}.{k}", out)
    elif isinstance(node, list):
        for i, v in enumerate(node):
            walk(v, f"{path}[{i}]", out)


def check(index: Index, data, label: str = "") -> list[dict]:
    items: list = []
    walk(data, label, items)
    fails = []
    for path, kind, sid, quote in items:
        if not isinstance(sid, str) or not index.exists(sid):
            fails.append({"path": path, "error": "unknown section_id", "section_id": sid})
            continue
        if kind == "quote":
            if not isinstance(quote, str) or not quote.strip():
                fails.append({"path": path, "error": "empty quote", "section_id": sid})
            elif not index.has_quote(sid, quote):
                fails.append({"path": path, "error": "quote not in section text", "section_id": sid,
                              "quote": quote[:160], "repairable": index.repair(sid, quote) is not None})
    return [{"checked": len(items)}] + fails


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("paths", nargs="*", default=[str(CONTENT)])
    ap.add_argument("--index")
    ap.add_argument("--json", action="store_true")
    a = ap.parse_args()
    index = load_index(a.index)
    total, failures = 0, []
    for f in iter_files(a.paths):
        try:
            data = load_file(f)
        except Exception as e:  # noqa: BLE001
            failures.append({"path": str(f), "error": f"parse: {e}"})
            continue
        res = check(index, data, str(f.relative_to(CONTENT)) if f.is_relative_to(CONTENT) else str(f))
        total += res[0]["checked"]
        failures += res[1:]
    if a.json:
        print(json.dumps({"checked": total, "failures": failures, "ecfr_date": index.idx["date"]}, indent=1))
    else:
        for x in failures:
            print(f"FAIL {x['path']}: {x['error']} {x.get('section_id', '')} {x.get('quote', '')}")
        print(f"verified {total - len(failures)}/{total} citations and quotes against eCFR as of {index.idx['date']}")
    sys.exit(1 if failures else 0)


if __name__ == "__main__":
    main()
