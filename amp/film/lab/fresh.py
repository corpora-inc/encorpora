"""One randomly selected lesson, authored end to end by one randomly drawn model."""
from contextlib import contextmanager
import hashlib
import json
from pathlib import Path
import random
import secrets
import shutil
import string
import subprocess
import time
from urllib.parse import urljoin

from one import costs, TEACHERS
from prepare import voice_access
from prod_queue import figure_gap, supported_figures
from providers import MODELS, credentials, now, run_agent, write_json
from runtime import (HERE, CHAMP, check_command, check_film, fixed_file,
                     prepare_runtime, voice_film, workspace_for)
from state import coordinator_lock, private_destination, read_json

EFFORTS = ('low', 'medium', 'high', 'xhigh')
BRIEF = '''Here is the standard. Here is the problem type. Make a great lesson that makes the math beautiful, obvious and intuitive. Make it self-contained so that the foundations and definitions are adequately covered. Explain the concept. Show a worked example for every unique case. Let the student know how to see the correct answer to this type of problem easily.

The bar: a parent watching says "wow, this is a great curriculum", and a student quickly learns the math that leads them to success.

The film is voiced by a teacher and Champ, an eager young learner; use Champ where his questions or mistakes help the student learn.'''

KIT = '''# Screenplay mechanics

Write screenplay.json. schema.ts defines the exact JSON fields, figure components,
action names and target syntax. It is documentation, not a file to execute.
The root has id, title, optional seed, cast, and shots. Each shot has an optional
figure and beats. Each beat has speaker, say, optional pause, and a do action array.
Use cast {"teacher": {}, "learner": {}} and explicitly name a speaker on each beat.
Both roles speak. Production binds the voices; do not supply voice IDs or names.
Write spoken math as words in say; use TeX in tex fields and $math$ in prose fields.

A figure can be {"example": true}, using the app's written-lesson example for the
root seed (default "film"), or a custom geometry object with points and parts.
Custom points use mathematical coordinates. Parts have IDs. Parts with start:true
are initially visible; other parts appear with show/draw actions. Actions target
these IDs. The schema documents grids, counters, blocks, bars, tables, mosaics,
segments, polygons, circles, vectors, plots, axes, labels and their actions.
Available example-figure part names are in facts.json. Components and their
implementation are readable in runtime/amp/film; schema.ts is the JSON contract.

Work-column actions include problem, write, text, term, stack, column, answer,
clear, overview and recap. clear starts a new work column; overview can display
the columns. An action's at field matches a word in that beat's say; nth selects
an occurrence. Omit timing fields to use defaults. Geometry resets for each shot.

The files in references/ are approved screenplays supplied as format references
only, not a teaching template. Use the assigned film ID, never a reference ID.
Run the exact check command in prompt.txt. Read check.json and open the images
in storyboards/. Fix errors and repeat the check until it passes. The check uses
the kit and installed review player, with landscape and portrait storyboards.
Do not edit runtime files or the kit. Do not run voice or video rendering commands.
'''


def approved_inputs(worktree, data):
    """Local lesson library plus current explicit approvals; never expose reviews."""
    data = Path(data)
    scripts = {p.stem: read_json(p) for p in sorted((Path(worktree)/'amp/film/lessons').glob('*.json'))}
    approved = {identifier.split('--')[0] for identifier in scripts}
    index = {r['id']: r for r in read_json(data/'index.json', [])}
    grades = read_json(data/'grades.json', {})
    reviews = read_json(data/'reviews.json', {})
    for identifier in sorted(set(grades) | set(reviews)):
        public = index.get(identifier, {})
        def current(entry):
            return isinstance(entry, dict) and (not entry.get('added') or entry['added'] == public.get('added'))
        review, grade = reviews.get(identifier), grades.get(identifier)
        score = review.get('score') if current(review) else None
        if not isinstance(score, (int, float)) or isinstance(score, bool):
            score = grade.get('score') if current(grade) else None
        if isinstance(score, (int, float)) and not isinstance(score, bool):
            ok = score >= 6
        else:
            ok = current(grade) and grade.get('grade') == 'approved'
        if not ok:
            continue
        payload = read_json(data/(identifier+'.json'), {})
        approved.add(payload.get('problemType') or public.get('problemType') or identifier.split('--')[0])
        if payload.get('script'):
            script = json.loads(json.dumps(payload['script']))
            if 'cast' in script:
                script['cast'] = {role: {} for role in script['cast']}
            scripts[identifier] = script
    return approved, scripts


def draw(catalog, approved, supported, seed, model=None, effort=None):
    """One uniform type draw, then independent uniform model and effort draws."""
    skills = {s['id']: s for s in catalog['skills']}
    candidates = sorted((r for r in catalog['templates']
                         if r['id'] not in approved and not figure_gap(r, supported)), key=lambda r: r['id'])
    if len({r['id'] for r in candidates}) != len(candidates):
        raise ValueError('Duplicate catalog type')
    if not candidates:
        raise ValueError('No drawable problem types without approved films')
    rng = random.Random(seed)
    selected = rng.choice(candidates)
    drawn_model, drawn_effort = rng.choice(tuple(MODELS)), rng.choice(EFFORTS)
    skill = skills[selected['skillId']]
    row = {'type': selected['id'], 'grade': skill['gradeBand'],
           'title': selected['title'], 'standards': selected.get('standards', [])}
    evidence = {'eligible_types': [r['id'] for r in candidates],
                'drawn_model': drawn_model, 'drawn_effort': drawn_effort,
                'model_override': model, 'effort_override': effort}
    return row, model or drawn_model, effort or drawn_effort, evidence


def allocate(production, fresh_root, row):
    live = Path(production['live_data'])
    taken = {p.stem for p in live.glob('*.json')}
    for name in ('_prod', '_lab'):
        taken.update(r['id'] for r in read_json(fresh_root.parent/name/'arms.json', {}).get('assignments', []))
    for name in ('_one', '_fresh'):
        taken.update(p.name for p in (fresh_root.parent/name).glob('*') if p.is_dir())
    available = [row['type']+'--'+a+b for a in string.ascii_lowercase for b in string.ascii_lowercase
                 if row['type']+'--'+a+b not in taken]
    if not available:
        raise RuntimeError('All film IDs for this type are occupied')
    row['id'] = secrets.choice(available)
    prior = sorted((read_json(p) for p in fresh_root.glob('*/recipe.json')), key=lambda r: r['started_at'])
    row['teacher'] = TEACHERS[1] if prior and prior[-1]['teacher'] == TEACHERS[0] else TEACHERS[0]
    root = fresh_root/row['id']
    root.mkdir()
    return {**production, 'root': str(root), 'fresh_root': str(fresh_root),
            'fresh_film': True, 'production': True, 'seed': None,
            'workspace_root': str(root/'workspace'), '_config_path': str(root/'config.json')}


def prepare_fresh_workspace(config, row, facts, references):
    workspace = workspace_for(config, row['id'])
    workspace.mkdir(parents=True)
    # Curate the input shape: no family plans, study, review, or teaching policy.
    clean = {k: facts[k] for k in ('type', 'template', 'skill', 'standards', 'problems',
                                  'written_lesson', 'contextual_written_lessons')}
    clean['kit_figure'] = {k: facts['kit_figure'][k] for k in ('kind', 'components', 'named_parts')}
    fixed_file(workspace/'facts.json', json.dumps(clean, indent=2, ensure_ascii=False)+'\n')
    fixed_file(workspace/'KIT.md', KIT)
    fixed_file(workspace/'schema.ts', (Path(config['worktree'])/'amp/film/schema.ts').read_text())
    if len(references) < 2:
        raise ValueError('At least two approved format references are required')
    for i, script in enumerate(references[:3], 1):
        write_json(workspace/'references'/f'format-{i}.json', script)
    return prepare_runtime(config, row, workspace)


def prompt_for(identifier, command):
    return BRIEF+f'''

Read facts.json for the verbatim standards, problem type, ten generated problems
with answers, and the app's written lesson. Read KIT.md, schema.ts and the format
references. Write screenplay.json with id "{identifier}".
Run this exact command, inspect check.json and open the storyboard images,
then fix errors until the check passes:
{command}

You have 45 minutes. Work only in this workspace. Do not spawn agents or read
outside this workspace, except to execute the supplied check command. Do not read
project teaching policies or search for other lessons. Do not edit runtime, run
Git, voice audio, or render MP4. Never run rm, find -delete, git stash, or shell
heredocs. Use file tools for edits. Do not put model attribution in the film.
'''


def fresh_page(config):
    from prod_runtime import grouped_page, page_rows
    rows = []
    for path in Path(config['fresh_root']).glob('*/config.json'):
        saved = read_json(path)
        if saved.get('fresh_film') and (Path(saved['root'])/'arms.json').exists():
            rows.extend(page_rows(saved))
    rows.sort(key=lambda r: (r['added'], r['id']), reverse=True)
    return grouped_page(config, rows=rows, single=True, fresh=True)


def run_fresh(production, args):
    for option in ('type_id', 'note', 'from_id', 'restudy', 'stickler'):
        if getattr(args, option, None):
            raise ValueError('Fresh mode only accepts --model, --effort and --seed overrides')
    fresh_root = private_destination(Path(production['root']).parent/'_fresh', production['worktree'])
    with coordinator_lock(fresh_root/'coordinator.lock'):
        started = time.monotonic()
        selection_started = now()
        seed = args.seed if args.seed is not None else secrets.randbits(63)
        catalog_path = fresh_root/'catalog.json'
        subprocess.run([production['heavy'], production.get('node', 'node'), '--import', 'tsx',
                        str(HERE/'facts.ts'), 'inventory', '--standards', production['standards'],
                        '--out', str(catalog_path)], cwd=Path(production['worktree'])/'amp', check=True)
        catalog = read_json(catalog_path)
        approved, reference_map = approved_inputs(production['worktree'], production['live_data'])
        row, model, effort, selection = draw(catalog, approved, supported_figures(production['worktree']),
                                             seed, args.model, args.effort)
        config = allocate(production, fresh_root, row)
        config['seed'] = seed
        root = Path(config['root'])
        folder = root/'films'/row['id']
        folder.mkdir(parents=True)
        write_json(root/'config.json', config)
        write_json(root/'arms.json', {'assignments': [row]})
        write_json(root/'selection.json', {**selection, 'seed': seed,
                   'catalog_sha256': hashlib.sha256(catalog_path.read_bytes()).hexdigest()})
        recipe = {'id': row['id'], 'type': row['type'], 'grade': row['grade'], 'seed': seed,
                  'standards': row['standards'], 'model': MODELS[model], 'provider': model,
                  'effort': effort, 'teacher': row['teacher'], 'learner': CHAMP,
                  'started_at': selection_started, 'status': 'running', 'stages': {
                      'selection': {'seconds': round(time.monotonic()-started, 3), 'status': 'succeeded'}}}
        write_json(root/'recipe.json', recipe)
        print(f'Fresh film: {row["id"]}; grade {row["grade"]}; seed {seed}', flush=True)

        @contextmanager
        def stage(name):
            begin = time.monotonic()
            entry = {'started_at': now(), 'status': 'running'}
            recipe['stages'][name] = entry
            write_json(root/'recipe.json', recipe)
            print(name+': started', flush=True)
            try:
                yield
                entry['status'] = 'succeeded'
            except BaseException:
                entry['status'] = 'failed'
                raise
            finally:
                entry.update(seconds=round(time.monotonic()-begin, 3), finished_at=now())
                write_json(root/'recipe.json', recipe)
                print(f'{name}: {entry["seconds"]:.1f}s ({entry["status"]})', flush=True)

        try:
            keys = credentials(config['env_file'])
            with stage('facts'):
                from prod import ensure_facts
                ensure_facts(config, [row])
                facts = read_json(root/'facts'/(row['type']+'.json'))
                if not facts['standards']:
                    raise RuntimeError('Verbatim standards are missing for the selected type')
                recipe['standards'] = facts['standards']
                # Exam-framework tags (SAT, MCAS, STAAR) have no Common Core text; keep them on record.
                recipe['unresolved_alignments'] = facts.get('unresolved_alignments') or []
            with stage('workspace'):
                references = random.Random(str(seed)+':references').sample(
                    sorted(reference_map), min(3, len(reference_map)))
                recipe['format_references'] = references
                workspace = prepare_fresh_workspace(config, row, facts, [reference_map[k] for k in references])
                command = check_command(config, row, workspace)
                recipe['prompt'] = prompt_for(row['id'], command)
            with stage('screenplay'):
                record = run_agent(model, 'screenplay', recipe['prompt'], workspace,
                                   root/'runs'/row['id']/'screenplay.json', secrets=keys,
                                   check_command=command, timeout=2700, effort=effort)
                recipe['tokens'] = record.get('tokens')
                recipe['usage_complete'] = record.get('usage_complete', False)
                recipe['dollars'] = {k: record.get(k) for k in ('api_dollars', 'reported_dollars', 'partial_api_dollars')}
                if record['status'] != 'succeeded':
                    raise RuntimeError('Authoring failed; inspect the private model receipt')
                shutil.copyfile(workspace/'screenplay.json', folder/'screenplay.json')
            with stage('kit-check'):
                check = check_film(config, row, workspace)
                write_json(folder/'check.json', check)
                if not check['passed']:
                    raise RuntimeError('Kit check failed: '+'; '.join(check['errors']))
            with stage('voice'):
                voice_access(config, keys)
                voiced = voice_film(config, row, workspace, keys)
                write_json(folder/'voice.json', voiced)
                if not voiced.get('voiced') or not voiced.get('check_passed'):
                    raise RuntimeError(voiced.get('error') or 'Voicing did not pass its kit check')
            with stage('export'):
                from prod_runtime import export_film
                exported = export_film(config, row, workspace)
                if not exported.get('exported'):
                    raise RuntimeError(exported.get('error') or 'Export failed')
            recipe.update(status='exported', review_url=urljoin(config['review_url'],
                          'review.html?id='+row['id']+'&list=fresh'))
        except BaseException as error:
            recipe.update(status='failed', error=str(error))
            raise
        finally:
            recipe.update(total_seconds=round(time.monotonic()-started, 3), finished_at=now(), cost=costs(root))
            write_json(root/'recipe.json', recipe)
        print(recipe['review_url'], flush=True)
