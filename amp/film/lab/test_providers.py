import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

from providers import api_cost, credentials, normalized_usage, redact, submit_review_batch
from prompts import coverage_from_study, validate_review


class EvidenceTests(unittest.TestCase):
    def test_api_key_file_is_parsed_not_executed(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory)/'env'
            path.write_text('export ANTHROPIC_API_KEY="test-key" # comment\nUNRELATED_SECRET=ignore\n')
            self.assertEqual(credentials(path), {'ANTHROPIC_API_KEY': 'test-key'})
        self.assertEqual(redact('error test-key', {'key': 'test-key'}), 'error [REDACTED]')

    def test_cached_tokens_are_not_counted_twice(self):
        astra = normalized_usage('astra', {'input_tokens': 120, 'cached_input_tokens': 100, 'output_tokens': 4})
        claude = normalized_usage('fable', {'input_tokens': 20, 'cache_read_input_tokens': 100, 'output_tokens': 4})
        self.assertEqual(astra['input_uncached'], claude['input_uncached'])
        self.assertEqual(astra['input_cached'], claude['input_cached'])
        self.assertIsNone(normalized_usage('astra', {})['input_uncached'])

    def test_prices_use_cache_lifetimes_and_batch_discount(self):
        usage = {'input_tokens': 1000, 'output_tokens': 100,
                 'cache_read_input_tokens': 2000, 'cache_creation_input_tokens': 300,
                 'cache_creation': {'ephemeral_5m_input_tokens': 200, 'ephemeral_1h_input_tokens': 100}}
        self.assertAlmostEqual(api_cost('fable', usage), .016)
        self.assertAlmostEqual(api_cost('fable', usage, batch=True), .008)

    def test_ambiguous_batch_submission_is_not_retried(self):
        with tempfile.TemporaryDirectory() as directory:
            manifest = Path(directory)/'batch.json'
            manifest.write_text(json.dumps({'status': 'submitting'}))
            with patch('providers.anthropic_request') as request:
                with self.assertRaisesRegex(RuntimeError, 'reconciliation'):
                    submit_review_batch('fable', [], manifest, 'test-key')
                request.assert_not_called()

    def test_coverage_requires_evidence_and_scope(self):
        valid = {'verdict': 'Observed', 'sample_limits': 'Ten samples.', 'gaps': []}
        self.assertEqual(coverage_from_study('```coverage-json\n'+json.dumps(valid)+'\n```'), valid)
        valid['gaps'] = [{'standard': '1.OA.A.1'}]
        with self.assertRaises(ValueError):
            coverage_from_study('```coverage-json\n'+json.dumps(valid)+'\n```')

    def test_review_does_not_accept_missing_images_or_boolean_scores(self):
        review = {'ship': False, 'score': 4, 'biggest_problem': 'A label overlaps.',
                  'reason': 'The unit cannot be read.', 'evidence': ['frame 1'], 'inspected_images': ['a.jpg']}
        validate_review(review, ['a.jpg'])
        with self.assertRaises(ValueError):
            validate_review(review, ['a.jpg', 'b.jpg'])
        review['score'] = True
        with self.assertRaises(ValueError):
            validate_review(review, ['a.jpg'])


if __name__ == '__main__':
    unittest.main()
