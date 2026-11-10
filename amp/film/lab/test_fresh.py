"""Fresh selection, clean authoring context, and blind export contracts."""
import contextlib
import io
import json
from pathlib import Path
import tempfile
from types import SimpleNamespace
import unittest
from unittest.mock import patch, Mock

import fresh
import providers
from providers import write_json


class FreshTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.base = Path(self.temp.name)
        self.work = self.base/'checkout'
        self.root = self.base/'private/_fresh'
        self.data = self.base/'private/live/data'
        self.data.mkdir(parents=True)
        self.work.mkdir()
        self.catalog = {'skills': [{'id': g, 'gradeBand': g} for g in ('K', '8', 'precalculus')],
                        'templates': [{'id': g+'-type', 'title': g, 'skillId': g,
                                       'figure': {'kind': 'none'}} for g in ('K', '8', 'precalculus')]}

    def test_draw_uses_every_grade_and_overrides_do_not_change_type(self):
        selected = set()
        models, efforts = set(), set()
        for seed in range(200):
            result = fresh.draw(self.catalog, set(), {'none'}, seed)
            selected.add(result[0]['grade'])
            models.add(result[1]); efforts.add(result[2])
            override = fresh.draw(self.catalog, set(), {'none'}, seed, 'sol', 'low')
            self.assertEqual(override[0], result[0])
            self.assertEqual(override[1:3], ('sol', 'low'))
            self.assertEqual(len(result[3]['eligible_types']), 3)
        self.assertEqual(selected, {'K', '8', 'precalculus'})
        self.assertEqual(models, set(providers.MODELS))
        self.assertEqual(efforts, set(fresh.EFFORTS))
        self.catalog['templates'][1]['figure'] = {'kind': 'unsupported'}
        result = fresh.draw(self.catalog, {'K-type'}, {'none'}, 1)
        self.assertEqual(result[0]['type'], 'precalculus-type')

    def test_approvals_use_current_score_and_resolve_blind_type(self):
        write_json(self.work/'amp/film/lessons/library.json', {'id': 'library'})
        ids = ['pass', 'fail', 'stale', 'legacy', 'boolean']
        write_json(self.data/'index.json', [{'id': i, 'added': 'new'} for i in ids])
        write_json(self.data/'grades.json', {i: {'grade': 'approved', 'added': 'new'} for i in ['fail', 'legacy']})
        write_json(self.data/'reviews.json', {'pass': {'score': 6, 'added': 'new'},
                   'fail': {'score': 5, 'added': 'new'}, 'stale': {'score': 10, 'added': 'old'},
                   'boolean': {'score': True}})
        write_json(self.data/'pass.json', {'problemType': 'actual-type',
                   'script': {'id': 'pass', 'cast': {'narrator': {'voice': 'bound-voice'}}}})
        approved, refs = fresh.approved_inputs(self.work, self.data)
        self.assertEqual(approved, {'library', 'actual-type', 'legacy'})
        self.assertEqual(refs['pass']['cast'], {'narrator': {}})

    def test_private_workspace_contains_only_curated_inputs(self):
        config = {'root': str(self.root/'type--aa'), 'worktree': str(self.work), 'fresh_film': True,
                  'workspace_root': str(self.root/'type--aa/workspace')}
        write_json(self.work/'amp/film/schema.ts', {})
        facts = {key: {} for key in ('template', 'skill', 'written_lesson', 'kit_figure')}
        facts.update(type='type', standards=[], problems=[], contextual_written_lessons=[],
                     study='DO NOT COPY', family='DO NOT COPY',
                     kit_figure={'kind': 'none', 'components': [], 'named_parts': [], 'use': 'AUTHORING.md'})
        with patch('fresh.prepare_runtime', side_effect=lambda c, r, w: w):
            workspace = fresh.prepare_fresh_workspace(config, {'id': 'type--aa'}, facts, [{}, {}, {}])
        self.assertEqual({p.name for p in workspace.iterdir()}, {'facts.json', 'KIT.md', 'schema.ts', 'references'})
        self.assertNotIn('DO NOT COPY', (workspace/'facts.json').read_text())
        self.assertNotIn('AUTHORING.md', (workspace/'facts.json').read_text())
        prompt = fresh.prompt_for('type--aa', 'check-me')
        self.assertTrue(prompt.startswith(fresh.BRIEF))
        self.assertIn('45 minutes', prompt)
        self.assertIn('check-me', prompt)

    def test_fresh_page_is_blind_newest_first_and_displays_grade(self):
        config = {'live_data': str(self.data), 'fresh_root': str(self.root)}
        for i, added, grade in [('old--aa', '2026-01-01', 'K'), ('new--aa', '2026-01-02', 'precalculus')]:
            root = self.root/i
            write_json(root/'config.json', {**config, 'root': str(root), 'fresh_film': True})
            write_json(root/'arms.json', {'assignments': [{'id': i, 'type': 'type', 'grade': grade, 'model': 'SECRET'}]})
            write_json(root/'facts/type.json', {'template': {'title': 'Type title'}, 'skill': {'grade': grade}})
        write_json(self.data/'index.json', [{'id': i, 'added': d, 'title': 'Film', 'seconds': 60}
                   for i, d in [('old--aa', '2026-01-01'), ('new--aa', '2026-01-02')]])
        fresh.fresh_page(config)
        page = (self.data.parent/'fresh.html').read_text()
        self.assertLess(page.index('data-film="new--aa"'), page.index('data-film="old--aa"'))
        self.assertIn('Kindergarten', page); self.assertIn('Precalculus', page)
        self.assertIn('review.html?id=new--aa&list=fresh', page)
        self.assertNotIn('SECRET', page)

    def test_each_provider_receives_selected_effort_with_default_unchanged(self):
        for provider in providers.MODELS:
            for effort in fresh.EFFORTS:
                process = Mock(pid=123, returncode=0)
                process.communicate.return_value = ('', '')
                with patch('providers.subprocess.Popen', return_value=process) as launch:
                    receipt = providers.run_agent(provider, 'screenplay', 'prompt', self.base/'agent',
                        self.base/'receipt.json', secrets={'ANTHROPIC_API_KEY': 'dummy'},
                        check_command='check-me', effort=effort)
                command = launch.call_args.args[0]
                if provider in ('astra', 'sol'):
                    self.assertIn(f'model_reasoning_effort="{effort}"', command)
                else:
                    flag = '--reasoning-effort' if provider == 'grok' else '--effort'
                    self.assertEqual(command[command.index(flag)+1], effort)
                self.assertEqual(receipt['reasoning_effort'], effort)

    def test_pipeline_calls_one_author_without_study_plan_or_review(self):
        config = {'root': str(self.root.parent/'_prod'), 'worktree': str(self.work),
                  'live_data': str(self.data), 'env_file': 'unused', 'heavy': 'gate',
                  'standards': 'unused', 'review_url': 'https://example.test/live/prod.html'}
        args = SimpleNamespace(seed=9, model='sol', effort='low')
        write_json(self.root/'catalog.json', self.catalog)
        workspace = self.base/'mock-author'
        workspace.mkdir()
        facts = {'standards': [{'code': 'test', 'text': 'Verbatim standard'}]}

        def facts_for(cfg, rows):
            write_json(Path(cfg['root'])/'facts'/(rows[0]['type']+'.json'), facts)

        def author(provider, role, prompt, work, receipt, **kw):
            self.assertEqual((provider, role), ('sol', 'screenplay'))
            self.assertEqual(kw['timeout'], 2700)
            self.assertEqual(kw['effort'], 'low')
            write_json(work/'screenplay.json', {'id': receipt.parent.name})
            result = {'status': 'succeeded', 'tokens': {'output': 12}, 'api_dollars': None}
            write_json(receipt, result)
            return result

        with patch('fresh.subprocess.run'), patch('fresh.approved_inputs', return_value=(set(), {'a': {}, 'b': {}})), \
             patch('fresh.supported_figures', return_value={'none'}), patch('fresh.credentials', return_value={}), \
             patch('prod.ensure_facts', side_effect=facts_for), patch('fresh.prepare_fresh_workspace', return_value=workspace), \
             patch('fresh.check_command', return_value='check-command'), patch('fresh.run_agent', side_effect=author) as run, \
             patch('fresh.check_film', return_value={'passed': True}), patch('fresh.voice_access'), \
             patch('fresh.voice_film', return_value={'voiced': True, 'check_passed': True}), \
             patch('prod_runtime.export_film', return_value={'exported': True}), patch('prod.stickler') as review, \
             patch('prod.grade_plan') as plan, contextlib.redirect_stdout(io.StringIO()):
            fresh.run_fresh(config, args)
        run.assert_called_once(); review.assert_not_called(); plan.assert_not_called()
        recipe = json.loads(next(self.root.glob('*/recipe.json')).read_text())
        self.assertEqual(recipe['status'], 'exported')
        self.assertEqual(recipe['tokens'], {'output': 12})
        self.assertTrue(recipe['review_url'].endswith('&list=fresh'))
        self.assertEqual(set(recipe['stages']), {'selection', 'facts', 'workspace', 'screenplay', 'kit-check', 'voice', 'export'})


if __name__ == '__main__':
    unittest.main()
