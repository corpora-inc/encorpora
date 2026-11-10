from collections import Counter
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

from prod_queue import (approved_types, grade_order, ordered_skills,
                        prepare_queue, select_queue, smoke_rows, supported_figures)
from prod_prompts import screenplay_prompt, study_prompt


class ProductionQueueTests(unittest.TestCase):
    def fixture(self):
        skills, templates, families, by_skill = [], [], {}, {}
        for index, (grade, domain) in enumerate([
                ('K', 'CC'), ('K', 'OA'), ('K', 'NBT'), ('K', 'MD'), ('K', 'G'),
                ('1', 'OA'), ('algebra-1', 'algebra'), ('geometry', 'geometry')]):
            identifier = f'skill-{index}'
            skills.append({'id': identifier, 'title': identifier, 'gradeBand': grade,
                           'strand': domain, 'prerequisites': [],
                           'alignments': [{'standardId': f'{grade}.{domain}.A.1'}]})
            families[index] = {'path': f'family-{index}/FAMILY.md'}
            by_skill[identifier] = (index, 0)
            for position in range(3):
                templates.append({'id': f'type-{index}-{position}', 'skillId': identifier,
                                  'order': len(templates), 'grade': grade,
                                  'standards': [f'{grade}.{domain}.A.1'],
                                  'figure': {'kind': 'scene', 'legacy_player_compatible': True}})
        return {'skills': skills, 'templates': templates}, families, by_skill

    def select(self, catalog=None, approved=(), seed=42, existing_ids=()):
        base, families, skills = self.fixture()
        return select_queue(catalog or base, families, skills, set(approved), seed,
                            ['K', '1', 'algebra-1', 'geometry'], {'scene', 'none'}, existing_ids)

    def test_seed_balance_control_domains_and_blind_siblings(self):
        mapping, audit = self.select(existing_ids=['type-0-0--ab'])
        self.assertEqual(mapping, self.select(existing_ids=['type-0-0--ab'])[0])
        self.assertNotEqual(mapping, self.select(seed=44)[0])
        primary = [r for r in mapping['assignments'] if r['arm'] == 'primary']
        controls = [r for r in mapping['assignments'] if r['arm'] == 'control']
        self.assertEqual(len(primary), 24)
        self.assertEqual(len(controls), 4)
        self.assertEqual(len({r['domain'] for r in controls}), 4)
        self.assertEqual(Counter((r['study'], r['screenplay']) for r in controls),
                         {('fable', 'astra'): 2, ('opus', 'opus'): 2})
        self.assertEqual(Counter(r['screenplay'] for r in primary), {'sonnet': 8, 'grok': 8, 'sol': 8})
        self.assertEqual({r['study'] for r in primary}, {'sonnet'})
        self.assertEqual(len({r['id'] for r in mapping['assignments']}), 28)
        self.assertNotIn('type-0-0--ab', {r['id'] for r in mapping['assignments']})
        for before, after in zip(mapping['assignments'], mapping['assignments'][1:]):
            self.assertNotEqual(before['teacher'], after['teacher'])
            self.assertLessEqual(before['curriculum_order'], after['curriculum_order'])
        self.assertEqual([r['type'] for r in smoke_rows(mapping)], ['type-0-0', 'type-0-1', 'type-0-2'])
        self.assertNotIn('assignments', audit)
        self.assertTrue(all('screenplay' not in row and 'id' not in row for row in audit['types']))

    def test_prerequisite_order_is_stable_and_grade_order_wins(self):
        catalog, _, _ = self.fixture()
        catalog['skills'][0]['prerequisites'] = ['skill-2']
        catalog['skills'][2]['prerequisites'] = ['skill-6']
        order, notes = ordered_skills(catalog['skills'], ['K', '1', 'algebra-1', 'geometry'])
        self.assertLess(order.index('skill-2'), order.index('skill-0'))
        self.assertLess(order.index('skill-1'), order.index('skill-2'))
        self.assertLess(order.index('skill-0'), order.index('skill-6'))
        self.assertEqual(notes[0]['prerequisite'], 'skill-6')
        mapping, _ = self.select(catalog)
        primary = [r['type'] for r in mapping['assignments'] if r['arm'] == 'primary']
        self.assertLess(primary.index('type-2-0'), primary.index('type-0-0'))

    def test_cycle_stops_queue(self):
        catalog, _, _ = self.fixture()
        catalog['skills'][0]['prerequisites'] = ['skill-1']
        catalog['skills'][1]['prerequisites'] = ['skill-0']
        with self.assertRaisesRegex(ValueError, 'cycle'):
            self.select(catalog)

    def test_only_approval_and_actual_kit_gaps_exclude(self):
        catalog, _, _ = self.fixture()
        catalog['templates'][0]['figure']['kind'] = 'unimplemented-widget'
        catalog['templates'][1]['eligible_error'] = 'example drawing failed'
        catalog['templates'][2]['figure']['legacy_player_compatible'] = False
        catalog['templates'][3]['standards'] = []
        mapping, audit = self.select(catalog, approved=['type-1-1'])
        types = {r['type'] for r in mapping['assignments']}
        self.assertNotIn('type-0-0', types)
        self.assertNotIn('type-0-1', types)
        self.assertNotIn('type-1-1', types)
        self.assertIn('type-0-2', types)  # The installed live player is not frozen.
        self.assertIn('type-1-0', types)  # A missing standard is an audit limitation.
        self.assertEqual(len(audit['exclusions']), 3)
        self.assertEqual(len(mapping['grades'][0]['kit_gaps']), 2)

    def test_trunk_and_explicit_live_approval_only(self):
        with tempfile.TemporaryDirectory() as directory:
            from providers import write_json
            write_json(Path(directory)/'grades.json', {
                'accepted--aa': {'grade': 'approved'}, 'pending--ab': {'grade': 'A'},
                'rejected--ac': {'grade': 'rejected'}})
            with patch('prod_queue.subprocess.check_output', return_value='amp/film/lessons/trunk-type.json\n'):
                self.assertEqual(approved_types(directory, directory), {'accepted', 'trunk-type'})

    def test_resume_reuses_assignments_and_rejects_new_seed(self):
        from providers import write_json
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)/'private'
            write_json(root/'arms.json', {'seed': 7, 'assignments': []})
            config = {'root': str(root), 'worktree': str(Path(directory)/'worktree'), 'seed': 7}
            self.assertEqual(prepare_queue(config)['seed'], 7)
            with self.assertRaisesRegex(ValueError, 'seed changed'):
                prepare_queue({**config, 'seed': 8})

    def test_app_order_and_renderer_inputs_are_readable(self):
        worktree = Path(__file__).resolve().parents[3]
        self.assertEqual(grade_order(worktree)[-4:], ['algebra-1', 'geometry', 'algebra-2', 'precalculus'])
        self.assertTrue({'scene', 'ten-frame', 'solid-shape', 'collection'} <= supported_figures(worktree))

    def test_v2_scope_and_coverage_are_separate(self):
        study = study_prompt({'type': 'sample'}, 'family design', 'grade conventions')
        screenplay = screenplay_prompt('sample--aa', 'bounded-check')
        self.assertIn('verbatim standard', study)
        self.assertIn('grade conventions', study)
        self.assertIn('coverage-json', study)
        for prompt in (study, screenplay):
            self.assertIn('never teach the next skill', prompt)
            self.assertIn('about 3 to 5 minutes', prompt)
            self.assertIn('allowed, not required', prompt)
            self.assertNotIn('connect one rung above', prompt)


if __name__ == '__main__':
    unittest.main()
