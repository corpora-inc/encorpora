"""Regressions for incomplete, mislabeled or stale paid-video deliveries."""
import copy
import hashlib
import io
import json
import os
from pathlib import Path
import sys
import tempfile
import unittest
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from cinema import delivery, spec, youtube


class Delivery(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.root = Path(self.tmp.name)
        self.manifest = self.root / 'delivery.json'
        self.exports = {}
        self.media = {}
        for fmt, preset in spec.FORMATS.items():
            file = self.root / f'{fmt}.mp4'
            file.write_bytes(fmt.encode())
            self.exports[fmt] = {'file': file.name, 'sha256': hashlib.sha256(file.read_bytes()).hexdigest()}
            w, h = preset['size']
            self.media[fmt] = {'streams': [{'codec_type': 'video', 'width': w, 'height': h,
                                           'sample_aspect_ratio': '1:1', 'duration': '23'},
                                          {'codec_type': 'audio'}], 'format': {'duration': '23'}}
        self.probe = patch.object(delivery, 'probe', side_effect=lambda p: self.media[p.stem])
        self.probe.start()
        self.addCleanup(self.probe.stop)
        self.save()

    def save(self):
        self.manifest.write_text(json.dumps({'exports': self.exports}))

    def test_full_set_passes_and_feed_is_optional(self):
        del self.exports['feed']
        self.save()
        result = delivery.check(self.manifest, self.root / 'square.mp4')
        self.assertEqual(set(result), {'wide', 'square', 'portrait'})
        self.assertEqual(result['square']['width'], 1080)

    def test_feed_cannot_replace_missing_square(self):
        del self.exports['square']
        self.save()
        with self.assertRaisesRegex(spec.SpecError, 'feed cannot replace square'):
            delivery.check(self.manifest)

    def test_file_labeled_square_with_feed_dimensions_is_rejected(self):
        self.media['square']['streams'][0]['height'] = 1350
        with self.assertRaisesRegex(spec.SpecError, 'square: requires'):
            delivery.check(self.manifest)

    def test_actual_bytes_must_match_reviewed_hash(self):
        (self.root / 'square.mp4').write_bytes(b'rerendered')
        with self.assertRaisesRegex(spec.SpecError, 'hash differs'):
            delivery.check(self.manifest)

    def test_small_rotated_anamorphic_and_silent_exports_fail(self):
        base = copy.deepcopy(self.media['square'])
        changes = [lambda v: v['streams'][0].update(width=720, height=720),
                   lambda v: v['streams'][0].update(side_data_list=[{'rotation': 90}]),
                   lambda v: v['streams'][0].update(sample_aspect_ratio='4:3'),
                   lambda v: v['streams'].pop()]
        for change in changes:
            with self.subTest(change=change):
                self.media['square'] = copy.deepcopy(base)
                change(self.media['square'])
                with self.assertRaises(spec.SpecError):
                    delivery.check(self.manifest)

    def test_placement_duration_and_nonfinite_values_fail(self):
        for fmt, duration in [('wide', '9'), ('portrait', '61'), ('square', 'nan')]:
            with self.subTest(fmt=fmt, duration=duration):
                self.media[fmt]['streams'][0]['duration'] = duration
                with self.assertRaisesRegex(spec.SpecError, 'duration'):
                    delivery.check(self.manifest)
                self.media[fmt]['streams'][0]['duration'] = '23'

    def test_cannot_upload_an_unlisted_file(self):
        with self.assertRaisesRegex(spec.SpecError, 'not in the checked'):
            delivery.check(self.manifest, self.root / 'other.mp4')

    def test_incomplete_upload_fails_before_credentials_or_network(self):
        del self.exports['square']
        self.save()
        with patch.dict(os.environ, {'AMP_YOUTUBE_CHANNEL_ID': 'test-channel'}), patch.object(youtube, '_token') as token:
            with self.assertRaises(spec.SpecError):
                youtube.upload(self.root / 'wide.mp4', 'Title', '', delivery_manifest=self.manifest)
            token.assert_not_called()

    def test_spec_cannot_omit_square(self):
        example = Path(__file__).resolve().parents[1] / 'cinema/examples/ad.json'
        data = json.loads(example.read_text())
        data['formats'] = ['wide', 'portrait', 'feed']
        with self.assertRaisesRegex(spec.SpecError, 'require wide, square and portrait'):
            spec.validate(data)

    def test_upload_receipt_identifies_sent_bytes_if_local_file_changes_during_put(self):
        video = self.root / 'square.mp4'
        sent_sha = self.exports['square']['sha256']
        def call(method, url, token, data=None, headers=None):
            if method == 'GET':
                result = {'items': [{'id': 'test-channel'}]}
            elif method == 'POST':
                result = {}
            else:
                self.assertEqual(hashlib.sha256(data).hexdigest(), sent_sha)
                video.write_bytes(b'concurrent render')
                result = {'id': 'test-video', 'status': {'privacyStatus': 'private'}}
            response = io.BytesIO(json.dumps(result).encode())
            response.headers = {'Location': 'https://www.googleapis.com/upload/youtube/v3/videos'}
            return response
        with patch.dict(os.environ, {'AMP_YOUTUBE_CHANNEL_ID': 'test-channel'}), \
                patch.object(youtube, '_token', return_value='test-token'), patch.object(youtube, '_call', side_effect=call):
            receipt = youtube.upload(video, 'Title', '', delivery_manifest=self.manifest)
        saved = json.loads(receipt.read_text())
        self.assertEqual(saved['sha256'], sent_sha)
        self.assertEqual(saved['deliveryCoverage']['square']['sha256'], sent_sha)


if __name__ == '__main__':
    unittest.main()
