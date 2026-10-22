"""Compile real protobuf operations and execute the exported Scripts runtime."""
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import campaigns
ROOT = Path(__file__).resolve().parents[1]
SPEC = json.loads((ROOT / "examples/search.json").read_text())
CONFIG = {"customer_id": "1234567890", "allowed_customer_ids": ["1234567890"], "max_daily_budget_micros": 1_000_000}

class ScriptExportTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.path = Path(self.temp.name) / "campaign.js"
        self.record = campaigns.export_script(SPEC, CONFIG, self.path)
        self.source = self.path.read_text()

    def run_case(self, scenario):
        result = subprocess.run(["node", str(ROOT / "test/google-script-harness.cjs")], input=json.dumps({"source": self.source, "scenario": scenario}), text=True, capture_output=True, check=True)
        return json.loads(result.stdout)

    def test_private_inspection_bundle_uses_real_json_schema(self):
        self.assertEqual(os.stat(self.path).st_mode & 0o777, 0o600)
        self.assertFalse(self.record["platform_validated"])
        self.assertIn('const AMP_MODE = "inspect"', self.source)
        self.assertIn('"targetSearchNetwork": false', self.source)
        self.assertIn('"amountMicros": "1000000"', self.source)
        self.assertIn('"type": "SEARCH_STANDARD"', self.source)
        self.assertNotIn('"primaryStatus"', self.source)
        self.assertNotIn('"credentials"', self.source)
        with self.assertRaises(FileExistsError):
            campaigns.export_script(SPEC, CONFIG, self.path)
        self.assertEqual(self.path.read_text(), self.source)

    def test_inspect_preview_and_existing_never_mutate(self):
        for case in ["inspect", "preview", "existing"]:
            with self.subTest(case=case):
                result = self.run_case(case)
                self.assertNotIn("error", result)
                self.assertEqual(result["calls"], 0)
                self.assertFalse(result["result"]["created"])
        self.assertFalse(self.run_case("preview")["result"]["platformValidated"])

    def test_guards_reject_before_any_write(self):
        for case in ["wrongAccount", "wrongCurrency", "overBudget", "ambiguousGeo", "active", "removed", "duplicate", "otherRevision", "enabledOperation", "existingParent", "existingBudget", "updateOperation"]:
            with self.subTest(case=case):
                result = self.run_case(case)
                self.assertIn("error", result)
                self.assertEqual(result["calls"], 0)

    def test_atomic_create_and_full_readback(self):
        result = self.run_case("success")
        self.assertNotIn("error", result)
        self.assertEqual(result["calls"], 1)
        self.assertTrue(result["result"]["created"])
        self.assertTrue(result["result"]["verified"])
        self.assertEqual(result["result"]["status"], "PAUSED")

    def test_errors_and_targeting_or_copy_drift_never_retry(self):
        for case in ["timeout", "rejected", "campaignDrift", "networkDrift", "urlDrift", "copyDrift", "geoDrift", "extraCriterion", "negativeMissing", "keywordDrift"]:
            with self.subTest(case=case):
                result = self.run_case(case)
                self.assertIn("error", result)
                self.assertEqual(result["calls"], 1)

    def test_export_rejects_wrong_customer_and_unsafe_amounts(self):
        for config in [{**CONFIG, "customer_id": "9999999999"}, {**CONFIG, "max_daily_budget_micros": 1}, {**CONFIG, "max_daily_budget_micros": 2**53}]:
            with self.assertRaises(ValueError):
                campaigns.export_script(SPEC, config, self.path.parent / "invalid.js")
        self.assertFalse((self.path.parent / "invalid.js").exists())

if __name__ == "__main__":
    unittest.main()
