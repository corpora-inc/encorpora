"""Freeze calibration evidence and verify access without generating narration."""
from __future__ import annotations
import argparse
import hashlib
import json
from pathlib import Path
import re
import urllib.request

from providers import credentials, now, run_agent, write_json
from state import coordinator_lock, private_destination, read_json

VOICES = ('XescS24CsOySAkKrLAO3', 'J3Ei0Lj6fAobhIqY5ySH', 'SYXbTJsLE7zmSjr1DchT')


def freeze_calibration(config, expected=40):
    root, live = Path(config['root']), Path(config['live_data'])
    path = root/'calibration-labels.json'
    if path.exists():
        manifest = read_json(path)
        if len(manifest['records']) != expected:
            raise RuntimeError('Frozen calibration cohort has the wrong size')
        for row in manifest['records']:
            source = root/'calibration-source'/(row['id']+'.json')
            if hashlib.sha256(source.read_bytes()).hexdigest() != row['payload_sha256']:
                raise RuntimeError('Frozen calibration evidence changed')
        return {'frozen': expected, 'reused': True}
    grades = read_json(live/'grades.json')
    index = {row['id']: row for row in read_json(live/'index.json')}
    records, payloads = [], {}
    for identifier, grade in grades.items():
        if grade.get('grade') not in ('approved', 'rejected'):
            continue
        if not re.fullmatch(r'[a-z0-9-]+', identifier):
            raise ValueError('Unsafe live film ID')
        if identifier not in index or not grade.get('added') or grade['added'] != index[identifier].get('added'):
            raise RuntimeError('Founder grade does not identify the current export version')
        payload = (live/(identifier+'.json')).read_bytes()
        json.loads(payload)
        payloads[identifier] = payload
        records.append({'id': identifier, 'payload_sha256': hashlib.sha256(payload).hexdigest(),
                        'grade': grade, 'index': index[identifier]})
    if len(records) != expected:
        raise RuntimeError(f'Expected {expected} founder grades; found {len(records)}')
    destination = root/'calibration-source'
    destination.mkdir(parents=True, exist_ok=True)
    for identifier, payload in payloads.items():
        target = destination/(identifier+'.json')
        if target.exists() and target.read_bytes() != payload:
            raise RuntimeError('An existing frozen source differs')
        target.write_bytes(payload)
    write_json(path, {'frozen_at': now(), 'records': records})
    return {'frozen': len(records), 'reused': False}


def voice_access(config, secrets):
    key = secrets.get('ELEVEN_LABS_API_KEY') or secrets.get('ELEVENLABS_API_KEY')
    if not key:
        raise RuntimeError('ElevenLabs API credential unavailable')
    def get(route):
        request = urllib.request.Request('https://api.elevenlabs.io/v1/'+route, headers={'xi-api-key': key})
        with urllib.request.urlopen(request, timeout=30) as response:
            return json.load(response)
    quota = get('user/subscription')
    voices = []
    for identifier in VOICES:
        voice = get('voices/'+identifier)
        if voice.get('voice_id') != identifier:
            raise RuntimeError('Required narration voice unavailable')
        voices.append(identifier)
    model = next((m for m in get('models') if m.get('model_id')=='eleven_v4'), None)
    if not model or not model.get('can_do_text_to_speech') or model.get('token_cost_factor') != 1:
        raise RuntimeError('Narration model or character factor is unsupported')
    result = {'checked_at': now(), 'character_limit': quota['character_limit'],
              'character_count': quota['character_count'],
              'remaining': quota['character_limit']-quota['character_count'],
              'reserve': 50000, 'verified_voice_ids': voices, 'model': 'eleven_v4', 'character_factor': 1}
    write_json(Path(config['root'])/'voice-access.json', result)
    return result


def billing_access(config, secrets):
    results = []
    for provider in ('fable', 'opus', 'sonnet'):
        receipt = Path(config['root'])/'runs/preflight'/('billing-'+provider+'.json')
        record = read_json(receipt)
        if record is None:
            record = run_agent(provider, 'preflight', 'Reply with exactly READY.',
                               Path(config['workspace_root'])/'preflight'/provider,
                               receipt, secrets=secrets, timeout=120)
        if record.get('status') != 'succeeded' or not record.get('api_dollars', 0):
            raise RuntimeError('API-key billing probe did not report a positive API cost for '+provider)
        results.append({'provider': provider, 'api_dollars': record['api_dollars'],
                        'verification': 'API key in child environment only; --bare authentication; positive CLI total_cost_usd'})
    return results


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--config', required=True)
    parser.add_argument('--billing', action='store_true', help='Run three one-line paid API billing probes')
    args = parser.parse_args()
    config = read_json(args.config)
    config['root'] = str(private_destination(config['root'], config['worktree']))
    with coordinator_lock(Path(config['root'])/'coordinator.lock'):
        result = {'calibration': freeze_calibration(config)}
        secrets = credentials(config['env_file'])
        result['voice_access'] = voice_access(config, secrets)
        if args.billing:
            result['billing'] = billing_access(config, secrets)
        write_json(Path(config['root'])/'preflight.json', result)
        print(json.dumps(result))


if __name__ == '__main__':
    main()
