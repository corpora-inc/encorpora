"""Seeded neighboring-type pathways and a private, balanced arm assignment."""
import argparse
from collections import defaultdict
import hashlib
import json
from pathlib import Path
import random
import re
import string

from providers import write_json
from state import private_destination

ARMS = [
    ('baseline', 'fable', 'astra'), ('study-opus', 'opus', 'astra'),
    ('study-sonnet', 'sonnet', 'astra'), ('study-grok', 'grok', 'astra'),
    ('write-opus', 'fable', 'opus'), ('write-fable', 'fable', 'fable'),
    ('write-grok', 'fable', 'grok'), ('write-sonnet', 'fable', 'sonnet'),
    ('all-grok', 'grok', 'grok'),
]
GRADES = ['K', '1', '2', '3', '4', '5', '6', '7', '8', 'algebra-1', 'geometry', 'algebra-2', 'precalculus']
STRATA = [
    ('k2', set(GRADES[:3]), None), ('g35', set(GRADES[3:6]), None),
    ('g68', set(GRADES[6:9]), None),
    ('hs-algebra', set(GRADES[9:]), {4, 5, 11, 12, 13, 14, 15, 16, 17, 18}),
    ('hs-geometry', set(GRADES[9:]), {22, 23, 24, 25, 26, 27, 28, 29, 30, 31}),
    ('hs-statistics', set(GRADES[9:]), {32, 33, 34}),
]
# Existing kit pictures, not proposed family tools. Families without a verified
# reusable picture are outside this experiment's pool.
PICTURES = {
    1: 'counters, frames and number lines', 2: 'base-ten blocks and number lines',
    3: 'signed number lines', 4: 'number lines, area grids and the algebra board',
    5: 'coordinate axes and directed segments', 6: 'counters, number lines and column arithmetic',
    7: 'counter arrays and rectangular area grids', 8: 'part-whole bars',
    9: 'equal-part bars, area grids and fraction number lines',
    10: 'two-scale bars, tables and number lines', 11: 'labeled bars, number lines and the algebra board',
    12: 'rectangular area grids and the algebra board', 13: 'tables and coordinate plots',
    14: 'coordinate plots and slope triangles', 15: 'parabolas and square-area diagrams',
    16: 'coordinate plots and tables', 17: 'coordinate plots and the algebra board',
    18: 'coordinate plots', 22: 'labeled planar polygons', 23: 'angles and labeled triangles',
    24: 'area grids and polygons', 26: 'coordinate polygons and corresponding segments',
    27: 'coordinate plots and labeled triangles', 28: 'circles, arcs and labeled segments',
    29: 'labeled geometric figures', 30: 'right triangles, circles and waves',
    31: 'coordinate axes and directed segments', 32: 'the app data displays and kit tables',
    33: 'two-variable tables and coordinate plots', 34: 'tables, proportional mosaics and labeled regions',
}
# The curriculum design explicitly identifies these grade leaks or misplaced
# types. Do not call their catalog grade sufficient evidence of comparability.
FLAGGED = {
    'story-equation-choice', 'staar-multistep-stories', 'staar-measure-chains',
    'decimal-money-change', 'wallet-purchase-chain', 'staar-money-vocabulary',
    'early-money-decisions', 'fixed-variable-expense-table', 'staar-signed-exponent-order',
    'staar-order-mixed-forms', 'elapsed-time-intervals', 'rename-time-units',
    'measurement-line-fraction-story', 'loan-total-cost', 'loan-compare-options',
    'frequency-table-center', 'congruent-figure-pair',
}


def families(design):
    text = (design/'CURRICULUM.md').read_text()
    result, by_skill = {}, {}
    for match in re.finditer(r'^\*\*(\d+)\. ([^*]+)\*\*[^\n]*\n([^\n]+)', text, re.M):
        number, title, members = int(match[1]), match[2], match[3]
        slug = 'place-value' if number==2 else re.sub(r'[^a-z0-9]+', '-', title.lower()).strip('-')
        filename = 'DESIGN.md' if number==2 else 'FAMILY.md'
        path = f'{slug}/{filename}'
        if not (design/path).is_file():
            raise ValueError('Missing family design '+path)
        ids = re.findall(r'(?:K|[1-8]|A1|Geo|A2|PC) ([a-z0-9-]+) \(\d+\)', members)
        if not ids:
            raise ValueError('Family has no parsed skills: '+title)
        result[number] = {'number': number, 'title': title, 'slug': slug, 'path': path, 'skills': ids}
        for index, skill in enumerate(ids):
            if skill in by_skill:
                raise ValueError('Skill has more than one family: '+skill)
            by_skill[skill] = (number, index)
    if len(result) != 34:
        raise ValueError('Expected all 34 declared teaching families')
    return result, by_skill


def candidate_windows(rows, family, by_skill):
    rows = sorted(rows, key=lambda r: (by_skill[r['skillId']][1], r.get('difficultyOffset', 0), r['order'], r['id']))
    windows = []
    for start in range(max(0, len(rows)-8)):
        group = rows[start:start+9]
        levels = [GRADES.index(r['grade']) for r in group]
        skill_positions = [by_skill[r['skillId']][1] for r in group]
        difficulty = [level+r.get('difficultyOffset', 0) for level, r in zip(levels, group)]
        if max(levels)!=min(levels) or max(difficulty)-min(difficulty)>0.75:
            continue
        if max(skill_positions)-min(skill_positions)>2:
            continue
        windows.append({'family_number': family['number'], 'family': family['title'],
                        'family_path': family['path'], 'types': [r['id'] for r in group],
                        'skills': list(dict.fromkeys(r['skillId'] for r in group)),
                        'grades': list(dict.fromkeys(r['grade'] for r in group)),
                        'difficulty_range': [min(difficulty), max(difficulty)],
                        'picture': PICTURES[family['number']]})
    return windows


def select(catalog, family_map, by_skill, approved, seed, existing_ids=()):
    rng = random.Random(seed)
    exclusions, eligible = [], []
    for row in catalog['templates']:
        reason = None
        family = by_skill.get(row['skillId'], (None, None))[0]
        if row['id'] in approved:
            reason = 'has an approved film'
        elif row['id'] in FLAGGED or row['id'].startswith('prime-factorization-'):
            reason = 'curriculum design flags its grade or family placement'
        elif row.get('eligible_error'):
            reason = 'written-lesson or figure construction failed: '+row['eligible_error']
        elif row.get('figure', {}).get('legacy_player_compatible') is False:
            reason = 'example scene needs scale below the installed review player minimum of 0.01'
        elif not row.get('standards'):
            reason = 'no aligned verbatim standard was resolved from the supplied source'
        elif family not in PICTURES:
            reason = 'outside the verified kit-picture family pool'
        elif family==22 and 'solid' in row['id']:
            reason = 'planar-figure pathway excludes solid figures'
        elif family==33 and row['skillId'] not in {'residuals-correlation', 'categorical-association', 'regression-interpretation', 'scatterplots', 'two-way-tables'}:
            reason = 'study-design and sampling pictures require tools outside this data-display pathway'
        if reason:
            exclusions.append({'type': row['id'], 'reason': reason})
        else:
            eligible.append(row)
    pathways, assignments, pools = [], [], {}
    used_ids = set(existing_ids)
    for stratum, grades, allowed in STRATA:
        grouped = defaultdict(list)
        for row in eligible:
            number = by_skill[row['skillId']][0]
            if row['grade'] in grades and (allowed is None or number in allowed):
                grouped[number].append(row)
        windows = {number: candidate_windows(rows, family_map[number], by_skill) for number, rows in grouped.items()}
        windows = {number: value for number, value in windows.items() if value}
        pools[stratum] = {str(number): value for number, value in sorted(windows.items())}
        if not windows:
            raise ValueError('No nine-type pathway satisfies the declared constraints for '+stratum)
        number = rng.choice(sorted(windows))
        chosen = rng.choice(windows[number])
        family = family_map[number]
        pathway_id = stratum+'-'+family['slug']
        reason = (f'Uniform seeded choice among {len(windows)} eligible families, then among '
                  f'{len(windows[number])} adjacent nine-type windows in this family. '
                  f'Grades: {", ".join(chosen["grades"])}; curriculum difficulty span '
                  f'{chosen["difficulty_range"][1]-chosen["difficulty_range"][0]:.2f}. '
                  f'Neighboring skills share {chosen["picture"]}. '
                  'Only implemented pictures are in scope; proposed family tools are excluded.')
        pathways.append({'id': pathway_id, 'stratum': stratum, **chosen, 'reason': reason})
        shuffled = list(ARMS)
        rng.shuffle(shuffled)
        for type_id, (arm, study, screenplay) in zip(chosen['types'], shuffled):
            while True:
                blind_id = type_id+'--'+''.join(rng.choice(string.ascii_lowercase) for _ in range(2))
                if blind_id not in used_ids:
                    used_ids.add(blind_id)
                    break
            position = len(assignments)
            assignments.append({'id': blind_id, 'type': type_id, 'arm': arm,
                'study': study, 'screenplay': screenplay, 'pathway': pathway_id,
                'family_path': family['path'], 'position': position,
                'teacher': 'XescS24CsOySAkKrLAO3' if position%2==0 else 'J3Ei0Lj6fAobhIqY5ySH'})
    if len({r['type'] for r in assignments}) != 54:
        raise ValueError('The experiment must contain 54 distinct types')
    mapping = {'seed': seed, 'pathways': pathways, 'assignments': assignments}
    selection = {'seed': seed, 'algorithm': 'Uniform eligible family, then uniform adjacent nine-type window; seeded arm shuffle per pathway.',
                 'adjacency': 'Family curriculum order, then editorial difficulty and stable engine order; one grade, difficulty span at most 0.75, and at most three neighboring skills.',
                 'catalog_sha256': hashlib.sha256(json.dumps(catalog, sort_keys=True).encode()).hexdigest(),
                 'approved_types_excluded': sorted(approved), 'exclusions': exclusions, 'candidate_pools': pools}
    return mapping, selection


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--root', required=True)
    parser.add_argument('--worktree', required=True)
    parser.add_argument('--seed', type=int, required=True)
    parser.add_argument('--live-data', required=True)
    args = parser.parse_args()
    root, live = private_destination(args.root, args.worktree), Path(args.live_data)
    if (root/'arms.json').exists():
        raise RuntimeError('Assignment already exists; do not resample an experiment')
    catalog = json.loads((root/'catalog.json').read_text())
    family_map, by_skill = families(Path(args.worktree)/'amp/film/design')
    grades = json.loads((live/'grades.json').read_text())
    # The private review service stores one verdict per live edition ID.
    approved = {key.split('--')[0] for key, value in grades.items() if value.get('grade')=='approved'}
    index = json.loads((live/'index.json').read_text())
    mapping, audit = select(catalog, family_map, by_skill, approved, args.seed, [r['id'] for r in index])
    write_json(root/'selection.json', audit)
    write_json(root/'types.json', [r['type'] for r in mapping['assignments']])
    write_json(root/'arms.json', mapping)
    print(json.dumps({'seed': args.seed, 'pathways': len(mapping['pathways']), 'distinct_types': len(mapping['assignments'])}))


if __name__ == '__main__':
    main()
