"""Deterministic curriculum queue and private film assignments for production."""
from __future__ import annotations

import argparse
from collections import defaultdict
import hashlib
import heapq
import json
from pathlib import Path
import random
import re
import string
import subprocess

from providers import now, write_json
from selection import families
from state import private_destination, read_json

WRITERS = ('sonnet', 'grok', 'sol')
TEACHERS = ('XescS24CsOySAkKrLAO3', 'J3Ei0Lj6fAobhIqY5ySH')


def grade_order(worktree):
    """Read the same order used by the app's written-lesson library."""
    source = (Path(worktree)/'amp/src/content/lesson-text.ts').read_text()
    match = re.search(r'export const gradeBandOrder[^=]*=\s*\[(.*?)\]', source, re.S)
    if not match:
        raise ValueError('Cannot read the app grade order')
    grades = re.findall(r'"([^"]+)"', match[1])
    if grades[:9] != ['K', *map(str, range(1, 9))] or len(set(grades)) != len(grades):
        raise ValueError('Invalid app grade order')
    return grades


def supported_figures(worktree):
    """The film example adapter renders the app Figure and its scene ports."""
    source = Path(worktree)/'amp/src'
    figure = (source/'web/Figure.tsx').read_text()
    legacy = (source/'math/scene/legacy.ts').read_text()
    match = re.search(r'export const portedKinds\s*=\s*\[(.*?)\]', legacy, re.S)
    if not match:
        raise ValueError('Cannot read the implemented figure ports')
    return {'none', 'scene', *re.findall(r'case "([^"]+)"', figure),
            *re.findall(r'"([^"]+)"', match[1])}


def approved_types(worktree, live_data):
    """Only trunk screenplays and explicit live approvals exclude a type."""
    paths = subprocess.check_output(
        ['git', 'ls-tree', '-r', '--name-only', 'origin/main', '--', 'amp/film/lessons'],
        cwd=worktree, text=True).splitlines()
    trunk = {Path(path).stem.split('--')[0] for path in paths if path.endswith('.json')}
    grades = read_json(Path(live_data)/'grades.json', {})
    live = {identifier.split('--')[0] for identifier, verdict in grades.items()
            if isinstance(verdict, dict) and verdict.get('grade') == 'approved'}
    return trunk | live


def ordered_skills(skills, grades):
    """Stable topological ordering: prerequisites first, app order for ties."""
    rank = {skill['id']: position for position, skill in enumerate(skills)}
    if len(rank) != len(skills):
        raise ValueError('Duplicate curriculum skill')
    by_id = {skill['id']: skill for skill in skills}
    unknown = {skill['gradeBand'] for skill in skills} - set(grades)
    if unknown:
        raise ValueError('Skills have grades absent from app order: '+', '.join(sorted(unknown)))
    result, cross_grade = [], []
    for grade in grades:
        group = [skill for skill in skills if skill['gradeBand'] == grade]
        members = {skill['id'] for skill in group}
        edges, remaining = defaultdict(list), {}
        for skill in group:
            parents = set(skill.get('prerequisites', []))
            unknown_parents = parents - set(by_id)
            if unknown_parents:
                raise ValueError('Missing prerequisite skills: '+', '.join(sorted(unknown_parents)))
            for parent in parents:
                if parent in members:
                    edges[parent].append(skill['id'])
                elif grades.index(by_id[parent]['gradeBand']) > grades.index(grade):
                    cross_grade.append({'skill': skill['id'], 'prerequisite': parent,
                                        'reason': 'App prerequisite belongs to a later grade; grade order takes precedence.'})
            remaining[skill['id']] = len(parents & members)
        ready = [(rank[identifier], identifier) for identifier, count in remaining.items() if count == 0]
        heapq.heapify(ready)
        ordered = []
        while ready:
            _, identifier = heapq.heappop(ready)
            ordered.append(identifier)
            for child in edges[identifier]:
                remaining[child] -= 1
                if remaining[child] == 0:
                    heapq.heappush(ready, (rank[child], child))
        if len(ordered) != len(group):
            raise ValueError('Prerequisite cycle in grade '+grade)
        result.extend(ordered)
    return result, cross_grade


def domain_for(skill):
    for alignment in skill.get('alignments', []):
        match = re.match(r'(?:CCSS\.)?(?:K|[1-8])\.([A-Z]+)\.', alignment['standardId'])
        if match:
            return match[1]
    return skill.get('strand', 'unspecified')


def figure_gap(row, supported):
    if row.get('eligible_error'):
        return 'The kit cannot construct this type’s example: '+row['eligible_error']
    figure = row.get('figure') or {'kind': 'none'}
    if figure.get('kit_supported') is False:
        return figure.get('unsupported_reason') or 'The catalog marks this figure as unsupported by the kit.'
    if figure.get('kind', 'none') not in supported:
        return 'No implemented film example renderer for figure kind '+str(figure.get('kind'))
    return None


def select_queue(catalog, family_map, by_skill, approved, seed, grades,
                 supported, existing_ids=()):
    """Return assignment mapping plus a model-free curriculum audit."""
    skill_order, ordering_notes = ordered_skills(catalog['skills'], grades)
    rank = {identifier: index for index, identifier in enumerate(skill_order)}
    skills = {skill['id']: skill for skill in catalog['skills']}
    rows = catalog['templates']
    if len({row['id'] for row in rows}) != len(rows):
        raise ValueError('Duplicate problem type')
    for row in rows:
        if row['skillId'] not in rank:
            raise ValueError('Problem type has unknown skill: '+row['id'])
    rows = sorted(rows, key=lambda row: (rank[row['skillId']], row.get('order', 0), row['id']))
    excluded, eligible = [], []
    for row in rows:
        skill = skills[row['skillId']]
        gap = figure_gap(row, supported)
        reason = 'has an approved film' if row['id'] in approved else gap
        if reason:
            excluded.append({'type': row['id'], 'grade': skill['gradeBand'],
                             'reason': reason, 'kind': 'approved' if row['id'] in approved else 'kit-gap'})
            continue
        number = by_skill.get(row['skillId'], (None, None))[0]
        family = family_map.get(number)
        eligible.append({'type': row['id'], 'grade': skill['gradeBand'],
                         'skillId': row['skillId'], 'skill_title': skill['title'],
                         'domain': domain_for(skill),
                         'title': row.get('lesson_title') or row.get('title') or row['id'],
                         'standards': row.get('standards', []),
                         'figure': row.get('figure', {}),
                         'family_path': family['path'] if family else 'CURRICULUM.md',
                         'curriculum_order': len(eligible)})

    # Select distinct K domains first, with seeded choices within each domain.
    rng = random.Random(seed)
    domains = defaultdict(list)
    for row in eligible:
        if row['grade'] == 'K':
            domains[row['domain']].append(row)
    names = sorted(domains)
    rng.shuffle(names)
    chosen = [rng.choice(domains[domain])['type'] for domain in names[:4]]
    if len(chosen) < 4:
        candidates = [row['type'] for row in eligible if row['grade'] == 'K' and row['type'] not in chosen]
        rng.shuffle(candidates)
        chosen.extend(candidates[:4-len(chosen)])
    if len(chosen) != 4:
        raise ValueError('Four eligible Kindergarten types are required for controls')
    rng.shuffle(chosen)
    controls = {identifier: ('fable', 'astra') if i < 2 else ('opus', 'opus')
                for i, identifier in enumerate(chosen)}
    rotation = list(WRITERS)
    rng.shuffle(rotation)
    used = set(existing_ids)
    assignments = []

    def add(row, study, writer, arm):
        suffixes = [a+b for a in string.ascii_lowercase for b in string.ascii_lowercase
                    if row['type']+'--'+a+b not in used]
        if not suffixes:
            raise ValueError('All blind suffixes are in use for '+row['type'])
        identifier = row['type']+'--'+rng.choice(suffixes)
        used.add(identifier)
        position = len(assignments)
        assignments.append({**row, 'id': identifier, 'study': study, 'screenplay': writer,
                            'arm': arm, 'position': position,
                            'teacher': TEACHERS[position % len(TEACHERS)]})

    for index, row in enumerate(eligible):
        add(row, 'sonnet', rotation[index % len(rotation)], 'primary')
        if row['type'] in controls:
            study, writer = controls[row['type']]
            add(row, study, writer, 'control')
    grade_rows = [{'id': grade,
                   'types': [row['type'] for row in eligible if row['grade'] == grade],
                   'skill_order': [identifier for identifier in skill_order if skills[identifier]['gradeBand'] == grade],
                   'kit_gaps': [row for row in excluded if row['grade'] == grade and row['kind'] == 'kit-gap']}
                  for grade in grades]
    mapping = {'schema_version': 1, 'seed': seed, 'grade_order': grades,
               'grades': grade_rows, 'assignments': assignments}
    audit = {'schema_version': 1, 'seed': seed, 'grade_order': grades,
             'algorithm': 'App grade order, stable prerequisite ordering within each grade, then engine type order. Seeded three-writer rotation; four Kindergarten controls spread across distinct available domains.',
             'catalog_sha256': hashlib.sha256(json.dumps(catalog, sort_keys=True).encode()).hexdigest(),
             'types': eligible, 'exclusions': excluded, 'ordering_notes': ordering_notes,
             'controls_count': len(controls), 'control_domains_count': len({row['domain'] for row in eligible if row['type'] in controls})}
    return mapping, audit


def smoke_rows(mapping, count=3):
    """First eligible Kindergarten types, before their optional siblings."""
    return [row for row in mapping['assignments']
            if row['grade'] == 'K' and row['arm'] == 'primary'][:count]


def prepare_queue(config):
    root = private_destination(config['root'], config['worktree'])
    saved = read_json(root/'arms.json')
    if saved is not None:
        if saved.get('seed') != config['seed']:
            raise ValueError('Production seed changed; preserve the existing assignment')
        return saved
    catalog = read_json(root/'catalog.json')
    if not catalog:
        raise ValueError('Build catalog.json with facts.ts inventory before preparing the queue')
    live = Path(config['live_data'])
    existing = {row['id'] for row in read_json(live/'index.json', [])}
    existing.update(config.get('existing_ids', []))
    # These identifiers are already public inside the private review service;
    # only the names are needed, never another mode's model assignments.
    existing.update(path.stem for path in live.glob('*.json') if '--' in path.stem)
    # Reserve unexported bake-off IDs too. Read only the identifiers; never
    # replace or reconcile another mode's state.
    for path in config.get('prior_assignment_files', [root.parent/'_lab/arms.json']):
        prior = read_json(path, {})
        existing.update(row['id'] for row in prior.get('assignments', []))
    family_map, by_skill = families(Path(config['worktree'])/'amp/film/design')
    mapping, audit = select_queue(catalog, family_map, by_skill,
        approved_types(config['worktree'], live), config['seed'], grade_order(config['worktree']),
        supported_figures(config['worktree']), existing)
    audit['prepared_at'] = now()
    audit['trunk_commit'] = subprocess.check_output(
        ['git', 'rev-parse', 'origin/main'], cwd=config['worktree'], text=True).strip()
    write_json(root/'queue.json', audit)
    write_json(root/'types.json', [row['type'] for row in audit['types']])
    write_json(root/'arms.json', mapping)
    return mapping


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--config', required=True)
    args = parser.parse_args()
    mapping = prepare_queue(read_json(args.config))
    print(json.dumps({'types': len({row['type'] for row in mapping['assignments']}),
                      'films': len(mapping['assignments']), 'grades': len(mapping['grades'])}))


if __name__ == '__main__':
    main()
