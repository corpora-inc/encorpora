"""The course knowledge tree's skeleton, from the authored blueprint and content files.

`harvest-bake course-skeleton <blueprint.yaml> --content <dir> [--existing tree.jsonl]` writes one
`course_node` row per node (CONTRACT "course_node"):

    course
    ├── exam:<exam_id>            each exam in the blueprint
    │   └── domain:<domain_id>    links.node_ids: the skills whose `exam` refs fall in the domain
    └── topic:<topic_id>          section_ids and lessons of the topic
        └── skill:<skill_id>      its section_ids, lessons, questions and diagrams

The structure is derived; the text (summary, hard, mistakes, exam, quotes) and film links are the
content lane's. With `--existing`, every node keeps the text, quotes, film links and provenance it
already has, so the skeleton can be regenerated whenever the blueprint changes. A row's provenance
covers its text: new rows get a deterministic `pass` (structure only, no claims).
"""

from __future__ import annotations

import glob
import json
from pathlib import Path

import yaml

from .textutil import canonical_json, sha256_text

TEXT = ("summary", "hard", "mistakes", "exam")


def _rows(path: Path) -> list[dict]:
    text = path.read_text()
    if path.suffix == ".jsonl":
        return [json.loads(x) for x in text.splitlines() if x.strip()]
    data = json.loads(text) if path.suffix == ".json" else yaml.safe_load(text)
    if data is None:
        return []
    if isinstance(data, dict):
        # `{diagrams: [...]}`: a file holding one named list; any other object is one row.
        lists = [v for v in data.values() if isinstance(v, list)]
        data = lists[0] if len(data) == 1 and lists else [data]
    return data if isinstance(data, list) else [data]


def _glob(content: Path, pattern: str) -> list[dict]:
    out = []
    for p in sorted(glob.glob(str(content / pattern), recursive=True)):
        out += _rows(Path(p))
    return out


def skeleton(blueprint: Path, content: Path, title: str, existing: list[dict] | None = None,
             lang: str = "en") -> list[dict]:
    bp = yaml.safe_load(blueprint.read_text()) or {}
    lessons = _glob(content, "data/lessons/*.json")
    questions = _glob(content, "data/questions/*.jsonl")
    diagrams = _glob(content, "diagrams/*.yaml") + _glob(content, "diagrams/*.json")
    old = {r["node_id"]: r for r in existing or []}
    rows: list[dict] = []

    def node(node_id, parent, ord_, level, node_title, section_ids=(), **links):
        r = {"node_id": node_id, "parent_id": parent, "ord": ord_, "level": level, "title": node_title,
             **{k: "" for k in TEXT}, "links": {k: v for k, v in links.items() if v},
             "section_ids": list(dict.fromkeys(section_ids)), "quotes": [], "lang": lang}
        prev = old.get(node_id)
        if prev:
            for k in (*TEXT, "quotes"):
                if prev.get(k):
                    r[k] = prev[k]
            if (prev.get("links") or {}).get("film_ids"):
                r["links"]["film_ids"] = prev["links"]["film_ids"]
        rows.append(r)
        return r

    node("course", None, 0, "course", title)
    skills = [(t, s) for t in bp.get("topics") or [] for s in t.get("skills") or []]
    for i, e in enumerate(bp.get("exams") or [], 1):
        node(f"exam:{e['exam_id']}", "course", i, "exam", e.get("title", e["exam_id"]))
        for j, d in enumerate(e.get("domains") or [], 1):
            did = d["domain_id"]
            linked = [f"skill:{s['skill_id']}" for _, s in skills
                      if any(str(x) == did or str(x).startswith(did + ".") for x in s.get("exam") or [])]
            node(f"domain:{did}", f"exam:{e['exam_id']}", j, "domain", d.get("title", did),
                 node_ids=list(dict.fromkeys(linked)))
    topic_ids = {t["topic_id"] for t in bp.get("topics") or []}
    for k, t in enumerate(bp.get("topics") or [], 1):
        tid = t["topic_id"]
        parent = f"topic:{t['parent_id']}" if t.get("parent_id") in topic_ids else "course"
        r = node(f"topic:{tid}", parent, 100 + int(t.get("ord", k)), "topic", t["title"], t.get("section_ids") or [],
                 lesson_ids=[x["lesson_id"] for x in lessons if x.get("topic_id") == tid])
        if not r["summary"]:
            r["summary"] = t.get("summary", "")
    for k, (t, s) in enumerate(skills, 1):
        sid = s["skill_id"]
        secs = s.get("section_ids") or []
        node(f"skill:{sid}", f"topic:{t['topic_id']}", k, "skill", s["title"], secs,
             lesson_ids=[x["lesson_id"] for x in lessons if sid in (x.get("skills") or [])],
             q_ids=[q["q_id"] for q in questions if q.get("skill_id") == sid],
             diagram_ids=[d["diagram_id"] for d in diagrams if d.get("diagram_id") and (
                 sid in (d.get("skills") or d.get("skill_ids") or [])
                 or set(d.get("section_ids") or []) & set(secs))])
    for r in rows:
        prev = old.get(r["node_id"])
        if (prev or {}).get("prov"):
            r["prov"] = prev["prov"]
            continue
        # Structure alone states nothing and passes; text with no provenance of its own waits for review.
        written = any(r[k] for k in TEXT if not (r["level"] == "topic" and k == "summary")) or r["quotes"]
        r["prov"] = {
            "prov_id": "course-skeleton-" + sha256_text(canonical_json({k: r[k] for k in ("node_id", "title")}))[:16],
            "backend": "deterministic", "model": "none", "prompt_id": "course.skeleton", "prompt_version": "1",
            "verifier": "course-skeleton:v1", "verdict": "needs_review" if written else "pass"}
    return rows


def problems(blueprint: Path) -> list[str]:
    """Authoring slips the skeleton would carry into the tree: a flow-mapping title cut at a comma
    (`{title: A, B}` parses as title "A" plus a key "B")."""
    bp = yaml.safe_load(blueprint.read_text()) or {}
    out = []
    for t in bp.get("topics") or []:
        for item in [t, *(t.get("skills") or [])]:
            cut = cut_keys(item)
            if cut:
                iid = item.get("skill_id") or item.get("topic_id")
                out.append(f"{iid}: title cut at a comma (quote it): {item.get('title')!r} + {cut}")
    return out


BLUEPRINT_KEYS = {"skill_id", "topic_id", "parent_id", "ord", "title", "summary", "kind", "levels",
                  "section_ids", "exam", "skills"}


def cut_keys(item: dict) -> list[str]:
    """Keys a flow-mapping comma split off the title: not a blueprint key, and no value."""
    return [k for k, v in item.items() if v is None and k not in BLUEPRINT_KEYS]
