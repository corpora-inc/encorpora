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
    assert conn.execute("SELECT verifier, model FROM provenance WHERE prov_id LIKE 'p1:%'").fetchone() == (
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


def _with_imports(corpus_dir, imports: str, extra: str = ""):
    y = corpus_dir / "corpus.yaml"
    y.write_text(y.read_text().replace("tasks: [terms, facts]", "tasks: []\nimports:\n" + imports) + extra)
    c = load_corpus(y)
    fetch(c)
    return c


def test_import_enforces_the_read_api_shapes(corpus_dir):
    import sqlite3
    data = corpus_dir / "data"
    data.mkdir()
    rubric = {"points": [{"id": "dist", "point": "Says 20 feet", "any": ["20 feet", "twenty feet"]}], "pass": 1,
              "sample_answer": "At least 20 feet.", "misconceptions": ["10 feet is enough."]}
    shared = {**prov(), "prov_id": "batch-1"}  # one generation call, many rows
    q = lambda qid, **kw: {"q_id": qid, "skill_id": "power.clearance", "kind": "mc", "stem": "How far?",
                           "choices": ["10 ft", "20 ft"], "answer": 1, "rationales": ["no", "yes"],
                           "section_ids": ["99cfr1999.12(a)(1)"], "lang": "en", "prov": shared, **kw}
    rows = [
        q("q.mc"),
        q("q.free", kind="free_text", choices=None, rationales=None, answer=rubric),
        q("q.num", kind="numeric", choices=None, rationales=None, answer="20±0.5"),
        q("q.bad-index", answer=5),
        q("q.bad-rubric", kind="free_text", choices=None, rationales=None,
          answer={"points": [{"id": "x", "text": "old shape", "keywords": ["x"]}], "pass": 0.7}),
        q("q.bad-num", kind="numeric", choices=None, rationales=None, answer="20 feet"),
        # same prov_id as the passing rows, but its own quote fails: it alone must not ship
        q("q.bad-quote", quotes=[{"section_id": "99cfr1999.12(a)(1)", "quote": "at least 99 feet"}]),
    ]
    (data / "q.jsonl").write_text("\n".join(json.dumps(r) for r in rows) + "\n")
    step = {"text": "Check the latch", "check_kind": "pass_fail", "section_ids": ["99cfr1999.12(i)"],
            "detail": {"trainee": "a", "operator": "b", "inspector": "c"}}
    procs = [
        {"proc_id": "cited", "title": "T", "kind": "inspection", "summary": "S", "roles": ["operator"],
         "steps": [{**step, "deficiency": {"guidance": "Tag out", "action": "stop", "section_id": "99cfr1999.12(i)",
                                           "quote": "The hook latch"}}], "prov": {**prov(), "prov_id": "pp"}},
        {"proc_id": "uncited", "title": "T", "kind": "inspection", "summary": "S", "roles": ["operator"],
         "steps": [{**step, "deficiency": {"guidance": "Tag out", "action": "stop", "section_id": None,
                                           "quote": None}}], "prov": {**prov(), "prov_id": "pp"}},
        {"proc_id": "practice", "title": "T", "kind": "inspection", "summary": "S", "roles": ["operator"],
         "steps": [{**step, "section_ids": [], "practice_only": True,
                    "deficiency": {"guidance": "Re-level", "action": "stop", "section_id": None, "quote": None}}],
         "prov": {**prov(), "prov_id": "pp"}},
    ]
    (data / "procs.json").write_text(json.dumps(procs))
    (corpus_dir / "fig").mkdir()
    (corpus_dir / "fig" / "a.svg").write_text('<svg xmlns="http://www.w3.org/2000/svg"><title>a</title></svg>')
    (corpus_dir / "fig" / "figs.yaml").write_text(textwrap.dedent("""
        diagrams:
          - {diagram_id: a, file: a.svg, caption: C, alt: A, lang: en, section_ids: ["99cfr1999.12(a)(1)"],
             quotes: [{section_id: "99cfr1999.12(a)(1)", quote: "at least 20 feet from an energized line"}]}
          - {diagram_id: missing, file: nope.svg, caption: C, alt: A, lang: en, section_ids: []}
    """))
    (corpus_dir / "blueprint.yaml").write_text(textwrap.dedent("""
        lang: en
        topics:
          - {topic_id: power, ord: 1, title: Power lines, summary: Clearance.,
             skills: [{skill_id: power.clearance, title: Know the clearance}, {skill_id: power.zone, title: Zone}]}
    """))
    (corpus_dir / "app.yaml").write_text("prereqs: {power.clearance: [power.zone]}\n")
    (corpus_dir / "exams.json").write_text(json.dumps([{"id": "core", "domains": [{"skillIds": ["power.zone"]}]}]))
    c = _with_imports(corpus_dir,
                      "  - {table: topic, files: [blueprint.yaml]}\n"
                      "  - {table: question, files: [data/q.jsonl]}\n"
                      "  - {table: procedure, files: [data/procs.json]}\n"
                      "  - {table: diagram, files: [fig/figs.yaml], key: diagrams, file_columns: {svg: file},\n"
                      "     prov: {backend: human, model: human, prompt_id: figs, verdict: pass}}\n",
                      "pack_meta:\n  exam_blueprints: {file: exams.json}\n"
                      "  skill_prereqs: {file: app.yaml, key: prereqs}\n")
    res = build(c, c.profile(), log=None)
    conn = sqlite3.connect(res["path"])
    got = dict(conn.execute("SELECT q_id, answer FROM question").fetchall())
    assert sorted(got) == ["q.free", "q.mc", "q.num"]
    assert json.loads(got["q.free"]) == rubric and got["q.mc"] == "1" and got["q.num"] == "20±0.5"
    assert len({r[0] for r in conn.execute("SELECT prov_id FROM question")}) == 3  # one provenance row each
    assert sorted(r[0] for r in conn.execute("SELECT proc_id FROM procedure")) == ["cited", "practice"]
    basis = {r[0]: json.loads(r[1])["basis"] for r in conn.execute("SELECT proc_id, deficiency FROM proc_step")}
    assert basis == {"cited": "rule", "practice": "practice"}
    assert [r[0] for r in conn.execute("SELECT diagram_id FROM diagram")] == ["a"]
    assert conn.execute("SELECT svg FROM diagram").fetchone()[0].startswith("<svg")
    meta = dict(conn.execute("SELECT key, value FROM pack_meta").fetchall())
    assert json.loads(meta["skill_prereqs"]) == {"power.clearance": ["power.zone"]}
    assert json.loads(meta["exam_blueprints"])[0]["id"] == "core"
    notes = " ".join(r[0] for r in conn.execute("SELECT notes FROM provenance WHERE notes IS NOT NULL"))
    report = json.loads(open(res["report"]).read())
    errors = " ".join(e for t in report["tasks"] for e in t["errors"])
    assert "mc answer 5 out of 2" in errors and "rubric point has unknown key 'text'" in errors
    assert "numeric answer '20 feet'" in errors and "deficiency must cite a section" in errors
    assert "nope.svg" in errors and notes is not None


def test_pack_meta_ids_are_checked(corpus_dir):
    import pytest
    (corpus_dir / "blueprint.yaml").write_text("lang: en\ntopics:\n  - {topic_id: t, ord: 1, title: T, summary: S,"
                                               " skills: [{skill_id: t.a, title: A}, {skill_id: t.b, title: B}]}\n")
    (corpus_dir / "app.yaml").write_text("prereqs: {t.a: [t.b], t.b: [t.a], t.c: [t.a]}\n"
                                         "starters: {operator: [a.none], pilot: []}\n")
    c = _with_imports(corpus_dir, "  - {table: topic, files: [blueprint.yaml]}\n",
                      "pack_meta:\n  skill_prereqs: {file: app.yaml, key: prereqs}\n"
                      "  starter_answers: {file: app.yaml, key: starters}\n")
    with pytest.raises(SystemExit) as e:
        build(c, c.profile(), log=None)
    msg = str(e.value)
    assert "unknown skill t.c" in msg and "prerequisite cycle through t.a" in msg
    assert "answer a.none is missing" in msg and "unknown role pilot" in msg


def test_unquoted_comma_in_a_blueprint_title_fails_the_import(corpus_dir):
    import pytest
    (corpus_dir / "blueprint.yaml").write_text(
        "lang: en\ntopics:\n  - {topic_id: t, ord: 1, title: T, summary: S, skills: [\n"
        "      {skill_id: t.a, title: Know the power line, drill shaft and tank cases, kind: knowledge}]}\n")
    c = _with_imports(corpus_dir, "  - {table: topic, files: [blueprint.yaml]}\n")
    with pytest.raises(SystemExit) as e:
        build(c, c.profile(), log=None)
    assert "t.a: 'drill shaft and tank cases' is not a key" in str(e.value)


def test_segment_kinds_are_checked():
    from harvest_pipeline.contract import body_problems
    ok = [{"t": "text", "text": "a"}, {"t": "cite", "section_id": "s"}, {"t": "quote", "section_id": "s", "text": "q"},
          {"t": "diagram", "diagram_id": "d"}, {"t": "check", "question": "Q?", "answer": "A."}]
    assert body_problems(ok) == [] and body_problems(json.dumps(ok)) == []
    assert body_problems([{"t": "quiz", "q": "x"}]) == ["segment 0: unknown kind 'quiz'"]
    assert body_problems([{"t": "check", "question": "Q?"}]) == ["segment 0 (check): no answer"]


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
