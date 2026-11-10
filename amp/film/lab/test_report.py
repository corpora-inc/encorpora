from pathlib import Path
import json
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
                       'transport': 'api-cli', 'status': 'failed', 'api_dollars': None, 'partial_api_dollars': .10})
            write_json(root/'runs/film/review-grok-1.json', {'provider': 'grok', 'role': 'review',
                       'transport': 'subscription-cli', 'status': 'succeeded', 'reported_dollars': 7.0, 'api_dollars': 0})
            write_json(root/'runs/film/review-grok-2.json', {'provider': 'grok', 'role': 'review',
                       'transport': 'subscription-cli', 'status': 'failed', 'reported_dollars': None})
            write_json(root/'voice-quota.json', {'confirmed_characters': 60, 'reserved_characters': 100})
            events = [{'kind': 'reserved', 'characters': 100},
                      {'kind': 'succeeded', 'characters': 100, 'charged_characters': 50},
                      {'kind': 'usage-reconciliation', 'operation': 'stt', 'charged_characters': 10},
                      {'kind': 'reserved', 'operation': 'stt', 'characters': 40},
                      {'kind': 'unmetered-success', 'operation': 'stt', 'characters': 40}]
            (root/'voice-ledger.jsonl').write_text('\n'.join(json.dumps(e) for e in events)+'\n')
            write_json(root/'claude-sonnet-preflight.json', {'total_cost_usd': .25})
            result = build_report(root, 'http://localhost/live/lab.html')
            self.assertEqual(result['known_api_dollars'], 1.6)
            self.assertEqual(result['unknown_api_attempts'], 1)
            self.assertEqual(result['unknown_grok_attempts'], 1)
            self.assertEqual(result['elevenlabs_characters'], 100)
            self.assertEqual(result['elevenlabs_credits'], 60)
            report = (root/'RESULTS.md').read_text()
            self.assertIn('$7.000000 usage cost through its CLI', report)
            self.assertIn('Missing usage is not treated as zero', report)
            self.assertIn('including **10** for transcription checks', report)
            self.assertIn('Successful transcription calls without a reported charge: **1**', report)


if __name__ == '__main__':
    unittest.main()
