import json
from pathlib import Path
import tempfile
import unittest

from prepare import freeze_calibration
from providers import write_json


class CalibrationSnapshotTests(unittest.TestCase):
    def test_resume_keeps_the_exact_graded_version(self):
        with tempfile.TemporaryDirectory() as directory:
            root, live = Path(directory)/'private', Path(directory)/'live'
            config = {'root': str(root), 'live_data': str(live)}
            write_json(live/'grades.json', {'film': {'grade': 'rejected', 'added': 'v1', 'note': 'A reason'}})
            write_json(live/'index.json', [{'id': 'film', 'added': 'v1'}])
            write_json(live/'film.json', {'script': {'id': 'film', 'title': 'Exact original'}})
            freeze_calibration(config, expected=1)
            original = (root/'calibration-source/film.json').read_bytes()
            write_json(live/'film.json', {'script': {'id': 'film', 'title': 'A later replacement'}})
            write_json(live/'grades.json', {'film': {'grade': 'approved', 'added': 'v2'}})
            self.assertTrue(freeze_calibration(config, expected=1)['reused'])
            self.assertEqual((root/'calibration-source/film.json').read_bytes(), original)
            self.assertEqual(json.loads((root/'calibration-labels.json').read_text())['records'][0]['grade']['grade'], 'rejected')

    def test_mismatched_grade_does_not_freeze_the_wrong_film(self):
        with tempfile.TemporaryDirectory() as directory:
            root, live = Path(directory)/'private', Path(directory)/'live'
            write_json(live/'grades.json', {'film': {'grade': 'approved', 'added': 'v1'}})
            write_json(live/'index.json', [{'id': 'film', 'added': 'v2'}])
            with self.assertRaisesRegex(RuntimeError, 'version'):
                freeze_calibration({'root': str(root), 'live_data': str(live)}, expected=1)
            self.assertFalse((root/'calibration-labels.json').exists())


if __name__ == '__main__':
    unittest.main()
