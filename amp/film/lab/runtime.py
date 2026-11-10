"""Isolated screenplay workspaces, kit checks, guarded voice and exact-player boards."""
from __future__ import annotations
import argparse
import hashlib
import json
import os
from pathlib import Path
import re
import shlex
import shutil
import signal
import subprocess
import sys
import threading
import time

from providers import clean_environment, now, redact, write_json
from state import read_json

TEACHERS = {'XescS24CsOySAkKrLAO3', 'J3Ei0Lj6fAobhIqY5ySH'}
CHAMP = 'SYXbTJsLE7zmSjr1DchT'
HERE = Path(__file__).resolve().parent
_source_lock = threading.Lock()
REFERENCES = {
    'place-value': ['tenths-as-hundredths', 'decimal-sum-difference', 'round-to-hundred'],
    'fractions': ['compare-unlike-fractions', 'fraction-line-position', 'decimal-grid-read'],
    'addition-and-subtraction': ['join-within-10', 'make-ten-remainder', 'linked-division-equations'],
    'probability-and-counting': ['independence-test', 'percent-amounts-blanks', 'mean-data'],
    'two-variables-sampling-and-inference': ['independence-test', 'line-slope', 'mean-data'],
    'trigonometry': ['sinusoid-compare-rule', 'triangle-area-base-height', 'complex-plane-forms'],
    'quadratics': ['quadratic-vertex', 'line-slope', 'rational-two-denominators'],
}


def digest(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def source_tree_digest(source):
    value = hashlib.sha256()
    source = Path(source)
    for path in sorted(source.rglob('*')):
        if path.is_symlink():
            raise RuntimeError('Shared app source must not contain mutable symlinks')
        if path.is_file():
            value.update(str(path.relative_to(source)).encode()+b'\0')
            value.update(bytes.fromhex(digest(path)))
    return value.hexdigest()


def verify_shared_source(config):
    """Keep every model on the same curriculum and figure implementation."""
    source = Path(config['worktree'])/'amp/src'
    current = source_tree_digest(source)
    path = Path(config['root'])/'canonical-source.json'
    with _source_lock:
        frozen = read_json(path)
        if frozen is None:
            write_json(path, {'sha256': current, 'frozen_at': now()})
        elif frozen['sha256'] != current:
            raise RuntimeError('Shared app source changed during the experiment')


def fixed_file(path, content):
    path = Path(path)
    if path.exists() and path.read_text() != content:
        raise RuntimeError('An immutable workspace input changed: '+str(path))
    if not path.exists():
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(content)


def workspace_for(config, identifier):
    if not re.fullmatch(r'[a-z0-9]+(?:-[a-z0-9]+)*--[a-z]{2}', identifier):
        raise ValueError('Invalid blind film ID')
    path = Path(config['workspace_root']).resolve()/identifier
    if not path.is_relative_to(Path(config['worktree']).resolve()):
        raise ValueError('Authoring workspace must be inside the lab worktree')
    return path


def prepare_workspace(config, row, facts, study):
    workspace = workspace_for(config, row['id'])
    workspace.mkdir(parents=True, exist_ok=True)
    source = Path(config['worktree'])/'amp'
    kit = source/'film'
    verify_shared_source(config)
    fixed_file(workspace/'facts.json', json.dumps(facts, indent=2, ensure_ascii=False)+'\n')
    fixed_file(workspace/'study.md', study)
    for name, path in {'AUTHORING.md': kit/'AUTHORING.md', 'PROCESS.md': kit/'design/PROCESS.md',
                       'KAIZEN.md': kit/'design/KAIZEN.md', 'CURRICULUM.md': kit/'design/CURRICULUM.md',
                       'FAMILY.md': kit/'design'/row['family_path'], 'schema.ts': kit/'schema.ts'}.items():
        fixed_file(workspace/name, path.read_text())
    family = row['family_path'].split('/')[0]
    references = REFERENCES.get(family, ['rectangle-area', 'line-slope', 'fraction-line-position', 'two-step-word-problem'])
    for name in references:
        fixed_file(workspace/'references'/(name+'.json'), (kit/'lessons'/(name+'.json')).read_text())
    manifest_path = Path(config['root'])/'films'/row['id']/'runtime-manifest.json'
    runtime = workspace/'runtime/amp'
    if not manifest_path.exists():
        (runtime/'film/lessons').mkdir(parents=True, exist_ok=True)
        entries = []
        sources = [p for p in kit.iterdir() if p.is_file() and p.suffix in ('.ts', '.tsx', '.css', '.html') and '.test.' not in p.name]
        sources += [source/'browser-security.mjs', source/'package.json']
        for path in sources:
            relative = path.relative_to(source)
            target = runtime/relative
            text = path.read_text()
            if path.name == 'make.ts':
                anchor = 'const suffix = values.tall ? "-tall" : "";'
                if text.count(anchor) != 1:
                    raise RuntimeError('Kit payload snapshot anchor changed')
                snapshot = 'writeFileSync(join(OUT, "lab-payload.json"), JSON.stringify({ id, title: script.title, script, timing, figure: lesson.example.figure ?? null, timing_source: values.dry ? "estimated" : "voice" }));'
                text = text.replace(anchor, anchor+'\n'+snapshot)
                server_anchor = 'server: { host: "127.0.0.1",'
                if text.count(server_anchor) != 1:
                    raise RuntimeError('Kit local server anchor changed')
                allowed = json.dumps([str(runtime), str(source/'src'), str(source/'node_modules')])
                text = text.replace(server_anchor, 'server: { fs: { allow: '+allowed+' }, host: "127.0.0.1",')
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_text(text)
            entries.append({'relative': str(relative), 'source_sha256': digest(path), 'runtime_sha256': digest(target)})
        for name in ('src', 'node_modules'):
            link = runtime/name
            if not link.exists():
                link.symlink_to(source/name, target_is_directory=True)
        script_link = runtime/'film/lessons'/(row['id']+'.json')
        if not script_link.is_symlink():
            script_link.symlink_to(workspace/'screenplay.json')
        write_json(manifest_path, {'files': entries, 'instrumentation': 'JSON payload snapshot and local Vite access to the shared source/dependency links; kit checks unchanged.'})
    verify_runtime(config, row, workspace)
    return workspace


def verify_runtime(config, row, workspace):
    verify_shared_source(config)
    source = Path(config['worktree'])/'amp'
    runtime = Path(workspace)/'runtime/amp'
    manifest = read_json(Path(config['root'])/'films'/row['id']/'runtime-manifest.json')
    if not manifest:
        raise RuntimeError('Missing runtime provenance')
    for entry in manifest['files']:
        if digest(source/entry['relative']) != entry['source_sha256']:
            raise RuntimeError('Canonical kit changed during the experiment')
        if digest(runtime/entry['relative']) != entry['runtime_sha256']:
            raise RuntimeError('A screenplay agent modified the kit')
    for name in ('src', 'node_modules'):
        if (runtime/name).resolve() != (source/name).resolve():
            raise RuntimeError('Runtime dependency link changed')
    screenplay = runtime/'film/lessons'/(row['id']+'.json')
    if not screenplay.is_symlink() or screenplay.resolve() != (Path(workspace)/'screenplay.json').resolve():
        raise RuntimeError('Runtime screenplay link changed')


def check_command(config, row, workspace):
    return shlex.join([sys.executable, str(HERE/'runtime.py'), 'check', '--config', config['_config_path'], '--id', row['id']])


def _run(command, cwd, env, timeout=3600):
    start = time.monotonic()
    process = subprocess.Popen(command, cwd=cwd, env=env, stdout=subprocess.PIPE,
                               stderr=subprocess.PIPE, text=True, start_new_session=True)
    try:
        stdout, stderr = process.communicate(timeout=timeout)
    except BaseException:
        if process.poll() is None:
            os.killpg(process.pid, signal.SIGTERM)
            try:
                process.communicate(timeout=15)
            except subprocess.TimeoutExpired:
                os.killpg(process.pid, signal.SIGKILL)
                process.communicate()
        raise
    return {'exit_code': process.returncode, 'stdout': stdout, 'stderr': stderr,
            'wall_seconds': round(time.monotonic()-start, 3)}


def heavy(config, mode, identifier, secrets=None, extra=()):
    env = clean_environment()
    env['FILM_LAB_HEAVY'] = '1'
    if mode=='voice-worker':
        key = (secrets or {}).get('ELEVEN_LABS_API_KEY') or (secrets or {}).get('ELEVENLABS_API_KEY')
        if not key:
            return {'exit_code': 1, 'stdout': '', 'stderr': 'ElevenLabs API key unavailable', 'wall_seconds': 0}
        env['ELEVEN_LABS_API_KEY'] = key
        env.pop('FILM_NO_VOICE', None)
    result = _run([config['heavy'], sys.executable, str(HERE/'runtime.py'), mode,
                   '--config', config['_config_path'], '--id', identifier, *extra],
                  config['worktree'], env)
    for field in ('stdout', 'stderr'):
        result[field] = redact(result[field], secrets or {})
    return result


def _last_report(output):
    for line in reversed(output.splitlines()):
        try:
            value = json.loads(line)
            if isinstance(value, dict) and 'problems' in value:
                return value
        except ValueError:
            pass
    return None


def _make(config, row, workspace, *, voice=False, tall=False):
    verify_runtime(config, row, workspace)
    if row['teacher'] not in TEACHERS:
        raise ValueError('Unapproved teacher voice')
    runtime = Path(workspace)/'runtime/amp'
    env = clean_environment()
    root = Path(config['root'])
    out = root/'voiced' if voice else Path(workspace)/'check-output'
    env.update(FILM_OUT=str(out), FILM_VOICES=config['voice_cache'], FILM_LOCKS=str(root/'kit-locks'))
    command = [config.get('node', 'node')]
    if voice:
        env.pop('FILM_NO_VOICE', None)
        env['ELEVEN_LABS_API_KEY'] = os.environ['ELEVEN_LABS_API_KEY']
        env.update(FILM_LAB_QUOTA_STATE=str(root/'voice-quota.json'),
                   FILM_LAB_VOICE_LEDGER=str(root/'voice-ledger.jsonl'), FILM_LAB_ID=row['id'])
        command += ['--import', str(HERE/'quota-hook.mjs')]
    command += ['--import', 'tsx', str(runtime/'film/make.ts'), row['id'],
                '--check' if voice else '--dry', '--res', '1080', '--out', str(out),
                '--voice', 'teacher='+row['teacher'], '--voice', 'learner='+CHAMP]
    if not voice:
        command += ['--board']
    if tall:
        command += ['--tall']
    result = _run(command, runtime, env)
    result['report'] = _last_report(result['stdout'])
    return result


def pages(raw, destination, prefix, tall=False):
    raw, destination = Path(raw), Path(destination)
    frames = sorted(raw.glob('*.jpg'))
    if not frames:
        raise RuntimeError('No storyboard frames in '+str(raw))
    destination.mkdir(parents=True, exist_ok=True)
    count, width, rows = (2, 540, 1) if tall else (4, 960, 2)
    outputs = []
    for start in range(0, len(frames), count):
        target = destination/f'{prefix}-{start//count+1:03}.jpg'
        filters = (f"scale={width}:-1,pad=iw:ih+40:0:40:color=white,"
                   f"drawtext=text='Frame %{{n}}':start_number={start}:x=12:y=6:fontsize=26:fontcolor=black,"
                   f"tile=2x{rows}:padding=6:color=white")
        subprocess.run(['ffmpeg', '-v', 'error', '-y', '-start_number', str(start), '-i', str(raw/'%03d.jpg'),
                        '-vf', filters, '-frames:v', '1', '-q:v', '3', str(target)], check=True, capture_output=True)
        outputs.append(str(target))
    return outputs


def validate_cast(path, identifier):
    script = read_json(path)
    if not script or script.get('id') != identifier:
        raise ValueError('Screenplay is missing or uses the wrong ID')
    if script.get('cast') != {'teacher': {}, 'learner': {}}:
        raise ValueError('Use exactly teacher and learner roles with empty voice bindings')
    beats = [beat for shot in script.get('shots', []) for beat in shot.get('beats', [])]
    speakers = {beat.get('speaker') for beat in beats}
    if speakers != {'teacher', 'learner'}:
        raise ValueError('Every beat must name its teacher or learner speaker, and both roles must speak')
    visible = script.get('title', '')+'\n'+'\n'.join(beat.get('say', '') for beat in beats)
    if re.search(r'\b(?:claude|fable|opus|sonnet|grok|astra|study-opus|write-opus)\b', visible, re.I):
        raise ValueError('Remove model or arm attribution from the visible screenplay')
    return script


def check_worker(config, row, workspace):
    if not os.environ.get('FILM_LAB_HEAVY'):
        raise RuntimeError('Kit checks require the heavy-command gate')
    errors, captures = [], []
    try:
        validate_cast(Path(workspace)/'screenplay.json', row['id'])
        old_boards = Path(workspace)/'storyboards'
        if old_boards.exists() or old_boards.is_symlink():
            subprocess.run(['trash', str(old_boards)], check=True, capture_output=True)
        for tall in (False, True):
            result = _make(config, row, workspace, tall=tall)
            name = 'tall' if tall else 'wide'
            write_json(Path(workspace)/(name+'-check-run.json'), result)
            reported = result['report']
            if result['exit_code'] or not reported:
                errors.extend((reported or {}).get('problems') or [result['stderr'][-6000:] or 'Kit did not report a completed check'])
            if not tall and reported:
                payload = Path(workspace)/'check-output'/row['id']/'lab-payload.json'
                compatibility = _run([config.get('node', 'node'), '--import', 'tsx',
                    str(HERE/'check-player-figure.ts'), str(payload)],
                    Path(config['worktree'])/'amp', clean_environment())
                if compatibility['exit_code']:
                    errors.append(compatibility['stderr'][-3000:] or 'Installed player figure compatibility failed')
            directory = Path(workspace)/'check-output'/row['id']/('board-tall' if tall else 'board')
            if directory.exists() and list(directory.glob('*.jpg')):
                captures += pages(directory, Path(workspace)/'storyboards', 'author-'+name, tall)
    except Exception as error:
        errors.append(str(error))
    result = {'passed': not errors, 'errors': errors, 'storyboard_pages': captures, 'checked_at': now(),
              'screenplay_sha256': digest(Path(workspace)/'screenplay.json') if (Path(workspace)/'screenplay.json').is_file() else None}
    write_json(Path(workspace)/'check.json', result)
    return result


def check_film(config, row, workspace):
    result = heavy(config, 'check-worker', row['id'])
    check = read_json(Path(workspace)/'check.json')
    if check and check.get('passed') is False:
        return check
    if result['exit_code'] or not check:
        return {'passed': False, 'errors': [result['stderr'][-6000:] or result['stdout'][-6000:] or 'Check worker failed']}
    if check.get('screenplay_sha256') != digest(Path(workspace)/'screenplay.json'):
        return {'passed': False, 'errors': ['Check does not describe the current screenplay']}
    return check


def completed_voice(config, row, workspace):
    root = Path(config['root'])
    out = root/'voiced'/row['id']
    payload = read_json(out/'lab-payload.json')
    current = read_json(Path(workspace)/'screenplay.json')
    if payload and payload.get('script') == current and (out/'narration.wav').is_file() and (out/'timing.json').is_file():
        timing = read_json(out/'timing.json')
        if timing.get('voices') == {'teacher': row['teacher'], 'learner': CHAMP}:
            return {'voiced': True, 'reused_completed_voice': True, 'directory': str(out)}
    return None


def voice_film(config, row, workspace, secrets):
    reused = completed_voice(config, row, workspace)
    if reused:
        return reused
    root = Path(config['root'])
    out = root/'voiced'/row['id']
    current = read_json(Path(workspace)/'screenplay.json')
    quota = read_json(root/'voice-quota.json', {})
    if quota.get('reserve_stopped'):
        return {'voiced': False, 'blocked': True, 'error': '50,000-character reserve reached; voicing stopped'}
    result = heavy(config, 'voice-worker', row['id'], secrets)
    write_json(root/'films'/row['id']/'voice-run.json', result)
    payload = read_json(out/'lab-payload.json')
    timing = read_json(out/'timing.json', {})
    voiced = bool(payload and payload.get('script')==current and (out/'narration.wav').is_file()
                  and timing.get('voices')=={'teacher': row['teacher'], 'learner': CHAMP})
    return {'voiced': voiced, 'directory': str(out), 'wall_seconds': result['wall_seconds'],
            'blocked': not voiced and bool(read_json(root/'voice-quota.json', {}).get('reserve_stopped')),
            'check_passed': result['exit_code']==0,
            'error': None if result['exit_code']==0 else (result['stderr'][-3000:] or result['stdout'][-3000:])}


def ensure_renderer(config):
    root = Path(config['root'])
    frozen = root/'frozen-player'
    manifest = frozen/'manifest.json'
    if manifest.exists():
        saved = read_json(manifest)
        if digest(frozen/'index.html') != saved['index_sha256']:
            raise RuntimeError('Frozen player HTML changed')
        for entry in saved['assets']:
            if digest(frozen/entry['path']) != entry['sha256']:
                raise RuntimeError('Frozen player asset changed')
        return frozen
    source = Path(config['live_data']).parent
    if frozen.exists():
        subprocess.run(['trash', str(frozen)], check=True, capture_output=True)
    frozen.mkdir(parents=True)
    shutil.copyfile(source/'index.html', frozen/'index.html')
    shutil.copytree(source/'assets', frozen/'assets')
    assets = [{'path': str(p.relative_to(frozen)), 'sha256': digest(p)} for p in sorted((frozen/'assets').rglob('*')) if p.is_file()]
    expected = config.get('expected_player_js_sha256')
    if expected and expected not in {a['sha256'] for a in assets if a['path'].endswith('.js')}:
        raise RuntimeError('Installed player differs from the calibration renderer snapshot')
    write_json(manifest, {'frozen_at': now(), 'assets': assets, 'index_sha256': digest(frozen/'index.html')})
    return frozen


def capture_worker(config, items_path):
    if not os.environ.get('FILM_LAB_HEAVY'):
        raise RuntimeError('Browser captures require the heavy-command gate')
    root = Path(config['root'])
    renderer = ensure_renderer(config)
    env = clean_environment()
    env['FILM_LAB_HEAVY'] = '1'
    result = _run([config.get('node', 'node'), '--import', 'tsx', str(HERE/'capture.ts'),
                   '--items', str(items_path), '--url', config['player_url'], '--out', str(root/'boards'),
                   '--renderer', str(renderer)], Path(config['worktree'])/'amp', env)
    if result['exit_code']:
        raise RuntimeError(result['stderr'][-6000:] or result['stdout'][-6000:])
    for item in read_json(items_path):
        directory = root/'boards'/item['id']
        images = pages(directory/'board-wide', directory/'pages', 'wide')
        images += pages(directory/'board-tall', directory/'pages', 'tall', True)
        write_json(directory/'pages.json', images)
    return result


def _capture(config, items, label):
    path = Path(config['root'])/'capture-jobs'/(label+'.json')
    write_json(path, items)
    result = heavy(config, 'capture-worker', label, extra=('--items', str(path)))
    write_json(path.with_name(label+'-run.json'), result)
    if result['exit_code']:
        raise RuntimeError(result['stderr'][-6000:] or result['stdout'][-6000:])


def make_review_item(config, row, workspace, voiced=False):
    root = Path(config['root'])
    source = root/'voiced'/row['id'] if voiced else Path(workspace)/'check-output'/row['id']
    payload = read_json(source/'lab-payload.json')
    if not payload:
        raise RuntimeError('No checked film payload to review')
    facts = read_json(root/'facts'/(row['type']+'.json'))
    payload.update(problemType=row['type'], grade=facts['skill']['grade'],
                   skill=facts['skill']['id'], skillTitle=facts['skill']['title'],
                   standards=[s['code'] for s in facts['standards']])
    path = root/'films'/row['id']/'review-payload.json'
    write_json(path, payload)
    _capture(config, [{'id': row['id'], 'payload': str(path)}], row['id'])
    return {'id': row['id'], 'payload': str(path), 'images': read_json(root/'boards'/row['id']/'pages.json')}


def prepare_calibration(config):
    root = Path(config['root'])
    labels = read_json(root/'calibration-labels.json')['records']
    if len(labels) != 40:
        raise RuntimeError('Calibration requires the frozen 40 founder grades')
    mapping = read_json(root/'calibration-map.json', {})
    items, pending = [], []
    for record in labels:
        identifier = mapping.setdefault(record['id'], 'cal-'+hashlib.sha256((str(config['seed'])+':'+record['id']).encode()).hexdigest()[:16])
        source = root/'calibration-source'/(record['id']+'.json')
        if digest(source) != record['payload_sha256']:
            raise RuntimeError('Frozen graded payload changed: '+record['id'])
        raw = read_json(source)
        payload = {k: v for k, v in raw.items() if k in {'id', 'title', 'problemType', 'grade', 'skill', 'skillTitle', 'strand', 'standards', 'script', 'timing', 'figure'}}
        payload['id'] = identifier
        payload['script']['id'] = identifier
        destination = root/'calibration-blind'/(identifier+'.json')
        write_json(destination, payload)
        item = {'id': identifier, 'payload': str(destination)}
        page_list = root/'boards'/identifier/'pages.json'
        if not page_list.exists():
            pending.append(item)
        items.append(item)
    if len(set(mapping.values())) != len(mapping):
        raise RuntimeError('Calibration blind ID collision')
    write_json(root/'calibration-map.json', mapping)
    if pending:
        _capture(config, pending, 'calibration')
    for item in items:
        item['images'] = read_json(root/'boards'/item['id']/'pages.json')
    return items


def export_film(config, row, workspace):
    from live_export import export_film as export
    return export(config, row, workspace)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('mode', choices=('check', 'check-worker', 'voice-worker', 'capture-worker', 'export-worker'))
    parser.add_argument('--config', required=True)
    parser.add_argument('--id', required=True)
    parser.add_argument('--items')
    args = parser.parse_args()
    config = read_json(args.config)
    config['_config_path'] = str(Path(args.config).resolve())
    if args.mode == 'capture-worker':
        result = capture_worker(config, args.items)
    else:
        row = next(r for r in read_json(Path(config['root'])/'arms.json')['assignments'] if r['id']==args.id)
        workspace = workspace_for(config, args.id)
        if args.mode == 'check':
            result = check_film(config, row, workspace)
        elif args.mode == 'check-worker':
            result = check_worker(config, row, workspace)
        elif args.mode == 'export-worker':
            from live_export import export_worker
            result = export_worker(config, row, workspace)
        else:
            if not os.environ.get('FILM_LAB_HEAVY'):
                raise RuntimeError('Voicing requires the heavy-command gate')
            result = _make(config, row, workspace, voice=True)
    print(json.dumps(result, ensure_ascii=False), flush=True)
    if result.get('passed') is False or result.get('exit_code', 0):
        raise SystemExit(1)


if __name__ == '__main__':
    signal.signal(signal.SIGTERM, lambda *_: sys.exit(130))
    main()
