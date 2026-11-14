"""Publish blind live-player artifacts locally, preserving the grading service."""
from __future__ import annotations
import hashlib
import json
import os
from pathlib import Path
import shutil
import subprocess
import urllib.request

from providers import clean_environment, now, write_json
from state import display_script, shared_lock, read_json

NAMES = {'XescS24CsOySAkKrLAO3': 'Madeline', 'J3Ei0Lj6fAobhIqY5ySH': 'Paul', 'SYXbTJsLE7zmSjr1DchT': 'Champ'}
ALLOWED = {'id', 'title', 'problemType', 'skill', 'skillTitle', 'grade', 'strand', 'standards', 'script', 'timing', 'figure'}


def instrument_export_paths(source):
    """File URLs must be decoded before reading a screenplay on disk."""
    anchor = 'const here = new URL(".", import.meta.url).pathname;'
    if source.count(anchor) != 1:
        raise RuntimeError('Export directory anchor changed; inspect the kit')
    return 'import { fileURLToPath } from "node:url";\n'+source.replace(
        anchor, 'const here = fileURLToPath(new URL(".", import.meta.url));')


def migrate_export_paths(config, row, workspace):
    """Preserve frozen sources; record a narrowly scoped runtime path repair."""
    from runtime import digest, fixed_file, verify_runtime
    verify_runtime(config, row, workspace)
    root = Path(config['root'])
    path = root/'films'/row['id']/'runtime-manifest.json'
    manifest = read_json(path)
    if manifest.get('export_path_policy') == 'decoded-file-url':
        return
    for receipt in (root/'runs'/row['id']).glob('*.json'):
        record = read_json(receipt, {})
        if record.get('status') == 'running' and record.get('role') == 'screenplay':
            raise RuntimeError('Finish the author before migrating its export runtime')
    module = Path(workspace)/'runtime/amp/film/export-live.ts'
    before = module.read_text()
    after = instrument_export_paths(before)
    archive = root/'runtime-migrations'/row['id']/'decoded-file-url'
    fixed_file(archive/'export-live.before.ts', before)
    fixed_file(archive/'runtime-manifest.before.json', path.read_text())
    temporary = module.with_suffix('.ts.tmp')
    temporary.write_text(after)
    temporary.replace(module)
    entry = next(e for e in manifest['files'] if e['relative'] == 'film/export-live.ts')
    entry['runtime_sha256'] = digest(module)
    manifest['export_path_policy'] = 'decoded-file-url'
    write_json(path, manifest)
    verify_runtime(config, row, workspace)
    write_json(archive/'receipt.json', {'at': now(), 'policy': 'decoded-file-url',
               'before_sha256': hashlib.sha256(before.encode()).hexdigest(),
               'after_sha256': digest(module)})


def player_copy(payload):
    value = {key: payload[key] for key in ALLOWED if key in payload}
    value = json.loads(json.dumps(value))
    for role in value['script'].get('cast', {}):
        voice = value['timing']['voices'][role]
        if voice not in NAMES:
            raise ValueError('Unapproved playback voice')
        value['script']['cast'][role] = {'voice': voice, 'name': NAMES[voice],
                                       **({'tag': '[energetic]'} if role=='learner' else {})}
    return value


def export_worker(config, row, workspace):
    if not os.environ.get('FILM_LINE_HEAVY'):
        raise RuntimeError('Audio export requires the heavy-command gate')
    from runtime import validate_cast
    migrate_export_paths(config, row, workspace)
    validate_cast(Path(workspace)/'screenplay.json', row['id'])
    root, data = Path(config['root']), Path(config['live_data'])
    stage = root/'export-staging'/row['id']
    stage.mkdir(parents=True, exist_ok=True)
    runtime = Path(workspace)/'runtime/amp'
    env = clean_environment()
    env['FILM_OUT'] = str(root/'voiced')
    result = subprocess.run([config.get('node', 'node'), '--import', 'tsx', str(runtime/'film/export-live.ts'),
                             str(stage), row['id']], cwd=runtime, env=env, capture_output=True, text=True)
    if result.returncode:
        raise RuntimeError(result.stderr[-6000:] or result.stdout[-6000:])
    emitted = read_json(stage/(row['id']+'.json'))
    if emitted['script'] != display_script(read_json(Path(workspace)/'screenplay.json')):
        raise RuntimeError('Export does not contain the checked screenplay')
    assigned = {'teacher': row['teacher'], 'learner': 'SYXbTJsLE7zmSjr1DchT'}
    expected = {role: assigned[role] for role in emitted['script'].get('cast', {})}
    if emitted['timing'].get('voices') != expected:
        raise RuntimeError('Exported voices differ from the production assignment')
    payload = player_copy(emitted)
    index_row = next(r for r in read_json(stage/'index.json') if r['id']==row['id'])
    data.mkdir(parents=True, exist_ok=True)
    destination = data/(row['id']+'.json')
    with shared_lock(config):
        existing = read_json(destination)
        released = any(r['id'] == row['id'] for r in read_json(data/'queue.json', []))
        audio = data/(row['id']+'.m4a')
        temporary = audio.with_suffix('.m4a.tmp')
        shutil.copyfile(stage/(row['id']+'.m4a'), temporary)
        temporary.replace(audio)
        write_json(destination, payload)
        prior = read_json(root/'films'/row['id']/'export.json', {})
        if existing == payload and prior.get('added'):
            index_row['added'] = prior['added']
        if released:
            # Publishing needs the current edition for director follow-ups.
            # The queue retains the release record until an explicit re-release.
            index = read_json(data/'index.json', [])
            write_json(data/'index.json', [
                {**r, **index_row} if r['id'] == row['id'] else r for r in index])
    base = config['player_url'].rstrip('/')+'/data/'
    with urllib.request.urlopen(base+row['id']+'.json', timeout=20) as response:
        if json.load(response) != payload:
            raise RuntimeError('Live payload readback differs')
    request = urllib.request.Request(base+row['id']+'.m4a', method='HEAD')
    with urllib.request.urlopen(request, timeout=20) as response:
        if int(response.headers.get('Content-Length', 0)) != audio.stat().st_size:
            raise RuntimeError('Live audio readback has the wrong size')
    receipt = {'exported': True, 'id': row['id'], 'at': now(), 'added': index_row['added'],
               'json_sha256': hashlib.sha256(destination.read_bytes()).hexdigest(),
               'audio_sha256': hashlib.sha256(audio.read_bytes()).hexdigest(), 'index_row': index_row}
    write_json(root/'films'/row['id']/'export.json', receipt)
    return receipt
