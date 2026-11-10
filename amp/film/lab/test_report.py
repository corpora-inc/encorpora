from pathlib import Path
import tempfile
import unittest

from providers import write_json
from report import build_report


class AccountingReportTests(unittest.TestCase):
    def test_unknown_charges_and_subscription_estimates_are_separate(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            write_json(root/'runs/film/study-fable-1.json', {'provider': 'fable', 'role': 'study',
                       'transport': 'api-cli', 'status': 'succeeded', 'api_dollars': 1.25})
            write_json(root/'runs/film/study-fable-2.json', {'provider': 'fable', 'role': 'study',
                       'transport': 'api-cli', 'status': 'failed', 'api_dollars': None})
            write_json(root/'runs/film/review-grok-1.json', {'provider': 'grok', 'role': 'review',
                       'transport': 'subscription-cli', 'status': 'succeeded', 'reported_dollars': 7.0, 'api_dollars': 0})
            write_json(root/'claude-sonnet-preflight.json', {'total_cost_usd': .25})
            result = build_report(root, 'http://localhost/live/lab.html')
            self.assertEqual(result['known_api_dollars'], 1.5)
            self.assertEqual(result['unknown_api_attempts'], 1)
            report = (root/'RESULTS.md').read_text()
            self.assertIn('$7.000000 usage cost through its CLI', report)
            self.assertIn('Missing usage is not treated as zero', report)


if __name__ == '__main__':
    unittest.main()
