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
            raise RuntimeError('Shared app source changed since this film was prepared')


def fixed_file(path, content):
    path = Path(path)
    if path.exists() and path.read_text() != content:
        raise RuntimeError('An immutable workspace input changed: '+str(path))
    if not path.exists():
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(content)


def instrument_voice_retry(text):
    """A repeated acoustic fault may need the kit's third take.

    Only a repeated transcript mismatch supports the kit's existing early-stop
    assumption that another generated take will not help. Keep its three-take
    ceiling and all audio checks intact.
    """
    anchor = 'if (k > 0 && faults.some((f) => last.includes(gist(f)))) break;'
    if text.count(anchor) != 1:
        raise RuntimeError('Kit voice retry anchor changed; inspect the upstream policy')
    return text.replace(anchor,
        'if (k > 0 && faults.some((f) => /^at [\\d.]+ s the script says /.test(f) && last.includes(gist(f)))) break;')


def workspace_for(config, identifier):
    if not re.fullmatch(r'[a-z0-9]+(?:-[a-z0-9]+)*--[a-z0-9]+(?:-[a-z0-9]+)*', identifier):
        raise ValueError('Invalid film ID')
    path = (Path(config['workspace_root'])/identifier).resolve()
    boundary = Path(config['root'])/'workspace'
    if not path.is_relative_to(boundary.resolve()):
        raise ValueError('Authoring workspace is outside its configured authoring boundary')
    return path


def prepare_runtime(config, row, workspace):
    """Freeze executable kit mechanics independently of authoring instructions."""
    source = Path(config['worktree'])/'amp'
    kit = source/'film'
    verify_shared_source(config)
    manifest_path = Path(config['root'])/'films'/row['id']/'runtime-manifest.json'
    runtime = workspace/'runtime/amp'
    if not manifest_path.exists():
        (runtime/'film/lessons').mkdir(parents=True, exist_ok=True)
        entries = []
        sources = [p for p in kit.iterdir() if p.is_file() and p.suffix in ('.ts', '.tsx', '.css', '.html') and '.test.' not in p.name]
        # tsconfig.json travels too: without it the copied film/*.tsx compile with the classic JSX
        # runtime and a shot that mounts an app figure fails with "React is not defined".
        sources += [source/'browser-security.mjs', source/'package.json', source/'tsconfig.json']
        for path in sources:
            relative = path.relative_to(source)
            target = runtime/relative
            text = path.read_text()
            if path.name == 'voice.ts':
                text = instrument_voice_retry(text)
            if path.name == 'make.ts':
                anchor = 'const suffix = values.tall ? "-tall" : "";'
                if text.count(anchor) != 1:
                    raise RuntimeError('Kit payload snapshot anchor changed')
                snapshot = 'writeFileSync(join(OUT, "line-payload.json"), JSON.stringify({ id, title: script.title, script, timing, figure: lesson.example.figure ?? null, timing_source: values.dry ? "estimated" : "voice" }));'
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
        write_json(manifest_path, {'files': entries, 'voice_retry_policy': 'three takes; early stop only for repeated transcript mismatches',
            'instrumentation': 'JSON payload snapshot, local Vite access to shared links, and acoustic-fault retries within the existing three-take ceiling; kit checks unchanged.'})
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
            raise RuntimeError('Canonical kit changed since this film was prepared')
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
    env['FILM_LINE_HEAVY'] = '1'
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
    if voice:
        from prod_voice import migrate_voice_runtime
        migrate_voice_runtime(config,row,workspace)
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
        env.update(FILM_LINE_QUOTA_STATE=str(root/'voice-quota.json'),
                   FILM_LINE_VOICE_LEDGER=str(root/'voice-ledger.jsonl'), FILM_LINE_ID=row['id'])
        env['FILM_PROD_VOICE_REPAIR_CACHE'] = str(root/'voice-repairs'/row['id'])
        command += ['--import', str(HERE/'quota-hook.mjs')]
    command += ['--import', 'tsx', str(runtime/'film/make.ts'), row['id'],
                '--check' if voice else '--dry', '--res', '1080', '--out', str(out),
                '--voice', 'teacher='+row['teacher']]
    # a teacher-alone film has no learner role to bind a voice to
    if 'learner' in read_json(Path(workspace)/'screenplay.json').get('cast', {}):
        command += ['--voice', 'learner='+CHAMP]
    if tall:
        command += ['--tall']
    result = _run(command, runtime, env)
    result['report'] = _last_report(result['stdout'])
    return result


def _tile(source, destination, prefix, tall):
    """Tile a `%03d.jpg` sequence. Beat frames stay `000.jpg`; lit frames are a separate sequence."""
    source, destination = Path(source), Path(destination)
    frames = sorted(source.glob('[0-9][0-9][0-9].jpg'))
    if not frames:
        raise RuntimeError('No storyboard frames in '+str(source))
    destination.mkdir(parents=True, exist_ok=True)
    count, width, rows = (2, 540, 1) if tall else (4, 960, 2)
    outputs = []
    for start in range(0, len(frames), count):
        target = destination/f'{prefix}-{start//count+1:03}.jpg'
        filters = (f"scale={width}:-1,pad=iw:ih+40:0:40:color=white,"
                   f"drawtext=text='Frame %{{n}}':start_number={start}:x=12:y=6:fontsize=26:fontcolor=black,"
                   f"tile=2x{rows}:padding=6:color=white")
        subprocess.run(['ffmpeg', '-v', 'error', '-y', '-start_number', str(start), '-i', str(source/'%03d.jpg'),
                        '-vf', filters, '-frames:v', '1', '-q:v', '3', str(target)], check=True, capture_output=True)
        outputs.append(str(target))
    return outputs


def pages(raw, destination, prefix, tall=False):
    raw, destination = Path(raw), Path(destination)
    outputs = _tile(raw, destination, prefix, tall)
    lit = raw/'lit'
    # Lit frames keep their own names (020-full.jpg). Number a copy so the beat sequence stays 000.jpg.
    named = sorted(lit.glob('*.jpg')) if lit.is_dir() else []
    if named:
        import tempfile
        scratch = Path(tempfile.mkdtemp(prefix='film-lit-'))
        try:
            for index, frame in enumerate(named):
                (scratch/f'{index:03d}.jpg').symlink_to(frame)
            outputs += _tile(scratch, destination, prefix+'-lit', tall)
        finally:
            subprocess.run(['trash', str(scratch)], check=True, capture_output=True)
    return outputs


def validate_cast(path, identifier):
    script = read_json(path)
    if not script or script.get('id') != identifier:
        raise ValueError('Screenplay is missing or uses the wrong ID')
    cast = script.get('cast')
    # a teacher with a learner, or the teacher alone (films for older learners)
    if cast not in ({'teacher': {}, 'learner': {}}, {'teacher': {}}):
        raise ValueError('Use teacher and learner roles, or the teacher alone, with empty voice bindings')
    beats = [beat for shot in script.get('shots', []) for beat in shot.get('beats', [])]
    speakers = {beat.get('speaker') for beat in beats}
    if speakers != set(cast):
        raise ValueError('Every beat must name its speaker, and every role in the cast must speak')
    visible = script.get('title', '')+'\n'+'\n'.join(beat.get('say', '') for beat in beats)
    if re.search(r'\b(?:claude|fable|opus|sonnet|grok|astra|sol|study-opus|write-opus)\b', visible, re.I):
        raise ValueError('Remove model attribution from the visible screenplay')
    return script


def check_worker(config, row, workspace):
    if not os.environ.get('FILM_LINE_HEAVY'):
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
        from prod_runtime import capture_worker
        source = Path(workspace)/'check-output'/row['id']/'line-payload.json'
        payload = read_json(source)
        if not payload or payload.get('timing_source') != 'estimated' or payload.get('script') != read_json(Path(workspace)/'screenplay.json'):
            raise RuntimeError('No current estimated payload for installed-player authoring boards')
        identifier = row['id']+'-author'
        previous = Path(config['root'])/'boards'/identifier
        if previous.exists():
            subprocess.run(['trash',str(previous)],check=True,capture_output=True)
        job = Path(workspace)/'author-capture.json'
        write_json(job, [{'id':identifier, 'payload':str(source)}])
        capture_worker(config,job)
        target = Path(workspace)/'storyboards'
        target.mkdir(parents=True,exist_ok=True)
        for name in read_json(Path(config['root'])/'boards'/identifier/'pages.json'):
            destination = target/Path(name).name
            shutil.copyfile(name,destination)
            captures.append(str(destination))
    except Exception as error:
        errors.append(str(error))
    result = {'passed': not errors, 'errors': errors, 'storyboard_pages': captures, 'notes': [], 'checked_at': now(),
              'screenplay_sha256': digest(Path(workspace)/'screenplay.json') if (Path(workspace)/'screenplay.json').is_file() else None}
    from review_notes import mechanical_notes
    payload = read_json(Path(workspace)/'check-output'/row['id']/'line-payload.json')
    if payload and payload.get('script') == read_json(Path(workspace)/'screenplay.json'):
        try:
            result.update(mechanical_notes(payload), timing_source=payload.get('timing_source', 'estimated'))
        except (KeyError, ValueError, IndexError, TypeError):
            result['note_limits'] = ['Mechanical notes unavailable: screenplay or word timing is incomplete.']
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
    payload = read_json(out/'line-payload.json')
    current = read_json(Path(workspace)/'screenplay.json')
    run = read_json(root/'films'/row['id']/'voice-run.json', {})
    if run.get('exit_code') == 0 and payload and payload.get('script') == current and (out/'narration.wav').is_file() and (out/'timing.json').is_file():
        timing = read_json(out/'timing.json')
        if timing.get('voices') == {'teacher': row['teacher'], 'learner': CHAMP}:
            return {'voiced': True, 'check_passed': True, 'reused_completed_voice': True, 'directory': str(out)}
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
    payload = read_json(out/'line-payload.json')
    timing = read_json(out/'timing.json', {})
    voiced = bool(payload and payload.get('script')==current and (out/'narration.wav').is_file()
                  and timing.get('voices')=={'teacher': row['teacher'], 'learner': CHAMP})
    return {'voiced': voiced, 'directory': str(out), 'wall_seconds': result['wall_seconds'],
            'blocked': not voiced and bool(read_json(root/'voice-quota.json', {}).get('reserve_stopped')),
            'check_passed': result['exit_code']==0,
            'error': None if result['exit_code']==0 else (result['stderr'][-3000:] or result['stdout'][-3000:])}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('mode', choices=('check', 'check-worker', 'voice-worker', 'export-worker'))
    parser.add_argument('--config', required=True)
    parser.add_argument('--id', required=True)
    parser.add_argument('--items')
    args = parser.parse_args()
    config = read_json(args.config)
    config['_config_path'] = str(Path(args.config).resolve())
    row = config['film']
    if row['id'] != args.id:
        raise ValueError('Film ID does not match its configuration')
    workspace = workspace_for(config, args.id)
    if args.mode == 'check':
        result = check_film(config, row, workspace)
    elif args.mode == 'check-worker':
        result = check_worker(config, row, workspace)
    elif args.mode == 'export-worker':
        from prod_runtime import export_worker
        result = export_worker(config, row, workspace)
    else:
        if not os.environ.get('FILM_LINE_HEAVY'):
            raise RuntimeError('Voicing requires the heavy-command gate')
        result = _make(config, row, workspace, voice=True)
    print(json.dumps(result, ensure_ascii=False), flush=True)
    if result.get('passed') is False or result.get('exit_code', 0):
        raise SystemExit(1)


if __name__ == '__main__':
    signal.signal(signal.SIGTERM, lambda *_: sys.exit(130))
    main()
