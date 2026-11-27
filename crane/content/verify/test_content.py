"""Structural tests for crane/content. Run: python -m unittest discover -s crane/content/verify

Citation and quote checks need the eCFR index (built on first use, network);
they are skipped when HARVEST_OFFLINE=1 and no cached index exists.
"""

from __future__ import annotations

import json
import os
import sys
import unittest
from pathlib import Path

HERE = Path(__file__).resolve().parent
CONTENT = HERE.parent
sys.path.insert(0, str(HERE))

import yaml  # noqa: E402

import ecfr  # noqa: E402
import verify  # noqa: E402

BLUEPRINT = yaml.safe_load((CONTENT / "blueprint.yaml").read_text())


def index_available() -> bool:
    return (ecfr.CACHE / "sections.json").exists() or os.environ.get("HARVEST_OFFLINE") != "1"


class Blueprint(unittest.TestCase):
    def skills(self):
        return [s for t in BLUEPRINT["topics"] for s in t["skills"]]

    def test_unique_ids(self):
        tids = [t["topic_id"] for t in BLUEPRINT["topics"]]
        sids = [s["skill_id"] for s in self.skills()]
        self.assertEqual(len(tids), len(set(tids)))
        self.assertEqual(len(sids), len(set(sids)), [s for s in sids if sids.count(s) > 1])

    def test_exam_refs_valid_and_outline_covered(self):
        outline = {}
        for e in BLUEPRINT["exams"]:
            outline.update(e.get("outline", {}))
        used = set()
        for s in self.skills():
            for ref in s.get("exam", []):
                self.assertIn(ref, outline, s["skill_id"])
                used.add(ref)
        self.assertEqual(sorted(set(outline) - used), [], "outline items with no skill")

    def test_domain_weights_sum_to_one(self):
        for e in BLUEPRINT["exams"]:
            self.assertAlmostEqual(sum(d["weight"] for d in e["domains"]), 1.0, places=6, msg=e["exam_id"])

    def test_skill_fields(self):
        equip = {e["equip_id"] for e in BLUEPRINT["equipment"]}
        for s in self.skills():
            self.assertIn(s["kind"], {"knowledge", "calc", "procedure", "judgment"}, s["skill_id"])
            self.assertTrue(set(s["levels"]) <= {"trainee", "operator", "inspector"}, s["skill_id"])
            self.assertTrue(s["section_ids"], s["skill_id"])
            self.assertTrue(set(s.get("equipment", [])) <= equip, s["skill_id"])

    @unittest.skipUnless(index_available(), "no eCFR index")
    def test_all_content_citations_verify(self):
        ix = verify.load_index(None)
        failures = []
        checked = 0
        for f in verify.iter_files([CONTENT]):
            if "data" in f.relative_to(CONTENT).parts:
                continue  # generated data: rows carry their own verdicts (see test below)
            res = verify.check(ix, verify.load_file(f), str(f))
            checked += res[0]["checked"]
            failures += res[1:]
        self.assertGreater(checked, 400)
        self.assertEqual(failures, [])

    @unittest.skipUnless(index_available(), "no eCFR index")
    def test_generated_pass_rows_verify(self):
        """Every generated row marked pass must have verifying quotes and citations."""
        ix = verify.load_index(None)
        data = CONTENT / "data"
        if not data.exists():
            self.skipTest("no generated data yet")
        bad = []
        for f in sorted(data.rglob("*.json*")):
            rows = [json.loads(line) for line in f.read_text().splitlines() if line.strip()] if f.suffix == ".jsonl" else json.loads(f.read_text())
            for r in rows:
                if r.get("prov", {}).get("verdict") != "pass":
                    continue
                r2 = {k: v for k, v in r.items() if k != "prov"}
                res = verify.check(ix, r2, f.name)
                bad += res[1:]
        self.assertEqual(bad[:20], [])


if __name__ == "__main__":
    unittest.main()
