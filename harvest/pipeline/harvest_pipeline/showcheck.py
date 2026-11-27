"""Read a built pack back through harvest-core's read API, the way the app does.

`harvest-bake showcheck PACK_DIR --harvest BIN --pubkey KEY [--out FILE]` runs `harvest show`
for every table, every lesson, diagram, procedure and question by id, and every answer in every
role. It fails when any call errors (the core refuses a malformed row as a pack error) or when the
core returns fewer rows than the pack holds (a row the app would never see). With `--out` it writes
everything it read as one JSON file (`harvest-show/1`): the app's browser build reads that copy,
since a browser cannot open the signed SQLite pack.
"""

from __future__ import annotations

import json
import subprocess
from pathlib import Path

ROLES = ("trainee", "operator", "inspector")
LISTS = ("info", "sections", "topics", "skills", "lessons", "terms", "diagrams", "questions", "procedures",
         "answers", "exams", "prereqs")
# show list -> pack table: the core must return every row of these (release packs hold pass rows only)
EXACT = {"topics": "topic", "skills": "skill", "terms": "term", "diagrams": "diagram", "questions": "question",
         "procedures": "procedure", "answers": "answer", "sections": "section"}


class ShowError(Exception):
    pass


def _table_counts(pack: Path) -> dict[str, int]:
    """Rows per table, counted in the database itself (the core's info reports only some tables)."""
    import sqlite3
    m = json.loads((pack / "manifest.json").read_text())
    db = next(f["path"] for f in m["files"] if f["path"].endswith(".sqlite"))
    con = sqlite3.connect(f"file:{pack / db}?mode=ro", uri=True)
    try:
        return {t: con.execute(f"SELECT count(*) FROM {t}").fetchone()[0]
                for t in (*EXACT.values(), "lesson")}
    finally:
        con.close()


def _show(binary: str, pack: Path, pubkey: str, what: str, *extra: str):
    cmd = [binary, "show", str(pack), what, "--pubkey", pubkey, *extra]
    r = subprocess.run(cmd, capture_output=True, text=True)
    if r.returncode != 0:
        raise ShowError(f"harvest show {what} {' '.join(extra)}: exit {r.returncode}: {r.stderr.strip()[:500]}")
    try:
        return json.loads(r.stdout)
    except json.JSONDecodeError as e:
        raise ShowError(f"harvest show {what} {' '.join(extra)}: not JSON: {e}") from e


def showcheck(pack: Path, binary: str, pubkey: str, app_data: bool = False) -> tuple[dict, list[str]]:
    """Returns (everything read, problems). Raises nothing: every failure is a problem."""
    out: dict = {"format": "harvest-show/1"}
    problems: list[str] = []

    def show(what, *extra):
        try:
            return _show(binary, pack, pubkey, what, *extra)
        except ShowError as e:
            problems.append(str(e))
            return None

    for what in LISTS:
        out[what] = show(what)
    out["starters"] = {r: show("starters", "--role", r) for r in ROLES}
    counts = _table_counts(pack)
    for what, table in EXACT.items():
        got, have = out.get(what), counts.get(table)
        if isinstance(got, list) and have is not None and len(got) != have:
            problems.append(f"show {what}: {len(got)} rows, the pack holds {have}")
    if isinstance(out.get("lessons"), list) and len(out["lessons"]) < counts.get("lesson", 0):
        problems.append(f"show lessons: the checker emptied {counts['lesson'] - len(out['lessons'])} lessons")

    for what, key in (("lessons", "lesson_id"), ("diagrams", "diagram_id"), ("questions", "q_id")):
        for row in out.get(what) or []:
            if show(what, "--id", row[key]) is None:
                break  # one failure per table is enough to read
    for p in out.get("procedures") or []:
        if not p.get("steps"):
            problems.append(f"procedure {p.get('proc_id')}: no steps")
        if show("procedures", "--id", p["proc_id"]) is None:
            break
    out["answer_bodies"] = {}
    for a in out.get("answers") or []:
        bodies = {r: show("answers", "--id", a["answer_id"], "--role", r) for r in ROLES}
        if any(b is None for b in bodies.values()):
            break
        out["answer_bodies"][a["answer_id"]] = bodies
    if app_data:
        if not out.get("exams"):
            problems.append("show exams: empty (pack_meta.exam_blueprints)")
        if not out.get("prereqs"):
            problems.append("show prereqs: empty (pack_meta.skill_prereqs)")
        problems += [f"show starters --role {r}: empty (pack_meta.starter_answers)"
                     for r, v in out["starters"].items() if not v]
    return out, problems
