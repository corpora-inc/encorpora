"""Import rows generated outside the engine (a content lane's own runner) into the stage.

corpus YAML:

```yaml
imports:
  - {table: term,      files: [data/glossary.jsonl]}
  - {table: question,  files: ["data/questions/*.jsonl"]}
  - {table: answer,    files: ["data/answers/*.jsonl"]}      # row "aliases" -> answer_alias
  - {table: lesson,    files: ["data/lessons/*.json"]}
  - {table: procedure, files: ["procedures/*.yaml"]}          # row "steps" -> proc_step
  - {table: diagram,   files: ["diagrams/*.json"]}
  - {table: topic,     files: [blueprint.yaml]}               # topics + nested skills
```

Files are JSONL, a JSON array, or YAML (a list or one document). Each row has the contract
columns plus a `prov` object with the contract provenance columns. Lists and objects in TEXT
columns are JSON-encoded; other keys are dropped.

Every row is re-verified against the stage before it can ship: each `{section_id, quote}` pair
and each answer segment `{"t": "quote", section_id, text}` must be verbatim (typographic quote and
dash glyphs are repaired to the source's characters), each `section_id`/`section_ids` must exist.
The shipped verdict is `pass` only when the row's own verdict is `pass` and re-verification passes.
"""

from __future__ import annotations

import glob
import json
import sqlite3
from dataclasses import dataclass, field
from pathlib import Path

import yaml

from . import schema
from .stage import Stage
from .textutil import canonical_json, locate, sha256_text

VERIFIER = "harvest-import:v1"


@dataclass
class ImportReport:
    table: str
    files: int = 0
    rows: int = 0
    verdicts: dict = field(default_factory=lambda: {"pass": 0, "fail": 0, "needs_review": 0})
    problems: list = field(default_factory=list)


def _load(path: Path) -> list[dict]:
    text = path.read_text()
    if path.suffix == ".jsonl":
        return [json.loads(x) for x in text.splitlines() if x.strip()]
    data = json.loads(text) if path.suffix == ".json" else yaml.safe_load(text)
    if data is None:
        return []
    return data if isinstance(data, list) else [data]


def verify_refs(obj, stage: Stage) -> list[str]:
    """Walk a row: repair and check quotes, check every cited section id."""
    problems: list[str] = []

    def walk(o):
        if isinstance(o, dict):
            sid = o.get("section_id")
            qkey = "quote" if isinstance(o.get("quote"), str) else ("text" if o.get("t") == "quote" else None)
            if isinstance(sid, str) and sid:
                if not stage.exists(sid):
                    problems.append(f"unknown section_id {sid}")
                elif qkey and o.get(qkey):
                    exact = locate(o[qkey], stage.text(sid))
                    if exact is None:
                        problems.append(f"quote not verbatim in {sid}: {o[qkey][:60]!r}")
                    else:
                        o[qkey] = exact
            for k, v in o.items():
                if k == "section_ids" and isinstance(v, list):
                    problems.extend(f"unknown section_id {s}" for s in v if isinstance(s, str) and not stage.exists(s))
                else:
                    walk(v)
        elif isinstance(o, list):
            for v in o:
                walk(v)

    walk(obj)
    return problems


def _encode(v):
    return canonical_json(v) if isinstance(v, (list, dict)) else v


def _row(stage: Stage, table: str, src: dict, prov_id: str) -> dict:
    cols = schema.table_columns(stage.conn, table)
    r = {c: _encode(src[c]) for c in cols if c in src}
    if "lang" in cols:
        r.setdefault("lang", "en")
    if "prov_id" in cols:
        r["prov_id"] = prov_id
    if table == "question":
        r["answer"] = str(src.get("answer"))
        r["difficulty"] = float(src.get("difficulty", 0.5))
    return r


def import_topics(stage: Stage, path: Path, rep: "ImportReport") -> None:
    """A course blueprint: `topics: [{topic_id, ord, title, summary, parent_id?, skills: [{skill_id, title}]}]`.

    Topic and skill rows are authored structure, not generated, so they carry no provenance;
    every section id they name must exist (reported, not dropped)."""
    doc = yaml.safe_load(path.read_text()) or {}
    lang = doc.get("lang", "en")
    for k, t in enumerate(doc.get("topics") or [], 1):
        rep.rows += 1
        stage.insert("topic", {"topic_id": t["topic_id"], "parent_id": t.get("parent_id"), "ord": t.get("ord", k),
                               "title": t["title"], "summary": t.get("summary", ""), "lang": lang})
        rep.verdicts["pass"] += 1
        rep.problems += [f"{t['topic_id']}: unknown section_id {s}" for s in t.get("section_ids") or []
                         if not stage.exists(s)]
        for sk in t.get("skills") or []:
            stage.insert("skill", {"skill_id": sk["skill_id"], "topic_id": t["topic_id"], "title": sk["title"],
                                   "lang": lang})
            rep.problems += [f"{sk['skill_id']}: unknown section_id {s}" for s in sk.get("section_ids") or []
                             if not stage.exists(s)]


def import_rows(stage: Stage, corpus_dir: Path, specs: list[dict]) -> list[ImportReport]:
    reports = []
    for spec in specs:
        table = spec["table"]
        if table == "topic":
            rep = ImportReport("topic")
            for path in sorted({Path(p) for pat in spec["files"] for p in glob.glob(str(corpus_dir / pat))}):
                rep.files += 1
                import_topics(stage, path, rep)
            stage.commit()
            reports.append(rep)
            continue
        rep = ImportReport(table)
        paths = sorted({Path(p) for pat in spec["files"] for p in glob.glob(str(corpus_dir / pat))})
        rep.files = len(paths)
        for path in paths:
            for n, raw in enumerate(_load(path)):
                rep.rows += 1
                prov = dict(raw.get("prov") or {})
                body = {k: v for k, v in raw.items() if k != "prov"}
                problems = verify_refs(body, stage)
                own = prov.get("verdict", "needs_review")
                verdict = "fail" if problems else (own if own in ("pass", "fail", "needs_review") else "needs_review")
                rep.verdicts[verdict] += 1
                if problems:
                    rep.problems.append(f"{path.name}#{n}: {'; '.join(problems[:3])}")
                prov_id = prov.get("prov_id") or sha256_text(canonical_json(body))[:20]
                notes = [x for x in (prov.get("notes"), "; ".join(problems) or None) if x]
                stage.add_provenance({
                    "prov_id": prov_id, "backend": prov.get("backend", "import"), "model": prov.get("model", "unknown"),
                    "prompt_id": prov.get("prompt_id", f"import.{table}"), "prompt_version": str(prov.get("prompt_version", "0")),
                    "prompt_sha256": prov.get("prompt_sha256", ""), "input_sha256": prov.get("input_sha256", ""),
                    "output_sha256": prov.get("output_sha256") or sha256_text(canonical_json(body)),
                    "created_at": prov.get("created_at", ""),
                    "verifier": "+".join(x for x in (prov.get("verifier"), VERIFIER) if x), "verdict": verdict,
                    "notes": json.dumps({"key": f"{path.name}#{n}", "notes": "; ".join(notes) or None}),
                })
                try:
                    stage.insert(table, _row(stage, table, body, prov_id))
                except sqlite3.Error as e:
                    rep.problems.append(f"{path.name}#{n}: not a valid {table} row: {e}")
                    stage.add_provenance({**dict(stage.conn.execute("SELECT * FROM provenance WHERE prov_id=?",
                                                                    (prov_id,)).fetchone()), "verdict": "fail"})
                    rep.verdicts[verdict] -= 1
                    rep.verdicts["fail"] += 1
                    continue
                if table == "answer":
                    # the canonical question is itself an alias (the answer-cache lookup searches aliases)
                    for alias in dict.fromkeys([body.get("question"), *(body.get("aliases") or [])]):
                        if not alias:
                            continue
                        stage.insert("answer_alias", {"alias": alias, "answer_id": body["answer_id"],
                                                      "lang": body.get("lang", "en")})
                if table == "procedure":
                    for k, step in enumerate(body.get("steps") or [], 1):
                        s = {"proc_id": body["proc_id"], "ord": step.get("ord", k), "lang": body.get("lang", "en"), **step}
                        s.setdefault("detail", {})
                        s.setdefault("section_ids", [])
                        try:
                            stage.insert("proc_step", _row(stage, "proc_step", s, prov_id))
                        except sqlite3.Error as e:
                            rep.problems.append(f"{path.name}#{n} step {k}: {e}")
        stage.commit()
        reports.append(rep)
    return reports
