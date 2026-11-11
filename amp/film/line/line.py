#!/usr/bin/env python3
"""One skill, one explicitly assigned author, independently repeatable steps."""
import argparse
from contextlib import contextmanager
import json
import math
import os
from pathlib import Path
import re
import shutil
import signal
import sys
import subprocess
import time
from urllib.parse import urljoin

from accounting import costs, TEACHERS, voice_access
from mechanics import KIT
import providers
from providers import now, write_json
from runtime import (HERE, CHAMP, check_command, check_film, digest, fixed_file,
                     prepare_runtime, voice_film, workspace_for)
from state import command_lock, private_destination, read_json

ID = r'[a-z0-9]+(?:-[a-z0-9]+)*'


def film_root(config, identifier):
    if not re.fullmatch(ID + '--' + ID, identifier):
        raise ValueError('Film ID must be <primary-template-id>--<suffix>')
    root = Path(config['root']).resolve()
    destination = (root/identifier).resolve()
    if not destination.is_relative_to(root):
        raise ValueError('Film directory escapes the line root')
    return destination


def load_config(path):
    config = read_json(path)
    if not isinstance(config, dict):
        raise ValueError('A private JSON configuration is required')
    for key in ('root', 'worktree', 'env_file', 'standards', 'heavy', 'live_data', 'voice_cache'):
        config[key] = str(Path(config[key]).expanduser().resolve())
    for key in ('root', 'live_data', 'voice_cache'):
        private_destination(config[key], config['worktree'])
    for key in ('player_url', 'review_url'):
        if not config.get(key):
            raise ValueError('Missing configuration field: '+key)
    config.setdefault('claude_auth', 'api')
    if config['claude_auth'] not in ('api', 'subscription'):
        raise ValueError('claude_auth must be api or subscription')
    if config.get('queue_page'):
        config['queue_page'] = str(private_destination(Path(config['queue_page']).expanduser(), config['worktree']))
    return config


def facts(config, skill, out, *, template=None):
    """Generate exact standards and deterministic examples for every type in a skill."""
    if not re.fullmatch(r'[a-z0-9]+(?:[.-][a-z0-9]+)*', template or skill):
        raise ValueError('Invalid skill ID')
    out = private_destination(out, config['worktree'])
    out.mkdir(parents=True, exist_ok=True)
    subprocess.run([config['heavy'], config.get('node', 'node'), '--import', 'tsx',
                    str(HERE/'facts.ts'), '--template' if template else '--skill', template or skill, '--standards', config['standards'],
                    '--out', str(out)], cwd=Path(config['worktree'])/'amp', check=True,
                   env=providers.clean_environment())
    return read_json(out/'facts.json')


def reference(config, identifier):
    if not re.fullmatch(ID + '(?:--' + ID + ')?', identifier):
        raise ValueError('Invalid reference film ID')
    for path in (Path(config['worktree'])/'amp/film/lessons'/(identifier+'.json'),
                 Path(config['live_data'])/(identifier+'.json')):
        value = read_json(path)
        if value is not None:
            script = value.get('script', value)
            # References demonstrate format; production binds all voice IDs.
            return {**script, 'cast': {role: {} for role in script.get('cast', {})}}
    raise ValueError('Reference screenplay unavailable: '+identifier)


def prepare_workspace(config, pack, references):
    row = config['film']
    workspace = workspace_for(config, row['id'])
    workspace.mkdir(parents=True, exist_ok=True)
    fixed_file(workspace/'facts.json', json.dumps(pack, indent=2, ensure_ascii=False)+'\n')
    fixed_file(workspace/'KIT.md', KIT)
    fixed_file(workspace/'schema.ts', (Path(config['worktree'])/'amp/film/schema.ts').read_text())
    for identifier, script in references.items():
        fixed_file(workspace/'references'/(identifier+'.json'), json.dumps(script, indent=2)+'\n')
    return prepare_runtime(config, row, workspace)


def prompt_for(brief, concept, row, pack, command):
    types = ', '.join(p['type'] for p in pack['problem_types'])
    concept_text = 'Concept:\n'+concept if concept else ''
    return brief + f'''

Assignment
Film ID: {row['id']}
Skill: {pack['skill']['id']} — {pack['skill']['title']}
Problem types: {types}
{concept_text}

Read facts.json for the exact standards, problems with answers, written lessons,
and figure parts for every problem type in this skill. Read KIT.md, schema.ts,
and the supplied references. Write screenplay.json with the assigned film ID.
The example figure resolves from {row['type']}; it does not switch problem types.
Run this exact command, inspect check.json and both orientations in storyboards/,
and fix errors until the check passes:
{command}

Work only in this workspace. Do not spawn agents, edit runtime, read credentials,
grades or predictions, run Git, voice audio, or render MP4. Do not read outside
the workspace except to execute the supplied check command. Use file tools for
edits. Never run rm, find -delete, git stash, or shell heredocs. Do not put model
attribution in the film.
'''


@contextmanager
def stage(config, recipe, name):
    root = Path(config['root'])
    begin = time.monotonic()
    entry = {'started_at': now(), 'status': 'running'}
    history = recipe['stages'].setdefault(name, {'attempts': [], 'seconds': 0})
    history['attempts'].append(entry)
    recipe.update(status=name, error=None)
    write_json(root/'recipe.json', recipe)
    try:
        yield
        entry['status'] = 'succeeded'
    except BaseException as error:
        entry['status'] = 'failed'
        recipe.update(status='failed', error=str(error))
        raise
    finally:
        entry.update(seconds=round(time.monotonic()-begin, 3), finished_at=now())
        history.update(status=entry['status'], seconds=round(sum(a.get('seconds', 0) for a in history['attempts']), 3))
        recipe.update(total_seconds=round(sum(s['seconds'] for s in recipe['stages'].values()), 3),
                      finished_at=now(), cost=costs(root))
        write_json(root/'recipe.json', recipe)
        print(f'{name}: {entry["seconds"]:.1f}s ({entry["status"]})', flush=True)



def remember_attempt(recipe, record, receipt, prompt):
    attempts = recipe.setdefault('author_attempts', [])
    entry = {'receipt': str(receipt), 'prompt': prompt, 'tokens': record.get('tokens'),
             'dollars': {k: record.get(k) for k in ('api_dollars', 'reported_dollars', 'partial_api_dollars')},
             'seconds': record.get('wall_seconds'), 'status': record['status'],
             'usage_complete': record.get('usage_complete', False)}
    prior = next((i for i, a in enumerate(attempts) if a['receipt'] == str(receipt)), None)
    if prior is None:
        attempts.append(entry)
    else:
        attempts[prior] = entry
    def total(values):
        return sum(values) if all(isinstance(v, (int, float)) for v in values) else None
    recipe['tokens'] = {k: total([(a.get('tokens') or {}).get(k) for a in attempts])
                        for k in ('input_uncached', 'input_cached', 'cache_write', 'output', 'reasoning')}
    recipe['dollars'] = {k: total([a['dollars'][k] for a in attempts]) for k in entry['dollars']}
    recipe['usage_complete'] = all(a['usage_complete'] for a in attempts)
    recipe['author_seconds'] = total([a['seconds'] for a in attempts])


def auto_references(config, skill, root):
    from pages import founder_score
    pack = read_json(root/'facts/facts.json') or facts(config, skill, root/'facts')
    band = pack['skill'].get('gradeBand')
    data = Path(config['live_data'])
    reviews, grades = read_json(data/'reviews.json', {}), read_json(data/'grades.json', {})
    candidates = []
    for row in read_json(data/'queue.json', []):
        score, _ = founder_score(row['id'], row, reviews, grades)
        if score is None or score < 8:
            continue
        payload = read_json(data/(row['id']+'.json'))
        if not payload:
            continue
        recipe = read_json(Path(config['root'])/row['id']/'recipe.json', {})
        grade = recipe.get('skill', {}).get('gradeBand', payload.get('grade'))
        candidates.append((band is not None and grade == band, row.get('added', ''), row['id']))
    return [row[2] for row in sorted(candidates, reverse=True)[:2]]


def existing_film(config, identifier):
    root = film_root(config, identifier)
    local, recipe = read_json(root/'config.json'), read_json(root/'recipe.json')
    if not local or not recipe:
        raise ValueError('Run write or adopt for this film first')
    return root, local, recipe, workspace_for(local, identifier)


def recheck(local, recipe, workspace):
    root, row = Path(local['root']), local['film']
    previous_status = recipe['status']
    with stage(local, recipe, 'kit-check'):
        checked = check_film(local, row, workspace)
        write_json(root/'films'/row['id']/'check.json', checked)
        if not checked['passed']:
            raise RuntimeError('Kit check failed: '+'; '.join(checked['errors']))
    changed = recipe.get('screenplay_sha256') != digest(workspace/'screenplay.json')
    recipe['status'] = previous_status if not changed and previous_status in ('voiced', 'exported', 'released') else 'checked'
    recipe['screenplay_sha256'] = digest(workspace/'screenplay.json')
    shutil.copyfile(workspace/'screenplay.json', root/'films'/row['id']/'screenplay.json')
    write_json(root/'recipe.json', recipe)
    return checked


def revise_film(config, identifier, notes_path):
    root, local, recipe, workspace = existing_film(config, identifier)
    if recipe.get('adopted'):
        raise ValueError('This author works outside the line; edit the screenplay and run look')
    notes = Path(notes_path).read_text()
    if not notes.strip():
        raise ValueError('Director notes are empty')
    # Upgrade an existing first-cut receipt without losing its evidence.
    if not recipe.get('author_attempts'):
        receipt = root/'runs'/identifier/'screenplay.json'
        remember_attempt(recipe, read_json(receipt), receipt, recipe['prompt'])
    attempt = len(recipe['author_attempts']) + 1
    archive = root/'attempts'/str(attempt-1)
    archive.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(workspace/'screenplay.json', archive/'screenplay.json')
    prompt = recipe['prompt'] + "\n\nDirector's notes on your first cut\n" + notes
    receipt = root/'runs'/identifier/f'revision-{attempt}.json'
    remember_attempt(recipe, {'status': 'running'}, receipt, prompt)
    with stage(local, recipe, 'revise'):
        try:
            record = providers.run_agent(recipe['provider'], 'screenplay', prompt, workspace, receipt,
                secrets=providers.credentials(local['env_file']), check_command=check_command(local, local['film'], workspace),
                timeout=2700, effort=recipe['effort'], claude_auth=config.get('claude_auth', local.get('claude_auth', 'api')))
        except BaseException:
            record = read_json(receipt, {'status': 'failed'})
            remember_attempt(recipe, {**record, 'status': 'failed'}, receipt, prompt)
            raise
        remember_attempt(recipe, record, receipt, prompt)
        if record['status'] != 'succeeded':
            raise RuntimeError('Author did not succeed; the attempt and prior screenplay are preserved')
    recheck(local, recipe, workspace)
    return recipe


def adopt_film(config, args):
    from runtime import validate_cast
    root = film_root(config, args.film)
    if (root/'recipe.json').exists():
        raise ValueError('Film already registered; edit its workspace screenplay and run look')
    script = validate_cast(args.screenplay, args.film)
    if not args.author.strip():
        raise ValueError('An author name is required')
    for value in (args.minutes, args.tokens):
        if value is not None and (not math.isfinite(value) or value < 0):
            raise ValueError('Usage must be finite and nonnegative')
    primary = args.film.split('--')[0]
    pack = facts(config, None, root/'facts', template=primary)
    recipe = {'id': args.film, 'type': primary, 'skill': pack['skill'], 'standards': pack['standards'],
        'standards_sha256': pack['standards_sha256'], 'problem_types': [p['type'] for p in pack['problem_types']],
        'model': args.author, 'provider': None, 'effort': args.effort, 'adopted': True,
        'teacher': TEACHERS[0], 'learner': CHAMP, 'format_references': [], 'started_at': now(),
        'stages': {}, 'status': 'adopted', 'total_seconds': 0, 'tokens': None, 'usage_complete': False,
        'external_usage': {'minutes': args.minutes, 'tokens': args.tokens},
        'dollars': {k: None for k in ('api_dollars', 'reported_dollars', 'partial_api_dollars')}}
    row = {'id': args.film, 'type': primary, 'teacher': recipe['teacher']}
    local = {**config, 'line_root': config['root'], 'root': str(root), 'film': row, 'production': True,
             'workspace_root': str(root/'workspace'), '_config_path': str(root/'config.json')}
    write_json(root/'config.json', local)
    write_json(root/'recipe.json', recipe)
    write_json(root/'runs'/args.film/'adopted.json', {'status': 'succeeded', 'transport': 'external',
        'api_dollars': None, 'reported_dollars': None, 'external_usage': recipe['external_usage']})
    workspace = prepare_workspace(local, pack, {})
    write_json(workspace/'screenplay.json', script)
    recheck(local, recipe, workspace)
    return recipe

def write_film(config, args):
    root = film_root(config, args.film)
    brief = Path(args.brief).read_text()
    concept = Path(args.concept).read_text() if args.concept else None
    prior = read_json(root/'inputs.json')
    names = args.reference
    if names == ['auto']:
        names = list(prior['references']) if prior else auto_references(config, args.skill, root)
    elif 'auto' in names:
        raise ValueError('Use auto by itself or name explicit references')
    refs = prior['references'] if args.reference == ['auto'] and prior else {name: reference(config, name) for name in names}
    inputs = {'brief': brief, 'concept': concept, 'references': refs,
              'skill': args.skill, 'provider': args.model, 'effort': args.effort}
    prior = read_json(root/'inputs.json')
    if prior is not None and prior != inputs:
        raise ValueError('Film inputs changed; use a new film ID')
    root.mkdir(parents=True, exist_ok=True)
    fixed_file(root/'inputs.json', json.dumps(inputs, indent=2, ensure_ascii=False)+'\n')
    primary = args.film.split('--')[0]
    recipe = read_json(root/'recipe.json')
    if recipe is None:
        previous = sorted((read_json(p) for p in Path(config['root']).glob('*/recipe.json')),
                          key=lambda r: r['started_at'])
        teacher = TEACHERS[1] if previous and previous[-1]['teacher'] == TEACHERS[0] else TEACHERS[0]
        recipe = {'id': args.film, 'type': primary, 'skill': {'id': args.skill, 'title': args.skill},
                  'standards': [], 'model': providers.MODELS[args.model], 'provider': args.model,
                  'effort': args.effort, 'teacher': teacher, 'learner': CHAMP, 'format_references': list(refs),
                  'started_at': now(), 'stages': {}, 'status': 'prepared', 'total_seconds': 0,
                  'tokens': None, 'dollars': {k: None for k in ('api_dollars', 'reported_dollars', 'partial_api_dollars')}}
    previous_status = recipe['status']
    previous_script = recipe.get('screenplay_sha256')
    row = {'id': args.film, 'type': primary, 'teacher': recipe['teacher']}
    local = {**config, 'line_root': config['root'], 'root': str(root), 'film': row,
             'production': True, 'workspace_root': str(root/'workspace'), '_config_path': str(root/'config.json')}
    saved_config = read_json(root/'config.json')
    operational = {'claude_auth', 'queue_page'}
    if saved_config is not None and {k: v for k, v in saved_config.items() if k not in operational} != {k: v for k, v in local.items() if k not in operational}:
        raise ValueError('Film runtime configuration changed; use its recorded checkout and paths')
    write_json(root/'config.json', local)
    with stage(local, recipe, 'facts'):
        pack = read_json(root/'facts/facts.json') or facts(config, args.skill, root/'facts')
        if primary not in {p['type'] for p in pack['problem_types']}:
            raise ValueError('Film ID primary template does not belong to the assigned skill')
        if not pack['standards']:
            raise ValueError('Exact standards text is missing for this skill')
        recipe.update(skill=pack['skill'], standards=pack['standards'], standards_sha256=pack['standards_sha256'],
                      unresolved_alignments=pack.get('unresolved_alignments', []),
                      problem_types=[p['type'] for p in pack['problem_types']])
    with stage(local, recipe, 'workspace'):
        workspace = prepare_workspace(local, pack, refs)
        command = check_command(local, row, workspace)
        recipe['prompt'] = prompt_for(brief, concept, row, pack, command)
        fixed_file(workspace/'original-prompt.txt', recipe['prompt'])
    with stage(local, recipe, 'screenplay'):
        receipt = Path(recipe['author_attempts'][-1]['receipt']) if recipe.get('author_attempts') else root/'runs'/row['id']/'screenplay.json'
        record = read_json(receipt)
        if record is None:
            record = providers.run_agent(args.model, 'screenplay', recipe['prompt'], workspace, receipt,
                secrets=providers.credentials(config['env_file']), check_command=command,
                timeout=2700, effort=args.effort, claude_auth=config.get('claude_auth', 'api'))
        remember_attempt(recipe, record, receipt, recipe.get('author_attempts', [{}])[-1].get('prompt', recipe['prompt']))
        if record['status'] != 'succeeded':
            raise RuntimeError('Author did not succeed; preserve the receipt and use a revise for another author attempt')
        shutil.copyfile(workspace/'screenplay.json', root/'films'/row['id']/'screenplay.json')
    with stage(local, recipe, 'kit-check'):
        checked = check_film(local, row, workspace)
        write_json(root/'films'/row['id']/'check.json', checked)
        if not checked['passed']:
            raise RuntimeError('Kit check failed: '+'; '.join(checked['errors']))
    unchanged = previous_script == digest(workspace/'screenplay.json')
    recipe.update(status=previous_status if unchanged and previous_status in ('voiced', 'exported', 'released') else 'checked',
                  screenplay_sha256=digest(workspace/'screenplay.json'))
    write_json(root/'recipe.json', recipe)
    return recipe


def finish_film(config, identifier, action):
    root = film_root(config, identifier)
    local, recipe = read_json(root/'config.json'), read_json(root/'recipe.json')
    if not local or not recipe:
        raise ValueError('Run write or adopt for this film first')
    row = local['film']
    workspace = workspace_for(local, identifier)
    check = read_json(workspace/'check.json', {})
    if not check.get('passed') or check.get('screenplay_sha256') != digest(workspace/'screenplay.json'):
        raise ValueError('Run look to check the current screenplay')
    with stage(local, recipe, action):
        if action == 'voice':
            keys = providers.credentials(local['env_file'])
            voice_access(local, keys)
            result = voice_film(local, row, workspace, keys)
            write_json(root/'films'/identifier/'voice.json', result)
            if not result.get('voiced') or not result.get('check_passed'):
                raise RuntimeError(result.get('error') or 'Voicing did not pass its kit check')
        else:
            from prod_runtime import export_film
            result = export_film(local, row, workspace)
            if not result.get('exported'):
                raise RuntimeError(result.get('error') or 'Export failed')
            recipe['review_url'] = urljoin(local['review_url'], 'review.html?id='+identifier+'&list=line')
    recipe['status'] = 'voiced' if action == 'voice' else 'exported'
    write_json(root/'recipe.json', recipe)
    return recipe


def predict(config, identifier, score, reason):
    if isinstance(score, bool) or not math.isfinite(score) or not 0 <= score <= 10:
        raise ValueError('Prediction score must be between 0 and 10')
    if not reason.strip():
        raise ValueError('A prediction needs a reason')
    root = film_root(config, identifier)
    if not (root/'recipe.json').is_file():
        raise ValueError('Unknown film; run write first')
    path = Path(config['root'])/'predictions.json'
    predictions = read_json(path, {})
    predictions[identifier] = {'score': score, 'reason': reason, 'at': now()}
    write_json(path, predictions)
    return predictions[identifier]



def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--config', default=os.environ.get('FILM_LINE_CONFIG'))
    commands = parser.add_subparsers(dest='command', required=True)
    p = commands.add_parser('facts')
    p.add_argument('--skill', required=True); p.add_argument('--film'); p.add_argument('--out')
    p = commands.add_parser('write')
    for name in ('film', 'skill', 'brief'):
        p.add_argument('--'+name, required=True)
    p.add_argument('--model', choices=providers.MODELS, required=True)
    p.add_argument('--effort', choices=('low', 'medium', 'high', 'xhigh'), required=True)
    p.add_argument('--concept'); p.add_argument('--reference', action='append', nargs='+', default=[])
    for name in ('voice', 'export', 'predict', 'revise', 'look', 'play', 'release', 'unrelease', 'adopt'):
        p = commands.add_parser(name); p.add_argument('--film', required=True)
        if name == 'predict':
            p.add_argument('--score', type=float, required=True); p.add_argument('--reason', required=True)
        if name == 'revise':
            p.add_argument('--notes', required=True)
        if name == 'release':
            p.add_argument('--level', required=True)
        if name == 'adopt':
            for key in ('screenplay', 'author', 'effort'):
                p.add_argument('--'+key, required=True)
            p.add_argument('--minutes', type=float); p.add_argument('--tokens', type=int)
    commands.add_parser('board')
    args = parser.parse_args(argv)
    if not args.config:
        parser.error('Use --config or set FILM_LINE_CONFIG to the private configuration')
    config = load_config(args.config)
    identifier = getattr(args, 'film', None)
    if identifier:
        film_root(config, identifier)
    if args.command == 'facts':
        if not identifier and not args.out:
            parser.error('facts requires --film or --out')
        if identifier and args.out:
            parser.error('Use --film or --out, not both')
        args.out = str(film_root(config, identifier)/'facts') if identifier else args.out
    with command_lock(config, args.command, identifier, getattr(args, 'out', None)):
        if args.command == 'facts':
            facts(config, args.skill, args.out)
        elif args.command == 'write':
            args.reference = [item for group in args.reference for item in group]
            write_film(config, args)
        elif args.command == 'revise':
            revise_film(config, args.film, args.notes)
        elif args.command == 'adopt':
            adopt_film(config, args)
        elif args.command in ('look', 'play'):
            from review_tools import look_film, play_film
            print((look_film if args.command == 'look' else play_film)(config, args.film))
        elif args.command in ('voice', 'export'):
            recipe = finish_film(config, args.film, args.command)
            print(recipe.get('review_url', recipe['status']))
        elif args.command == 'predict':
            predict(config, args.film, args.score, args.reason)
        elif args.command in ('release', 'unrelease'):
            from release import release_film, unrelease_film
            print(release_film(config, args.film, args.level) if args.command == 'release'
                  else unrelease_film(config, args.film))
        else:
            from pages import board
            print(board(config))


if __name__ == '__main__':
    signal.signal(signal.SIGTERM, lambda *_: sys.exit(130))
    main()
