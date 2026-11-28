"""Item quality gates: deterministic checks on hand-made items, model passes against a stub server."""
from __future__ import annotations

import http.server
import json
import sys
import tempfile
import threading
import unittest
from pathlib import Path

HERE = Path(__file__).parent
sys.path.insert(0, str(HERE.parent))

from harvest_eval.cli import main  # noqa: E402
from harvest_eval.corpus import Corpus  # noqa: E402
from harvest_eval.items import LETTERS, deterministic, perm  # noqa: E402
from harvest_eval.sections import Normalizer  # noqa: E402

SECTIONS = [("29cfr9999.10", None, "Hooks must be inspected each shift by a competent person."),
            ("29cfr9999.11", None, "Rated capacity means the maximum working load permitted by the manufacturer.")]


def mc(q_id, choices, answer, quote_sec="29cfr9999.10", quote="inspected each shift", difficulty=0.2,
       rationales=None, section_ids=None):
    return {"q_id": q_id, "skill_id": "s", "topic_id": "t", "variant_of": None, "kind": "mc",
            "stem": "When must hooks be inspected?", "choices": choices, "answer": str(answer),
            "rationales": rationales if rationales is not None else [f"r{i}" for i in range(len(choices))],
            "section_ids": section_ids or [quote_sec], "quotes": [{"section_id": quote_sec, "quote": quote}],
            "fact": "", "difficulty": difficulty}


TELL = mc("tell", ["Monthly.", "Yearly.", "Each shift, by a competent person, as the rule requires.", "Never."], 2)
FAIR = mc("fair", ["Each shift.", "Each month by the operator.", "Each year by an engineer.", "Every week."], 0,
          quote="Hooks must be inspected each shift")
BROKEN = mc("broken", ["A.", "B.", "C.", "D."], 1, quote="inspected monthly", rationales=["x", "", "y", "z"],
            section_ids=["29cfr9999.99"])
FREE = {"q_id": "free", "skill_id": "s", "topic_id": "t", "kind": "free_text", "stem": "Explain.",
        "answer": {"rubric": []}, "section_ids": ["29cfr9999.11"],
        "quotes": [{"section_id": "29cfr9999.11", "quote": "maximum working load"}], "difficulty": 0.5}


def corpus() -> Corpus:
    c = Corpus(Normalizer())
    for sid, parent, text in SECTIONS:
        c._add(sid, parent, text)
    return c


class Deterministic(unittest.TestCase):
    def test_tells_and_integrity(self):
        c, n = corpus(), Normalizer()
        t = deterministic(TELL, c, n)
        self.assertTrue(t["key_longest"])
        self.assertTrue(t["key_most_like_rule"])
        self.assertTrue(t["rationales"] and t["cites_exist"] and t["quotes_verbatim"])
        f = deterministic(FAIR, c, n)
        self.assertFalse(f["key_longest"])
        b = deterministic(BROKEN, c, n)
        self.assertFalse(b["rationales"])
        self.assertFalse(b["cites_exist"])
        self.assertFalse(b["quotes_verbatim"])
        fr = deterministic(FREE, c, n)
        self.assertTrue(fr["cites_exist"] and fr["quotes_verbatim"])
        self.assertNotIn("key_longest", fr)

    def test_shuffle_is_fixed_per_item(self):
        self.assertEqual(perm(TELL), perm(dict(TELL)))
        self.assertEqual(sorted(perm(TELL)), [0, 1, 2, 3])


class _Stub(http.server.BaseHTTPRequestHandler):
    """Answers like a model that always picks the longest option, and reviews every key as right."""

    def do_POST(self):  # noqa: N802
        req = json.loads(self.rfile.read(int(self.headers["Content-Length"])))
        user = req["messages"][-1]["content"]
        schema = req["response_format"]["json_schema"]["schema"]
        if "key_correct" in schema["properties"]:
            letters = schema["properties"]["distractors"]["items"]["properties"]["option"]["enum"]
            key = user.split("KEY: ")[1][0]
            out = {"key_correct": "yes", "rule_supports_key": "yes", "single_best": True, "note": "",
                   "distractors": [{"option": x, "wrong": "yes", "plausible": 0} for x in letters if x != key]}
        else:
            opts = [l for l in user.split("\n") if len(l) > 2 and l[1:3] == ". " and l[0] in LETTERS]
            out = {"answer": max(opts, key=len)[0]}
        body = json.dumps({"choices": [{"message": {"content": json.dumps(out)}, "finish_reason": "stop"}]}).encode()
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, *a):
        pass


class Passes(unittest.TestCase):
    def test_end_to_end_with_a_longest_option_model(self):
        srv = http.server.ThreadingHTTPServer(("127.0.0.1", 0), _Stub)
        threading.Thread(target=srv.serve_forever, daemon=True).start()
        try:
            with tempfile.TemporaryDirectory() as d:
                d = Path(d)
                (d / "bank.jsonl").write_text("\n".join(json.dumps(x) for x in (TELL, FAIR, BROKEN, FREE)) + "\n")
                with (d / "sections.jsonl").open("w") as f:
                    for sid, parent, text in SECTIONS:
                        f.write(json.dumps({"section_id": sid, "parent_id": parent, "text": text}) + "\n")
                url = f"http://127.0.0.1:{srv.server_port}/v1#stub"
                rc = main(["items", "--bank", str(d / "bank.jsonl"), "--sections", str(d / "sections.jsonl"),
                           "--out", str(d / "out"), "--passes", "deterministic", "options_only", "no_context",
                           "crane_aware", "review", "--strong", url, "--weak", url + "-weak", "--jobs", "2"])
                self.assertEqual(rc, 0)
                s = json.loads((d / "out" / "summary.json").read_text())
                self.assertEqual(s["mc"], 3)
                self.assertEqual(s["free_text"], 1)
                self.assertAlmostEqual(s["deterministic"]["key_longest"], 1 / 3, places=3)
                # The longest-option model finds the tell item's key without the stem.
                rows = {r.split(",")[0]: r for r in (d / "out" / "items.csv").read_text().splitlines()[1:]}
                self.assertIn("tell", rows)
                self.assertEqual(s["passes"]["review"]["key_correct"], 1.0)
                self.assertEqual(s["passes"]["review"]["distractor_plausibility_mean"], 0.0)
                self.assertGreaterEqual(s["everyone_correct"]["n"], 1)
                self.assertIn("0.2", s["calibration_by_tier"])
                # A second run is answered from the cache.
                calls_before = len(list((d / "out" / "cache").rglob("*.json")))
                main(["items", "--bank", str(d / "bank.jsonl"), "--sections", str(d / "sections.jsonl"),
                      "--out", str(d / "out"), "--passes", "options_only", "--strong", url])
                self.assertEqual(len(list((d / "out" / "cache").rglob("*.json"))), calls_before)
                self.assertEqual(s["everyone_correct"]["of"], 3)
                # An unlabelled endpoint, or weak and strong as one model, would share cached answers.
                base = ["items", "--bank", str(d / "bank.jsonl"), "--sections", str(d / "sections.jsonl"),
                        "--out", str(d / "out3"), "--passes", "no_context"]
                with self.assertRaises(SystemExit):
                    main(base + ["--strong", f"http://127.0.0.1:{srv.server_port}/v1"])
                with self.assertRaises(SystemExit):
                    main(base + ["--strong", url, "--weak", url])
                # The cache is keyed by the model, not its address: the same model elsewhere is a hit.
                other = f"http://localhost:{srv.server_port}/v1#stub"
                main(["items", "--bank", str(d / "bank.jsonl"), "--sections", str(d / "sections.jsonl"),
                      "--out", str(d / "out2"), "--cache", str(d / "out" / "cache"), "--passes", "options_only",
                      "--strong", other])
                self.assertEqual(len(list((d / "out" / "cache").rglob("*.json"))), calls_before)
        finally:
            srv.shutdown()


if __name__ == "__main__":
    unittest.main()
