import json

from harvest_eval import converse
from harvest_eval.judge import Judge


class FakePack(converse.Pack):
    def __init__(self):
        self.exams = [{"id": "core", "title": "Core", "minutes": 90,
                       "domains": [{"title": "Site", "weight": 0.22, "count": 21}]}]
        self._cache = {}

    def show(self, what, id_=None):
        return {
            ("sections", "s.1"): {"citation": "§ 1408(a)", "heading": "Power lines"},
            ("lessons", "l.1"): {"title": "Clearance basics"},
            ("questions", "q.1"): {"stem": "How far?", "choices": ["10 ft", "20 ft"], "answer": "1",
                                   "rationales": ["Too close.", "Stated in Table A."]},
        }.get((what, id_))

    def search(self, query, k=3):
        return [{"citation": "§ 1408(a)", "heading": "Power lines"}]


def test_render_and_judge(tmp_path):
    convs = tmp_path / "c.json"
    convs.write_text(json.dumps([{"id": "c1", "category": "rule", "goal": "Gives the clearance."}]))
    turn = {"who": "instructor", "status": "done", "model": "m", "trace": {"elapsed_ms": 900, "dropped": ["x"]},
            "blocks": [{"t": "text", "text": "Here is the rule."},
                       {"t": "quote", "section_id": "s.1", "text": "at least 20 feet"},
                       {"t": "cite", "section_id": "s.1"},
                       {"t": "exam", "exam_id": "core"},
                       {"t": "lesson", "lesson_id": "l.1"},
                       {"t": "question", "q_id": "q.1", "chosen": 0},
                       {"t": "search", "query": "unknown voltage"},
                       {"t": "node", "node_id": "topic:x", "level": "topic", "title": "X", "path": [],
                        "texts": [{"field": "hard", "text": "Bands are tricky."}]}],
            "follow_ups": [{"label": "Practice this", "input": {"kind": "practice", "skill_id": "a"}}]}
    tr = tmp_path / "t.jsonl"
    tr.write_text(json.dumps({"id": "c1", "turns": [{"said": None, "turn": {**turn, "model": None}},
                                                    {"said": "how far", "turn": turn}]}) + "\n")
    rows = converse.render(tr, convs, FakePack())
    text = rows[0]["text"]
    for s in ["LEARNER: how far", "“at least 20 feet”", "(§ 1408(a))", "Site 22% (21 questions)",
              "[lesson card: Clearance basics]", "You chose: 10 ft. Correct: 20 ft.", "Bands are tricky.",
              "shows: § 1408(a) Power lines", "[suggested next: Practice this | Practice this]"[:30]]:
        assert s in text, s
    assert rows[0]["latency_ms"] == [900] and rows[0]["dropped"] == 2

    def fake(system, schema, prompt, model, binary):
        assert "GOAL: Gives the clearance." in prompt
        g = {"key": "K0", "fluency": 5, "correctness": 4, "citations": 5, "honesty": 5, "teaching": 4,
             "goal_met": True, "unsupported": 0, "why": "ok"}
        return {"grades": [g]}, ["claude-opus"], 0.01

    grades = converse.judge(rows, Judge(tmp_path / "cache", call=fake))
    s = converse.summarize(rows, grades)
    assert s["n"] == 1 and s["score"] == 4.6 and s["goal_met"] == 1.0 and s["turn_ms_p50"] == 900
    assert s["by_category"]["rule"]["n"] == 1
