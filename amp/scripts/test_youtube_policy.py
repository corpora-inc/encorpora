import unittest
import importlib.util
import multiprocessing
import sys
import tempfile
import time
from pathlib import Path
from datetime import timedelta
from youtube_policy import allowed_slot, release_time, timestamp, validate_plan, validate_review, calendar_event, CHECKS, POLICY_VERSION


def upload_worker(folder):
    spec = importlib.util.spec_from_file_location("lesson_youtube_test", Path(__file__).with_name("publish-lesson-youtube.py"))
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    root = Path(folder)
    def mock_api_upload(args):
        if args.receipt.exists():
            return
        time.sleep(0.1)
        with (root / "uploads.log").open("a") as log:
            log.write("one-upload\n")
        args.receipt.write_text('{"videoId":"one-id"}')
    module.execute = mock_api_upload
    sys.argv = ["uploader", "manifest", "deliverables", str(root / "receipt.json"), "--title", "Test", "--description-file", "description", "--plan", "plan"]
    module.main()


class ReleasePolicyTests(unittest.TestCase):
    def setUp(self):
        self.now = timestamp("2026-10-30T22:00:00Z")
        self.uploaded = self.now

    def test_concurrent_upload_commands_share_one_receipt(self):
        with tempfile.TemporaryDirectory() as directory:
            context = multiprocessing.get_context("fork")
            workers = [context.Process(target=upload_worker, args=(directory,)) for _ in range(2)]
            for worker in workers:
                worker.start()
            for worker in workers:
                worker.join(5)
                self.assertEqual(worker.exitcode, 0)
            self.assertEqual((Path(directory) / "uploads.log").read_text().splitlines(), ["one-upload"])

    def test_24_hour_target_uses_next_local_slot(self):
        self.assertEqual(release_time(self.uploaded, self.now, []), timestamp("2026-10-31T20:00:00Z"))

    def test_immediate_or_early_publication_rejected(self):
        for hours in (0, 1, 11):
            with self.assertRaises(ValueError):
                release_time(self.uploaded, self.now, [], requested=(self.now + timedelta(hours=hours)).isoformat())

    def test_rolling_window_and_four_hour_spacing(self):
        candidate = self.now + timedelta(hours=24)
        for hours in (1, 3):
            self.assertFalse(allowed_slot(candidate, self.uploaded, self.now, [{'id': 'x', 'at': candidate - timedelta(hours=hours)}]))
        events = [{'id': str(hours), 'at': candidate - timedelta(hours=hours)} for hours in (20, 16, 12, 8, 4)]
        self.assertTrue(allowed_slot(candidate, self.uploaded, self.now, events))
        # A legacy burst can exhaust the cap even when this release is spaced.
        events.append({'id': 'legacy-burst', 'at': candidate - timedelta(hours=18)})
        self.assertFalse(allowed_slot(candidate, self.uploaded, self.now, events))
        # Include future scheduled neighbors in windows crossing this release.
        events = [{'id': str(hours), 'at': candidate + timedelta(hours=hours)} for hours in (-8, -4, 4, 8, 12, 15)]
        self.assertFalse(allowed_slot(candidate, self.uploaded, self.now, events))

    def test_spring_dst_cannot_shorten_the_four_hour_gap(self):
        uploaded = timestamp('2027-03-13T05:00:00Z')
        events = [{'id': 'midnight', 'at': timestamp('2027-03-14T05:00:00Z')}]
        # Midnight to 4am is only three elapsed hours on this date.
        self.assertFalse(allowed_slot(timestamp('2027-03-14T08:00:00Z'), uploaded, uploaded, events))
        self.assertTrue(allowed_slot(timestamp('2027-03-14T12:00:00Z'), uploaded, uploaded, events))

    def test_related_editions_stay_a_day_apart(self):
        candidate = self.now + timedelta(hours=24)
        events = [{'id': 'same-concept', 'at': candidate - timedelta(hours=18)}]
        self.assertFalse(allowed_slot(candidate, self.uploaded, self.now, events, ['same-concept']))

    def test_dst_keeps_the_named_local_hour(self):
        uploaded = timestamp("2026-10-31T16:00:00Z")
        self.assertEqual(release_time(uploaded, uploaded, []), timestamp("2026-11-01T17:00:00Z"))

    def test_delayed_livestream_counts_its_actual_start(self):
        event = calendar_event({'id': 'stream', 'status': {'privacyStatus': 'public'}, 'snippet': {'publishedAt': '2026-10-31T10:00:00Z'}, 'liveStreamingDetails': {'scheduledStartTime': '2026-10-31T10:00:00Z', 'actualStartTime': '2026-10-31T14:00:00Z'}})
        self.assertEqual(event['at'], timestamp('2026-10-31T14:00:00Z'))
        self.assertFalse(allowed_slot(timestamp('2026-10-31T17:00:00Z'), self.uploaded, self.now, [event]))

    def test_review_cannot_make_a_public_video_private(self):
        with self.assertRaisesRegex(ValueError, "never changes a public"):
            validate_review({}, {}, {'status': {'privacyStatus': 'public'}}, self.now)

    def test_missing_comment_verification_blocks_scheduling(self):
        receipt = {'videoId': 'test', 'uploadedAt': self.uploaded.isoformat()}
        plan = {'studioReview': {'videoId': 'test', 'checkedAt': self.now.isoformat(), 'checks': {key: True for key in CHECKS}}}
        current = {'status': {'privacyStatus': 'private'}, 'processingDetails': {'processingStatus': 'succeeded'}}
        validate_review(plan, receipt, current, self.now)
        plan['studioReview']['checks']['commentsOn'] = False
        with self.assertRaisesRegex(ValueError, 'commentsOn'):
            validate_review(plan, receipt, current, self.now)

    def test_grade_is_not_an_audience_classification(self):
        plan = {'policyVersion': POLICY_VERSION, 'contentType': 'explanation', 'audience': {'classification': 'fifth-grade', 'rationale': 'Grade level'}, 'aiDisclosure': {'required': False, 'rationale': 'Diagram'}, 'pinnedComment': 'https://amp.corpora.inc', 'relatedVideoIds': []}
        with self.assertRaisesRegex(ValueError, 'audience rationale'):
            validate_plan(plan)


if __name__ == '__main__':
    unittest.main()
