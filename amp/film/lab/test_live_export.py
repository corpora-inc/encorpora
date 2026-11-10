import json
from pathlib import Path
import tempfile
import unittest
import subprocess

from live_export import grouped_page, player_copy, instrument_export_paths
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

    def test_grouped_page_has_no_assignment_key_and_escapes_titles(self):
        with tempfile.TemporaryDirectory() as directory:
            base = Path(directory)
            root, data = base/'private', base/'live/data'
            data.mkdir(parents=True)
            (data.parent/'index.html').write_text('<html><body><div id="app"></div></body></html>')
            write_json(root/'arms.json', {'assignments': [{'id': 'example--aa', 'type': 'example', 'arm': 'SECRET_ARM_MARKER', 'screenplay': 'grok'}]})
            write_json(root/'facts/example.json', {'template': {'title': '</script><script>unsafe()</script>'}})
            write_json(data/'index.json', [{'id': 'example--aa', 'title': 'A < B', 'seconds': 90, 'grade': '4', 'added': 'edition-time'}])
            grouped_page({'root': str(root), 'live_data': str(data)})
            page = (data.parent/'lab.html').read_text()
            self.assertNotIn('SECRET_ARM_MARKER', page)
            self.assertNotIn('grok', page)
            self.assertNotIn('<script>unsafe()', page)
            self.assertIn('A &lt; B', page)
            self.assertIn('example--aa', page)


if __name__ == '__main__':
    unittest.main()
