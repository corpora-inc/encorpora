"""Submit image reviews in cohorts and collect their measured receipts."""
import json
from pathlib import Path
import time

from prompts import review_prompt
from providers import collect_review_batch, submit_review_batch
from state import read_json

API_REVIEWERS = ('fable', 'opus', 'sonnet')


def chunks(items):
    groups, group, size = [], [], 0
    for item in sorted(items, key=lambda value: value['id']):
        estimate = (40_000+6*Path(item['payload']).stat().st_size
                    +sum(4*((Path(p).stat().st_size+2)//3) for p in item['images']))
        if estimate > 180_000_000:
            raise ValueError('One film exceeds the safe batch request size')
        if group and (len(group) == 10 or size+estimate > 180_000_000):
            groups.append(group)
            group, size = [], 0
        group.append(item)
        size += estimate
    if group:
        groups.append(group)
    return groups


def submit_cohort(root, items, label, secrets):
    root = Path(root)
    if not label or any(c not in 'abcdefghijklmnopqrstuvwxyz0123456789-_' for c in label):
        raise ValueError('Unsafe batch label')
    for provider in API_REVIEWERS:
        # Chunk the whole fixed cohort, not just its pending items: a restart
        # after one batch must not reuse that batch's name for different films.
        for number, group in enumerate(chunks(items), 1):
            specs = []
            for item in group:
                receipt = root/'runs'/item['id']/f'review-{provider}-1.json'
                if receipt.exists() or (root/'reviews'/item['id']/(provider+'.json')).exists():
                    continue
                images = [Path(p) for p in item['images']]
                payload = read_json(item['payload'])
                specs.append({'id': item['id'], 'prompt': review_prompt(payload, [p.name for p in images]),
                              'images': images, 'receipt': receipt})
            if not specs:
                continue
            manifest = root/'batches'/f'{label}-{provider}-{number}.json'
            existing = read_json(manifest)
            if existing and not {s['id'] for s in specs} <= {e['id'] for e in existing['entries']}:
                raise RuntimeError('Cohort changed after its batch submission')
            submit_review_batch(provider, specs, manifest, secrets['ANTHROPIC_API_KEY'])


def collect(root, secrets):
    pending = []
    for path in sorted((Path(root)/'batches').glob('*.json')):
        result = collect_review_batch(path, secrets['ANTHROPIC_API_KEY'])
        if result['status'] != 'collected':
            pending.append({'manifest': str(path), 'status': result['status'],
                            'counts': result.get('request_counts')})
    return pending


def wait_for_batches(root, secrets, callback=None):
    while True:
        pending = collect(root, secrets)
        if not pending:
            return
        print(json.dumps({'event': 'batches-pending', 'batches': pending}), flush=True)
        if callback:
            callback()
        time.sleep(60)
