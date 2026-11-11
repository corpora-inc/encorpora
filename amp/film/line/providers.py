"""Measured, non-interactive model runners. All run artifacts are private.

Claude Code's --bare flag uses API-key authentication exclusively. Screenplay
authors use the CLI. CLI-reported
usage costs are kept separate from verified API-key charges.
"""
from __future__ import annotations

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

MODELS = {
    'fable': 'claude-fable-5-2', 'opus': 'claude-opus-5-5',
    'sonnet': 'claude-sonnet-5-5', 'astra': 'gpt-6-astra', 'grok': 'grok-4.7',
    'sol': 'gpt-6.1-sol',
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


def normalized_usage(provider, raw):
    if provider in ('astra', 'sol'):
        total = raw.get('input_tokens')
        cached = raw.get('cached_input_tokens', 0)
        return {'input_uncached': None if total is None else total-cached,
                'input_cached': cached, 'cache_write': raw.get('cache_write_input_tokens', 0),
                'output': raw.get('output_tokens'), 'reasoning': raw.get('reasoning_output_tokens')}
    return {'input_uncached': raw.get('input_tokens'),
            'input_cached': raw.get('cache_read_input_tokens', 0),
            'cache_write': raw.get('cache_creation_input_tokens', 0),
            'output': raw.get('output_tokens'), 'reasoning': raw.get('reasoning_tokens')}


def api_cost(provider, usage):
    base, output, write5, write60, hit = RATES[provider]
    split = usage.get('cache_creation') or {}
    one_hour = split.get('ephemeral_1h_input_tokens', 0)
    five_minute = split.get('ephemeral_5m_input_tokens',
                           usage.get('cache_creation_input_tokens', 0)-one_hour)
    cost = (base*usage.get('input_tokens', 0) + output*usage.get('output_tokens', 0)
            + write5*five_minute + write60*one_hour
            + hit*usage.get('cache_read_input_tokens', 0))/1_000_000
    return cost


def claude_output(stdout, provider):
    """Prefer the final result; retain reported request usage after interruption.

    Assistant events repeat per content block and their output count is a
    placeholder. Deduplicate inputs by message ID; accept output counts only
    from raw message_delta events or the final result.
    https://code.claude.com/docs/en/agent-sdk/cost-tracking
    """
    results, messages = [], {}
    current = None
    malformed = 0
    for line in stdout.splitlines():
        try:
            event = json.loads(line)
        except ValueError:
            malformed += bool(line.strip())
            continue
        if not isinstance(event, dict):
            continue
        if event.get('type') == 'result' or ('result' in event and 'usage' in event):
            results.append(event)
        if event.get('parent_tool_use_id'):
            continue
        raw = event.get('event', {}) if event.get('type') == 'stream_event' else {}
        message = raw.get('message') if raw.get('type') == 'message_start' else event.get('message') if event.get('type') == 'assistant' else None
        if message and message.get('id'):
            identifier = message['id']
            usage = messages.setdefault(identifier, {})
            for key, value in (message.get('usage') or {}).items():
                if key != 'output_tokens':
                    usage[key] = value
            if raw.get('type') == 'message_start':
                current = identifier
        elif raw.get('type') == 'message_delta' and current:
            messages[current].update(raw.get('usage') or {})
        elif raw.get('type') == 'message_stop':
            current = None
    final = results[-1] if results else None
    # A crash can emit a zeroed final result despite earlier billable requests.
    crashed_zero = final and final.get('subtype') == 'error_during_execution' and not final.get('total_cost_usd') and messages
    if final and not crashed_zero:
        return {**final, 'usage_partial': False, 'malformed_stream_lines': malformed}
    usage = {}
    for request in messages.values():
        for key in ('input_tokens', 'output_tokens', 'cache_read_input_tokens', 'cache_creation_input_tokens'):
            if isinstance(request.get(key), (int, float)):
                usage[key] = usage.get(key, 0)+request[key]
        for key, value in (request.get('cache_creation') or {}).items():
            usage.setdefault('cache_creation', {})[key] = usage.get('cache_creation', {}).get(key, 0)+value
    return {'result': '', 'usage': usage, 'is_error': True, 'usage_partial': True,
            'reported_requests': len(messages), 'malformed_stream_lines': malformed,
            'partial_api_dollars': sum(api_cost(provider, value) for value in messages.values()) if messages else None}


def grok_output(stdout):
    """Prefer closing spend; otherwise retain reported response boundaries.

    Grok's streaming-json usage fields already exclude cache hits from input.
    Never add per-response usage to the cumulative closing event, or derive a
    dollar figure when the CLI omits one.
    """
    chunks, requests = [], {}
    final = None
    malformed = 0
    for number, line in enumerate(stdout.splitlines()):
        try:
            event = json.loads(line)
        except ValueError:
            malformed += bool(line.strip())
            continue
        if not isinstance(event, dict):
            continue
        kind = event.get('type')
        if kind == 'text' and isinstance(event.get('data'), str):
            chunks.append(event['data'])
        elif kind == 'usage':
            identifier = event.get('messageId') or event.get('message_id') or f'line-{number}'
            requests[identifier] = event.get('usage') or {}
        elif kind in ('end', 'error'):
            final = event
    usage = (final or {}).get('usage') or {}
    usable_final_usage = isinstance(usage, dict) and any(
        isinstance(usage.get(key), (int, float)) and not isinstance(usage.get(key), bool)
        for key in ('input_tokens', 'output_tokens', 'total_tokens'))
    partial = final is None or bool(final.get('usage_is_incomplete')) or not usable_final_usage
    if partial and requests:
        usage = {key: sum(value.get(key, 0) for value in requests.values())
                 for key in ('input_tokens', 'output_tokens', 'cache_read_input_tokens',
                             'cache_creation_input_tokens', 'reasoning_tokens', 'total_tokens')}
    result = {**(final or {}), 'text': ''.join(chunks), 'usage': usage,
              'usage_partial': partial, 'reported_requests': len(requests),
              'malformed_stream_lines': malformed,
              'is_error': final is None or final.get('type') == 'error'
                          or final.get('stopReason') not in (None, 'end_turn')}
    if partial or result.get('cost_is_partial'):
        result.pop('total_cost_usd', None)
    return result


def run_agent(provider, role, prompt, workspace, receipt, *, secrets=None,
              check_command=None, images=(), timeout=1800, max_dollars=None, effort='xhigh'):
    """One measured attempt. The caller owns retry limits and concurrency."""
    if provider not in MODELS or effort not in ('low', 'medium', 'high', 'xhigh'):
        raise ValueError('Unsupported model or reasoning effort')
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
             'Never read credentials, founder grades, private predictions or other films. '
             'Do not edit source code, run Git, voice audio, or render MP4. '
             'Run kit checks only using the exact supplied check command, which invokes the heavy-command gate.')
    if provider in ('astra', 'sol'):
        command = ['codex', 'exec', '-m', MODELS[provider], '-c', f'model_reasoning_effort="{effort}"',
                   '-c', 'mcp_servers={}', '--ignore-user-config',
                   '--dangerously-bypass-approvals-and-sandbox', '--skip-git-repo-check',
                   '--ephemeral', '--json', '-C', str(workspace)]
        for path in images:
            command += ['-i', str(Path(path).resolve())]
        command += ['-']
    elif provider == 'grok':
        command = ['grok', '-m', MODELS[provider], '--reasoning-effort', effort,
                   '--prompt-file', str(prompt_path), '--cwd', str(workspace),
                   '--always-approve', '--rules', house, '--no-subagents',
                   '--disable-web-search', '--output-format', 'streaming-json']
    else:
        if not secrets.get('ANTHROPIC_API_KEY'):
            raise RuntimeError('Anthropic API key is unavailable')
        env['ANTHROPIC_API_KEY'] = secrets['ANTHROPIC_API_KEY']
        command = ['claude', '-p', '--bare', '--restricted', '--strict-mcp-config',
                   '--mcp-config', '{"mcpServers":{}}', '--model', MODELS[provider],
                   '--effort', effort, '--output-format', 'stream-json', '--verbose', '--include-partial-messages',
                   '--no-session-persistence', '--permission-mode', 'dontAsk',
                   '--disable-slash-commands', '--append-system-prompt', house]
        if max_dollars is not None:
            if not isinstance(max_dollars,(int,float)) or max_dollars <= 0:
                raise ValueError('The API attempt budget must be positive')
            command += ['--max-budget-usd',str(max_dollars)]
        if role == 'screenplay':
            if not check_command:
                raise ValueError('A screenplay agent needs its bounded check command')
            command += ['--tools', 'Read,Write,Edit,Bash,Glob,Grep', '--allowedTools',
                        'Read', 'Write', 'Edit', 'Glob', 'Grep', f'Bash({check_command})']
        else:
            command += ['--tools', '']
    record = {'provider': provider, 'model': MODELS[provider], 'role': role,
              'reasoning_effort': effort,
              'output_format': 'streaming-json' if provider == 'grok' else 'json' if provider in ('astra', 'sol') else 'stream-json',
              'started_at': now(), 'prompt_sha256': hashlib.sha256(prompt.encode()).hexdigest(),
              'image_sha256': [hashlib.sha256(Path(p).read_bytes()).hexdigest() for p in images],
              'timeout_seconds': timeout,
              'transport': 'account-cli' if provider in ('astra', 'sol', 'grok') else 'api-cli',
              'api_dollars': None, 'reported_dollars': None, 'status': 'running'}
    if max_dollars is not None and provider in RATES:
        record['budget_limit_usd'] = max_dollars
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
        if provider in ('astra', 'sol'):
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
            response = grok_output(stdout) if provider == 'grok' else claude_output(stdout, provider)
            result = response.get('text' if provider == 'grok' else 'result', '')
            raw_usage = response.get('usage', {})
            record['model_usage'] = response.get('modelUsage')
            record['reported_dollars'] = response.get('total_cost_usd')
            record['api_dollars'] = None if provider == 'grok' else response.get('total_cost_usd')
            record['provider_error'] = bool(response.get('is_error'))
            record['usage_partial'] = response.get('usage_partial', False)
            record['partial_api_dollars'] = response.get('partial_api_dollars')
            record['reported_requests'] = response.get('reported_requests')
            record['malformed_stream_lines'] = response.get('malformed_stream_lines', 0)
            if provider == 'grok':
                record['session_id'] = response.get('sessionId')
                record['reported_usage_is_incomplete'] = response.get('usage_is_incomplete', False)
                record['reported_cost_is_partial'] = response.get('cost_is_partial', False)
        record['raw_usage'] = raw_usage
        record['tokens'] = normalized_usage(provider, raw_usage)
        record['usage_complete'] = bool(raw_usage) and not timed_out and not record.get('usage_partial')
    except (ValueError, KeyError, TypeError) as error:
        record['parse_error'] = type(error).__name__
        record['usage_complete'] = False
    record['status'] = 'failed' if process.returncode or timed_out or record.get('provider_error') else 'succeeded'
    record['response'] = result
    write_json(receipt, record)
    return record
