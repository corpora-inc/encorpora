import json
import os
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

from prod_runtime import capture_worker, grouped_page, make_review_item
from providers import write_json
from runtime import _make, check_worker, digest


class ProductionRuntimeTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.base = Path(self.temp.name)
        self.root, self.data = self.base/'private', self.base/'live/data'
        self.data.mkdir(parents=True)
        self.config = {'root': str(self.root), 'live_data': str(self.data),
                       'worktree': str(self.base/'worktree'), 'player_url': 'http://localhost/live/'}

    def test_page_groups_siblings_in_curriculum_order_without_touching_player(self):
        untouched = {'index.html': '<body>Installed player</body>', 'lab.html': 'Lab comparisons'}
        for name, content in untouched.items():
            (self.data.parent/name).write_text(content)
        grades = {'first--zz': {'grade': 'approved'}}
        write_json(self.data/'grades.json', grades)
        assignments = [
            {'id': 'first--zz', 'type': 'first', 'grade': 'K', 'screenplay': 'SECRET_WRITER'},
            {'id': 'first--aa', 'type': 'first', 'grade': 'K', 'control': 'SECRET_CONTROL'},
            {'id': 'second--bb', 'type': 'second', 'grade': '1'},
        ]
        write_json(self.root/'arms.json', {'assignments': assignments})
        for kind in ('first', 'second'):
            write_json(self.root/'facts'/(kind+'.json'), {'template': {'title': 'Count < objects'}, 'skill': {'grade': 'K'}})
        write_json(self.data/'index.json', [dict(row, title='A < B', seconds=90, added='2026-01-01T00:00:00Z') for row in assignments])
        self.assertEqual(grouped_page(self.config), 3)
        page = (self.data.parent/'prod.html').read_text()
        self.assertNotIn('SECRET_WRITER', page)
        self.assertNotIn('SECRET_CONTROL', page)
        self.assertNotIn('control', page)
        self.assertIn('Count &lt; objects', page)
        self.assertIn('A &lt; B', page)
        self.assertIn('amp-production-films-seen', page)
        self.assertLess(page.index('Kindergarten'), page.index('Grade 1'))
        self.assertLess(page.index('data-film="first--aa"'), page.index('data-film="first--zz"'))
        self.assertLess(page.index('data-film="first--zz"'), page.index('data-film="second--bb"'))
        for name, content in untouched.items():
            self.assertEqual((self.data.parent/name).read_text(), content)
        self.assertEqual(json.loads((self.data/'grades.json').read_text()), grades)

    def test_review_editions_preserve_payloads_and_reject_changed_editions(self):
        row = {'id': 'first--aa', 'type': 'first'}
        workspace = self.base/'workspace'
        screenplay = workspace/'screenplay.json'
        payload_path = workspace/'check-output/first--aa/lab-payload.json'
        write_json(self.root/'facts/first.json', {'skill': {'grade': 'K', 'id': 'count', 'title': 'Counting'}, 'standards': []})
        def prepare(title):
            script = {'id': row['id'], 'title': title}
            write_json(screenplay, script)
            write_json(workspace/'check.json', {'passed': True, 'screenplay_sha256': digest(screenplay)})
            write_json(payload_path, {'script': script, 'timing_source': 'estimated', 'timing': {}})
        def capture(config, mode, *, items):
            identifier = json.loads(Path(items).read_text())[0]['id']
            image = self.root/'boards'/identifier/'one.jpg'
            image.parent.mkdir(parents=True)
            image.write_bytes(b'image')
            write_json(image.parent/'pages.json', [str(image)])
            return {'exit_code': 0}
        prepare('Initial')
        with patch('prod_runtime._worker', side_effect=capture) as worker:
            initial = make_review_item(self.config, row, workspace, edition=1)
            self.assertEqual(make_review_item(self.config, row, workspace, edition=1), initial)
            self.assertEqual(worker.call_count, 1)
            prepare('Revision')
            with self.assertRaisesRegex(RuntimeError, 'different screenplay'):
                make_review_item(self.config, row, workspace, edition=1)
            revised = make_review_item(self.config, row, workspace, edition=2)
        self.assertNotEqual(initial['id'], revised['id'])
        self.assertEqual(json.loads(Path(initial['payload']).read_text())['script']['title'], 'Initial')
        self.assertEqual(json.loads(Path(revised['payload']).read_text())['script']['title'], 'Revision')

    def test_capture_selects_installed_player_and_records_pages(self):
        items = self.root/'items.json'
        write_json(items, [{'id': 'first--aa-review-1', 'payload': 'payload.json'}])
        with patch.dict(os.environ, {'FILM_LAB_HEAVY': '1'}), \
                patch('prod_runtime._run', return_value={'exit_code': 0}) as run, \
                patch('prod_runtime.pages', side_effect=[['wide.jpg'], ['tall.jpg']]):
            capture_worker(self.config, items)
        command = run.call_args.args[0]
        self.assertIn('--installed', command)
        self.assertNotIn('--renderer', command)
        self.assertEqual(json.loads((self.root/'boards/first--aa-review-1/pages.json').read_text()), ['wide.jpg', 'tall.jpg'])
        self.assertFalse((self.root/'frozen-player').exists())

    def check_fixture(self):
        row = {'id': 'first--aa', 'type': 'first', 'teacher': 'J3Ei0Lj6fAobhIqY5ySH'}
        workspace = self.base/'check-workspace'
        script = {'id': row['id'], 'title': 'Count'}
        write_json(workspace/'screenplay.json', script)
        write_json(workspace/'check-output'/row['id']/'lab-payload.json', {
            'script': script, 'timing_source': 'estimated', 'timing': {}})
        return row, workspace

    def test_production_dry_checks_omit_old_boards_but_bakeoff_keeps_them(self):
        row, workspace = self.check_fixture()
        config = {**self.config, 'voice_cache': str(self.base/'voices')}
        result = {'exit_code': 0, 'stdout': '{"problems": []}', 'stderr': ''}
        with patch('runtime.verify_runtime'), patch('runtime._run', return_value=result) as run:
            _make(config, row, workspace)
            self.assertIn('--board', run.call_args.args[0])
            _make({**config, 'production': True}, row, workspace, tall=True)
            command = run.call_args.args[0]
            self.assertIn('--dry', command)
            self.assertIn('--tall', command)
            self.assertNotIn('--board', command)

    def test_production_check_uses_live_pages_and_replaces_mutable_author_boards(self):
        row, workspace = self.check_fixture()
        author = self.root/'boards'/(row['id']+'-author')
        author.mkdir(parents=True)
        (author/'stale-tail.jpg').write_bytes(b'old')
        old_pages = workspace/'storyboards'
        old_pages.mkdir()
        (old_pages/'stale.jpg').write_bytes(b'old')
        trashed = []
        def trash(command, **kwargs):
            self.assertEqual(command[0], 'trash')
            path = Path(command[1])
            trashed.append(path)
            path.rename(self.base/('trashed-'+str(len(trashed))))
        def capture(config, job):
            self.assertFalse(author.exists(), 'Old author frames must not survive a shorter draft')
            item = json.loads(Path(job).read_text())[0]
            self.assertEqual(item['id'], row['id']+'-author')
            files = [author/'pages/wide-001.jpg', author/'pages/tall-001.jpg']
            for image in files:
                image.parent.mkdir(parents=True, exist_ok=True)
                image.write_bytes(b'installed-player')
            write_json(author/'pages.json', [str(image) for image in files])
            return {'exit_code': 0}
        result = {'exit_code': 0, 'report': {'problems': []}, 'stderr': ''}
        with patch.dict(os.environ, {'FILM_LAB_HEAVY': '1'}), \
                patch('runtime.validate_cast'), patch('runtime._make', return_value=result) as make, \
                patch('runtime._run', side_effect=AssertionError('Legacy scale check must be skipped')), \
                patch('runtime.pages', side_effect=AssertionError('Old kit boards must be skipped')), \
                patch('runtime.ensure_renderer', side_effect=AssertionError('No frozen player')), \
                patch('runtime.subprocess.run', side_effect=trash), \
                patch('prod_runtime.capture_worker', side_effect=capture) as capture_call:
            checked = check_worker({**self.config, 'production': True}, row, workspace)
        self.assertTrue(checked['passed'], checked['errors'])
        self.assertEqual([call.kwargs['tall'] for call in make.call_args_list], [False, True])
        self.assertEqual(capture_call.call_count, 1)
        self.assertEqual(set(trashed), {author, old_pages})
        self.assertEqual(len(checked['storyboard_pages']), 2)
        self.assertTrue(all(Path(path).read_bytes() == b'installed-player' for path in checked['storyboard_pages']))
        self.assertFalse((old_pages/'stale.jpg').exists())

    def test_bakeoff_checks_keep_legacy_scale_gate_and_local_storyboards(self):
        row, workspace = self.check_fixture()
        for name in ('board', 'board-tall'):
            directory = workspace/'check-output'/row['id']/name
            directory.mkdir(parents=True)
            (directory/'000.jpg').write_bytes(b'old-kit')
        result = {'exit_code': 0, 'report': {'problems': []}, 'stderr': ''}
        with patch.dict(os.environ, {'FILM_LAB_HEAVY': '1'}), \
                patch('runtime.validate_cast'), patch('runtime._make', return_value=result) as make, \
                patch('runtime._run', return_value={'exit_code': 0}) as compatibility, \
                patch('runtime.pages', side_effect=[['author-wide.jpg'], ['author-tall.jpg']]), \
                patch('prod_runtime.capture_worker', side_effect=AssertionError('Bake-off capture changed')):
            checked = check_worker(self.config, row, workspace)
        self.assertTrue(checked['passed'], checked['errors'])
        self.assertEqual([call.kwargs['tall'] for call in make.call_args_list], [False, True])
        self.assertEqual(compatibility.call_count, 1)
        self.assertTrue(any(str(part).endswith('check-player-figure.ts') for part in compatibility.call_args.args[0]))
        self.assertEqual(checked['storyboard_pages'], ['author-wide.jpg', 'author-tall.jpg'])


if __name__ == '__main__':
    unittest.main()
