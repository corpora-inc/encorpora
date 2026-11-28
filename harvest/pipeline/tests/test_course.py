import json
import textwrap

from harvest_pipeline.cli import main
from harvest_pipeline.course import problems, skeleton


def write(p, text):
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(textwrap.dedent(text))


def test_skeleton_builds_the_tree_and_keeps_written_text(tmp_path):
    bp = tmp_path / "blueprint.yaml"
    write(bp, """
        exams:
          - exam_id: core
            title: Core exam
            domains:
              - {domain_id: core.site, title: Site, weight: 0.5}
              - {domain_id: core.ops, title: Operations, weight: 0.5}
        topics:
          - topic_id: power
            ord: 1
            title: Power lines
            summary: Clearance.
            section_ids: ["s.1"]
            skills:
              - {skill_id: power.clear, title: "Know the clearance, by voltage", section_ids: ["s.1(a)"], exam: [core.site.3]}
              - {skill_id: power.spot, title: Use a spotter, section_ids: ["s.1(b)"], exam: [core.ops.5, core.site]}
              - {skill_id: power.cut, title: Know A, B and C, exam: [core.ops.1]}
    """)
    write(tmp_path / "data/lessons/power.json", json.dumps([
        {"lesson_id": "l.power.1", "topic_id": "power", "skills": ["power.clear"]}]))
    write(tmp_path / "data/questions/power.jsonl", json.dumps({"q_id": "q1", "skill_id": "power.spot"}) + "\n")
    write(tmp_path / "diagrams/diagrams.yaml", """
        diagrams:
          - {diagram_id: d.zone, section_ids: ["s.1(a)"]}
    """)
    rows = skeleton(bp, tmp_path, "Crane course")
    by = {r["node_id"]: r for r in rows}
    assert by["course"]["title"] == "Crane course"
    assert by["exam:core"]["parent_id"] == "course"
    assert by["domain:core.site"]["links"]["node_ids"] == ["skill:power.clear", "skill:power.spot"]
    assert by["domain:core.ops"]["links"]["node_ids"] == ["skill:power.spot", "skill:power.cut"]
    assert by["topic:power"]["summary"] == "Clearance." and by["topic:power"]["links"]["lesson_ids"] == ["l.power.1"]
    clear = by["skill:power.clear"]
    assert clear["parent_id"] == "topic:power" and clear["section_ids"] == ["s.1(a)"]
    assert clear["links"] == {"lesson_ids": ["l.power.1"], "diagram_ids": ["d.zone"]}
    assert by["skill:power.spot"]["links"]["q_ids"] == ["q1"]
    assert all(r["prov"]["verdict"] == "pass" and r["prov"]["backend"] == "deterministic" for r in rows)
    assert problems(bp) == ["power.cut: title cut at a comma (quote it): 'Know A' + ['B and C']"]

    # Regenerating keeps the content lane's text, quotes, films and provenance.
    written = dict(clear, hard="Picking the band.", quotes=[{"section_id": "s.1(a)", "quote": "q"}],
                   links={**clear["links"], "film_ids": ["film.table-a"]}, prov={"prov_id": "lane-1", "verdict": "pass"})
    again = {r["node_id"]: r for r in skeleton(bp, tmp_path, "Crane course", [written])}
    c2 = again["skill:power.clear"]
    assert c2["hard"] == "Picking the band." and c2["quotes"][0]["quote"] == "q"
    assert c2["links"]["film_ids"] == ["film.table-a"] and c2["prov"]["prov_id"] == "lane-1"
    # Text without provenance of its own is never stamped as passed.
    bare = {k: v for k, v in written.items() if k != "prov"}
    again = {r["node_id"]: r for r in skeleton(bp, tmp_path, "Crane course", [bare])}
    assert again["skill:power.clear"]["prov"]["verdict"] == "needs_review"
    assert again["skill:power.spot"]["prov"]["verdict"] == "pass"


def test_course_skeleton_cli_writes_jsonl(tmp_path, capsys):
    bp = tmp_path / "blueprint.yaml"
    write(bp, """
        topics:
          - {topic_id: t, ord: 1, title: T, summary: S, skills: [{skill_id: t.a, title: A}]}
    """)
    out = tmp_path / "course/tree.jsonl"
    assert main(["course-skeleton", str(bp), "--out", str(out), "--title", "C"]) == 0
    rows = [json.loads(x) for x in out.read_text().splitlines()]
    assert [r["node_id"] for r in rows] == ["course", "topic:t", "skill:t.a"]
    assert "3 nodes" in capsys.readouterr().err
