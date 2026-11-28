"""Import rows generated outside the engine (a content lane's own runner) into the stage.

corpus YAML:

```yaml
imports:
  - {table: term,      files: [data/glossary.jsonl]}
  - {table: question,  files: ["data/questions/*.jsonl"]}
  - {table: answer,    files: ["data/answers/*.jsonl"]}      # row "aliases" -> answer_alias
  - {table: lesson,    files: ["data/lessons/*.json"]}
  - {table: procedure, files: ["procedures/*.yaml"]}          # row "steps" -> proc_step
  - {table: diagram,   files: [diagrams/diagrams.yaml], key: diagrams, file_columns: {svg: file},
     prov: {backend: human, model: human, prompt_id: diagrams, verdict: pass}}
  - {table: topic,     files: [blueprint.yaml]}               # topics + nested skills
  - {table: course_node, files: ["course/*.jsonl"]}           # the course tree; import it last
```

Files are JSONL, a JSON array, or YAML (a list or one document; `key` names the list inside a
document). Each row has the contract columns plus a `prov` object with the contract provenance
columns; a spec's `prov` is the default for rows without one (hand-authored rows). `file_columns`
fills a column from the file a row names, relative to that file (`{svg: file}`). Lists and objects
in TEXT columns are JSON-encoded (a free-text question's rubric `answer` included); other keys are
dropped.

Rows must also have the shapes the core's read API enforces (`contract.py`): a question that does
not fit its kind, a body with an unknown segment, or a procedure with a malformed step ships as
`fail`. A deficiency either cites its rule with a quote (`basis: rule`) or cites nothing and is
marked practice (`basis: practice`, or a `practice_only` step); the stored row always says which.

Every row is re-verified against the stage before it can ship: each `{section_id, quote}` pair
and each answer segment `{"t": "quote", section_id, text}` must be verbatim (typographic quote and
dash glyphs are repaired to the source's characters), each `section_id`/`section_ids` must exist.
The shipped verdict is `pass` only when the row's own verdict is `pass` and re-verification passes.
"""

from __future__ import annotations

import glob
import json
import re
import sqlite3
from dataclasses import dataclass, field
from pathlib import Path

import yaml

from . import contract, schema
from .stage import Stage
from .textutil import canonical_json, locate, sha256_text

VERIFIER = "harvest-import:v1"
PRIMARY_KEY = {"question": "q_id", "answer": "answer_id", "procedure": "proc_id", "diagram": "diagram_id",
               "term": "term_id", "lesson": "lesson_id"}


@dataclass
class ImportReport:
    table: str
    files: int = 0
    rows: int = 0
    verdicts: dict = field(default_factory=lambda: {"pass": 0, "fail": 0, "needs_review": 0})
    problems: list = field(default_factory=list)


def _load(path: Path, key: str | None = None) -> list[dict]:
    text = path.read_text()
    if path.suffix == ".jsonl":
        return [json.loads(x) for x in text.splitlines() if x.strip()]
    data = json.loads(text) if path.suffix == ".json" else yaml.safe_load(text)
    if key is not None:
        data = (data or {}).get(key)
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
        a = src.get("answer")
        # a free-text rubric is JSON text; an mc index or numeric key is its plain text
        r["answer"] = canonical_json(a) if isinstance(a, (dict, list)) else str(a)
        r["difficulty"] = float(src.get("difficulty", 0.5))
    return r


def import_topics(stage: Stage, path: Path, rep: "ImportReport") -> None:
    """A course blueprint: `topics: [{topic_id, ord, title, summary, parent_id?, skills: [{skill_id, title}]}]`.

    Topic and skill rows are authored structure, not generated, so they carry no provenance;
    every section id they name must exist (reported, not dropped)."""
    doc = yaml.safe_load(path.read_text()) or {}
    split = _split_keys(doc.get("topics") or [])
    if split:
        raise SystemExit(f"{path.name}: " + "; ".join(split[:10]) + (f" (+{len(split) - 10} more)" if len(split) > 10 else ""))
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


_KEY = re.compile(r"^[a-z_][a-z0-9_]*$")


def _split_keys(topics: list) -> list[str]:
    """Keys that are fragments of a value, not keys: in a YAML flow mapping an unquoted comma ends
    the value, so `{title: Know A, B and C, kind: x}` reads as title "Know A" plus keys "B and C".
    A real key is a plain identifier; anything else means a value lost its tail."""
    out = []
    for t in topics:
        for row, id_key in [(t, "topic_id"), *((sk, "skill_id") for sk in (t.get("skills") or []))]:
            bad = [k for k in row if not (isinstance(k, str) and _KEY.match(k))]
            if bad:
                out.append(f"{row.get(id_key)}: {', '.join(repr(k) for k in bad)} is not a key; quote the value "
                           f"before it (an unquoted comma split {row.get('title')!r})")
    return out


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
            for n, raw in enumerate(_load(path, spec.get("key"))):
                rep.rows += 1
                prov = dict(raw.get("prov") or spec.get("prov") or {})
                body = {k: v for k, v in raw.items() if k != "prov"}
                problems = []
                for col, name_key in (spec.get("file_columns") or {}).items():
                    f = path.parent / str(body.get(name_key, ""))
                    if body.get(name_key) and f.is_file() and f.resolve().is_relative_to(corpus_dir.resolve()):
                        body[col] = f.read_text()
                    else:
                        problems.append(f"{col}: file {body.get(name_key)!r} not found under the corpus")
                problems += verify_refs(body, stage)
                problems += contract.row_problems(table, body)
                if table == "course_node":
                    problems += node_link_problems(body, stage)
                own = prov.get("verdict", "needs_review")
                verdict = "fail" if problems else (own if own in ("pass", "fail", "needs_review") else "needs_review")
                rep.verdicts[verdict] += 1
                if problems:
                    rep.problems.append(f"{path.name}#{n}: {'; '.join(problems[:3])}")
                # One provenance row per imported row: a generation call often yields many rows under
                # one prov_id, and their verdicts differ, so a shared id would ship a failed row (or
                # drop a passing one) with its siblings. The source id stays the prefix.
                base = prov.get("prov_id") or sha256_text(canonical_json(body))[:20]
                row_key = body.get(PRIMARY_KEY.get(table, ""))
                prov_id = f"{base}:{sha256_text(f'{table}:{row_key}')[:10]}" if row_key else base
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
                        if isinstance(s.get("deficiency"), dict):
                            # the reader always learns whether a rule backs it (CONTRACT)
                            basis = contract.deficiency_basis(s["deficiency"], bool(step.get("practice_only")))
                            s["deficiency"] = {**s["deficiency"], "basis": basis}
                        s.setdefault("detail", {})
                        s.setdefault("section_ids", [])
                        try:
                            stage.insert("proc_step", _row(stage, "proc_step", s, prov_id))
                        except sqlite3.Error as e:
                            # a procedure ships whole or not at all (the core hides one with a bad step)
                            rep.problems.append(f"{path.name}#{n} step {k}: {e}")
                            if verdict != "fail":
                                stage.add_provenance({**dict(stage.conn.execute(
                                    "SELECT * FROM provenance WHERE prov_id=?", (prov_id,)).fetchone()),
                                    "verdict": "fail"})
                                rep.verdicts[verdict] -= 1
                                rep.verdicts["fail"] += 1
                                verdict = "fail"
        if table == "course_node":
            rep.problems += dangling_nodes(stage)
        stage.commit()
        reports.append(rep)
    return reports


NODE_LEVELS = ("course", "exam", "domain", "topic", "skill")
# links key -> (table, id column) the linked id must exist in. `film_ids` name films the app
# resolves from its own media catalog, so they are not checked here.
NODE_LINKS = {"lesson_ids": ("lesson", "lesson_id"), "q_ids": ("question", "q_id"),
              "diagram_ids": ("diagram", "diagram_id")}


def node_link_problems(body: dict, stage: Stage) -> list[str]:
    """A course-tree node: a known level, and every linked lesson, question and diagram exists in the
    stage (import `course_node` after the tables it links to)."""
    problems = []
    if body.get("level") not in NODE_LEVELS:
        problems.append(f"level {body.get('level')!r} is not one of {', '.join(NODE_LEVELS)}")
    links = body.get("links") or {}
    if not isinstance(links, dict):
        return problems + ["links is not an object"]
    for key, (table, col) in NODE_LINKS.items():
        for i in links.get(key) or []:
            if stage.conn.execute(f"SELECT 1 FROM {table} WHERE {col} = ?", (i,)).fetchone() is None:
                problems.append(f"unknown {key[:-1]} {i}")
    return problems


def dangling_nodes(stage: Stage) -> list[str]:
    """Parents and `links.node_ids` that name no node (reported once the whole tree is in)."""
    ids = {r[0] for r in stage.conn.execute("SELECT node_id FROM course_node")}
    out = []
    for nid, parent, links in stage.conn.execute("SELECT node_id, parent_id, links FROM course_node ORDER BY node_id"):
        if parent and parent not in ids:
            out.append(f"{nid}: unknown parent_id {parent}")
        try:
            named = (json.loads(links or "{}") or {}).get("node_ids") or []
        except ValueError:
            named = []
        out += [f"{nid}: unknown node {n}" for n in named if n not in ids]
    return out
