"""Production facts derived from durable receipts, without assigning missing costs zero."""
from collections import Counter, defaultdict
from pathlib import Path

from providers import now
from state import read_json


def spending(root):
    total, partial, unknown, holds = 0.0, 0.0, 0, 0.0
    for path in (Path(root)/'runs').glob('**/*.json'):
        record = read_json(path, {})
        if record.get('transport') not in ('api-cli', 'messages-api', 'messages-batch-api'):
            continue
        if isinstance(record.get('api_dollars'), (float, int)):
            total += record['api_dollars']
        elif isinstance(record.get('partial_api_dollars'), (float, int)):
            partial += record['partial_api_dollars']
            unknown += 1
            holds += max(0,record.get('budget_limit_usd',25)-record['partial_api_dollars'])
        elif record.get('status') not in ('running', 'queued'):
            unknown += 1
            holds += record.get('budget_limit_usd',25)
    return {'api_dollars': total, 'partial_api_dollars': partial,
            'known_dollars': total+partial, 'incomplete_costs': unknown,
            'unconfirmed_holds':holds,'admission_dollars':total+partial+holds}


def build_status(config, status='running'):
    root = Path(config['root'])
    mapping = read_json(root/'arms.json', {'assignments': [], 'grade_order': []})
    counts, failures, history, waiting, verdicts = defaultdict(Counter), [], [], [], []
    for row in mapping['assignments']:
        state = read_json(root/'films'/row['id']/'state.json', {})
        grade = counts[row['grade']]
        grade['queued'] += 1
        for field in ('written', 'reviewed', 'revised', 'voiced', 'exported'):
            grade[field] += bool(state.get(field))
        if state.get('failure'):
            failures.append(f"- {row['id']}: {state['failure']}")
        attempts = Counter(item.get('role', 'authoring') for item in state.get('failures', []))
        attempts['voice'] = sum(bool(item.get('error')) and not item.get('blocked')
                                for item in state.get('voice_history', []))
        if any(attempts.values()):
            summary = ', '.join(f'{number} {role}' for role, number in attempts.items() if number)
            history.append(f"- {row['id']}: {summary} failed attempts; retained in films/{row['id']}/state.json and runs/. Exported: {bool(state.get('exported'))}.")
        if state.get('reviewed') and not state.get('voiced'):
            waiting.append(f"- {row['id']}: {state.get('voice_status', state.get('status', 'awaiting voice'))}")
        for edition, verdict in enumerate(state.get('verdicts', []), 1):
            verdicts.append(f"| {row['id']} | {edition} | {'Ship' if verdict['ship'] else 'Would not ship'} | {verdict['score']} | {verdict['reason'].replace('|', '/').replace(chr(10), ' ')} |")
    costs = spending(root)
    writers = defaultdict(lambda: defaultdict(list))
    for path in (root/'runs').glob('**/*.json'):
        r = read_json(path, {})
        if r.get('role') == 'screenplay':
            writers[r['provider']][path.parent.name].append(r)
    quota = read_json(root/'voice-quota.json', {})
    access = read_json(root/'voice-access.json', {})
    remaining = quota.get('last_live_remaining', access.get('remaining', 'unavailable'))
    if quota.get('initial_remaining') is not None:
        remaining = min(quota.get('last_live_remaining', quota['initial_remaining']),
                        quota['initial_remaining']-quota.get('reserved_characters', 0))
    gap_path = root/'coverage-gaps.jsonl'
    gaps = len(gap_path.read_text().splitlines()) if gap_path.exists() else 0
    lines = ['# Lesson-film production status', '', f'Updated: {now()}', f'State: {status}',
             f"Review page: {config.get('review_url', '')}", '',
             f"Anthropic API dollars: ${costs['api_dollars']:.4f}; partial lower bounds: ${costs['partial_api_dollars']:.4f}; incomplete cost receipts: {costs['incomplete_costs']}.",
             f"Unconfirmed budget holds: ${costs['unconfirmed_holds']:.4f}; spending plus holds for admission: ${costs['admission_dollars']:.4f}. Holds are not measured charges: incomplete CLI attempts reserve their configured cap; legacy uncapped attempts and unknown direct requests reserve $25 each.",
             'New-film start threshold: $250. Films already in flight finish; final spend can exceed the threshold.',
             f'Voice quota remaining (last read, less local holds): {remaining}; protected reserve: 50,000.',
             f'Coverage gaps: {gaps}.', '',
             '| Grade/course | Queued | Written | Reviewed | Revised | Voiced | Exported |',
             '| --- | ---: | ---: | ---: | ---: | ---: | ---: |']
    for grade in mapping.get('grade_order', counts):
        c = counts[grade]
        lines.append('| '+str(grade)+' | '+' | '.join(str(c[k]) for k in ('queued','written','reviewed','revised','voiced','exported'))+' |')
    lines += ['', 'Writer means are per film, including repair and revision attempts. Only complete cost/time samples enter each mean. Missing dollars are unavailable, not zero.', '',
              '| Writer | Films | Attempts | Mean reported dollars/film | Cost samples | Mean seconds/film | Time samples |',
              '| --- | ---: | ---: | ---: | ---: | ---: | ---: |']
    for name, films in sorted(writers.items()):
        dollars, seconds = [], []
        for records in films.values():
            sample_costs = [r.get('api_dollars') if r.get('api_dollars') is not None else r.get('reported_dollars') for r in records]
            times = [r.get('wall_seconds') for r in records]
            if all(isinstance(v, (int,float)) for v in sample_costs):
                dollars.append(sum(sample_costs))
            if all(isinstance(v, (int,float)) for v in times):
                seconds.append(sum(times))
        avg = lambda values: f'{sum(values)/len(values):.3f}' if values else 'unavailable'
        lines.append(f'| {name} | {len(films)} | {sum(len(r) for r in films.values())} | {avg(dollars)} | {len(dollars)} | {avg(seconds)} | {len(seconds)} |')
    lines += ['', '## Fable verdicts', '', '| Film | Edition | Verdict | Score | Reason |',
              '| --- | ---: | --- | ---: | --- |', *verdicts,
              '', '## Waiting for voice', '', *(waiting or ['None.']),
              '', '## Current failures', '', *(failures or ['None.']),
              '', '## Attempt failures', '', *(history or ['None.'])]
    disabled = read_json(root/'provider-limits.json', {})
    if disabled:
        lines += ['', 'Provider usage limits:', *[f'- {p}: {v["reason"]}' for p,v in disabled.items()]]
    lines += ['', 'Queue exclusion reasons are recorded in queue.json.', '']
    target = root/'STATUS.md'
    temporary = target.with_suffix('.md.tmp')
    temporary.write_text('\n'.join(lines))
    temporary.replace(target)
    return costs
