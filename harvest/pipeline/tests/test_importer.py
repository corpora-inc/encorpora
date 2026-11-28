import json
import textwrap

from harvest_pipeline.corpus import load_corpus
from harvest_pipeline.fetch import fetch
from harvest_pipeline.pipeline import build


def prov(verdict="pass"):
    return {"prov_id": f"p-{verdict}-x", "backend": "claude-cli", "model": "m-1", "prompt_id": "crane.q",
            "prompt_version": "1", "prompt_sha256": "a", "input_sha256": "b", "output_sha256": "c",
            "created_at": "2026-01-01", "verifier": "lane:v1", "verdict": verdict, "notes": None}


def test_imports_reverify_and_ship_only_pass(corpus_dir):
    data = corpus_dir / "data"
    data.mkdir()
    rows = [
        {"answer_id": "a1", "question": "How far from a 50 kV line?", "level": "operator", "lang": "en",
         "section_ids": ["99cfr1999.12(a)(1)"], "aliases": ["power line distance", "line clearance"],
         "body": [{"t": "text", "text": "Keep back."},
                  {"t": "quote", "section_id": "99cfr1999.12(a)(1)", "text": "at least 20 feet from an energized line"}],
         "prov": {**prov(), "prov_id": "p1"}},
        {"answer_id": "a2", "question": "Bad quote", "lang": "en", "section_ids": ["99cfr1999.12"],
         "body": [{"t": "quote", "section_id": "99cfr1999.12", "text": "at least 99 feet"}], "prov": {**prov(), "prov_id": "p2"}},
        {"answer_id": "a3", "question": "Unknown id", "lang": "en", "section_ids": ["99cfr1999.77"],
         "body": [{"t": "cite", "section_id": "99cfr1999.77"}], "prov": {**prov(), "prov_id": "p3"}},
        {"answer_id": "a4", "question": "Their own fail", "lang": "en", "section_ids": [], "body": [],
         "prov": {**prov("fail"), "prov_id": "p4"}},
    ]
    (data / "answers.jsonl").write_text("\n".join(json.dumps(r) for r in rows) + "\n")
    (data / "proc.yaml").write_text(textwrap.dedent("""
        proc_id: pre-shift
        title: Pre-shift check
        kind: inspection
        summary: Daily check.
        roles: [operator]
        lang: en
        steps:
          - {text: Check the latch, check_kind: pass_fail, section_ids: ["99cfr1999.12(i)"],
             detail: {trainee: a, operator: b, inspector: c},
             deficiency: {guidance: Tag out, action: stop, section_id: "99cfr1999.12(i)", quote: "The hook latch"}}
        prov: {prov_id: p5, backend: claude-cli, model: m-1, prompt_id: crane.p, prompt_version: "1",
               prompt_sha256: a, input_sha256: b, output_sha256: c, created_at: x, verifier: lane, verdict: pass}
    """))
    (corpus_dir / "blueprint.yaml").write_text(textwrap.dedent("""
        lang: en
        topics:
          - {topic_id: power, ord: 1, title: Power lines, summary: Clearance., section_ids: ["99cfr1999.12(a)", "99cfr1999.99"],
             skills: [{skill_id: power.clearance, title: Know the clearance}]}
    """))
    y = corpus_dir / "corpus.yaml"
    y.write_text(y.read_text().replace("tasks: [terms, facts]", "tasks: []\nimports:\n"
                                       "  - {table: topic, files: [blueprint.yaml]}\n"
                                       "  - {table: answer, files: [data/answers.jsonl]}\n"
                                       "  - {table: procedure, files: [data/proc.yaml]}"))
    c = load_corpus(y)
    fetch(c)
    res = build(c, c.profile(), log=None)
    import sqlite3
    conn = sqlite3.connect(res["path"])
    assert [r[0] for r in conn.execute("SELECT answer_id FROM answer")] == ["a1"]
    assert sorted(r[0] for r in conn.execute("SELECT alias FROM answer_alias")) == [
        "How far from a 50 kV line?", "line clearance", "power line distance"]
    assert conn.execute("SELECT ref_id FROM chunk WHERE ref_kind='proc_step'").fetchall() == [("pre-shift#1",)]
    body = json.loads(conn.execute("SELECT body FROM answer").fetchone()[0])
    assert body[1]["text"] == "at least 20 feet from an energized line"
    assert conn.execute("SELECT verifier, model FROM provenance WHERE prov_id='p1'").fetchone() == (
        "lane:v1+harvest-import:v1", "m-1")
    step = conn.execute("SELECT text, check_kind, section_ids, deficiency FROM proc_step").fetchone()
    assert step[0] == "Check the latch" and json.loads(step[2]) == ["99cfr1999.12(i)"]
    assert json.loads(step[3])["quote"] == "The hook latch"
    hits = conn.execute("SELECT a.answer_id FROM alias_fts f JOIN answer_alias a ON a.rowid=f.rowid "
                        "WHERE alias_fts MATCH 'clearance'").fetchall()
    assert hits == [("a1",)]
    report = json.loads(open(res["report"]).read())
    imp = {t["task"]: t for t in report["tasks"]}["import:answer"]
    assert imp["verdicts"] == {"pass": 1, "fail": 3, "needs_review": 0}
    assert conn.execute("SELECT topic_id, title FROM topic").fetchall() == [("power", "Power lines")]
    assert conn.execute("SELECT skill_id, topic_id FROM skill").fetchall() == [("power.clearance", "power")]
    topic_rep = {t["task"]: t for t in report["tasks"]}["import:topic"]
    assert topic_rep["errors"] == ["power: unknown section_id 99cfr1999.99"]


def test_course_tree_imports_checks_links_and_indexes_apart(corpus_dir):
    data = corpus_dir / "data"
    data.mkdir()
    p = {**prov(), "prov_id": "n"}
    nodes = [
        {"node_id": "course", "level": "course", "ord": 1, "title": "Crane course",
         "summary": "Everything you need for the written exam.", "hard": "", "mistakes": "", "exam": "",
         "links": {"node_ids": ["topic:power"]}, "section_ids": [], "quotes": [], "prov": {**p, "prov_id": "n1"}},
        {"node_id": "topic:power", "parent_id": "course", "level": "topic", "ord": 1, "title": "Power lines",
         "summary": "How close a crane may get to an energized line.",
         "hard": "Reading the clearance table by voltage band.", "mistakes": "Measuring from the wrong point.",
         "exam": "Table lookups.", "links": {"node_ids": ["skill:power.clearance"], "lesson_ids": []},
         "section_ids": ["99cfr1999.12(a)(1)"],
         "quotes": [{"section_id": "99cfr1999.12(a)(1)", "quote": "at least 20 feet from an energized line"}],
         "prov": {**p, "prov_id": "n2"}},
        {"node_id": "skill:power.clearance", "parent_id": "topic:power", "level": "skill", "ord": 1,
         "title": "Know the clearance", "summary": "s", "hard": "", "mistakes": "", "exam": "",
         "links": {"lesson_ids": ["no-such-lesson"]}, "section_ids": [], "quotes": [], "prov": {**p, "prov_id": "n3"}},
        {"node_id": "topic:wind", "parent_id": "nowhere", "level": "chapter", "ord": 2, "title": "Wind",
         "summary": "w", "hard": "", "mistakes": "", "exam": "", "links": {}, "section_ids": [], "quotes": [],
         "prov": {**p, "prov_id": "n4"}},
    ]
    (data / "tree.jsonl").write_text("\n".join(json.dumps(r) for r in nodes) + "\n")
    y = corpus_dir / "corpus.yaml"
    y.write_text(y.read_text().replace("tasks: [terms, facts]", "tasks: []\nimports:\n"
                                       "  - {table: course_node, files: [data/tree.jsonl]}"))
    c = load_corpus(y)
    fetch(c)
    res = build(c, c.profile(), log=None)
    import sqlite3
    conn = sqlite3.connect(res["path"])
    # a bad lesson link and a bad level fail their rows; the rest ship
    assert [r[0] for r in conn.execute("SELECT node_id FROM course_node ORDER BY node_id")] == [
        "course", "topic:power"]
    q = json.loads(conn.execute("SELECT quotes FROM course_node WHERE node_id='topic:power'").fetchone()[0])
    assert q[0]["quote"] == "at least 20 feet from an energized line"
    report = json.loads(open(res["report"]).read())
    imp = {t["task"]: t for t in report["tasks"]}["import:course_node"]
    assert imp["verdicts"] == {"pass": 2, "fail": 2, "needs_review": 0}
    assert any("unknown lesson_id no-such-lesson" in e for e in imp["errors"])
    assert any("unknown parent_id nowhere" in e for e in imp["errors"])
    # nodes are their own index, never mixed into the rule chunks
    assert conn.execute("SELECT count(*) FROM chunk WHERE ref_kind LIKE '%node%'").fetchone()[0] == 0
    assert conn.execute("SELECT count(*) FROM course_node_vec").fetchone()[0] == 2
