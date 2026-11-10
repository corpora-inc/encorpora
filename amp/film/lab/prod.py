"""Curriculum-ordered production alongside the frozen model experiment."""
from __future__ import annotations
import argparse
from concurrent.futures import ThreadPoolExecutor, wait, FIRST_COMPLETED
import hashlib
import json
from pathlib import Path
import re
import shutil
import subprocess
import threading
import time

from lab import append_coverage
from prompts import coverage_from_study
from prod_prompts import review_prompt
from providers import (MODELS, credentials, now, run_agent, write_json,
                       submit_review_batch, collect_review_batch)
from prod_report import build_status, spending
from reviews import review_one
from runtime import (prepare_workspace, check_command, check_film, fixed_file,
                     completed_voice, voice_film, digest)
from state import coordinator_lock, private_destination, read_json, freeze_protocol, reconcile_interrupted

HERE = Path(__file__).resolve().parent
_assign_lock = threading.Lock()


def emit(event, **fields):
    print(json.dumps({'event': event, 'at': now(), **fields}), flush=True)


def stop_reason(config):
    root = Path(config['root'])
    if (root/'PAUSE').exists():
        return 'PAUSE file exists; no new films will start'
    cost = spending(root)
    if cost['known_dollars'] >= 250:
        return 'Anthropic API spend reached the $250 new-film threshold'
    if cost['admission_dollars'] >= 250:
        return 'Anthropic spending plus unconfirmed budget holds reached the $250 new-film threshold'
    limits = read_json(root/'provider-limits.json', {})
    if 'fable' in limits or 'sonnet-study' in limits:
        return 'A required planning/study/review provider reached a usage limit'
    return None


def record_limit(config, provider, record, receipt):
    text = ' '.join(str(record.get(k, '')) for k in ('response', 'error', 'launch_error'))
    for suffix in ('.stdout', '.stderr'):
        output = Path(receipt).with_suffix(suffix)
        if output.exists():
            text += output.read_text()[-5000:]
    matched = re.search(r'usage limit|quota exceeded|insufficient (?:credits|funds)|out of credits|hit your limit|credit balance is too low|rate_limit_error|rate limit exceeded', text, re.I)
    if not matched:
        return False
    with _assign_lock:
        path = Path(config['root'])/'provider-limits.json'
        limits = read_json(path, {})
        limits[provider] = {'at': now(), 'reason': matched.group(0), 'receipt': str(receipt)}
        write_json(path, limits)
    emit('provider-limit', provider=provider, reason=matched.group(0))
    return True


def choose_writer(config, row, state):
    """Reassign an unavailable cheap writer, balancing the remaining assignments."""
    if state.get('writer'):
        return state['writer']
    with _assign_lock:
        root = Path(config['root'])
        limits = read_json(root/'provider-limits.json', {})
        writer = row['screenplay']
        if writer in limits and writer in ('sonnet', 'grok', 'sol'):
            available = [p for p in ('sonnet','grok','sol') if p not in limits]
            if not available:
                raise RuntimeError('All production screenplay providers reached usage limits')
            mapping = read_json(root/'arms.json')
            counts = {p: sum(r['screenplay']==p for r in mapping['assignments']) for p in available}
            writer = min(available, key=lambda p: (counts[p], p))
            current = next(r for r in mapping['assignments'] if r['id']==row['id'])
            current.setdefault('initial_screenplay', current['screenplay'])
            current['screenplay'] = writer
            current.setdefault('reassignments', []).append({'at': now(), 'reason': 'provider usage limit', 'writer': writer})
            write_json(root/'arms.json', mapping)
            row.update(current)
        state['writer'] = writer
        return writer


def model_attempt(config, row, role, provider, prompt, workspace, name, secrets, command=None):
    receipt = Path(config['root'])/'runs'/row['id']/(name+'.json')
    record = read_json(receipt)
    if record is None:
        record = run_agent(provider, role, prompt, workspace, receipt, secrets=secrets,
                           check_command=command,
                           max_dollars=20,
                           timeout=config.get('screenplay_timeout', 1800) if role=='screenplay' else config.get('study_timeout', 900))
    if record.get('status') in ('running', 'queued'):
        raise RuntimeError('Unfinished model receipt requires reconciliation')
    limited = record_limit(config, provider if role!='study' else provider+'-study', record, receipt)
    return record, receipt, limited


def grade_plan(config, grade, rows, secrets):
    from prod_prompts import grade_plan_prompt
    root = Path(config['root'])
    target = root/'plans'/(grade+'.md')
    if target.exists():
        return target.read_text()
    facts = [read_json(root/'facts'/(row['type']+'.json')) for row in rows]
    unique = {f['type']: {'type':f['type'], 'title':f['template']['title'],
                        'skill':{'id':f['skill']['id'], 'title':f['skill']['title']},
                        'kit_figure':{k:v for k,v in f['kit_figure'].items() if k in ('kind','components')},
                        'prerequisites':[p['id'] for p in f['prerequisites']]} for f in facts}
    gaps = [g for g in read_json(root/'queue.json',{}).get('exclusions',[]) if g.get('grade')==grade and g.get('kind')=='kit-gap']
    prompt = grade_plan_prompt(grade, list(unique.values()), (Path(config['worktree'])/'amp/film/AUTHORING.md').read_text()+'\nRECORDED KIT GAPS:\n'+json.dumps(gaps))
    record, receipt, _ = model_attempt(config, {'id':'grade-'+grade}, 'plan', 'fable', prompt,
                                      Path(config['workspace_root'])/'plans'/grade, 'plan-fable', secrets)
    if record['status'] != 'succeeded' or not record.get('response','').strip():
        raise RuntimeError('Grade plan failed; inspect '+str(receipt))
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(record['response'])
    emit('grade-plan', grade=grade)
    return record['response']


def checked_write(config, row, state, workspace, secrets, *, revision=False, feedback=''):
    from prod_prompts import screenplay_prompt
    root, folder = Path(config['root']), Path(config['root'])/'films'/row['id']
    command = check_command(config, row, workspace)
    writer = choose_writer(config, row, state)
    # A revision is one writer turn, whose bounded check tool permits self-repair.
    attempts = (1,) if revision else (1, 2, 3)
    for attempt in attempts:
        label = ('revision' if revision else 'screenplay')+f'-{writer}-{attempt}'
        record, receipt, limited = model_attempt(config, row, 'screenplay', writer,
            screenplay_prompt(row['id'], command, feedback=feedback), workspace, label, secrets, command)
        if record['status'] == 'succeeded':
            check = check_film(config, row, workspace)
            write_json(folder/(label+'-check.json'), check)
            if check['passed']:
                shutil.copyfile(workspace/'screenplay.json', folder/('screenplay-revised.json' if revision else 'screenplay-initial.json'))
                shutil.copyfile(workspace/'screenplay.json', folder/'screenplay.json')
                state.update(checked=True, written=True, workspace=str(workspace), checked_at=now())
                if revision:
                    state['revised'] = True
                return
            feedback = '\n'.join(check.get('errors', ['Kit check failed']))
        else:
            feedback = record.get('error') or record.get('response') or 'Writer provider failed'
        state.setdefault('failures', []).append({'role':'revision' if revision else 'screenplay', 'receipt':str(receipt), 'error':feedback[-2000:]})
        if limited and not revision and writer in ('sonnet','grok','sol'):
            state.pop('writer', None)
            writer = choose_writer(config, row, state)
        elif revision or attempt >= 2:
            break
    raise RuntimeError(('Revision' if revision else 'Screenplay')+' failed: '+feedback[-2000:])


def stickler(config, row, state, workspace, secrets, *, edition=1, allow_new=True):
    from prod_runtime import make_review_item
    saved = Path(config['root'])/'review-items'/(row['id']+'-review-'+str(edition)+'.json')
    item = read_json(saved) or make_review_item(config, row, workspace, edition=edition)
    write_json(Path(config['root'])/'review-items'/(item['id']+'.json'), item)
    verdict = review_one(item, 'fable', config['root'], config['workspace_root'], secrets,
                         allow_new=allow_new, prompt_builder=review_prompt)
    if not verdict:
        raise RuntimeError('Fable review unavailable; do not voice an unreviewed film')
    if len(state.setdefault('verdicts', [])) < edition:
        state['verdicts'].append(verdict)
    return verdict


def finish_review(config, row, state, workspace, secrets, *, first=None):
    path = Path(config['root'])/'films'/row['id']/'state.json'
    verdict = first or (state.get('verdicts') or [None])[0] or stickler(config, row, state, workspace, secrets)
    write_json(path, state)
    if not verdict['ship']:
        if not state.get('revised'):
            checked_write(config, row, state, workspace, secrets, revision=True,
                          feedback='Revise this screenplay once to address the independent review.\n'+json.dumps(verdict))
            write_json(path, state)
        stickler(config, row, state, workspace, secrets, edition=2)
    state.update(reviewed=True, review_pending=False, status='reviewed', reviewed_at=now())
    write_json(path, state)


def produce_one(config, row, plan, secrets):
    from prod_prompts import study_prompt
    root, folder = Path(config['root']), Path(config['root'])/'films'/row['id']
    path = folder/'state.json'
    state = read_json(path, {})
    if state.get('reviewed') or state.get('status') == 'failed':
        return row
    folder.mkdir(parents=True, exist_ok=True)
    state.setdefault('started_at', now())
    state['status'] = 'writing'
    write_json(path, state)
    emit('film-started', id=row['id'], grade=row['grade'])
    try:
        facts = read_json(root/'facts'/(row['type']+'.json'))
        family = (Path(config['worktree'])/'amp/film/design'/row['family_path']).read_text()
        study_file = folder/'study.md'
        if not state.get('study_complete'):
            feedback = ''
            for attempt in (1,2):
                record, receipt, _ = model_attempt(config, row, 'study', row['study'],
                    study_prompt(facts, family, plan)+feedback,
                    Path(config['workspace_root'])/row['id']/'study-agent', f'study-{row["study"]}-{attempt}', secrets)
                try:
                    if record['status'] != 'succeeded':
                        raise ValueError(record.get('error') or 'Study provider failed')
                    coverage = coverage_from_study(record['response'])
                    append_coverage(root, row, facts, coverage)
                    study_file.write_text(record['response'])
                    write_json(folder/'coverage.json', coverage)
                    state['study_complete'] = True
                    break
                except (ValueError, KeyError, TypeError) as error:
                    feedback = '\nCorrect this study artifact error: '+str(error)
                    state.setdefault('failures', []).append({'role':'study', 'receipt':str(receipt), 'error':str(error)})
            if not state.get('study_complete'):
                raise RuntimeError('Study failed after two attempts'+feedback)
            write_json(path, state)
        workspace = prepare_workspace(config, row, facts, study_file.read_text())
        fixed_file(workspace/'grade-plan.md', plan)
        if not state.get('written'):
            checked_write(config, row, state, workspace, secrets)
            write_json(path, state)
        # Once voicing is stopped, review can use discounted batches without
        # delaying a film eligible for narration. Author the rest of this grade
        # first; bound each remote batch to six items.
        if read_json(root/'voice-quota.json', {}).get('reserve_stopped'):
            from prod_runtime import make_review_item
            item = make_review_item(config, row, workspace, edition=1)
            write_json(root/'review-items'/(item['id']+'.json'), item)
            state.update(review_pending=True, status='awaiting batch review')
            write_json(path, state)
        else:
            finish_review(config, row, state, workspace, secrets)
    except Exception as error:
        state.update(status='failed', failure=str(error))
        write_json(path, state)
        emit('film-failed', id=row['id'], error=str(error))
    return row


def postprocess(config, row, secrets):
    from prod_runtime import export_film
    path = Path(config['root'])/'films'/row['id']/'state.json'
    state = read_json(path, {})
    # A legacy terminal boundary failure can be retried once after the bounded
    # repair policy is installed. Retain its old attempts and failure evidence.
    if state.get('voice_terminal') and 'narration has edits' in state.get('failure',''):
        from prod_voice import POLICY
        manifest = read_json(path.parent/'runtime-manifest.json',{})
        if manifest.get('production_voice_policy') != POLICY and not state.get('voice_recovery_policy'):
            state.setdefault('voice_recoveries',[]).append({'at':now(),'policy':POLICY,
                'prior_attempts':state.get('voice_attempts',0),'prior_failure':state.get('failure')})
            state.update(voice_terminal=False,voice_recovery_policy=POLICY,
                         voice_attempt_limit=state.get('voice_attempts',0)+1)
            state.pop('failure',None)
            write_json(path,state)
    if not state.get('reviewed') or state.get('exported') or state.get('voice_terminal'):
        return
    workspace = Path(state['workspace'])
    attempt_limit = state.get('voice_attempt_limit',2)
    try:
        recovered = completed_voice(config, row, workspace)
        voice_run = read_json(path.parent/'voice-run.json', {})
        if recovered and voice_run.get('exit_code') != 0:
            recovered = None
        state['voiced'] = bool(recovered)
        if recovered:
            state.update(voiced=True, voice_result=recovered)
        while not state.get('voiced') and state.get('voice_attempts', 0)<attempt_limit:
            if read_json(Path(config['root'])/'voice-quota.json', {}).get('reserve_stopped'):
                state['voice_status'] = 'Waiting for voice: protected 50,000-credit reserve reached'
                break
            state['voice_attempts'] = state.get('voice_attempts', 0)+1
            write_json(path, state)
            result = voice_film(config, row, workspace, secrets)
            state.setdefault('voice_history', []).append(result)
            passed = result.get('check_passed') or (result.get('reused_completed_voice') and read_json(path.parent/'voice-run.json',{}).get('exit_code')==0)
            voiced = bool(result.get('voiced') and passed)
            state.update(voiced=voiced, voice_result=result,
                         voice_status='voiced' if voiced else result.get('error') or 'Voiced timing has no passing kit check')
            write_json(path, state)
            if result.get('blocked'):
                break
        if state.get('voiced'):
            result = export_film(config, row, workspace)
            state.update(exported=bool(result.get('exported')), export_result=result)
            if not state['exported']:
                state['failure'] = result.get('error','Export failed')
        elif state.get('voice_attempts',0)>=attempt_limit and not read_json(Path(config['root'])/'voice-quota.json',{}).get('reserve_stopped'):
            state['voice_terminal'] = True
            state['failure'] = state.get('voice_status','Voice attempts exhausted')
    except Exception as error:
        state['failure'] = str(error)
    write_json(path, state)
    emit('voice-export', id=row['id'], voiced=state.get('voiced',False), exported=state.get('exported',False))


def deferred_reviews(config, rows, secrets):
    root = Path(config['root'])
    # Reconcile durable submissions before constructing any new batch. A
    # partly completed group must not resubmit its remaining members.
    for manifest in sorted((root/'batches').glob('*.json')):
        while collect_review_batch(manifest, secrets['ANTHROPIC_API_KEY'])['status'] != 'collected':
            build_status(config, 'waiting for submitted Fable batch reviews')
            time.sleep(30)
    pending = [r for r in rows if read_json(root/'films'/r['id']/'state.json',{}).get('review_pending')]
    for start in range(0,len(pending),6):
        group = pending[start:start+6]
        specs = []
        for row in group:
            item = read_json(root/'review-items'/(row['id']+'-review-1.json'))
            if (root/'runs'/item['id']/'review-fable-1.json').exists():
                continue
            names = [Path(p).name for p in item['images']]
            specs.append({'id':item['id'], 'images':item['images'],
                          'prompt':review_prompt(read_json(item['payload']), names),
                          'receipt':str(root/'runs'/item['id']/'review-fable-1.json')})
        if specs:
            key = hashlib.sha256(json.dumps([s['id'] for s in specs]).encode()).hexdigest()[:16]
            manifest = root/'batches'/(key+'.json')
            submit_review_batch('fable', specs, manifest, secrets['ANTHROPIC_API_KEY'])
            while collect_review_batch(manifest, secrets['ANTHROPIC_API_KEY'])['status'] != 'collected':
                build_status(config, 'waiting for Fable batch reviews; voice reserve reached')
                time.sleep(30)
        def finish(row):
            path = root/'films'/row['id']/'state.json'
            state = read_json(path)
            try:
                first = stickler(config,row,state,Path(state['workspace']),secrets,allow_new=False)
                finish_review(config,row,state,Path(state['workspace']),secrets,first=first)
            except Exception as error:
                state.update(status='failed', failure=str(error), review_pending=False)
                write_json(path,state)
        with ThreadPoolExecutor(max_workers=6) as agents:
            list(agents.map(finish,group))


def run_grade(config, rows, plan, secrets):
    """Submit only available slots: PAUSE never leaves a hidden queue of starts."""
    root = Path(config['root'])
    iterator = iter(rows)
    exhausted = False
    reason = None
    with ThreadPoolExecutor(max_workers=config.get('agents',6)) as agents, ThreadPoolExecutor(max_workers=1) as voice:
        active, voice_jobs = {}, []
        while not exhausted or active:
            while not exhausted and len(active)<config.get('agents',6):
                row = next(iterator,None)
                if row is None:
                    exhausted = True
                    break
                state = read_json(root/'films'/row['id']/'state.json',{})
                if not state.get('started_at'):
                    reason = stop_reason(config)
                    if reason:
                        write_json(root/'stop.json', {'at':now(),'reason':reason})
                        continue
                if state.get('reviewed'):
                    voice_jobs.append(voice.submit(postprocess,config,row,secrets))
                elif state.get('status') != 'failed':
                    active[agents.submit(produce_one,config,row,plan,secrets)] = row
            if not active:
                break
            done,_ = wait(active,timeout=30,return_when=FIRST_COMPLETED)
            for future in done:
                row = active.pop(future)
                future.result()
                voice_jobs.append(voice.submit(postprocess,config,row,secrets))
            build_status(config, reason or 'writing, reviewing and voicing')
        while voice_jobs:
            done,_ = wait(voice_jobs,timeout=30,return_when=FIRST_COMPLETED)
            for future in done:
                future.result()
                voice_jobs.remove(future)
            build_status(config, reason or 'finishing voice/export')
    deferred_reviews(config,rows,secrets)
    return reason


def ensure_facts(config, rows):
    root = Path(config['root'])
    missing = list(dict.fromkeys(r['type'] for r in rows if not (root/'facts'/(r['type']+'.json')).exists()))
    if not missing:
        return
    path = root/'facts-needed.json'
    write_json(path, missing)
    subprocess.run([config['heavy'],config.get('node','node'),'--import','tsx',str(HERE/'facts.ts'),
                    'packs','--standards',config['standards'],'--out',str(root/'facts'),
                    '--types',str(path),'--seed',str(config['seed'])],cwd=Path(config['worktree'])/'amp',check=True)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--config',required=True)
    parser.add_argument('--phase',choices=('prepare','smoke','run','status','one'),required=True)
    parser.add_argument('--type', dest='type_id')
    parser.add_argument('--study', choices=MODELS, default='sonnet')
    parser.add_argument('--writer', choices=MODELS, default='astra')
    parser.add_argument('--note')
    parser.add_argument('--from', dest='from_id')
    parser.add_argument('--restudy', action='store_true')
    parser.add_argument('--stickler', action='store_true')
    args = parser.parse_args()
    config = read_json(args.config)
    if args.phase == 'one':
        from one import run_one
        run_one(config, args)
        return
    if args.phase != 'status' and not config.get('production'):
        config['production'] = True
        private_destination(Path(args.config).parent,config['worktree'])
        write_json(args.config,config)
    config['_config_path'] = str(Path(args.config).resolve())
    config['root'] = str(private_destination(config['root'],config['worktree']))
    if not 1 <= config.get('agents',6) <= 6:
        raise ValueError('Production allows one to six model agents')
    root = Path(config['root'])
    if args.phase == 'status':
        build_status(config,stop_reason(config) or 'status refreshed')
        return
    with coordinator_lock(root/'coordinator.lock'):
        reconcile_interrupted(root)
        if args.phase == 'prepare':
            from prod_queue import prepare_queue
            from prepare import voice_access
            if not (root/'catalog.json').exists():
                subprocess.run([config['heavy'],config.get('node','node'),'--import','tsx',str(HERE/'facts.ts'),
                    'inventory','--standards',config['standards'],'--out',str(root/'catalog.json')],
                    cwd=Path(config['worktree'])/'amp',check=True)
            mapping = prepare_queue(config)
            voice_access(config,credentials(config['env_file']))
            from prod_runtime import grouped_page
            grouped_page(config)
            build_status(config,'queue prepared')
            emit('prepared', films=len(mapping['assignments']))
            return
        mapping = read_json(root/'arms.json')
        if not mapping:
            raise RuntimeError('Prepare the production queue first')
        freeze_protocol(root/'protocol.json', {'prompts_v2_sha256':digest(HERE/'prod_prompts.py'),
                        'models':MODELS, 'seed':config['seed'], 'agent_limit':config.get('agents',6),
                        'api_start_threshold':250, 'voice_reserve':50000})
        secrets = credentials(config['env_file'])
        rows = mapping['assignments']
        if args.phase == 'smoke':
            types = list(dict.fromkeys(r['type'] for r in rows if r['grade']=='K'))[:3]
            rows = [r for r in rows if r['type'] in types and r['grade']=='K']
        elif not read_json(root/'smoke-complete.json',{}).get('passed'):
            raise RuntimeError('Complete the first three Kindergarten films before the detached run')
        reason = None
        for grade in mapping['grade_order']:
            selected = [r for r in rows if r['grade']==grade]
            if not selected:
                continue
            if all(read_json(root/'films'/r['id']/'state.json',{}).get('exported') for r in selected):
                continue
            reason = stop_reason(config)
            if reason:
                write_json(root/'stop.json', {'at':now(),'reason':reason})
                selected = [r for r in selected if read_json(root/'films'/r['id']/'state.json',{}).get('started_at')]
                if not selected:
                    continue
            grade_rows = [r for r in mapping['assignments'] if r['grade']==grade]
            ensure_facts(config,grade_rows)
            with ThreadPoolExecutor(max_workers=1) as planner:
                planned = planner.submit(grade_plan,config,grade,grade_rows,secrets)
                while not planned.done():
                    build_status(config,'planning grade '+grade)
                    wait([planned],timeout=30)
                plan = planned.result()
            reason = run_grade(config,selected,plan,secrets) or reason
        if args.phase == 'smoke':
            passed = all(read_json(root/'films'/r['id']/'state.json',{}).get('exported') for r in rows)
            write_json(root/'smoke-complete.json', {'passed':passed,'at':now(),'films':[r['id'] for r in rows]})
            if not passed:
                reason = reason or 'Smoke incomplete; inspect STATUS.md'
        build_status(config,reason or args.phase+' complete')
        emit('stopped',reason=reason or args.phase+' complete')
        if args.phase=='smoke' and reason:
            raise SystemExit(1)


if __name__ == '__main__':
    try:
        main()
    except Exception as error:
        import sys
        single = '--phase=one' in sys.argv or ('--phase' in sys.argv and sys.argv[sys.argv.index('--phase')+1] == 'one')
        if '--config' in sys.argv and not single:
            config = read_json(sys.argv[sys.argv.index('--config')+1])
            root = private_destination(config['root'],config['worktree'])
            write_json(root/'run-error.json', {'at':now(),'error':str(error)})
            build_status(config,'Run stopped: '+str(error))
        raise
