from collections import Counter
import unittest

from selection import candidate_windows, select


class SamplingTests(unittest.TestCase):
    def fixture(self):
        families, skills, rows = {}, {}, []
        for number, grade in [(2, '1'), (9, '4'), (3, '6'), (15, 'algebra-1'), (30, 'geometry'), (33, 'algebra-1')]:
            skill = 'residuals-correlation' if number==33 else f'skill-{number}'
            families[number] = {'number': number, 'title': f'Family {number}', 'slug': f'family-{number}',
                                'path': f'family-{number}/FAMILY.md', 'skills': [skill]}
            skills[skill] = (number, 0)
            rows += [{'id': f'type-{number}-{i}', 'skillId': skill, 'grade': grade,
                      'order': i, 'standards': ['S.1'], 'difficultyOffset': 0} for i in range(10)]
        return {'templates': rows}, families, skills

    def test_reproducible_breadth_balance_and_blinding(self):
        catalog, families, skills = self.fixture()
        mapping, audit = select(catalog, families, skills, {'type-2-0'}, 20261110)
        repeated, _ = select(catalog, families, skills, {'type-2-0'}, 20261110)
        self.assertEqual(mapping, repeated)
        rows = mapping['assignments']
        self.assertEqual(len(rows), 54)
        self.assertEqual(len({r['type'] for r in rows}), 54)
        self.assertEqual(set(Counter(r['arm'] for r in rows).values()), {6})
        self.assertEqual(set(Counter(r['pathway'] for r in rows).values()), {9})
        self.assertNotIn('type-2-0', {r['type'] for r in rows})
        for row in rows:
            self.assertRegex(row['id'], '^'+row['type']+'--[a-z]{2}$')
        for before, after in zip(rows, rows[1:]):
            self.assertNotEqual(before['teacher'], after['teacher'])
        self.assertNotIn('assignments', audit)
        changed, _ = select(catalog, families, skills, {'type-2-0'}, 20261111)
        self.assertNotEqual(rows, changed['assignments'])

    def test_distant_grades_do_not_form_a_pathway(self):
        catalog, families, skills = self.fixture()
        rows = catalog['templates'][:9]
        rows[0] = {**rows[0], 'grade': '3'}
        self.assertEqual(candidate_windows(rows, families[2], skills), [])

    def test_pathways_stay_in_one_grade_and_three_neighboring_skills(self):
        catalog, families, skills = self.fixture()
        rows = catalog['templates'][:9]
        self.assertTrue(candidate_windows(rows, families[2], skills))
        adjacent_grade = [{**row, 'grade': '2'} if i==0 else row for i, row in enumerate(rows)]
        self.assertEqual(candidate_windows(adjacent_grade, families[2], skills), [])
        too_wide = [{**row, 'difficultyOffset': 0.76} if i==0 else row for i, row in enumerate(rows)]
        self.assertEqual(candidate_windows(too_wide, families[2], skills), [])
        skills['fourth-skill'] = (2, 3)
        fourth_skill = [{**row, 'skillId': 'fourth-skill'} if i==0 else row for i, row in enumerate(rows)]
        self.assertEqual(candidate_windows(fourth_skill, families[2], skills), [])

    def test_installed_player_scale_limit_is_applied_before_the_draw(self):
        catalog, families, skills = self.fixture()
        catalog['templates'][0]['figure'] = {'legacy_player_compatible': False}
        mapping, audit = select(catalog, families, skills, set(), 20261110)
        self.assertNotIn('type-2-0', {row['type'] for row in mapping['assignments']})
        self.assertTrue(any(row['type']=='type-2-0' and '0.01' in row['reason'] for row in audit['exclusions']))

    def test_a_stratum_short_of_nine_stops_before_assignment(self):
        catalog, families, skills = self.fixture()
        with self.assertRaisesRegex(ValueError, 'No nine-type pathway'):
            select(catalog, families, skills, {'type-2-0', 'type-2-1'}, 1)


if __name__ == '__main__':
    unittest.main()
