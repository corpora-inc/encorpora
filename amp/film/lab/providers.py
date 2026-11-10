"""Measured, non-interactive model runners. All run artifacts are private.

Claude Code's --bare flag uses API-key authentication exclusively. Study and
screenplay agents use the CLI; image reviews use the Messages API. CLI-reported
usage costs are kept separate from verified API-key charges.
"""
from __future__ import annotations

import base64
import datetime as dt
import hashlib
import json
import os
from pathlib import Path
import re
import shlex
import signal
import subprocess
import time
import urllib.error
import urllib.request

MODELS = {
    'fable': 'claude-fable-5-2', 'opus': 'claude-opus-5-5',
    'sonnet': 'claude-sonnet-5-5', 'astra': 'gpt-6-astra', 'grok': 'grok-4.7',
}
# USD per million tokens, checked 2026-11-10 against the provider's pricing page.
# https://platform.claude.com/docs/en/about-claude/pricing
RATES = {'fable': (8, 40, 10, 16, .20), 'opus': (4, 20, 5, 8, .20),
         'sonnet': (2, 10, 2.5, 4, .10)}
KEY_NAMES = {'ANTHROPIC_API_KEY', 'ELEVEN_LABS_API_KEY', 'ELEVENLABS_API_KEY'}


def now():
    return dt.datetime.now(dt.timezone.utc).isoformat()


def write_json(path, value):
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_name(path.name + '.tmp')
    temporary.write_text(json.dumps(value, indent=2, ensure_ascii=False) + '\n')
    temporary.replace(path)


def credentials(path):
    """Read a small allowlist without executing a shell initialization file."""
    result = {}
    for line in Path(path).expanduser().read_text().splitlines():
        line = line.strip().removeprefix('export ')
        if not line or line.startswith('#') or '=' not in line:
            continue
        name, value = line.split('=', 1)
        if name.strip() not in KEY_NAMES:
            continue
        tokens = shlex.split(value, comments=True)
        if tokens:
            result[name.strip()] = tokens[0]
    return result


def redact(text, secrets):
    for value in secrets.values():
        if value:
            text = text.replace(value, '[REDACTED]')
    return text


def clean_environment():
    env = os.environ.copy()
    for name in list(env):
        if (re.search(r'(API_KEY|TOKEN|SECRET|PASSWORD)', name)
                or name.startswith(('ANTHROPIC_', 'CLAUDE_CODE_USE_'))
                or name in {'CLAUDECODE', 'CLAUDE_CODE_OAUTH_TOKEN'}):
            env.pop(name)
    env['FILM_NO_VOICE'] = '1'
    return env


def parse_json(text):
    text = text.strip()
    if text.startswith('```'):
        text = re.sub(r'^```[^\n]*\n|\n```\s*$', '', text).strip()
    return json.loads(text)


def normalized_usage(provider, raw):
    if provider == 'astra':
        total = raw.get('input_tokens')
        cached = raw.get('cached_input_tokens', 0)
        return {'input_uncached': None if total is None else total-cached,
                'input_cached': cached, 'cache_write': raw.get('cache_write_input_tokens', 0),
                'output': raw.get('output_tokens'), 'reasoning': raw.get('reasoning_output_tokens')}
    return {'input_uncached': raw.get('input_tokens'),
            'input_cached': raw.get('cache_read_input_tokens', 0),
            'cache_write': raw.get('cache_creation_input_tokens', 0),
            'output': raw.get('output_tokens'), 'reasoning': raw.get('reasoning_tokens')}


def api_cost(provider, usage, batch=False):
    base, output, write5, write60, hit = RATES[provider]
    split = usage.get('cache_creation') or {}
    one_hour = split.get('ephemeral_1h_input_tokens', 0)
    five_minute = split.get('ephemeral_5m_input_tokens',
                           usage.get('cache_creation_input_tokens', 0)-one_hour)
    cost = (base*usage.get('input_tokens', 0) + output*usage.get('output_tokens', 0)
            + write5*five_minute + write60*one_hour
            + hit*usage.get('cache_read_input_tokens', 0))/1_000_000
    return cost * (.5 if batch else 1)


def run_agent(provider, role, prompt, workspace, receipt, *, secrets=None,
              check_command=None, images=(), timeout=1800):
    """One measured attempt. The caller owns retry limits and concurrency."""
    workspace, receipt = Path(workspace).resolve(), Path(receipt)
    workspace.mkdir(parents=True, exist_ok=True)
    receipt.parent.mkdir(parents=True, exist_ok=True)
    secrets = secrets or {}
    prompt_path = workspace / 'prompt.txt'
    prompt_path.write_text(prompt)
    receipt.with_suffix('.prompt.txt').write_text(prompt)
    env = clean_environment()
    house = ('Work only on this assigned task in this workspace. Do not spawn agents. '
             'Never run rm, find -delete, git stash, or write shell heredocs. Use file tools. '
             'Never read credentials, founder grades, experiment results, or assignments. '
             'Do not edit source code, run Git, voice audio, or render MP4. '
             'Run kit checks only using the exact supplied check command, which invokes the heavy-command gate.')
    if provider == 'astra':
        command = ['codex', 'exec', '-m', MODELS[provider], '-c', 'model_reasoning_effort="xhigh"',
                   '-c', 'mcp_servers={}', '--ignore-user-config',
                   '--dangerously-bypass-approvals-and-sandbox', '--skip-git-repo-check',
                   '--ephemeral', '--json', '-C', str(workspace)]
        for path in images:
            command += ['-i', str(Path(path).resolve())]
        command += ['-']
    elif provider == 'grok':
        command = ['grok', '-m', MODELS[provider], '--reasoning-effort', 'xhigh',
                   '--prompt-file', str(prompt_path), '--cwd', str(workspace),
                   '--always-approve', '--rules', house, '--no-subagents',
                   '--disable-web-search', '--output-format', 'json']
    else:
        if not secrets.get('ANTHROPIC_API_KEY'):
            raise RuntimeError('Anthropic API key is unavailable')
        env['ANTHROPIC_API_KEY'] = secrets['ANTHROPIC_API_KEY']
        command = ['claude', '-p', '--bare', '--restricted', '--strict-mcp-config',
                   '--mcp-config', '{"mcpServers":{}}', '--model', MODELS[provider],
                   '--effort', 'xhigh', '--output-format', 'json',
                   '--no-session-persistence', '--permission-mode', 'dontAsk',
                   '--disable-slash-commands', '--append-system-prompt', house]
        if role == 'screenplay':
            if not check_command:
                raise ValueError('A screenplay agent needs its bounded check command')
            command += ['--tools', 'Read,Write,Edit,Bash,Glob,Grep', '--allowedTools',
                        'Read', 'Write', 'Edit', 'Glob', 'Grep', f'Bash({check_command})']
        else:
            command += ['--tools', '']
    record = {'provider': provider, 'model': MODELS[provider], 'role': role,
              'started_at': now(), 'prompt_sha256': hashlib.sha256(prompt.encode()).hexdigest(),
              'image_sha256': [hashlib.sha256(Path(p).read_bytes()).hexdigest() for p in images],
              'transport': 'account-cli' if provider in ('astra', 'grok') else 'api-cli',
              'api_dollars': None, 'reported_dollars': None, 'status': 'running'}
    write_json(receipt, record)
    start = time.monotonic()
    timed_out = False
    try:
        process = subprocess.Popen(command, stdin=subprocess.PIPE, stdout=subprocess.PIPE,
                                   stderr=subprocess.PIPE, cwd=workspace, env=env,
                                   text=True, start_new_session=True)
    except OSError as error:
        record.update(status='failed', launch_error=redact(str(error), secrets),
                      finished_at=now(), wall_seconds=round(time.monotonic()-start, 3),
                      api_dollars=0, usage_complete=True, response='')
        write_json(receipt, record)
        return record
    record['pid'] = process.pid
    write_json(receipt, record)
    try:
        stdout, stderr = process.communicate(prompt if provider != 'grok' else '', timeout=timeout)
    except subprocess.TimeoutExpired:
        timed_out = True
        os.killpg(process.pid, signal.SIGTERM)
        try:
            stdout, stderr = process.communicate(timeout=15)
        except subprocess.TimeoutExpired:
            os.killpg(process.pid, signal.SIGKILL)
            stdout, stderr = process.communicate()
    stdout, stderr = redact(stdout, secrets), redact(stderr, secrets)
    receipt.with_suffix('.stdout').write_text(stdout)
    receipt.with_suffix('.stderr').write_text(stderr)
    record.update(wall_seconds=round(time.monotonic()-start, 3), finished_at=now(),
                  exit_code=process.returncode, timed_out=timed_out)
    result, raw_usage = '', {}
    try:
        if provider == 'astra':
            events = [json.loads(line) for line in stdout.splitlines() if line.startswith('{')]
            messages = [e['item'].get('text', '') for e in events
                        if e.get('type') == 'item.completed' and e.get('item', {}).get('type') == 'agent_message']
            result = messages[-1] if messages else ''
            turns = [e['usage'] for e in events if e.get('type') == 'turn.completed']
            for usage in turns:
                for key, value in usage.items():
                    if isinstance(value, (int, float)):
                        raw_usage[key] = raw_usage.get(key, 0)+value
            record['api_dollars'] = None  # This CLI reports tokens, not an API-key charge.
        else:
            response = json.loads(stdout)
            result = response.get('text' if provider == 'grok' else 'result', '')
            raw_usage = response.get('usage', {})
            record['model_usage'] = response.get('modelUsage')
            record['reported_dollars'] = response.get('total_cost_usd')
            record['api_dollars'] = None if provider == 'grok' else response.get('total_cost_usd')
            record['provider_error'] = bool(response.get('is_error'))
        record['raw_usage'] = raw_usage
        record['tokens'] = normalized_usage(provider, raw_usage)
        record['usage_complete'] = bool(raw_usage) and not timed_out
    except (ValueError, KeyError, TypeError) as error:
        record['parse_error'] = type(error).__name__
        record['usage_complete'] = False
    record['status'] = 'failed' if process.returncode or timed_out or record.get('provider_error') else 'succeeded'
    record['response'] = result
    write_json(receipt, record)
    return record


def anthropic_request(path, key, payload=None, timeout=180):
    headers = {'x-api-key': key, 'anthropic-version': '2023-06-01', 'Content-Type': 'application/json'}
    body = None if payload is None else json.dumps(payload).encode()
    request = urllib.request.Request('https://api.anthropic.com/v1/'+path,
                                     data=body, headers=headers)
    try:
        with urllib.request.urlopen(request, timeout=timeout) as response:
            return json.load(response)
    except urllib.error.HTTPError as error:
        # Status and a redacted message are useful; request headers never are.
        message = error.read().decode(errors='replace').replace(key, '[REDACTED]')
        raise RuntimeError(f'Anthropic HTTP {error.code}: {message[:1500]}') from None


def review_params(provider, prompt, images):
    content = []
    for path in images:
        path = Path(path)
        content += [{'type': 'text', 'text': path.name}, {'type': 'image', 'source': {
            'type': 'base64', 'media_type': 'image/jpeg',
            'data': base64.b64encode(path.read_bytes()).decode()}}]
    content.append({'type': 'text', 'text': prompt})
    return {'model': MODELS[provider], 'max_tokens': 12000,
            'thinking': {'type': 'adaptive'}, 'output_config': {'effort': 'xhigh'},
            'messages': [{'role': 'user', 'content': content}]}


def review_api(provider, prompt, images, receipt, key):
    """Direct Messages API review, useful for smoke tests and failed batch items."""
    receipt = Path(receipt)
    receipt.parent.mkdir(parents=True, exist_ok=True)
    receipt.with_suffix('.prompt.txt').write_text(prompt)
    record = {'provider': provider, 'model': MODELS[provider], 'role': 'review',
              'transport': 'messages-api', 'started_at': now(), 'status': 'running',
              'prompt_sha256': hashlib.sha256(prompt.encode()).hexdigest(),
              'image_sha256': [hashlib.sha256(Path(p).read_bytes()).hexdigest() for p in images]}
    write_json(receipt, record)
    start = time.monotonic()
    try:
        response = anthropic_request('messages', key, review_params(provider, prompt, images), timeout=900)
        usage = response.get('usage', {})
        record.update(response='\n'.join(b['text'] for b in response.get('content', []) if b['type']=='text'),
                      raw_usage=usage, tokens=normalized_usage(provider, usage),
                      api_dollars=api_cost(provider, usage), usage_complete=True,
                      status='succeeded' if response.get('stop_reason') == 'end_turn' else 'failed',
                      stop_reason=response.get('stop_reason'), response_model=response.get('model'))
    except Exception as error:
        record.update(status='failed', error=str(error).replace(key, '[REDACTED]'),
                      usage_complete=False, api_dollars=None)
    record.update(wall_seconds=round(time.monotonic()-start, 3), finished_at=now())
    write_json(receipt, record)
    return record


def submit_review_batch(provider, specs, manifest_path, key):
    """Persist a submission intent before spending; ambiguous submissions stop.

    specs contain id, prompt, images and receipt. A manifest in 'submitting'
    state must be reconciled against the provider before another submission.
    """
    manifest_path = Path(manifest_path)
    if manifest_path.exists():
        old = json.loads(manifest_path.read_text())
        if old.get('batch_id'):
            return old
        raise RuntimeError('Batch submission needs reconciliation: '+str(manifest_path))
    requests, entries = [], []
    for item in specs:
        receipt = Path(item['receipt'])
        receipt.parent.mkdir(parents=True, exist_ok=True)
        receipt.with_suffix('.prompt.txt').write_text(item['prompt'])
        custom_id = hashlib.sha256(item['id'].encode()).hexdigest()[:32]
        requests.append({'custom_id': custom_id,
                         'params': review_params(provider, item['prompt'], item['images'])})
        entries.append({'custom_id': custom_id, 'id': item['id'], 'receipt': str(item['receipt']),
                        'prompt_sha256': hashlib.sha256(item['prompt'].encode()).hexdigest(),
                        'image_sha256': [hashlib.sha256(Path(p).read_bytes()).hexdigest() for p in item['images']]})
    if len({x['custom_id'] for x in entries}) != len(entries):
        raise ValueError('Duplicate batch item')
    size = len(json.dumps({'requests': requests}).encode())
    if size > 240_000_000:
        raise ValueError('Batch exceeds the safe request size; split the cohort')
    manifest = {'provider': provider, 'model': MODELS[provider], 'entries': entries,
                'started_at': now(), 'status': 'submitting', 'request_bytes': size}
    write_json(manifest_path, manifest)
    try:
        response = anthropic_request('messages/batches', key, {'requests': requests}, timeout=300)
    except Exception as error:
        manifest['submission_error'] = str(error).replace(key, '[REDACTED]')
        write_json(manifest_path, manifest)
        raise
    manifest.update(batch_id=response['id'], status=response['processing_status'],
                    provider_created_at=response.get('created_at'), request_counts=response.get('request_counts'))
    write_json(manifest_path, manifest)
    for entry in entries:
        write_json(entry['receipt'], {
            'provider': provider, 'model': MODELS[provider], 'role': 'review',
            'transport': 'messages-batch-api', 'status': 'queued',
            'started_at': manifest['started_at'], 'batch_id': response['id'],
            'prompt_sha256': entry['prompt_sha256'], 'image_sha256': entry['image_sha256'],
            'api_dollars': None, 'usage_complete': False,
        })
    return manifest


def collect_review_batch(manifest_path, key):
    """One nonblocking status check and collection. Caller controls polling."""
    manifest_path = Path(manifest_path)
    manifest = json.loads(manifest_path.read_text())
    if manifest.get('status') == 'collected':
        return manifest
    if not manifest.get('batch_id'):
        raise RuntimeError('Unreconciled batch submission')
    response = anthropic_request('messages/batches/'+manifest['batch_id'], key)
    manifest.update(status=response['processing_status'], request_counts=response.get('request_counts'))
    write_json(manifest_path, manifest)
    if response['processing_status'] != 'ended':
        return manifest
    url = response.get('results_url', '')
    if not url.startswith('https://api.anthropic.com/v1/messages/batches/'):
        raise ValueError('Unexpected provider results URL')
    request = urllib.request.Request(url, headers={'x-api-key': key, 'anthropic-version': '2023-06-01'})
    with urllib.request.urlopen(request, timeout=300) as stream:
        lines = stream.read().decode()
    entries = {x['custom_id']: x for x in manifest['entries']}
    collected = set()
    provider = manifest['provider']
    elapsed = (dt.datetime.now(dt.timezone.utc)-dt.datetime.fromisoformat(manifest['started_at'])).total_seconds()
    for line in lines.splitlines():
        if not line.strip():
            continue
        item = json.loads(line)
        entry = entries[item['custom_id']]
        result = item['result']
        record = {'provider': provider, 'model': MODELS[provider], 'role': 'review',
                  'transport': 'messages-batch-api', 'started_at': manifest['started_at'],
                  'finished_at': now(), 'batch_id': manifest['batch_id'],
                  'prompt_sha256': entry['prompt_sha256'], 'image_sha256': entry['image_sha256'],
                  'wall_seconds': None, 'batch_elapsed_seconds': round(elapsed, 3),
                  'timing_note': 'Provider does not report per-request execution time; batch elapsed includes queueing.',
                  'status': 'failed', 'api_dollars': None, 'usage_complete': False}
        if result['type'] == 'succeeded':
            message = result['message']
            usage = message.get('usage', {})
            record.update(response='\n'.join(b['text'] for b in message['content'] if b['type']=='text'),
                          raw_usage=usage, tokens=normalized_usage(provider, usage),
                          api_dollars=api_cost(provider, usage, batch=True), usage_complete=True,
                          stop_reason=message.get('stop_reason'), response_model=message.get('model'),
                          status='succeeded' if message.get('stop_reason')=='end_turn' else 'failed')
        else:
            record['error'] = json.dumps(result).replace(key, '[REDACTED]')
        write_json(entry['receipt'], record)
        collected.add(item['custom_id'])
    if collected != set(entries):
        raise ValueError('Provider batch result set does not match submitted requests')
    manifest.update(status='collected', collected_at=now())
    write_json(manifest_path, manifest)
    return manifest
