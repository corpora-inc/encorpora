"""Ask as search: the harvest-search backend and the typo/misspelling generator."""
from __future__ import annotations

import importlib.util
import json
import sys
import tempfile
import unittest
from pathlib import Path

HERE = Path(__file__).parent
sys.path.insert(0, str(HERE.parent))

from harvest_eval import metrics  # noqa: E402
from harvest_eval.backends import HarvestSearchBackend, make_backend  # noqa: E402
from harvest_eval.sections import Normalizer  # noqa: E402

PERTURB = HERE.parent.parent.parent / "crane" / "eval" / "tools" / "perturb.py"


def load_perturb():
    spec = importlib.util.spec_from_file_location("perturb", PERTURB)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


class SearchBackend(unittest.TestCase):
    def test_hits_become_ranked_distinct_sections(self):
        b = make_backend({"name": "s", "kind": "harvest-search", "pack": "p", "k": 5}, None,
                         Normalizer([(r"-table-", "-table")]))
        self.assertIsInstance(b, HarvestSearchBackend)
        r = b.parse({"hits": [
            {"chunk_id": "f:a#1", "ref_kind": "fact", "ref_id": "a#1", "section_id": "29cfr9999.10(a)"},
            {"chunk_id": "s:29cfr9999.10(a)", "ref_kind": "section", "ref_id": "29cfr9999.10(a)",
             "section_id": "29cfr9999.10(a)"},
            {"chunk_id": "s:t", "ref_kind": "section", "ref_id": "29cfr9999.12-table-A",
             "section_id": "29cfr9999.12-table-A"}], "elapsed_ms": 3}, 10.0)
        self.assertTrue(r.ok)
        self.assertEqual(r.retrieved, ["29cfr9999.10(a)", "29cfr9999.12-tableA"])
        self.assertEqual(r.mode, "search")
        self.assertEqual(r.text, "")
        row = metrics.score_item({"id": "q", "question": "x", "gold_answer": "", "section_ids": ["29cfr9999.12-tableA"],
                                  "must_decline": False, "category": "c"}, r.to_json(), None, None, None, True)
        self.assertEqual(row["r@1.lineage"], 0.0)
        self.assertEqual(row["r@5.lineage"], 1.0)
        self.assertEqual(row["rank.lineage"], 2)


class Perturb(unittest.TestCase):
    def test_deterministic_and_bounded(self):
        p = load_perturb()
        q = "how far do the outriggers need to be from the 345 kV line per 1926.1408"
        a = p.edit(q, "id-1", "typo1")
        self.assertEqual(a, p.edit(q, "id-1", "typo1"))
        self.assertNotEqual(a[0], q)
        self.assertIn("345", a[0])
        self.assertIn("1926.1408", a[0])
        changed = [w for w, v in zip(q.split(), a[0].split()) if w != v]
        self.assertEqual(len(changed), 1)
        m = p.edit(q, "id-1", "misspell")
        self.assertEqual(m[1], "misspell")
        self.assertIn("outrigers", m[0])
        n = p.edit("no crane words here at all", "id-2", "misspell")
        self.assertEqual(n[1], "typo1")
        for seed in range(30):
            protected = p.edit("is NCCCO crane in Subpart CC or Appendix Barricades", f"id-{seed}", "typo1")[0]
            self.assertIn("NCCCO", protected)
            self.assertIn("Subpart CC", protected)
            self.assertIn("Appendix Barricades", protected)
            self.assertNotIn("crane", protected)  # the only editable word
        self.assertEqual(p.typo("boom", __import__("random").Random(1)) != "boom", True)
        many = p.edit(" ".join(["alpha", "bravo", "charlie", "delta", "echo"] * 6), "id-3", "typo10")
        self.assertEqual(sum(1 for w, v in zip((["alpha", "bravo", "charlie", "delta", "echo"] * 6), many[0].split())
                             if w != v), 3)

    def test_cli_writes_original_and_kind(self):
        with tempfile.TemporaryDirectory() as d:
            src = Path(d) / "set.jsonl"
            src.write_text(json.dumps({"id": "x1", "question": "is the outrigger pad required"}) + "\n")
            out = Path(d) / "out.jsonl"
            saved = sys.argv
            sys.argv = ["perturb", "--set", str(src), "--mode", "misspell", "--out", str(out)]
            try:
                load_perturb().main()
            finally:
                sys.argv = saved
            row = json.loads(out.read_text())
            self.assertEqual(row["question_original"], "is the outrigger pad required")
            self.assertEqual(row["perturbation"], "misspell")
            self.assertIn("outriger", row["question"])


if __name__ == "__main__":
    unittest.main()
