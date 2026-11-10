"""Blind review jobs. This module never loads assignments or founder grades."""
from __future__ import annotations
import hashlib
import json
from pathlib import Path
import shutil

from prompts import review_prompt, validate_review
from providers import parse_json, review_api, run_agent, write_json


def fingerprint(payload, images):
    digest = hashlib.sha256(json.dumps(payload, sort_keys=True).encode())
    for path in images:
        path = Path(path)
        digest.update(path.name.encode())
        digest.update(path.read_bytes())
    return digest.hexdigest()


def review_one(item, provider, root, workspace_root, secrets, *, allow_new=True, prompt_builder=review_prompt):
    """Run at most two attempts. The caller bounds concurrent model jobs."""
    root = Path(root)
    job_id = item['id']
    if not job_id or any(c not in 'abcdefghijklmnopqrstuvwxyz0123456789-_' for c in job_id):
        raise ValueError('Unsafe blind review ID')
    payload = json.loads(Path(item['payload']).read_text())
    images = [Path(p) for p in item['images']]
    if not images or any(not p.is_file() for p in images):
        raise ValueError('A review needs every storyboard image')
    names = [p.name for p in images]
    if len(names) != len(set(names)):
        raise ValueError('Storyboard filenames must be unique')
    digest = fingerprint(payload, images)
    target = root/'reviews'/job_id/(provider+'.json')
    if target.exists():
        old = json.loads(target.read_text())
        if old.get('input_sha256') != digest:
            raise RuntimeError('Review inputs changed; use a new blind edition')
        return validate_review(old, names)
    prompt = prompt_builder(payload, names)
    prompt_digest = hashlib.sha256(prompt.encode()).hexdigest()
    image_digests = [hashlib.sha256(p.read_bytes()).hexdigest() for p in images]
    workspace = Path(workspace_root)/'reviews'/job_id/provider
    workspace.mkdir(parents=True, exist_ok=True)
    local_images = []
    for source in images:
        path = workspace/source.name
        shutil.copyfile(source, path)
        local_images.append(path)
    (workspace/'payload.json').write_text(json.dumps(payload, ensure_ascii=False))
    last_error = None
    for attempt in (1, 2):
        receipt = root/'runs'/job_id/f'review-{provider}-{attempt}.json'
        if receipt.exists():
            record = json.loads(receipt.read_text())
            if (record.get('prompt_sha256') != prompt_digest
                    or record.get('image_sha256') != image_digests):
                raise RuntimeError('Attempt inputs changed; use a new blind edition')
            if record.get('status') in ('running', 'queued'):
                raise RuntimeError('Unfinished review receipt requires reconciliation before retry')
        elif not allow_new:
            return None
        elif provider in ('astra', 'grok'):
            record = run_agent(provider, 'review', prompt, workspace, receipt,
                               images=local_images, timeout=900)
        else:
            record = review_api(provider, prompt, local_images, receipt,
                                secrets['ANTHROPIC_API_KEY'])
        try:
            if record.get('status') != 'succeeded':
                raise ValueError(record.get('error') or 'Provider attempt failed')
            verdict = validate_review(parse_json(record['response']), names)
            verdict['input_sha256'] = digest
            write_json(target, verdict)
            return verdict
        except (ValueError, KeyError, TypeError) as error:
            last_error = str(error)
            record['artifact_error'] = last_error
            write_json(receipt, record)
    write_json(root/'reviews'/job_id/(provider+'-failure.json'), {
        'status': 'failed', 'attempts': 2, 'error': last_error, 'input_sha256': digest})
    return None
