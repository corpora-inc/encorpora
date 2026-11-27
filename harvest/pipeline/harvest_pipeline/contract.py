"""Row shapes the core's read API enforces (harvest/CONTRACT.md), checked before a row can ship.

The core treats a malformed generated row as a pack error, so one bad question would take down
the whole question list in the app. The bake refuses such a row instead: it is imported with
verdict `fail` and the problem in its provenance notes. Keep these rules equal to
`harvest/core/src/content.rs` and `harvest/core/src/grade.rs`.
"""

from __future__ import annotations

import re

KINDS = ("mc", "free_text", "numeric")
CHECK_KINDS = ("pass_fail", "value", "note", "photo")
ROLES = ("trainee", "operator", "inspector")
RUBRIC_KEYS = {"points", "pass", "sample_answer", "misconceptions"}
POINT_KEYS = {"id", "point", "any"}

# "25", "25±0.5", "25 +/- 0.5", "1,200" (harvest/practice parseNumericKey, core parse_numeric_key)
_NUM = r"[-+]?(?:\d{1,3}(?:,\d{3})+|\d*)(?:\.\d*)?"
_NUMERIC_KEY = re.compile(rf"^\s*({_NUM})\s*(?:(?:±|\+/-|\+-)\s*({_NUM}))?\s*$")


def _is_number(s: str) -> bool:
    return bool(s) and any(c.isdigit() for c in s)


def numeric_key_ok(answer) -> bool:
    m = _NUMERIC_KEY.match(str(answer))
    if not m or not _is_number(m.group(1)):
        return False
    tol = m.group(2)
    return tol is None or (_is_number(tol) and not tol.startswith("-"))


def rubric_problems(rubric) -> list[str]:
    """The free-text rubric (CONTRACT "Free-text rubric")."""
    if not isinstance(rubric, dict):
        return [f"rubric is a {type(rubric).__name__}, not an object"]
    out = [f"rubric has unknown key {k!r}" for k in sorted(set(rubric) - RUBRIC_KEYS)]
    points = rubric.get("points")
    if not isinstance(points, list) or not points:
        return out + ["rubric has no points"]
    seen = set()
    for p in points:
        if not isinstance(p, dict):
            out.append("rubric point is not an object")
            continue
        out += [f"rubric point has unknown key {k!r}" for k in sorted(set(p) - POINT_KEYS)]
        pid = p.get("id")
        if not isinstance(pid, str) or not pid.strip() or pid in seen:
            out.append(f"rubric point id {pid!r} is empty or repeated")
        seen.add(pid)
        if not isinstance(p.get("point"), str) or not p["point"].strip():
            out.append(f"rubric point {pid!r} has no point text")
        alts = p.get("any")
        if not isinstance(alts, list) or not all(isinstance(a, str) for a in alts) or not any(a.strip() for a in alts):
            out.append(f"rubric point {pid!r} needs at least one phrase in any")
    need = rubric.get("pass")
    if need is not None and (isinstance(need, bool) or not isinstance(need, int) or not 1 <= need <= len(points)):
        out.append(f"rubric pass {need!r} is not a whole number from 1 to {len(points)}")
    if rubric.get("sample_answer") is not None and not isinstance(rubric["sample_answer"], str):
        out.append("rubric sample_answer is not text")
    mis = rubric.get("misconceptions")
    if mis is not None and not (isinstance(mis, list) and all(isinstance(m, str) for m in mis)):
        out.append("rubric misconceptions is not a list of text")
    return out


def question_problems(q: dict) -> list[str]:
    kind = q.get("kind")
    if kind not in KINDS:
        return [f"unknown kind {kind!r}"]
    out = []
    choices = q.get("choices") or []
    rationales = q.get("rationales") or []
    if kind == "mc":
        if not isinstance(choices, list) or len(choices) < 2:
            out.append("mc needs at least two choices")
        try:
            i = int(str(q.get("answer")).strip())
            if not 0 <= i < len(choices):
                out.append(f"mc answer {i} out of {len(choices)} choices")
        except ValueError:
            out.append(f"mc answer {q.get('answer')!r} is not an index")
        if rationales and len(rationales) != len(choices):
            out.append(f"{len(rationales)} rationales for {len(choices)} choices")
    elif kind == "numeric":
        if not numeric_key_ok(q.get("answer")):
            out.append(f"numeric answer {q.get('answer')!r} is not a number or number±tolerance")
    else:
        out += rubric_problems(q.get("answer"))
    return out


def deficiency_problems(d) -> list[str]:
    """`proc_step.deficiency`: null, or {guidance, action?, section_id, quote}; every deficiency
    cites the rule it breaks (the quote's verbatim check is the importer's)."""
    if d is None:
        return []
    if not isinstance(d, dict):
        return ["deficiency is not an object"]
    out = []
    if not isinstance(d.get("guidance"), str) or not d["guidance"].strip():
        out.append("deficiency has no guidance")
    if not isinstance(d.get("section_id"), str) or not d["section_id"]:
        out.append("deficiency cites no section")
    if not isinstance(d.get("quote"), str) or not d["quote"].strip():
        out.append("deficiency has no quote")
    if d.get("action") is not None and not isinstance(d["action"], str):
        out.append("deficiency action is not text")
    return out


def procedure_problems(p: dict) -> list[str]:
    steps = p.get("steps") or []
    if not steps:
        return ["procedure has no steps"]
    out = []
    for k, s in enumerate(steps, 1):
        if s.get("check_kind") not in CHECK_KINDS:
            out.append(f"step {k}: unknown check_kind {s.get('check_kind')!r}")
        detail = s.get("detail")
        if detail is not None and not (isinstance(detail, dict) and all(isinstance(v, str) for v in detail.values())):
            out.append(f"step {k}: detail is not {{role: text}}")
        out += [f"step {k}: {m}" for m in deficiency_problems(s.get("deficiency"))]
    return out


def row_problems(table: str, row: dict) -> list[str]:
    if table == "question":
        return question_problems(row)
    if table == "procedure":
        return procedure_problems(row)
    if table == "diagram":
        return [] if isinstance(row.get("svg"), str) and "<svg" in row["svg"] else ["diagram has no SVG markup"]
    return []


def _load_doc(path):
    import json as _json
    import yaml as _yaml
    text = path.read_text()
    return _json.loads(text) if path.suffix == ".json" else _yaml.safe_load(text)


def app_meta(corpus_dir, spec: dict | None, stage) -> tuple[dict[str, str], list[str]]:
    """pack_meta app keys from corpus files (CONTRACT "Content read API").

    `spec` (corpus YAML `pack_meta:`) maps a meta key to `{file, key?}`. Known keys are checked
    against the stage: `exam_blueprints` is an array whose skill ids exist, `skill_prereqs` is
    `{skill: [skill]}` over existing skills, `starter_answers` is `{role: [answer_id]}` over passing
    answers. Returns the JSON text per key and the problems; a problem means the build must stop."""
    from pathlib import Path
    from .textutil import canonical_json

    out, problems = {}, []
    skills = {r[0] for r in stage.conn.execute("SELECT skill_id FROM skill")}
    answers = {r[0] for r in stage.conn.execute(
        "SELECT answer_id FROM answer WHERE prov_id IN (SELECT prov_id FROM provenance WHERE verdict='pass')")}
    for meta_key, src in (spec or {}).items():
        path = Path(corpus_dir) / src["file"]
        if not path.is_file():
            problems.append(f"pack_meta.{meta_key}: {src['file']} not found")
            continue
        v = _load_doc(path)
        if src.get("key"):
            v = (v or {}).get(src["key"])
        if v is None:
            problems.append(f"pack_meta.{meta_key}: {src['file']} has no {src.get('key') or 'data'}")
            continue
        bad = []
        if meta_key == "exam_blueprints":
            if not isinstance(v, list):
                bad.append("is not an array")
            else:
                def walk(o):
                    if isinstance(o, dict):
                        for k, x in o.items():
                            if k in ("skillIds", "skill_ids") and isinstance(x, list):
                                bad.extend(f"unknown skill {s}" for s in x if s not in skills)
                            else:
                                walk(x)
                    elif isinstance(o, list):
                        for x in o:
                            walk(x)
                walk(v)
        elif meta_key == "skill_prereqs":
            if not isinstance(v, dict) or not all(isinstance(x, list) for x in v.values()):
                bad.append("is not {skill: [skill]}")
            else:
                bad += [f"unknown skill {s}" for k, xs in v.items() for s in [k, *xs] if s not in skills]
                bad += [f"prerequisite cycle through {k}" for k in sorted(_cycle_nodes(v))]
        elif meta_key == "starter_answers":
            if not isinstance(v, dict) or not all(isinstance(x, list) for x in v.values()):
                bad.append("is not {role: [answer_id]}")
            else:
                bad += [f"unknown role {r}" for r in v if r not in ROLES]
                bad += [f"{r}: answer {a} is missing or did not pass" for r, xs in v.items() for a in xs
                        if a not in answers]
        problems += [f"pack_meta.{meta_key}: {b}" for b in bad]
        out[meta_key] = canonical_json(v)
    return out, problems


def _cycle_nodes(graph: dict) -> set:
    """Skills on a prerequisite cycle (a cycle would keep them locked forever)."""
    done, stack, on_cycle = set(), [], set()

    def visit(n):
        if n in stack:
            on_cycle.update(stack[stack.index(n):])
            return
        if n in done:
            return
        stack.append(n)
        for m in graph.get(n, []):
            visit(m)
        stack.pop()
        done.add(n)

    for n in graph:
        visit(n)
    return on_cycle
