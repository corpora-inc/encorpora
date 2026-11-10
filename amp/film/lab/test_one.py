"""Single-film isolation and feedback contracts, without paid requests."""
import contextlib
import io
import json
from pathlib import Path
import subprocess
import sys
from types import SimpleNamespace
import tempfile
import unittest
from unittest.mock import patch

import one
from providers import write_json
from state import read_json


class SingleFilmTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.base = Path(self.temp.name)
        self.prod = self.base/'private/_prod'
        self.data = self.base/'private/live/data'
        self.work = self.base/'checkout'
        self.config = {'root': str(self.prod), 'worktree': str(self.work),
                       'live_data': str(self.data), 'env_file': 'unused',
                       'review_url': 'https://example.test/live/prod.html'}
        write_json(self.prod/'queue.json', {'types': [{'type': 'shapes', 'grade': 'K', 'family_path': 'family.md'}]})
        write_json(self.prod/'arms.json', {'assignments': [{'id': 'shapes--aa', 'type': 'shapes', 'study': 'opus'}]})
        write_json(self.prod/'facts/shapes.json', {'template': {'title': 'Flat < solid'}, 'skill': {'grade': 'K'}})
        (self.prod/'plans').mkdir()
        (self.prod/'plans/K.md').write_text('Course conventions')
        (self.prod/'PAUSE').write_text('Keep paused')
        self.data.mkdir(parents=True)
        self.work.mkdir()
        self.args = SimpleNamespace(type_id='shapes', note=None, from_id=None,
                                    restudy=False, stickler=False, study='sonnet', writer='astra')
        self.study = 'Study\n```coverage-json\n'+json.dumps({'verdict': 'ok', 'sample_limits': 'ten', 'gaps': []})+'\n```'

    def test_ids_avoid_live_and_reserved_ids_and_teachers_alternate(self):
        one_root = self.prod.parent/'_one'
        one_root.mkdir()
        write_json(self.data/'shapes--ab.json', {})
        with patch('one.random_ids.choice', side_effect=lambda values: values[0]):
            first, row = one.allocate(self.config, 'shapes')
            self.assertEqual(row['id'], 'shapes--ac')
            write_json(Path(first['root'])/'recipe.json', {'teacher': row['teacher'], 'started_at': '2026-01-01'})
            second, next_row = one.allocate(self.config, 'shapes')
        self.assertNotEqual(row['teacher'], next_row['teacher'])
        self.assertNotEqual(first['root'], second['root'])
        self.assertEqual(read_json(self.prod/'arms.json')['assignments'][0]['id'], 'shapes--aa')

    def test_feedback_reuses_study_and_rejects_wrong_type(self):
        write_json(self.prod/'films/shapes--aa/screenplay.json', {'id': 'shapes--aa', 'shots': []})
        (self.prod/'films/shapes--aa/study.md').write_text(self.study)
        script, study, study_model = one.source_film(self.config, 'shapes--aa', 'shapes')
        self.assertEqual(study_model, 'claude-opus-5-5')
        self.assertEqual(study, self.study)
        self.assertEqual(script['id'], 'shapes--aa')
        with self.assertRaisesRegex(ValueError, 'different problem type'):
            one.source_film(self.config, 'shapes--aa', 'counting')
        with self.assertRaises(ValueError):
            one.source_film(self.config, '../shapes--aa', 'shapes')

    def test_live_only_feedback_requires_restudy(self):
        write_json(self.data/'shapes--bb.json', {'problemType': 'shapes', 'script': {'id': 'shapes--bb'}})
        with self.assertRaisesRegex(ValueError, 'requires --restudy'):
            one.source_film(self.config, 'shapes--bb', 'shapes')
        self.assertIsNone(one.source_film(self.config, 'shapes--bb', 'shapes', restudy=True)[1])

    def test_cli_failure_preserves_production_even_with_equals_option(self):
        config = self.prod/'config.json'
        write_json(config, self.config)
        before = {str(p): p.read_bytes() for p in self.prod.rglob('*') if p.is_file()}
        for phase in (['--phase', 'one'], ['--phase=one']):
            result = subprocess.run([sys.executable, str(one.HERE/'prod.py'), '--config', str(config),
                                     *phase], capture_output=True, text=True)
            self.assertNotEqual(result.returncode, 0)
            self.assertIn('requires a valid --type', result.stderr)
            self.assertEqual(before, {str(p): p.read_bytes() for p in self.prod.rglob('*') if p.is_file()})

    def test_page_is_newest_first_and_preserves_other_pages_and_grades(self):
        one_root = self.prod.parent/'_one'
        for identifier, added in [('shapes--zz', '2026-01-01'), ('shapes--ab', '2026-01-02')]:
            root = one_root/identifier
            cfg = {**self.config, 'root': str(root), 'single_film': True, 'one_root': str(one_root)}
            write_json(root/'config.json', cfg)
            write_json(root/'arms.json', {'assignments': [{'id': identifier, 'type': 'shapes', 'grade': 'K'}]})
            write_json(root/'facts/shapes.json', read_json(self.prod/'facts/shapes.json'))
        write_json(self.data/'index.json', [{'id': i, 'title': 'Private-free title', 'seconds': 90, 'added': t}
                                           for i, t in [('shapes--zz', '2026-01-01'), ('shapes--ab', '2026-01-02')]])
        (self.data.parent/'prod.html').write_text('Preserve batch page')
        write_json(self.data/'grades.json', {'private': 'preserve'})
        one.one_page(cfg)
        page = (self.data.parent/'one.html').read_text()
        self.assertLess(page.index('data-film="shapes--ab"'), page.index('data-film="shapes--zz"'))
        self.assertIn('Flat &lt; solid', page)
        self.assertNotIn(str(one_root), page)
        self.assertEqual((self.data.parent/'prod.html').read_text(), 'Preserve batch page')
        self.assertEqual(read_json(self.data/'grades.json'), {'private': 'preserve'})

    def test_one_pipeline_does_not_write_batch_state_or_automatically_review(self):
        write_json(self.prod/'films/shapes--aa/screenplay.json', {'id': 'shapes--aa'})
        (self.prod/'films/shapes--aa/study.md').write_text(self.study)
        self.args.note, self.args.from_id = 'Use fewer words', 'shapes--aa'
        before = {str(p): p.read_bytes() for p in self.prod.rglob('*') if p.is_file()}
        workspace = self.work/'author'
        workspace.mkdir()

        def run(provider, role, prompt, workspace, receipt, **kwargs):
            self.assertEqual((provider, role), ('astra', 'screenplay'))
            self.assertIn(self.args.note, prompt)
            self.assertIn('previous-screenplay.json', prompt)
            write_json(workspace/'screenplay.json', {'id': receipt.parent.name})
            write_json(receipt, {'status': 'succeeded', 'api_dollars': None})
            return {'status': 'succeeded', 'response': 'Done'}

        with patch('one.credentials', return_value={}), \
             patch('one.prepare_workspace', return_value=workspace), \
             patch('one.check_command', return_value='bounded-check'), \
             patch('one.run_agent', side_effect=run) as agent, \
             patch('one.check_film', return_value={'passed': True}), \
             patch('one.voice_access'), \
             patch('one.voice_film', return_value={'voiced': True, 'check_passed': True}), \
             patch('prod_runtime.export_film', return_value={'exported': True}), \
             patch('prod.stickler') as stickler, contextlib.redirect_stdout(io.StringIO()) as output:
            one.run_one(self.config, self.args)
        self.assertEqual(agent.call_count, 1)
        stickler.assert_not_called()
        self.assertEqual(before, {str(p): p.read_bytes() for p in self.prod.rglob('*') if p.is_file()})
        root = next((self.prod.parent/'_one').glob('shapes--*'))
        recipe = read_json(root/'recipe.json')
        self.assertEqual(recipe['status'], 'exported')
        self.assertEqual(recipe['study_reused_from'], 'shapes--aa')
        self.assertEqual(recipe['models']['study'], 'claude-opus-5-5')
        self.assertEqual(recipe['cost']['model_receipts_without_full_dollars'], 1)
        self.assertTrue((root/'recipe/prod_prompts.py').exists())
        self.assertEqual(output.getvalue().splitlines()[-1], recipe['review_url'])


if __name__ == '__main__':
    unittest.main()
