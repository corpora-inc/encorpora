"""Run the private film experiment in bounded, resumable phases."""
from __future__ import annotations
import argparse
from concurrent.futures import ThreadPoolExecutor, as_completed
import hashlib
import json
from pathlib import Path
import shutil
import threading
import time

from prompts import coverage_from_study, screenplay_prompt, study_prompt
from providers import MODELS, RATES, credentials, now, run_agent, write_json
from report import build_report
from reviews import review_one
from state import coordinator_lock, freeze_protocol, private_destination, read_json, reconcile_interrupted

REVIEWERS = ('fable', 'opus', 'sonnet', 'astra', 'grok')
_coverage_lock = threading.Lock()


def append_coverage(root, row, facts, coverage):
    """Only queue clauses actually present in the supplied standards text."""
    standards = facts['standards']
    for gap in coverage['gaps']:
        matches = [s for s in standards if gap['standard'] in [s['code'], *s.get('aliases', [])]]
        passages = [part for s in matches for part in [s.get('text', ''),
                    *(p['text'] for p in s.get('parts', []))]]
        if not any(gap['clause'] in text for text in passages):
            raise ValueError('Coverage clause must quote the supplied standard verbatim: '+gap['standard'])
    queue = Path(root)/'coverage-gaps.jsonl'
    with _coverage_lock:
        existing = [json.loads(line) for line in queue.read_text().splitlines() if line.strip()] if queue.exists() else []
        keys = {r['record_id'] for r in existing if 'record_id' in r}
        with queue.open('a') as handle:
            for gap in coverage['gaps']:
                value = {'film': row['id'], 'type': row['type'], **gap}
                key = hashlib.sha256(json.dumps(value, sort_keys=True).encode()).hexdigest()
                if key not in keys:
                    handle.write(json.dumps({'record_id': key, 'recorded_at': now(), **value}, ensure_ascii=False)+'\n')
                    keys.add(key)


def production(config, row, secrets):
    # Imported here so read-only reporting works without Node or browser dependencies.
    from runtime import prepare_workspace, check_command, check_film
    root = Path(config['root'])
    folder = root/'films'/row['id']
    folder.mkdir(parents=True, exist_ok=True)
    state_path = folder/'state.json'
    state = read_json(state_path, {'status': 'pending', 'failures': [], 'started_at': now()})
    if state.get('checked') or state.get('status') == 'failed':
        return row
    start = time.monotonic()
    facts = read_json(root/'facts'/(row['type']+'.json'))
    if not facts:
        raise RuntimeError('Missing facts pack for '+row['type'])
    family_path = Path(config['worktree'])/'amp'/'film'/'design'/row['family_path']
    family = family_path.read_text()
    input_hashes = {'facts': hashlib.sha256(json.dumps(facts, sort_keys=True).encode()).hexdigest(),
                    'family': hashlib.sha256(family.encode()).hexdigest()}
    if state.get('input_hashes', input_hashes) != input_hashes:
        raise RuntimeError('Inputs changed for an existing film: '+row['id'])
    state['input_hashes'] = input_hashes
    write_json(state_path, state)
    failures = state.setdefault('failures', [])
    study_file = folder/'study.md'
    feedback = ''
    for attempt in (1, 2):
        if state.get('study_complete') or len(failures) >= 2:
            break
        prompt = study_prompt(facts, family)
        if feedback:
            prompt += '\nCORRECT THIS ARTIFACT ERROR:\n'+feedback
        receipt = root/'runs'/row['id']/f'study-{row["study"]}-{attempt}.json'
        record = read_json(receipt)
        if record is None:
            record = run_agent(row['study'], 'study', prompt,
                               Path(config['workspace_root'])/row['id']/'study-agent', receipt,
                               secrets=secrets, timeout=config.get('study_timeout', 900))
        try:
            if record.get('artifact_error'):
                raise ValueError(record['artifact_error'])
            if record['status'] != 'succeeded':
                raise ValueError(record.get('error') or 'Study provider attempt failed')
            study = record['response']
            coverage = coverage_from_study(study)
            append_coverage(root, row, facts, coverage)
            study_file.write_text(study)
            write_json(folder/'coverage.json', coverage)
            state['study_complete'] = True
        except (ValueError, KeyError, TypeError) as error:
            feedback = str(error)
            if not any(f['receipt']==str(receipt) for f in failures):
                failures.append({'role': 'study', 'receipt': str(receipt), 'error': feedback})
            record['artifact_error'] = feedback
            write_json(receipt, record)
        write_json(state_path, state)
    if state.get('study_complete'):
        workspace = prepare_workspace(config, row, facts, study_file.read_text())
        command = check_command(config, row, workspace)
        feedback = ''
        for attempt in (1, 2):
            if state.get('checked') or len(failures) >= 2:
                break
            receipt = root/'runs'/row['id']/f'screenplay-{row["screenplay"]}-{attempt}.json'
            prompt = screenplay_prompt(row['id'], command, feedback=feedback)
            record = read_json(receipt)
            if record is None:
                record = run_agent(row['screenplay'], 'screenplay', prompt, workspace, receipt,
                                   secrets=secrets, check_command=command,
                                   timeout=config.get('screenplay_timeout', 1800))
            try:
                if record.get('artifact_error'):
                    raise ValueError(record['artifact_error'])
                if record['status'] != 'succeeded':
                    raise ValueError(record.get('error') or 'Screenplay provider attempt failed')
                check = check_film(config, row, workspace)
                write_json(folder/f'check-{attempt}.json', check)
                if not check['passed']:
                    raise ValueError('\n'.join(check.get('errors', ['Kit check failed'])))
                shutil.copyfile(Path(workspace)/'screenplay.json', folder/'screenplay.json')
                state.update(checked=True, workspace=str(workspace), checked_at=now())
            except (ValueError, KeyError, TypeError) as error:
                feedback = str(error)
                if not any(f['receipt']==str(receipt) for f in failures):
                    failures.append({'role': 'screenplay', 'receipt': str(receipt), 'error': feedback})
                record['artifact_error'] = feedback
                write_json(receipt, record)
            write_json(state_path, state)
    state['production_wall_seconds'] = state.get('production_wall_seconds', 0)+round(time.monotonic()-start, 3)
    state['status'] = 'checked' if state.get('checked') else 'failed'
    if state['status'] == 'failed':
        state['failure'] = failures[-1]['error'] if failures else 'No valid screenplay'
    write_json(state_path, state)
    return row


def postprocess(config, row, secrets):
    """Called by one worker, so voice quota state and live exports are serialized."""
    from runtime import completed_voice, voice_film, export_film, make_review_item
    root = Path(config['root'])
    path = root/'films'/row['id']/'state.json'
    state = read_json(path, {})
    if not state.get('checked'):
        return None
    saved_item = root/'review-items'/(row['id']+'.json')
    if saved_item.exists() and (state.get('voice_terminal') or (state.get('voiced') and state.get('exported'))):
        return read_json(saved_item)
    workspace = Path(state['workspace'])
    if not state.get('voiced') and state.get('voice_attempts', 0) >= 2:
        recovered = completed_voice(config, row, workspace)
        state['voiced'] = bool(recovered)
        state['voice_terminal'] = not state['voiced']
        state['voice_status'] = 'voiced' if recovered else 'Two voice attempts used; no complete verified narration'
        if recovered:
            state['voice_result'] = recovered
        write_json(path, state)
    # Resolve bounded voice retries before freezing C's payload. Replacing an
    # already-reviewed dry timeline with voiced timing would change its inputs.
    while not state.get('voiced') and not state.get('voice_terminal'):
        state['voice_attempts'] = state.get('voice_attempts', 0)+1
        write_json(path, state)
        voice = voice_film(config, row, workspace, secrets)
        state.setdefault('voice_history', []).append(voice)
        state['voice_result'] = voice
        state['voiced'] = bool(voice.get('voiced'))
        state['voice_status'] = 'voiced' if state['voiced'] else voice.get('error', 'Voice failed')
        state['voice_terminal'] = not state['voiced'] and (voice.get('blocked', False)
                                    or state['voice_attempts'] >= 2)
        write_json(path, state)
    if state.get('voiced') and not state.get('exported'):
        export = export_film(config, row, workspace)
        state['export_result'] = export
        state['exported'] = bool(export.get('exported'))
        write_json(path, state)
    item = make_review_item(config, row, workspace, voiced=state.get('voiced', False))
    write_json(saved_item, item)
    return item


def report(config, status):
    with _coverage_lock:
        result = build_report(config['root'], config['review_url'], status)
    print(json.dumps({'event': 'report', 'at': now(), **result}), flush=True)


def pathway_reviews(config, rows, secrets):
    """Submit each complete, frozen pathway while later authoring continues.

    The single voice worker calls this callback, so submission is serialized.
    Failed production rows count as finished but have no review item.
    """
    from batches import submit_cohort
    root = Path(config['root'])
    groups = {}
    for row in rows:
        groups.setdefault(row['pathway'], []).append(row)
    finished, submitted = set(), set()

    def complete(row):
        finished.add(row['id'])
        label = row['pathway']
        group = groups[label]
        if label in submitted or not all(r['id'] in finished for r in group):
            return
        items = [read_json(root/'review-items'/(r['id']+'.json')) for r in group]
        items = [item for item in items if item]
        submit_cohort(root, items, label, secrets)
        submitted.add(label)
        print(json.dumps({'event': 'pathway-reviews-submitted', 'pathway': label,
                          'films': len(items), 'at': now()}), flush=True)
    return complete


def produce_cohort(config, rows, secrets, on_postprocess=None):
    def finish(row):
        item = postprocess(config, row, secrets)
        if on_postprocess:
            on_postprocess(row)
        return item

    with ThreadPoolExecutor(max_workers=3) as agents, ThreadPoolExecutor(max_workers=1) as voice:
        pending = {agents.submit(production, config, row, secrets): row for row in rows}
        voice_jobs = []
        try:
            for future in as_completed(pending):
                row = future.result()
                voice_jobs.append(voice.submit(finish, row))
                print(json.dumps({'event': 'screenplay-finished', 'id': row['id'], 'at': now()}), flush=True)
                report(config, 'production running')
            for future in as_completed(voice_jobs):
                future.result()
                report(config, 'voice/export processing')
        except BaseException:
            for future in pending:
                future.cancel()
            raise


def review_cohort(config, items, secrets, providers=REVIEWERS):
    with ThreadPoolExecutor(max_workers=3) as agents:
        jobs = {agents.submit(review_one, item, provider, config['root'],
                              config['workspace_root'], secrets): (item['id'], provider)
                for item in items for provider in providers}
        for future in as_completed(jobs):
            value = future.result()
            identifier, provider = jobs[future]
            print(json.dumps({'event': 'review-finished', 'id': identifier,
                              'provider': provider, 'valid': value is not None, 'at': now()}), flush=True)
            report(config, 'reviews running')


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--config', required=True)
    parser.add_argument('--phase', required=True,
                        choices=('smoke', 'rest', 'calibration-prepare', 'calibration', 'reviews', 'report'))
    args = parser.parse_args()
    config = read_json(args.config)
    config['_config_path'] = str(Path(args.config).resolve())
    config['root'] = str(private_destination(config['root'], config['worktree']))
    root = Path(config['root'])
    with coordinator_lock(root/'coordinator.lock'):
        reconcile_interrupted(root)
        if args.phase == 'report':
            report(config, 'report refreshed')
            return
        secrets = credentials(config['env_file'])
        mapping = read_json(root/'arms.json')
        if not mapping:
            raise RuntimeError('Select and record pathways before running models')
        freeze_protocol(root/'protocol.json', {
            'prompts_sha256': hashlib.sha256(Path(__file__).with_name('prompts.py').read_bytes()).hexdigest(),
            'assignment_sha256': hashlib.sha256(json.dumps(mapping, sort_keys=True).encode()).hexdigest(),
            'models': MODELS, 'api_rates_usd_per_million': {key: list(value) for key, value in RATES.items()},
            'reviewers': list(REVIEWERS), 'agent_limit': 3, 'failure_limit': 2,
        })
        freeze_protocol(root/'execution-settings.json', {
            'study_timeout_seconds': config.get('study_timeout', 900),
            'screenplay_timeout_seconds': config.get('screenplay_timeout', 1800),
            'cli_review_timeout_seconds': 900,
            'api_review_max_output_tokens': 12000,
        })
        if args.phase in ('smoke', 'rest'):
            first = mapping['pathways'][0]['id']
            rows = [r for r in mapping['assignments'] if (r['pathway']==first)==(args.phase=='smoke')]
            if args.phase == 'rest' and not (root/'smoke-complete.json').exists():
                raise RuntimeError('Complete and inspect the nine-arm smoke pathway before the remaining pathways')
            if args.phase == 'smoke':
                produce_cohort(config, rows, secrets)
                items = [read_json(root/'review-items'/(r['id']+'.json')) for r in rows]
                review_cohort(config, [i for i in items if i], secrets)
                write_json(root/'smoke-complete.json', {'completed_at': now(), 'pathway': first, 'types': len(rows)})
            else:
                from batches import API_REVIEWERS, wait_for_batches
                # Keep the three authoring slots occupied across pathways. A
                # slow final film in one pathway must not idle the other slots.
                produce_cohort(config, rows, secrets,
                               on_postprocess=pathway_reviews(config, rows, secrets))
                # Include the frozen calibration cohort, whose API batches can run
                # while the screenplay agents work. Completed smoke reviews are reused.
                items = [read_json(p) for p in sorted((root/'review-items').glob('*.json'))]
                review_cohort(config, items, secrets, providers=('astra', 'grok'))
                wait_for_batches(root, secrets, lambda: report(config, 'waiting for review batches'))
                review_cohort(config, items, secrets, providers=API_REVIEWERS)
        elif args.phase in ('calibration', 'calibration-prepare'):
            from runtime import prepare_calibration
            from batches import API_REVIEWERS, submit_cohort, wait_for_batches
            items = prepare_calibration(config)
            for item in items:
                write_json(root/'review-items'/(item['id']+'.json'), item)
            # Validate the image/API request on a real calibration item before
            # submitting the cohort. These verdicts count toward calibration.
            review_cohort(config, items[:1], secrets, providers=API_REVIEWERS)
            for provider in API_REVIEWERS:
                probes = [read_json(root/'runs'/items[0]['id']/f'review-{provider}-{attempt}.json', {})
                          for attempt in (1, 2)]
                if not any(record.get('status')=='succeeded' for record in probes):
                    raise RuntimeError('Image-review API preflight failed for '+provider+'; no calibration batches submitted')
            submit_cohort(root, items, 'calibration', secrets)
            if args.phase == 'calibration':
                review_cohort(config, items, secrets, providers=('astra', 'grok'))
                wait_for_batches(root, secrets, lambda: report(config, 'waiting for calibration batches'))
                review_cohort(config, items, secrets, providers=API_REVIEWERS)
        elif args.phase == 'reviews':
            from batches import wait_for_batches
            wait_for_batches(root, secrets, lambda: report(config, 'waiting for review batches'))
            items = [read_json(p) for p in sorted((root/'review-items').glob('*.json'))]
            review_cohort(config, items, secrets)
        report(config, args.phase+' phase complete')


if __name__ == '__main__':
    main()
