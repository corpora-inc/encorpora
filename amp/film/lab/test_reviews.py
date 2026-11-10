import hashlib
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

from prompts import review_prompt
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


class OfflineReviewTests(unittest.TestCase):
    def test_completed_batch_failure_waits_for_a_batch_retry_without_direct_api_spending(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            payload = {'script': {}}
            write_json(root/'payload.json', payload)
            image = root/'wide-001.jpg'
            image.write_bytes(b'fixture')
            item = {'id': 'example--aa', 'payload': str(root/'payload.json'), 'images': [str(image)]}
            hashes = {'prompt_sha256': hashlib.sha256(review_prompt(payload, [image.name]).encode()).hexdigest(),
                      'image_sha256': [hashlib.sha256(image.read_bytes()).hexdigest()]}
            first = root/'runs/example--aa/review-fable-1.json'
            second = first.with_name('review-fable-2.json')
            write_json(first, {**hashes, 'status': 'failed', 'error': 'max_tokens'})
            with patch('reviews.run_agent') as agent, patch('reviews.review_api') as api:
                self.assertIsNone(review_one(item, 'fable', root, root/'work', {}, allow_new=False))
                self.assertFalse(second.exists())
                self.assertFalse((root/'reviews/example--aa/fable-failure.json').exists())
                self.assertEqual(json.loads(first.read_text())['artifact_error'], 'max_tokens')
                verdict = {'ship': False, 'score': 4, 'biggest_problem': 'The units overlap.',
                           'reason': 'The scale cannot be read.', 'evidence': ['frame 1'],
                           'inspected_images': [image.name]}
                write_json(second, {**hashes, 'status': 'succeeded', 'response': json.dumps(verdict)})
                result = review_one(item, 'fable', root, root/'work', {}, allow_new=False)
                self.assertFalse(result['ship'])
                self.assertTrue((root/'reviews/example--aa/fable.json').exists())
                agent.assert_not_called()
                api.assert_not_called()


if __name__ == '__main__':
    unittest.main()
