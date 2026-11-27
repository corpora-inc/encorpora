"""Harness tests. Run from harvest/eval:  python3 -m unittest discover -s tests -v

Everything runs offline: a toy pack built here, a stub `harvest` (CONTRACT
JSON), a stub `claude` for the judge and the frontier baseline, and a local
HTTP server for the OpenAI-compatible baseline.
"""
from __future__ import annotations

import csv
import http.server
import json
import sqlite3
import sys
import tempfile
import threading
import unittest
from pathlib import Path

HERE = Path(__file__).parent
sys.path.insert(0, str(HERE.parent))

from harvest_eval import metrics  # noqa: E402
from harvest_eval.backends import HarvestBackend, OpenAIBackend, split_claims  # noqa: E402
from harvest_eval.cli import main  # noqa: E402
from harvest_eval.corpus import Corpus  # noqa: E402
from harvest_eval.sections import Normalizer, base, cites_in_text, match  # noqa: E402

# A toy corpus with the same id shape as a CFR pack, on a neutral subject.
SECTIONS = [
    ("29cfr9999.10", None, "section", "Ladders."),
    ("29cfr9999.10(a)", "29cfr9999.10", "paragraph", "Each ladder must be inspected before each shift by a competent person."),
    ("29cfr9999.10(b)", "29cfr9999.10", "paragraph", "Ladders must extend at least 3 feet above the landing surface."),
    ("29cfr9999.10(b)(1)", "29cfr9999.10(b)", "paragraph", "Where that is not possible, grab rails must be provided."),
    ("29cfr9999.11", None, "section", "Guardrails."),
    ("29cfr9999.11(a)", "29cfr9999.11", "paragraph", "Top rails must be 42 inches plus or minus 3 inches above the walking level."),
    ("29cfr9999.11-tableA", "29cfr9999.11", "table", "Table A Rail | Height ; Top rail | 42 in ; Mid rail | 21 in"),
]
SET = [
    {"id": "t-1", "question": "how often do ladders get inspected", "category": "inspections",
     "gold_answer": "Before each shift, by a competent person.", "section_ids": ["29cfr9999.10(a)"],
     "key_quote": {"section_id": "29cfr9999.10(a)", "text": "inspected before each shift"},
     "must_decline": False, "equipment": None, "difficulty": "easy"},
    {"id": "t-2", "question": "how far above the landing must ladders extend", "category": "ladders",
     "gold_answer": "At least 3 feet.", "section_ids": ["29cfr9999.10(b)"], "key_quote": None,
     "must_decline": False, "equipment": "step-ladder", "difficulty": "easy"},
    {"id": "t-3", "question": "top rails height guardrails walking level", "category": "guardrails",
     "gold_answer": "42 inches plus or minus 3 inches.", "section_ids": ["29cfr9999.11(a)"], "key_quote": None,
     "must_decline": False, "equipment": None, "difficulty": "medium"},
    {"id": "t-4", "question": "what torque for the bolts on my brand X lift", "category": "decline-manufacturer",
     "gold_answer": "Not covered; manufacturer data.", "section_ids": [], "key_quote": None,
     "must_decline": True, "equipment": None, "difficulty": "easy"},
]


def build_pack(d: Path) -> Path:
    db = d / "toy-1.sqlite"
    con = sqlite3.connect(db)
    con.executescript("""
    CREATE TABLE pack_meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
    CREATE TABLE section (section_id TEXT PRIMARY KEY, source_id TEXT, parent_id TEXT, ord INTEGER, depth INTEGER,
      kind TEXT, citation TEXT, heading TEXT, text TEXT NOT NULL, text_sha256 TEXT, lang TEXT);
    CREATE TABLE fact (fact_id TEXT PRIMARY KEY, section_id TEXT NOT NULL, kind TEXT, statement TEXT, quote TEXT,
      value TEXT, unit TEXT, lang TEXT, prov_id TEXT);
    CREATE TABLE answer (answer_id TEXT PRIMARY KEY, question TEXT, body TEXT, section_ids TEXT, level TEXT,
      lang TEXT, prov_id TEXT);
    CREATE TABLE chunk (chunk_id TEXT PRIMARY KEY, ref_kind TEXT NOT NULL, ref_id TEXT NOT NULL, text TEXT, lang TEXT);
    """)
    con.execute("INSERT INTO pack_meta VALUES ('version', 'toy-2026.11.27-1')")
    for i, (sid, parent, kind, text) in enumerate(SECTIONS):
        con.execute("INSERT INTO section VALUES (?,?,?,?,?,?,?,?,?,?,?)",
                    (sid, "toy", parent, i, sid.count("("), kind, sid, None, text, "", "en"))
        con.execute("INSERT INTO chunk VALUES (?,?,?,?,?)", (f"c{i}", "section", sid, text, "en"))
    con.execute("INSERT INTO fact VALUES ('f1','29cfr9999.10(b)','limit','3 ft','at least 3 feet','3','ft','en','p')")
    con.execute("INSERT INTO chunk VALUES ('cf1','fact','f1','ladder extend 3 feet above landing','en')")
    con.execute("INSERT INTO answer VALUES ('a1','how often do ladders get inspected','[]','[]',NULL,'en','p')")
    con.commit()
    con.close()
    return db


class SectionTests(unittest.TestCase):
    def test_levels(self):
        g = "29cfr1926.1408(a)(2)"
        self.assertTrue(match("29cfr1926.1408(a)(2)(i)", g, "strict"))
        self.assertFalse(match("29cfr1926.1408(a)", g, "strict"))
        self.assertTrue(match("29cfr1926.1408(a)", g, "lineage"))
        self.assertFalse(match("29cfr1926.1408(a)(20)", g, "lineage"))
        self.assertFalse(match("29cfr1926.1408(b)", g, "lineage"))
        self.assertTrue(match("29cfr1926.1408(b)", g, "section"))
        self.assertTrue(match("29cfr1926.1408-tableA", "29cfr1926.1408", "strict"))
        self.assertEqual(base("29cfr1926.1408-tableA"), "29cfr1926.1408")
        self.assertEqual(base("29cfr1926-subpartCC-appC(b)(1)"), "29cfr1926-subpartCC-appC")

    def test_cites_in_text(self):
        t = "See § 1926.1408(a)(2) and 29 CFR 1910.180(c)(1)(i); also 1926.1431."
        self.assertEqual(cites_in_text(t), ["29cfr1926.1408(a)(2)", "29cfr1910.180(c)(1)(i)", "29cfr1926.1431"])

    def test_aliases(self):
        n = Normalizer([(r"-appendix-([A-Z])", r"-app\1")])
        self.assertEqual(n("§29cfr1926-subpartCC-appendix-C(a)"), "29cfr1926-subpartCC-appC(a)")


class MetricTests(unittest.TestCase):
    def test_retrieval_at_k(self):
        ret = ["29cfr1.1(b)", "29cfr1.1(a)(1)", "29cfr1.2"]
        p, r = metrics.retrieval_at_k(ret, ["29cfr1.1(a)"], 1, "strict")
        self.assertEqual((p, r), (0.0, 0.0))
        p, r = metrics.retrieval_at_k(ret, ["29cfr1.1(a)"], 3, "strict")
        self.assertAlmostEqual(p, 1 / 3)
        self.assertEqual(r, 1.0)
        p, r = metrics.retrieval_at_k(ret, ["29cfr1.1(a)", "29cfr1.3"], 3, "section")
        self.assertAlmostEqual(p, 2 / 3)
        self.assertEqual(r, 0.5)
        self.assertEqual(metrics.first_hit_rank(ret, ["29cfr1.2"], "strict"), 3)

    def test_decline_and_correctness(self):
        rows = [
            {"id": "1", "must_decline": True, "declined": True, "score": 2, "ok": True},
            {"id": "2", "must_decline": True, "declined": False, "score": 0, "ok": True},
            {"id": "3", "must_decline": False, "declined": True, "score": 0, "ok": True},
            {"id": "4", "must_decline": False, "declined": False, "score": 2, "ok": True},
            {"id": "5", "must_decline": False, "declined": False, "score": 1, "ok": True},
        ]
        for r in rows:
            r.update({"category": "c", "equipment": None, "difficulty": "easy", "mode": "text", "baked": False,
                      "n_cites": 0, "n_quotes": 0, "quotes_ok": 0, "cites_exist": 0, "elapsed_ms": 10.0,
                      "wall_ms": 12.0})
        a = metrics.aggregate(rows, is_harvest=False)
        self.assertEqual(a["decline"]["precision"], 0.5)
        self.assertEqual(a["decline"]["recall"], 0.5)
        self.assertAlmostEqual(a["decline"]["false_decline_rate"], 1 / 3)
        self.assertAlmostEqual(a["correctness"]["fully_correct"], 1 / 3)
        self.assertAlmostEqual(a["correctness"]["mean_score"], 0.5)
        self.assertEqual(a["correctness"]["must_decline_handled"], 0.5)

    def test_agreement_and_sign(self):
        a = [{"score": 2, "declined": False}, {"score": 1, "declined": False}, {"score": 0, "declined": True}]
        b = [{"score": 2, "declined": False}, {"score": 2, "declined": False}, {"score": 0, "declined": True}]
        ag = metrics.agreement(a, b)
        self.assertAlmostEqual(ag["exact_agreement"], 2 / 3)
        self.assertLess(ag["cohen_kappa"], 1.0)
        self.assertEqual(metrics.sign_test(0, 0), None)
        self.assertAlmostEqual(metrics.sign_test(5, 0), 0.0625)
        self.assertEqual(metrics.pct([1, 2, 3, 4], 0.5), 2.5)

    def test_split_claims(self):
        c = split_claims("Keep 10 feet away. The operator must stop.\n\n- Use a spotter when needed.")
        self.assertEqual(len(c), 3)


class CorpusTests(unittest.TestCase):
    def test_pack(self):
        with tempfile.TemporaryDirectory() as d:
            db = build_pack(Path(d))
            c = Corpus.from_pack(Path(d))
            self.assertEqual(c.version, "toy-2026.11.27-1")
            self.assertTrue(c.quote_ok("29cfr9999.10(a)", "inspected  before each\nshift"))
            self.assertTrue(c.quote_ok("29cfr9999.10(b)", "grab rails must be provided"))  # child text
            self.assertFalse(c.quote_ok("29cfr9999.10(a)", "inspected weekly"))
            self.assertEqual(c.sections_for_ref("fact", "f1"), ["29cfr9999.10(b)"])
            self.assertEqual(c.chunk_kind("cf1"), "fact")
            hb = HarvestBackend({"name": "h", "pack": str(db)}, c, Normalizer())
            r = hb.parse({"mode": "composed", "body": [
                {"t": "text", "text": "Inspect ladders every shift. A competent person does it."},
                {"t": "quote", "section_id": "29cfr9999.10(a)", "text": "inspected before each shift"},
                {"t": "cite", "section_id": "29cfr9999.10(a)"}],
                "citations": ["29cfr9999.10(a)"],
                "retrieved": [{"chunk_id": "cf1", "ref_id": "f1"}, {"chunk_id": "c1", "ref_id": "29cfr9999.10(a)"}],
                "elapsed_ms": 5}, 7.0)
            self.assertEqual(r.retrieved, ["29cfr9999.10(b)", "29cfr9999.10(a)"])
            self.assertEqual(r.citations, ["29cfr9999.10(a)"])
            self.assertEqual(len(r.claims), 2)


class AliasTests(unittest.TestCase):
    def test_aliased_pack_ids_still_resolve(self):
        """A pack that spells ids differently: quotes, citations and cited text
        must be looked up in the set's spelling, after the aliases."""
        with tempfile.TemporaryDirectory() as d:
            p = Path(d) / "s.jsonl"
            p.write_text(json.dumps({"section_id": "29cfr9999-appendix-C", "parent_id": None, "text": ""}) + "\n"
                         + json.dumps({"section_id": "29cfr9999-appendix-C(a)", "parent_id": "29cfr9999-appendix-C",
                                       "text": "Know the load chart."}) + "\n")
            n = Normalizer([(r"-appendix-([A-Z])", r"-app\1")])
            c = Corpus.from_jsonl(p, n)
            hb = HarvestBackend({"name": "h", "pack": d}, c, n)
            r = hb.parse({"mode": "composed", "body": [
                {"t": "quote", "section_id": "29cfr9999-appendix-C(a)", "text": "Know the load chart."}],
                "citations": [], "retrieved": [{"chunk_id": "x", "ref_id": "29cfr9999-appendix-C(a)"}]}, 1.0)
            self.assertEqual(r.citations, ["29cfr9999-appC(a)"])
            self.assertEqual(r.retrieved, ["29cfr9999-appC(a)"])
            self.assertTrue(c.quote_ok(r.quotes[0]["section_id"], r.quotes[0]["text"]))
            self.assertIn("Know the load chart.", c.subtree("29cfr9999-appC"))


class _OpenAIStub(http.server.BaseHTTPRequestHandler):
    def do_POST(self):  # noqa: N802
        n = int(self.headers["Content-Length"])
        req = json.loads(self.rfile.read(n))
        q = req["messages"][-1]["content"]
        text = "I cannot answer that." if "torque" in q else "Per § 9999.10(a), before each shift."
        body = json.dumps({"model": req["model"], "choices": [{"message": {"content": text}}]}).encode()
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, *a):
        pass


class _ThinkingStub(http.server.BaseHTTPRequestHandler):
    """A reasoning model that spends the whole budget thinking: empty content."""

    def do_POST(self):  # noqa: N802
        self.rfile.read(int(self.headers["Content-Length"]))
        body = json.dumps({"choices": [{"finish_reason": "length",
                                        "message": {"content": "", "reasoning_content": "Let me think"}}]}).encode()
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, *a):
        pass


class EmptyAnswer(unittest.TestCase):
    def test_empty_content_is_an_error_not_an_answer(self):
        srv = http.server.ThreadingHTTPServer(("127.0.0.1", 0), _ThinkingStub)
        threading.Thread(target=srv.serve_forever, daemon=True).start()
        try:
            b = OpenAIBackend({"name": "t", "endpoint": f"http://127.0.0.1:{srv.server_port}/v1", "model": "m"},
                              Normalizer())
            r = b.ask({"question": "how far from a 50 kV line?"})
        finally:
            srv.shutdown()
        self.assertFalse(r.ok)
        self.assertIn("finish_reason=length", r.error)
        self.assertIn("12 chars of reasoning_content", r.error)


class EndToEnd(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.d = Path(self.tmp.name)
        (self.d / "pack").mkdir()
        build_pack(self.d / "pack")
        (self.d / "set.jsonl").write_text("\n".join(json.dumps(x) for x in SET) + "\n")
        with (self.d / "ref.jsonl").open("w") as f:
            for sid, parent, kind, text in SECTIONS:
                f.write(json.dumps({"section_id": sid, "parent_id": parent, "text": text}) + "\n")
        self.srv = http.server.ThreadingHTTPServer(("127.0.0.1", 0), _OpenAIStub)
        threading.Thread(target=self.srv.serve_forever, daemon=True).start()
        cfg = {
            "set": "set.jsonl", "reference_sections": "ref.jsonl",
            "backends": [
                {"name": "pack", "kind": "harvest", "binary": str(HERE / "stub_harvest.py"), "pack": "pack", "llm": "off"},
                {"name": "open", "kind": "openai", "endpoint": f"http://127.0.0.1:{self.srv.server_port}/v1",
                 "model": "toy-model"},
                {"name": "frontier", "kind": "claude", "binary": str(HERE / "stub_claude.py"), "model": "sonnet"},
            ],
            "judge": {"model": "opus", "agreement_model": "sonnet", "agreement_sample": 1.0,
                      "binary": str(HERE / "stub_claude.py"), "cache": "cache"},
        }
        (self.d / "eval.json").write_text(json.dumps(cfg))

    def tearDown(self):
        self.srv.shutdown()
        self.tmp.cleanup()

    def test_run_and_compare(self):
        out = self.d / "out"
        self.assertEqual(main(["run", "--config", str(self.d / "eval.json"), "--out", str(out)]), 0)
        res = json.loads((out / "results.json").read_text())
        pack = res["backends"]["pack"]
        self.assertEqual(pack["n"], 4)
        self.assertEqual(pack["errors"], 0)
        self.assertEqual(pack["decline"]["tp"], 1)        # the torque question
        self.assertEqual(pack["bake_hit_rate"], 0.25)     # one alias matches exactly
        self.assertEqual(pack["quote_verbatim_rate"], 1.0)
        self.assertGreater(pack["retrieval"]["lineage"]["r@5"], 0.5)
        self.assertEqual(res["meta"]["backends"]["pack"]["reported_pack_versions"], ["toy-2026.11.27-1"])
        self.assertIn("judge_agreement", pack)
        self.assertGreater(pack["judge_agreement"]["n"], 0)
        opn = res["backends"]["open"]
        self.assertEqual(opn["decline"]["tp"], 1)
        self.assertEqual(opn["cites_exist_rate"], 1.0)
        self.assertIn("pack vs open", res["comparisons"])
        report = (out / "report.md").read_text()
        self.assertIn("Fully correct", report)
        rows = list(csv.DictReader((out / "items.csv").open()))
        self.assertEqual(len(rows), 12)
        # second run: everything comes from the responses file and the judge cache
        calls_before = len(list((self.d / "cache").glob("*.json")))
        self.assertEqual(main(["run", "--config", str(self.d / "eval.json"), "--out", str(out)]), 0)
        res2 = json.loads((out / "results.json").read_text())
        self.assertEqual(res2["meta"]["judge"]["calls"], 0)
        self.assertEqual(len(list((self.d / "cache").glob("*.json"))), calls_before)
        # item-by-item comparison of two runs / backends
        self.assertEqual(main(["compare", f"{out}:pack", f"{out}:frontier", "--out", str(self.d / "cmp")]), 0)
        cmp_ = json.loads((self.d / "cmp" / "compare.json").read_text())
        self.assertEqual(cmp_["n"], 4)

    def test_check_ids(self):
        rc = main(["check-ids", "--set", str(self.d / "set.jsonl"), "--pack", str(self.d / "ref.jsonl")])
        self.assertEqual(rc, 0)

    def test_missing_binary_is_an_error_not_a_crash(self):
        cfg = json.loads((self.d / "eval.json").read_text())
        cfg["backends"] = [{"name": "pack", "kind": "harvest", "binary": "/nonexistent/harvest", "pack": "pack"}]
        (self.d / "bad.json").write_text(json.dumps(cfg))
        out = self.d / "out-bad"
        self.assertEqual(main(["run", "--config", str(self.d / "bad.json"), "--out", str(out), "--no-judge"]), 0)
        res = json.loads((out / "results.json").read_text())
        self.assertEqual(res["backends"]["pack"]["errors"], 4)
        self.assertEqual(res["backends"]["pack"]["decline"]["fn"], 1)  # an error on a must-decline item is a miss

    def test_resume_ignores_answers_from_another_config(self):
        out = self.d / "out-r"
        self.assertEqual(main(["run", "--config", str(self.d / "eval.json"), "--out", str(out), "--no-judge",
                               "--backends", "pack"]), 0)
        cfg = json.loads((self.d / "eval.json").read_text())
        cfg["backends"][0]["llm"] = "http://other"
        (self.d / "eval2.json").write_text(json.dumps(cfg))
        self.assertEqual(main(["run", "--config", str(self.d / "eval2.json"), "--out", str(out), "--no-judge",
                               "--backends", "pack"]), 0)
        lines = (out / "responses" / "pack.jsonl").read_text().splitlines()
        self.assertEqual(len(lines), 8)  # every item asked again under the new config


if __name__ == "__main__":
    unittest.main()
