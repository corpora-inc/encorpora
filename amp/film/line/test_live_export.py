import json
from pathlib import Path
import tempfile
import unittest
import subprocess

from live_export import player_copy, instrument_export_paths
from providers import write_json


class BlindExportTests(unittest.TestCase):
    def test_export_resolves_module_directories_containing_spaces_and_percent_signs(self):
        with tempfile.TemporaryDirectory(prefix='film archive % ') as directory:
            module = Path(directory)/'export.mjs'
            module.write_text(instrument_export_paths(
                'const here = new URL(".", import.meta.url).pathname;\nconsole.log(here);'))
            actual = subprocess.check_output(['node', str(module)], text=True).strip()
            self.assertEqual(Path(actual).resolve(), Path(directory).resolve())

    def test_only_player_fields_leave_private_storage(self):
        source = {'id': 'example--aa', 'title': 'Fractions', 'arm': 'SECRET_ARM_MARKER',
                  'founder_note': 'PRIVATE_NOTE', 'script': {'cast': {'teacher': {}, 'learner': {}}},
                  'timing': {'voices': {'teacher': 'J3Ei0Lj6fAobhIqY5ySH', 'learner': 'SYXbTJsLE7zmSjr1DchT'}}}
        result = player_copy(source)
        self.assertNotIn('arm', result)
        self.assertNotIn('founder_note', result)
        self.assertEqual(result['script']['cast']['teacher']['name'], 'Paul')
        self.assertEqual(result['script']['cast']['learner']['name'], 'Champ')
        self.assertEqual(source['script']['cast']['teacher'], {})


if __name__ == '__main__':
    unittest.main()
