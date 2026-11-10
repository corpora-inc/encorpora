"""One current-recipe film per invocation, with private, independent evidence."""
from contextlib import contextmanager
import json
from pathlib import Path
import re
import secrets as random_ids
import shutil
import string
import time
from urllib.parse import urljoin

import prod_prompts
from prepare import voice_access
from providers import MODELS, credentials, now, run_agent, write_json
from runtime import (HERE, CHAMP, check_command, check_film, digest, fixed_file,
                     prepare_workspace, voice_film)
from state import coordinator_lock, private_destination, read_json

TEACHERS = ('XescS24CsOySAkKrLAO3', 'J3Ei0Lj6fAobhIqY5ySH')
ID = re.compile(r'[a-z0-9]+(?:-[a-z0-9]+)*--[a-z]{2}')


def one_page(config):
    from prod_runtime import grouped_page, page_rows
    rows = []
    for path in Path(config['one_root']).glob('*/config.json'):
        saved = read_json(path)
        if saved.get('single_film') and (Path(saved['root'])/'arms.json').is_file():
            rows.extend(page_rows(saved))
    rows.sort(key=lambda row: (row['added'], row['id']), reverse=True)
    return grouped_page(config, rows=rows, single=True)


def source_film(config, identifier, type_id, *, restudy=False):
    if not ID.fullmatch(identifier) and not re.fullmatch(r'[a-z0-9]+(?:-[a-z0-9]+)*', identifier):
        raise ValueError('Invalid source film ID')
    production = Path(config['root'])
    roots = [production.parent/'_one'/identifier, production, production.parent/'_lab']
    for root in roots:
        folder = root/'films'/identifier
        script = read_json(folder/'screenplay.json')
        study = folder/'study.md'
        if script is not None:
            assignment = next((r for r in read_json(root/'arms.json', {}).get('assignments', [])
                               if r['id'] == identifier), {})
            if assignment.get('type', identifier.split('--')[0]) != type_id:
                raise ValueError('Source screenplay belongs to a different problem type')
            if not restudy and not study.is_file():
                raise ValueError('Source has no saved study; use --restudy')
            original = read_json(root/'recipe.json', {}).get('models', {})
            study_model = original.get('study') or MODELS.get(assignment.get('study'))
            return script, study.read_text() if study.is_file() else None, study_model
    payload = read_json(Path(config['live_data'])/(identifier+'.json'))
    if payload and restudy:
        script = payload['script']
        if payload.get('problemType', identifier.split('--')[0]) != type_id:
            raise ValueError('Source screenplay belongs to a different problem type')
        # Live payloads bind voices for display; authors use unbound roles.
        script['cast'] = {'teacher': {}, 'learner': {}}
        return script, None, None
    raise ValueError('Source screenplay/study unavailable; a live-only film requires --restudy')


def allocate(config, type_id):
    production = Path(config['root'])
    queue = read_json(production/'queue.json')['types']
    source = next((r for r in queue if r['type'] == type_id), None)
    if source is None:
        raise ValueError('Type is not in the production queue')
    one_root = private_destination(production.parent/'_one', config['worktree'])
    taken = {p.stem for p in Path(config['live_data']).glob('*.json')}
    for root in (production, production.parent/'_lab'):
        taken.update(r['id'] for r in read_json(root/'arms.json', {}).get('assignments', []))
    taken.update(p.name for p in one_root.iterdir())
    available = [type_id+'--'+a+b for a in string.ascii_lowercase for b in string.ascii_lowercase
                 if type_id+'--'+a+b not in taken]
    if not available:
        raise RuntimeError('All two-letter IDs for this type are occupied')
    identifier = random_ids.choice(available)
    prior = sorted((read_json(p) for p in one_root.glob('*/recipe.json')), key=lambda r: r['started_at'])
    teacher = TEACHERS[1] if prior and prior[-1]['teacher'] == TEACHERS[0] else TEACHERS[0]
    row = {**source, 'id': identifier, 'teacher': teacher}
    root = one_root/identifier
    root.mkdir()
    isolated = {**config, 'root': str(root), 'one_root': str(one_root),
                'production': True, 'single_film': True,
                'workspace_root': str(HERE/'.work/one'),
                'review_url': urljoin(config['review_url'], 'one.html'),
                '_config_path': str(root/'config.json')}
    return isolated, row


def costs(root):
    records = [read_json(p) for p in (root/'runs').glob('**/*.json')]
    known = sum(r.get('api_dollars') or r.get('partial_api_dollars') or r.get('reported_dollars') or 0
                for r in records)
    unknown = sum(not any(isinstance(r.get(k), (int, float)) for k in ('api_dollars', 'reported_dollars'))
                  for r in records)
    quota = read_json(root/'voice-quota.json', {})
    ledger = root/'voice-ledger.jsonl'
    entries = [json.loads(line) for line in ledger.read_text().splitlines()] if ledger.exists() else []
    return {'known_model_dollars': round(known, 6), 'model_receipts_without_full_dollars': unknown,
            'voice_input_characters': sum(e.get('input_characters', 0) for e in entries if e.get('kind') == 'reserved'),
            'voice_confirmed_credits': quota.get('confirmed_characters', 0),
            'voice_reserved_credits': quota.get('reserved_characters', 0),
            'voice_dollars': None}


def run_one(production, args):
    if not args.type_id or not re.fullmatch(r'[a-z0-9]+(?:-[a-z0-9]+)*', args.type_id):
        raise ValueError('--phase one requires a valid --type')
    if bool(args.note) != bool(args.from_id) or (args.restudy and not args.from_id):
        raise ValueError('Use --note and --from together; --restudy requires --from')
    previous = source_film(production, args.from_id, args.type_id, restudy=args.restudy) if args.from_id else None
    one_root = private_destination(Path(production['root']).parent/'_one', production['worktree'])
    # Serialize authoring and quota use across the founder's single-film loop.
    with coordinator_lock(one_root/'coordinator.lock'):
        config, row = allocate(production, args.type_id)
        row.update(study=args.study, screenplay=args.writer)
        root = Path(config['root'])
        folder = root/'films'/row['id']
        folder.mkdir(parents=True)
        write_json(root/'config.json', config)
        write_json(root/'arms.json', {'assignments': [row], 'grade_order': [row['grade']]})
        for name in ('prod_prompts.py', 'prompts.py', 'providers.py'):
            target = root/'recipe'/name
            target.parent.mkdir(exist_ok=True)
            shutil.copyfile(HERE/name, target)
        recipe = {'id': row['id'], 'type': row['type'], 'started_at': now(),
                  'prompt_version': prod_prompts.VERSION, 'teacher': row['teacher'], 'learner': CHAMP,
                  'models': {'study': previous[2] if previous and not args.restudy else MODELS[args.study],
                             'screenplay': MODELS[args.writer],
                             'stickler': MODELS['fable'] if args.stickler else None},
                  'from': args.from_id, 'note': args.note, 'restudy': args.restudy,
                  'prompt_sha256': digest(HERE/'prod_prompts.py'), 'stages': {}, 'status': 'running'}
        write_json(root/'recipe.json', recipe)
        start = time.monotonic()

        @contextmanager
        def stage(name):
            began = time.monotonic()
            before = costs(root)
            print(f'{name}: started', flush=True)
            result = {'started_at': now(), 'status': 'running'}
            recipe['stages'][name] = result
            write_json(root/'recipe.json', recipe)
            try:
                yield
                result['status'] = 'succeeded'
            except BaseException:
                result['status'] = 'failed'
                raise
            finally:
                result.update(seconds=round(time.monotonic()-began, 3), finished_at=now())
                recipe['cost'] = costs(root)
                result['cost'] = {k: value-before[k] if isinstance(value, (int, float)) else None
                                  for k, value in recipe['cost'].items()}
                write_json(root/'recipe.json', recipe)
                print(f'{name}: {result["seconds"]:.1f}s ({result["status"]})', flush=True)

        def model(role, provider, prompt, workspace, command=None):
            record = run_agent(provider, role, prompt, workspace, root/'runs'/row['id']/(role+'.json'),
                               secrets=keys, check_command=command, max_dollars=20,
                               timeout=production.get('screenplay_timeout', 1800) if role == 'screenplay'
                               else production.get('study_timeout', 900))
            if record['status'] != 'succeeded':
                raise RuntimeError(role+' failed; inspect its private receipt')
            return record['response']

        try:
            keys = credentials(config['env_file'])
            with stage('facts'):
                from prod import ensure_facts
                source = Path(production['root'])/'facts'/(row['type']+'.json')
                if source.exists():
                    (root/'facts').mkdir()
                    shutil.copyfile(source, root/'facts'/source.name)
                ensure_facts(config, [row])
                facts = read_json(root/'facts'/(row['type']+'.json'))
            with stage('plan'):
                from prod import grade_plan
                source = Path(production['root'])/'plans'/(row['grade']+'.md')
                if source.exists():
                    (root/'plans').mkdir()
                    shutil.copyfile(source, root/'plans'/source.name)
                    recipe['plan_reused'] = True
                else:
                    queue = read_json(Path(production['root'])/'queue.json')
                    write_json(root/'queue.json', queue)
                    grade_rows = [r for r in queue['types']
                                  if r['grade'] == row['grade']]
                    (root/'facts').mkdir(exist_ok=True)
                    for item in grade_rows:
                        source_fact = Path(production['root'])/'facts'/(item['type']+'.json')
                        if source_fact.exists():
                            shutil.copyfile(source_fact, root/'facts'/source_fact.name)
                    ensure_facts(config, grade_rows)
                    grade_plan(config, row['grade'], grade_rows, keys)
                    recipe['models']['plan'] = MODELS['fable']
                plan = (root/'plans'/(row['grade']+'.md')).read_text()
            with stage('study'):
                if previous and not args.restudy:
                    study = previous[1]
                    recipe['study_reused_from'] = args.from_id
                else:
                    family = (Path(config['worktree'])/'amp/film/design'/row['family_path']).read_text()
                    prompt = prod_prompts.study_prompt(facts, family, plan)
                    if args.restudy:
                        prompt += '\nFOUNDER FEEDBACK FOR THIS NEW STUDY:\n'+args.note
                    study = model('study', args.study, prompt, Path(config['workspace_root'])/row['id']/'study-agent')
                coverage = prod_prompts.coverage_from_study(study)
                (folder/'study.md').write_text(study)
                write_json(folder/'coverage.json', coverage)
            with stage('workspace'):
                workspace = prepare_workspace(config, row, facts, study)
                fixed_file(workspace/'grade-plan.md', plan)
                if previous:
                    write_json(workspace/'previous-screenplay.json', previous[0])
                command = check_command(config, row, workspace)
            with stage('screenplay'):
                feedback = ('Read previous-screenplay.json. Rewrite it as this new film ID using the founder feedback:\n'+args.note) if previous else ''
                model('screenplay', args.writer, prod_prompts.screenplay_prompt(row['id'], command, feedback=feedback), workspace, command)
                shutil.copyfile(workspace/'screenplay.json', folder/'screenplay.json')
            with stage('kit-check'):
                check = check_film(config, row, workspace)
                write_json(folder/'check.json', check)
                if not check['passed']:
                    raise RuntimeError('Kit checks failed: '+'; '.join(check['errors']))
            if args.stickler:
                with stage('stickler'):
                    from prod import stickler
                    verdict = stickler(config, row, {}, workspace, keys)
                    write_json(folder/'stickler.json', verdict)
                    # Advisory for the founder: never launch a revision automatically.
            with stage('voice'):
                voice_access(config, keys)
                voiced = voice_film(config, row, workspace, keys)
                write_json(folder/'voice.json', voiced)
                if not voiced.get('voiced') or not voiced.get('check_passed'):
                    raise RuntimeError(voiced.get('error') or 'Voice did not pass its kit check')
            with stage('export'):
                from prod_runtime import export_film
                exported = export_film(config, row, workspace)
                if not exported.get('exported'):
                    raise RuntimeError(exported.get('error') or 'Export failed')
            recipe.update(status='exported', review_url=urljoin(config['review_url'], './?id='+row['id']))
        except BaseException as error:
            recipe.update(status='failed', error=str(error))
            raise
        finally:
            recipe.update(total_seconds=round(time.monotonic()-start, 3), finished_at=now(), cost=costs(root))
            write_json(root/'recipe.json', recipe)
            print(f'Total: {recipe["total_seconds"]:.1f}s; cost: '+json.dumps(recipe['cost']), flush=True)
        print(recipe['review_url'], flush=True)
