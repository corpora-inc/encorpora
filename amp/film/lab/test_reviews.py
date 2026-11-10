import hashlib
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

from providers import write_json
from reviews import review_one


class DurableReviewTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.payload = self.root/'payload.json'
        self.payload.write_text('{"script":{"id":"cal-aa"}}')
        self.picture = self.root/'wide-001.jpg'
        self.picture.write_bytes(b'fixture-image-bytes')
        self.item = {'id': 'cal-aa', 'payload': str(self.payload), 'images': [str(self.picture)]}

    def fake(self, response):
        def call(provider, prompt, images, receipt, key):
            record = {'status': 'succeeded', 'response': response,
                      'prompt_sha256': hashlib.sha256(prompt.encode()).hexdigest(),
                      'image_sha256': [hashlib.sha256(p.read_bytes()).hexdigest() for p in images]}
            write_json(receipt, record)
            return record
        return call

    def run_review(self):
        return review_one(self.item, 'sonnet', self.root, self.root/'work',
                          {'ANTHROPIC_API_KEY': 'test-placeholder'})

    def test_two_failed_attempts_are_terminal_across_resume(self):
        with patch('reviews.review_api', side_effect=self.fake('invalid')) as api:
            self.assertIsNone(self.run_review())
            self.assertIsNone(self.run_review())
            self.assertEqual(api.call_count, 2)

    def test_completed_review_is_not_rebilled(self):
        value = {'ship': True, 'score': 8, 'biggest_problem': 'none', 'reason': 'Clear.',
                 'evidence': ['frame 0'], 'inspected_images': [self.picture.name]}
        with patch('reviews.review_api', side_effect=self.fake(json.dumps(value))) as api:
            self.assertTrue(self.run_review()['ship'])
            self.assertTrue(self.run_review()['ship'])
            self.assertEqual(api.call_count, 1)

    def test_changed_frames_cannot_reuse_an_attempt(self):
        with patch('reviews.review_api', side_effect=self.fake('invalid')) as api:
            self.run_review()
            self.picture.write_bytes(b'different-picture')
            with self.assertRaisesRegex(RuntimeError, 'inputs changed'):
                self.run_review()
            self.assertEqual(api.call_count, 2)


if __name__ == '__main__':
    unittest.main()
