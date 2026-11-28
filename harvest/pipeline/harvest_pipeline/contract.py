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
# ASCII digits only, an optional leading minus (a leading plus is refused, as practice does)
_NUM = r"-?(?:\d{1,3}(?:,\d{3})+|\d*)(?:\.\d*)?"
_NUMERIC_KEY = re.compile(rf"^\s*({_NUM})\s*(?:(?:±|\+/-|\+-)\s*({_NUM}))?\s*$", re.ASCII)


def _is_number(s: str) -> bool:
    return bool(s) and any(c.isdigit() for c in s)


def numeric_key_ok(answer) -> bool:
    m = _NUMERIC_KEY.match(str(answer))
    if not m or not _is_number(m.group(1)):
        return False
    tol = m.group(2)
    return tol is None or (_is_number(tol) and not tol.startswith("-"))


def _text_list(v) -> bool:
    return isinstance(v, list) and all(isinstance(x, str) for x in v)


def _index(v) -> int | None:
    """An mc key: a non-negative int, or its ASCII digits as text (what the core parses as usize)."""
    if isinstance(v, int) and not isinstance(v, bool):
        return v if v >= 0 else None
    if isinstance(v, str) and re.fullmatch(r"\s*\d+\s*", v, re.ASCII):
        return int(v)
    return None


def rubric_problems(rubric) -> list[str]:
    """The free-text rubric (CONTRACT "Free-text rubric"). A JSON string is read as its JSON."""
    if isinstance(rubric, str):
        import json
        try:
            rubric = json.loads(rubric)
        except json.JSONDecodeError:
            return ["rubric is text that is not JSON"]
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
        else:
            seen.add(pid)
        if not isinstance(p.get("point"), str) or not p["point"].strip():
            out.append(f"rubric point {pid!r} has no point text")
        alts = p.get("any")
        if not isinstance(alts, list) or not all(isinstance(a, str) for a in alts) or not any(a.strip() for a in alts):
            out.append(f"rubric point {pid!r} needs at least one phrase in any")
    need = rubric.get("pass")  # absent means all; null is refused (practice's parseRubric throws on it)
    if "pass" in rubric and (isinstance(need, bool) or not isinstance(need, int) or not 1 <= need <= len(points)):
        out.append(f"rubric pass {need!r} is not a whole number from 1 to {len(points)}")
    if rubric.get("sample_answer") is not None and not isinstance(rubric["sample_answer"], str):
        out.append("rubric sample_answer is not text")
    # absent is fine; null is not (the core reads it as a list)
    if "misconceptions" in rubric and not _text_list(rubric["misconceptions"]):
        out.append("rubric misconceptions is not a list of text")
    return out


def question_problems(q: dict) -> list[str]:
    kind = q.get("kind")
    if kind not in KINDS:
        return [f"unknown kind {kind!r}"]
    out = []
    for key in ("q_id", "skill_id", "stem"):
        if not isinstance(q.get(key), str) or not q[key].strip():
            out.append(f"question has no {key}")
    if not _text_list(q.get("section_ids")):
        out.append("section_ids is not a list of section ids")
    choices = q.get("choices") or []
    rationales = q.get("rationales") or []
    for key, v in (("choices", choices), ("rationales", rationales)):
        if not _text_list(v):
            out.append(f"{key} is not a list of text")
    if kind == "mc":
        if not isinstance(choices, list) or len(choices) < 2:
            out.append("mc needs at least two choices")
        i = _index(q.get("answer"))
        if i is None:
            out.append(f"mc answer {q.get('answer')!r} is not an index")
        elif i >= len(choices):
            out.append(f"mc answer {i} out of {len(choices)} choices")
        if rationales and len(rationales) != len(choices):
            out.append(f"{len(rationales)} rationales for {len(choices)} choices")
    elif kind == "numeric":
        if not numeric_key_ok(q.get("answer")):
            out.append(f"numeric answer {q.get('answer')!r} is not a number or number±tolerance")
    else:
        out += rubric_problems(q.get("answer"))
    return out


def deficiency_basis(d: dict, practice_step: bool = False) -> str | None:
    """`rule` when the deficiency cites a section and quotes it; `practice` when it cites nothing
    and is marked practice (its own `basis`, or a `practice_only` step); None when neither holds."""
    cited = isinstance(d.get("section_id"), str) and bool(d["section_id"].strip())
    quoted = isinstance(d.get("quote"), str) and bool(d["quote"].strip())
    basis = d.get("basis")
    if cited and quoted and basis in (None, "rule"):
        return "rule"
    if not cited and not quoted and (basis == "practice" or (basis is None and practice_step)):
        return "practice"
    return None


def deficiency_problems(d, practice_step: bool = False) -> list[str]:
    """`proc_step.deficiency`: null, or {guidance, action?, basis, section_id, quote}. A rule
    deficiency cites its section with a quote (the importer checks it is verbatim); a practice one
    cites nothing and is marked as practice, so it is never shown as a rule."""
    if d is None:
        return []
    if not isinstance(d, dict):
        return ["deficiency is not an object"]
    out = []
    if not isinstance(d.get("guidance"), str) or not d["guidance"].strip():
        out.append("deficiency has no guidance")
    if d.get("action") is not None and not isinstance(d["action"], str):
        out.append("deficiency action is not text")
    if deficiency_basis(d, practice_step) is None:
        out.append("deficiency must cite a section with a quote (a rule) or cite nothing and be marked "
                   "practice (basis: practice, or a practice_only step)")
    return out


def procedure_problems(p: dict) -> list[str]:
    steps = p.get("steps") or []
    if not isinstance(p.get("proc_id"), str) or not p["proc_id"].strip():
        return ["procedure has no proc_id"]
    if not steps:
        return ["procedure has no steps"]
    out = []
    ords = [s.get("ord", k) for k, s in enumerate(steps, 1)]
    if len(set(ords)) != len(ords):
        out.append("procedure has repeated step ord")
    for k, s in enumerate(steps, 1):
        if not _text_list(s.get("section_ids", [])):
            out.append(f"step {k}: section_ids is not a list of section ids")
        if s.get("check_kind") not in CHECK_KINDS:
            out.append(f"step {k}: unknown check_kind {s.get('check_kind')!r}")
        detail = s.get("detail")
        if detail is not None and not (isinstance(detail, dict) and all(isinstance(v, str) for v in detail.values())):
            out.append(f"step {k}: detail is not {{role: text}}")
        out += [f"step {k}: {m}" for m in deficiency_problems(s.get("deficiency"), bool(s.get("practice_only")))]
    return out


SEGMENT_FIELDS = {"text": ("text",), "quote": ("section_id", "text"), "cite": ("section_id",),
                  "diagram": ("diagram_id",), "check": ("question", "answer")}


def body_problems(body) -> list[str]:
    """Answer-segment JSON (CONTRACT): every segment a kind the core reads, with its fields as text."""
    if isinstance(body, str):
        import json
        try:
            body = json.loads(body)
        except json.JSONDecodeError:
            return ["body is text that is not JSON"]
    if not isinstance(body, list):
        return ["body is not a list of segments"]
    out = []
    for k, seg in enumerate(body):
        kind = seg.get("t") if isinstance(seg, dict) else None
        if kind not in SEGMENT_FIELDS:
            out.append(f"segment {k}: unknown kind {kind!r}")
            continue
        missing = [f for f in SEGMENT_FIELDS[kind] if not isinstance(seg.get(f), str) or not seg[f].strip()]
        if missing:
            out.append(f"segment {k} ({kind}): no {', '.join(missing)}")
    return out


def row_problems(table: str, row: dict) -> list[str]:
    if table in ("lesson", "answer"):
        return body_problems(row.get("body"))
    if table == "question":
        return question_problems(row)
    if table == "procedure":
        return procedure_problems(row)
    if table == "diagram":
        out = [] if isinstance(row.get("svg"), str) and "<svg" in row["svg"] else ["diagram has no SVG markup"]
        if not isinstance(row.get("diagram_id"), str) or not row["diagram_id"].strip():
            out.append("diagram has no diagram_id")
        if not _text_list(row.get("section_ids")):
            out.append("section_ids is not a list of section ids")
        return out
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
