"""Regression checks for exhaustive, bounded print layout batches."""
import contextlib
import io
import json
from pathlib import Path
import subprocess
import unittest
from unittest.mock import patch

from print_pdf_oracle import review_print_html, LAYOUT_BATCH_SIZE, LAYOUT_BATCH_TIMEOUT


class PrintLayoutBatchTests(unittest.TestCase):
    def setUp(self):
        self.documents = [{'file': f'fixture-{i}.html', 'format': 'Letter'}
                          for i in range(LAYOUT_BATCH_SIZE * 2 + 1)]

    @staticmethod
    def successful_run(_args, **kwargs):
        return subprocess.CompletedProcess([], 0, json.dumps({
            'documents': len(json.loads(kwargs['input'])), 'rejectedMutations': 14}), '')

    def review(self):
        with contextlib.redirect_stderr(io.StringIO()):
            return review_print_html(self.documents, Path('/fixture'))

    def test_every_document_is_checked_once_with_bounded_batches(self):
        with patch('print_pdf_oracle.subprocess.run', side_effect=self.successful_run) as run:
            self.assertEqual(self.review(), {
                'documents': len(self.documents), 'rejectedMutations': 14, 'batches': 3})
        submitted = []
        for call in run.call_args_list:
            batch = json.loads(call.kwargs['input'])
            self.assertLessEqual(len(batch), LAYOUT_BATCH_SIZE)
            self.assertEqual(call.kwargs['timeout'], LAYOUT_BATCH_TIMEOUT)
            submitted.extend(batch)
        self.assertEqual(submitted, self.documents)

    def test_failure_in_later_batch_stops_review(self):
        calls = 0

        def fail_later(args, **kwargs):
            nonlocal calls
            calls += 1
            if calls == 2:
                return subprocess.CompletedProcess([], 1, '', 'clipped formula')
            return self.successful_run(args, **kwargs)

        with patch('print_pdf_oracle.subprocess.run', side_effect=fail_later):
            with self.assertRaisesRegex(ValueError, 'batch 2.*clipped formula'):
                self.review()
        self.assertEqual(calls, 2)

    def test_incomplete_document_or_mutation_report_fails_closed(self):
        for report in ({'documents': 119, 'rejectedMutations': 14},
                       {'documents': 120, 'rejectedMutations': 0}):
            with self.subTest(report=report), patch('print_pdf_oracle.subprocess.run',
                    return_value=subprocess.CompletedProcess([], 0, json.dumps(report), '')) as run:
                with self.assertRaisesRegex(ValueError, 'incomplete'):
                    self.review()
                self.assertEqual(run.call_count, 1)

    def test_timeout_identifies_batch_and_document(self):
        with patch('print_pdf_oracle.subprocess.run', side_effect=subprocess.TimeoutExpired('node', 180)):
            with self.assertRaisesRegex(ValueError, 'batch 1.*fixture-0.html'):
                self.review()

    def test_empty_inventory_is_rejected(self):
        self.documents = []
        with self.assertRaisesRegex(ValueError, 'Missing print HTML inventory'):
            self.review()


if __name__ == '__main__':
    unittest.main()
