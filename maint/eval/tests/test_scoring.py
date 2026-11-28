"""Offline tests of the closed scoring rules (no engine, no model)."""
import unittest

from maint_eval import analysis, rank, t1, t2, t3
from maint_eval.text import sentences, states_number


class T1Scoring(unittest.TestCase):
    def test_parse_and_score(self):
        ids = ["s-a", "s-b", "s-c"]
        single = {"kind": "single", "gold": ["s-b"]}
        self.assertTrue(t1.score(single, ids, t1.parse({"decision": "pick", "candidate": 2}, 3))["correct"])
        r = t1.score(single, ids, t1.parse({"decision": "pick", "candidate": 1}, 3))
        self.assertTrue(r["wrong_pick"] and not r["correct"])
        self.assertEqual(t1.parse({"decision": "pick", "candidate": 9}, 3)["decision"], "error")
        # nested answers (Claude wrapper, two-step form) unwrap
        self.assertEqual(t1.parse({"answer": {"present": "no", "answer": {"decision": "none"}}}, 3)["decision"], "none")
        decline = {"kind": "decline", "gold": []}
        self.assertTrue(t1.score(decline, ids, {"decision": "none"})["correct"])
        amb = {"kind": "ambiguous", "gold": ["s-a", "s-c"]}
        self.assertTrue(t1.score(amb, ids, {"decision": "clarify", "between": [1, 3]})["correct"])
        self.assertFalse(t1.score(amb, ids, {"decision": "clarify", "between": [1, 2]})["correct"])

    def test_schema_twostep_forces_none(self):
        s = t1.schema(3, twostep=True)
        no = s["anyOf"][0]
        self.assertEqual(no["properties"]["present"]["const"], "no")
        self.assertEqual(no["properties"]["answer"]["properties"]["decision"]["const"], "none")


class T2Scoring(unittest.TestCase):
    def test_alternatives_accepted(self):
        gold = {"cause": {"kind": "unknown"}, "action": {"kind": "listed", "number": 1}, "parts": [], "minutes": None,
                "alt": {"cause": [{"kind": "listed", "number": 1}]}}
        pred = {"cause": {"kind": "listed", "number": 1}, "action": {"kind": "listed", "number": 1}, "parts": [],
                "minutes": None}
        r = t2.score(gold, pred)
        self.assertTrue(r["all"])
        self.assertFalse(r["invented_cause"])
        pred2 = dict(pred, cause={"kind": "listed", "number": 2})
        self.assertTrue(t2.score(gold, pred2)["invented_cause"])

    def test_from_v2(self):
        p = t2.from_v2({"cause": "C2", "cause_text": "", "action": "other", "action_text": "retorqued bolt",
                        "parts": ["P1", "other"], "parts_other": ["zip tie"], "minutes": 20, "note": ""})
        self.assertEqual(p["cause"], {"kind": "listed", "number": 2})
        self.assertEqual(p["action"]["kind"], "other")
        self.assertEqual([x["kind"] for x in p["parts"]], ["listed", "other"])


class T3Scoring(unittest.TestCase):
    def test_match_does_not_accept_a_title_inside_a_row(self):
        row = "Servo voltage to low Servo rail voltage below 4.3V Check power supply to rear servo rail"
        self.assertFalse(t3._match("Check power supply to rear servo rail", row))
        self.assertTrue(t3._match("Wait before you test it.", "Wait before you test it"))

    def test_score_and_connector(self):
        pool = [{"h": "S1", "label": "x", "text": "Cranking needs a charged battery; below 11.5 V the starter cannot turn the engine."},
                {"h": "S2", "label": "x", "text": "Set the multimeter to DC volts."}]
        item = {"kind": "answerable", "text": "how low can the battery be", "gold": {"required": [pool[0]["text"]], "acceptable": []}}
        r = t3.score(item, pool, {"kind": "answer", "sentences": ["S1"], "connector": "Check it reads at least 12 V first."})
        self.assertTrue(r["correct"])
        self.assertTrue(r["conn_own_content"])  # a number the shown sentence does not state
        r2 = t3.score(item, pool, {"kind": "answer", "sentences": ["S1"], "connector": "The manual says:"})
        self.assertFalse(r2["conn_own_content"])
        una = {"kind": "unanswerable", "text": "q", "gold": {"required": [], "acceptable": []}}
        self.assertTrue(t3.score(una, pool, {"kind": "decline"})["correct"])

    def test_sentences(self):
        self.assertEqual(sentences("1. Is the switch ON\nand fuse good?\n2. Pull F2."), ["Is the switch ON and fuse good?", "Pull F2."])
        self.assertTrue(states_number("about two minutes"))


class Ranking(unittest.TestCase):
    def test_rerank_and_route(self):
        hits = [{"id": "a", "lex": 0.6, "cos": 0.5, "cov": 0.6, "sh": 2, "sq": 3, "score": 0.0, "signal": False},
                {"id": "b", "lex": 0.1, "cos": 0.9, "cov": 0.1, "sh": 1, "sq": 3, "score": 0.0, "signal": False}]
        self.assertEqual([h["id"] for h in rank.rerank(hits, "lin:0.10")], ["b", "a"])
        self.assertEqual([h["id"] for h in rank.rerank(hits, "lex")], ["a", "b"])
        row = {"hits": [{**h, "lex_words": h["sh"]} for h in rank.rerank(hits, "lin:0.10")]}
        self.assertTrue(analysis.routes(row, 0.5, 1, 0.02, None, 0.85))   # cosine 0.9 alone, margin 0.31
        self.assertFalse(analysis.routes(row, 0.5, 1, 0.5, None, 0.85))   # margin too small


if __name__ == "__main__":
    unittest.main()
