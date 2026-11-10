from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

from batches import submit_cohort
from providers import write_json


class BatchResumeTests(unittest.TestCase):
    def test_retry_batches_require_a_completed_failure_and_cannot_charge_twice(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            payload = root/'payload.json'
            payload.write_text('{"script":{}}')
            image = root/'wide-001.jpg'
            image.write_bytes(b'fixture')
            items = [{'id': f'cal-{i}', 'payload': str(payload), 'images': [str(image)]} for i in range(7)]
            records = [{'status': 'failed'}, {'status': 'queued'}, {'status': 'succeeded'},
                       {'status': 'succeeded', 'artifact_error': 'Invalid verdict'},
                       {'status': 'failed'}, {'status': 'failed'}]
            for item, record in zip(items, records):
                write_json(root/'runs'/item['id']/'review-fable-1.json', record)
            write_json(root/'reviews/cal-4/fable.json', {'ship': True})
            write_json(root/'runs/cal-5/review-fable-2.json', {'status': 'failed'})
            calls = []
            def submit(provider, specs, manifest, key):
                calls.append((manifest.name, [s['id'] for s in specs]))
                for spec in specs:
                    self.assertEqual(spec['receipt'].name, 'review-fable-2.json')
                    write_json(spec['receipt'], {'status': 'queued'})
            with patch('batches.API_REVIEWERS', ('fable',)), patch('batches.submit_review_batch', side_effect=submit):
                submit_cohort(root, items, 'calibration', {'ANTHROPIC_API_KEY': 'test-placeholder'}, attempt=2)
                submit_cohort(root, items, 'calibration', {'ANTHROPIC_API_KEY': 'test-placeholder'}, attempt=2)
                with self.assertRaisesRegex(ValueError, 'two attempts'):
                    submit_cohort(root, items, 'calibration', {}, attempt=3)
            self.assertEqual(calls, [('calibration-fable-1-retry.json', ['cal-0', 'cal-3'])])

    def test_finished_chunk_cannot_rename_later_pending_chunks(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            payload = root/'payload.json'
            payload.write_text('{"script":{}}')
            image = root/'wide-001.jpg'
            image.write_bytes(b'fixture')
            items = [{'id': f'cal-{i:02}', 'payload': str(payload), 'images': [str(image)]} for i in range(25)]
            for item in items[:10]:
                write_json(root/'runs'/item['id']/'review-fable-1.json', {'status': 'succeeded'})
            calls = []
            def submit(provider, specs, manifest, key):
                calls.append((manifest.name, [s['id'] for s in specs]))
            with patch('batches.API_REVIEWERS', ('fable',)), patch('batches.submit_review_batch', side_effect=submit):
                submit_cohort(root, list(reversed(items)), 'calibration', {'ANTHROPIC_API_KEY': 'test-placeholder'})
            self.assertEqual([c[0] for c in calls], ['calibration-fable-2.json', 'calibration-fable-3.json'])
            self.assertEqual(calls[0][1], [f'cal-{i:02}' for i in range(10, 20)])
            self.assertEqual(calls[1][1], [f'cal-{i:02}' for i in range(20, 25)])


if __name__ == '__main__':
    unittest.main()
