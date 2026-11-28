"""Release gate over synthetic finished runs: no harness run, no judge, no network."""
from __future__ import annotations

import csv
import json
import sqlite3
import sys
import tempfile
import unittest
from pathlib import Path

HERE = Path(__file__).parent
sys.path.insert(0, str(HERE.parent))

from harvest_eval.cli import main  # noqa: E402
from harvest_eval.gate import gate  # noqa: E402

SHA = "ab" * 32
BAR = {"fresh_sets": {"fresh": SHA}, "min_items": 4,
       "thresholds": {"fully_correct": 0.9, "declines": 0.95, "unsupported_claims": 0, "quote_verbatim": 1.0,
                      "cites_exist": 1.0},
       "must_beat": ["frontier"], "category_floor": 0.9, "contamination": {"leak": 0.9, "near": 0.6}}
ITEMS = [  # id, question, category, must_decline
    ("q1", "how often do we inspect the hook", "inspections", False),
    ("q2", "minimum distance from a 50 kv line", "power-lines", False),
    ("q3", "who checks the ground before setup", "ground-conditions", False),
    ("q4", "what torque on the boom pins for my crane model", "decline-manufacturer", True),
]


def agg(fc: float, tp: int, unsupported: int, quotes_ok: int = 3, errors: int = 0) -> dict:
    return {"n": 4, "errors": errors, "n_answerable": 3, "n_must_decline": 1, "grades_missing": [],
            "correctness": {"fully_correct": fc, "fully_correct_ci95": [fc, fc]},
            "decline": {"tp": tp, "recall": tp / 1}, "claims": {"supported": 5, "unsupported": unsupported},
            "unsupported_claim_rate": unsupported / (5 + unsupported), "quotes": {"total": 3, "verbatim_ok": quotes_ok},
            "quote_verbatim_rate": quotes_ok / 3, "cites_exist_rate": 1.0}


UNJUDGED: set = set()
GOOD = (agg(1.0, 1, 0), ["2", "2", "2", "2"], [False, False, False, True])
FRONT = (agg(0.67, 1, 4), ["2", "2", "0", "2"], [False, False, False, True])


def write_run(d: Path, backends: dict, sha: str = SHA) -> Path:
    d.mkdir(parents=True)
    (d / "results.json").write_text(json.dumps({
        "meta": {"set": {"path": str(d.parent / "set.jsonl"), "sha256": sha, "items": 4}},
        "backends": {k: v[0] for k, v in backends.items()}}))
    with (d / "items.csv").open("w", newline="") as f:
        w = csv.DictWriter(f, fieldnames=["backend", "id", "category", "must_decline", "ok", "declined", "score",
                                          "claims_supported", "claims_unsupported"])
        w.writeheader()
        for name, (_a, scores, declined) in backends.items():
            for (i, _q, cat, md), sc, dec in zip(ITEMS, scores, declined):
                judged = "" if (name, i) in UNJUDGED else ("" if dec else "2")
                w.writerow({"backend": name, "id": i, "category": cat, "must_decline": md, "ok": True,
                            "declined": dec, "score": sc, "claims_supported": judged,
                            "claims_unsupported": "" if judged == "" else "0"})
    return d


class Gate(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.d = Path(self.tmp.name)
        with (self.d / "set.jsonl").open("w") as f:
            for i, q, cat, md in ITEMS:
                f.write(json.dumps({"id": i, "question": q, "category": cat, "must_decline": md}) + "\n")

    def tearDown(self):
        self.tmp.cleanup()

    def crit(self, out, name):
        return next(c for c in out["checks"] if c["criterion"].startswith(name))

    def test_pass_and_each_failure(self):
        out = gate(BAR, [write_run(self.d / "run", {"sys": GOOD, "frontier": FRONT})], "sys", None)
        self.assertTrue(out["pass"], out["checks"])
        bad = (agg(0.67, 0, 1, quotes_ok=2), ["2", "2", "0", "0"], [False, False, False, False])
        out = gate(BAR, [write_run(self.d / "run2", {"sys": bad, "frontier": FRONT})], "sys", None)
        self.assertFalse(out["pass"])
        for name in ("fully correct", "correct declines", "unsupported claims", "every quote verbatim",
                     "beats frontier"):
            self.assertFalse(self.crit(out, name)["pass"], name)
        cats = {c["category"]: c for c in out["by_category"]}
        self.assertTrue(cats["ground-conditions"]["below_floor"])
        self.assertTrue(cats["decline-manufacturer"]["below_floor"])
        self.assertFalse(cats["inspections"]["below_floor"])

    def test_unregistered_set_small_set_and_missing_comparison_fail(self):
        out = gate({**BAR, "min_items": 300}, [write_run(self.d / "run", {"sys": GOOD}, sha="cd" * 32)], "sys", None)
        self.assertFalse(self.crit(out, "fresh held-out set")["pass"])
        self.assertFalse(self.crit(out, "set size")["pass"])
        self.assertFalse(self.crit(out, "beats frontier")["pass"])

    def test_comparison_from_another_run_and_mixed_sets_refused(self):
        a = write_run(self.d / "a", {"sys": GOOD})
        b = write_run(self.d / "b", {"frontier": FRONT})
        self.assertTrue(gate(BAR, [a, b], "sys", None)["pass"])
        c = write_run(self.d / "c", {"frontier": FRONT}, sha="ef" * 32)
        with self.assertRaises(SystemExit):
            gate(BAR, [a, c], "sys", None)

    def test_copied_question_in_the_pack_fails(self):
        run = write_run(self.d / "run", {"sys": GOOD, "frontier": FRONT})
        db = self.d / "pack.sqlite"
        con = sqlite3.connect(db)
        con.execute("CREATE TABLE answer_alias (alias TEXT, answer_id TEXT, lang TEXT)")
        con.execute("CREATE TABLE answer (answer_id TEXT, question TEXT)")
        con.execute("CREATE TABLE question (q_id TEXT, stem TEXT)")
        con.execute("INSERT INTO answer_alias VALUES ('How often do we inspect the hook?', 'a1', 'en')")
        con.execute("INSERT INTO question VALUES ('x1', 'what is the minimum clearance distance from a 50 kv power line')")
        con.commit()
        con.close()
        out = gate(BAR, [run], "sys", db, self.d / "set.jsonl")
        self.assertFalse(self.crit(out, "set not in the bake")["pass"])
        self.assertEqual([w["id"] for w in out["contamination"]["leaks"]], ["q1"])
        self.assertEqual([w["id"] for w in out["contamination"]["near"]], ["q2"])

    def test_hidden_set_withholds_item_text(self):
        run = write_run(self.d / "run", {"sys": GOOD, "frontier": FRONT})
        db = self.d / "pack.sqlite"
        con = sqlite3.connect(db)
        con.execute("CREATE TABLE answer_alias (alias TEXT, answer_id TEXT, lang TEXT)")
        con.execute("INSERT INTO answer_alias VALUES ('How often do we inspect the hook?', 'a1', 'en')")
        con.commit()
        con.close()
        out = gate({**BAR, "hidden_sets": ["fresh"]}, [run], "sys", db, self.d / "set.jsonl")
        self.assertTrue(out["set"]["hidden"])
        self.assertNotIn("path", out["set"])
        self.assertEqual(out["contamination"]["leaks"][0]["id"], "q1")
        self.assertNotIn("question", out["contamination"]["leaks"][0])
        self.assertNotIn("pack_text", out["contamination"]["leaks"][0])
        from harvest_eval.gate import write
        md = write(out, None)
        self.assertNotIn("inspect the hook", md.lower())

    def test_missing_support_verdict_fails(self):
        UNJUDGED.add(("sys", "q2"))
        try:
            out = gate(BAR, [write_run(self.d / "run", {"sys": GOOD, "frontier": FRONT})], "sys", None)
        finally:
            UNJUDGED.clear()
        self.assertFalse(self.crit(out, "every shipped answer has a support verdict")["pass"])
        self.assertFalse(out["pass"])

    def test_unhealthy_comparison_fails(self):
        bad_front = ({**agg(0.3, 1, 0, errors=40)}, ["0", "0", "0", "2"], [False, False, False, True])
        out = gate(BAR, [write_run(self.d / "run", {"sys": GOOD, "frontier": bad_front})], "sys", None)
        self.assertFalse(self.crit(out, "beats frontier")["pass"])

    def test_edited_hidden_set_and_empty_pack_fail_closed(self):
        run = write_run(self.d / "run", {"sys": GOOD, "frontier": FRONT}, sha="99" * 32)
        db = self.d / "empty.sqlite"
        sqlite3.connect(db).close()
        out = gate(BAR, [run], "sys", db, self.d / "set.jsonl")
        self.assertTrue(out["set"]["hidden"])
        self.assertNotIn("path", out["set"])
        self.assertFalse(self.crit(out, "set not in the bake")["pass"])

    def test_cli_exit_code_and_outputs(self):
        run = write_run(self.d / "run", {"sys": GOOD, "frontier": FRONT})
        (self.d / "bar.json").write_text(json.dumps(BAR))
        rc = main(["gate", "--bar", str(self.d / "bar.json"), "--run", str(run), "--system", "sys",
                   "--out", str(self.d / "g")])
        self.assertEqual(rc, 0)
        self.assertTrue((self.d / "g" / "gate-sys.md").exists())
        bar = {**BAR, "thresholds": {**BAR["thresholds"], "fully_correct": 1.01}}
        (self.d / "bar.json").write_text(json.dumps(bar))
        self.assertEqual(main(["gate", "--bar", str(self.d / "bar.json"), "--run", str(run), "--system", "sys"]), 1)


if __name__ == "__main__":
    unittest.main()
