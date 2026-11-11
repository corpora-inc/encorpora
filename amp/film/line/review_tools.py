"""Private reviewer folders, generated without authors, narration or review writes."""
import argparse
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
from urllib.parse import urljoin

from providers import clean_environment, write_json
from runtime import HERE, _run, digest, workspace_for
from state import read_json
from review_notes import mechanical_notes, moments, script_text


def checked_payload(local, workspace):
    script = read_json(workspace/'screenplay.json')
    identifier = local['film']['id']
    voiced = Path(local['root'])/'voiced'/identifier/'line-payload.json'
    dry = workspace/'check-output'/identifier/'line-payload.json'
    for path in (voiced, dry):
        payload = read_json(path)
        if payload and payload.get('script') == script:
            # A failed voice run must not masquerade as checked voiced timing.
            if path == voiced and read_json(Path(local['root'])/'films'/identifier/'voice-run.json', {}).get('exit_code') != 0:
                continue
            return path, payload
    raise ValueError('No checked timing for the current screenplay; run look to recheck it')


def tile_sheets(frames, metadata, destination, prefix, *, tall=False):
    """Twelve labeled tiles per page, keeping every frame, including singletons."""
    destination.mkdir(parents=True, exist_ok=True)
    outputs = []
    width = 360 if tall else 640
    for start in range(0, len(frames), 12):
        chunk = frames[start:start+12]
        command = ['ffmpeg', '-v', 'error', '-y', '-filter_complex_threads', '1']
        filters = []
        for i, path in enumerate(chunk):
            command += ['-i', str(path)]
            mark = metadata[start+i]
            label = (f"S{mark['shot']} B{mark['beat']} " if 'shot' in mark else '') + f"{mark['time']:.2f}s"
            filters.append(f"[{i}:v]scale={width}:-1,pad=iw:ih+36:0:36:color=white,drawtext=text='{label}':x=10:y=6:fontsize=22:fontcolor=black[v{i}]")
        if len(chunk) == 1:
            result = '[v0]'
        else:
            # Dimensions are identical within a layout. xstack supports h0
            # expressions, so screenshots of full review pages keep their ratio.
            layout = '|'.join(f'{(i%3)*(width+6)}_'+('0' if i < 3 else '+'.join(['h0+6']*(i//3))) for i in range(len(chunk)))
            filters.append(''.join(f'[v{i}]' for i in range(len(chunk)))+f'xstack=inputs={len(chunk)}:layout={layout}:fill=white[out]')
            result = '[out]'
        output = destination/f'{prefix}-{start//12+1:03}.jpg'
        command += ['-filter_complex', ';'.join(filters), '-map', result, '-frames:v', '1', '-q:v', '3', str(output)]
        subprocess.run(command, check=True, capture_output=True)
        outputs.append(str(output))
    return outputs


def worker(local, mode):
    env = clean_environment(); env['FILM_LINE_HEAVY'] = '1'
    result = _run([local['heavy'], sys.executable, str(HERE/'review_tools.py'), mode,
                   '--config', local['_config_path']], local['worktree'], env)
    if result['exit_code']:
        raise RuntimeError(result['stderr'][-6000:] or result['stdout'][-6000:])


def look_film(config, identifier):
    from line import existing_film, recheck
    root, local, recipe, workspace = existing_film(config, identifier)
    check = read_json(workspace/'check.json', {})
    if not check.get('passed') or check.get('screenplay_sha256') != digest(workspace/'screenplay.json'):
        recheck(local, recipe, workspace)
    worker(local, 'look')
    return root/'look/look.json'


def look_worker(local):
    root = Path(local['root']); workspace = workspace_for(local, local['film']['id'])
    source, payload = checked_payload(local, workspace)
    marks = moments(payload)
    out = root/'look'
    if out.exists():
        subprocess.run(['trash', str(out)], check=True, capture_output=True)
    out.mkdir(parents=True)
    (out/'script.txt').write_text(script_text(payload))
    notes = mechanical_notes(payload)
    report = {'screenplay_sha256': digest(workspace/'screenplay.json'), 'payload_sha256': digest(source),
              'timing_source': payload.get('timing_source', 'voice' if 'voiced' in source.parts else 'estimated'),
              'script': str(out/'script.txt'), 'sheets': {}, 'moments': marks, **notes}
    jobs = []
    cached = {}
    for kind, times in marks.items():
        if not times:
            continue
        # Newer kits can supply held highlights directly. Only use a complete
        # set generated with this payload; otherwise capture the installed player.
        if kind == 'lit':
            for layout, folder in (('wide', 'board'), ('tall', 'board-tall')):
                files = sorted((source.parent/folder/'lit').glob('*.jpg'))
                if len(files) == len(times) and all(p.stat().st_mtime >= source.stat().st_mtime for p in files):
                    cached[layout] = files
        if kind != 'lit' or len(cached) != 2:
            jobs.append({'id': local['film']['id']+'-'+kind, 'payload': str(source), 'times': [m['time'] for m in times]})
    if jobs:
        job_path = out/'captures.json'; write_json(job_path, jobs)
        env = clean_environment(); env['FILM_LINE_HEAVY'] = '1'
        result = _run([local.get('node', 'node'), '--import', 'tsx', str(HERE/'capture.ts'),
            '--items', str(job_path), '--url', local['player_url'], '--out', str(out/'frames')],
            Path(local['worktree'])/'amp', env)
        if result['exit_code']:
            raise RuntimeError(result['stderr'][-6000:] or result['stdout'][-6000:])
    for kind, times in marks.items():
        for layout in ('wide', 'tall'):
            files = cached.get(layout) if kind == 'lit' else None
            if files:
                target = out/'frames'/('cached-lit-'+layout); target.mkdir(parents=True)
                copied = []
                for n, file in enumerate(files):
                    dest = target/f'{n:03}.jpg'; shutil.copyfile(file, dest); copied.append(dest)
                files = copied
            else:
                files = sorted((out/'frames'/(local['film']['id']+'-'+kind)/('board-'+layout)).glob('*.jpg'))
            if len(files) != len(times):
                raise RuntimeError('Missing '+kind+' frames in '+layout)
            report['sheets'][kind+'-'+layout] = tile_sheets(files, times, out, kind+'-'+layout, tall=layout=='tall')
    for path in (workspace/'check.json', root/'films'/local['film']['id']/'check.json'):
        check = read_json(path, {})
        write_json(path, {**check, **notes, 'timing_source': report['timing_source']})
    write_json(out/'look.json', report)
    return report


def play_film(config, identifier):
    from line import existing_film
    root, local, _, workspace = existing_film(config, identifier)
    receipt = read_json(root/'films'/identifier/'export.json', {})
    data = Path(config['live_data'])
    for suffix, key in (('.json', 'json_sha256'), ('.m4a', 'audio_sha256')):
        path = data/(identifier+suffix)
        if not path.is_file() or receipt.get(key) != digest(path):
            raise ValueError('Run export for this film before play')
    payload = read_json(data/(identifier+'.json'))
    current = read_json(workspace/'screenplay.json')
    if {**payload['script'], 'cast': current['cast']} != current:
        raise ValueError('Export the current screenplay before play')
    worker(local, 'play')
    return root/'look/play.json'


def play_worker(local):
    root = Path(local['root']); identifier = local['film']['id']
    out = root/'look'; out.mkdir(parents=True, exist_ok=True)
    payload = read_json(Path(local['live_data'])/(identifier+'.json'))
    marks = moments(payload)
    ends = marks['beats']; step = max(1, len(ends)//8)
    times = sorted({m['time'] for m in marks['lit']+ends[::step][:8]})
    job = {'url': urljoin(local['review_url'], 'review.html?id='+identifier+'&list=line'),
           'times': times, 'out': str(out/'played-frames')}
    write_json(out/'play-job.json', job)
    env = clean_environment(); env['FILM_LINE_HEAVY'] = '1'
    result = _run([local.get('node', 'node'), '--import', 'tsx', str(HERE/'play.ts'), str(out/'play-job.json')],
                  Path(local['worktree'])/'amp', env)
    if result['exit_code']:
        raise RuntimeError(result['stderr'][-6000:] or result['stdout'][-6000:])
    report = read_json(out/'played-frames/play.json')
    for layout in report['layouts']:
        layout['sheets'] = tile_sheets([Path(f['path']) for f in layout['frames']], layout['frames'],
                                      out, 'played-'+layout['name'], tall=layout['name']=='phone')
    report['payload_sha256'] = digest(Path(local['live_data'])/(identifier+'.json'))
    report['audio_observation'] = 'Playback requires advancing, unmuted audio with decoded data; browser automation cannot verify speaker output.'
    write_json(out/'play.json', report)
    look = read_json(out/'look.json', {})
    look['play'] = report
    write_json(out/'look.json', look)
    return report


if __name__ == '__main__':
    parser = argparse.ArgumentParser(); parser.add_argument('mode', choices=('look', 'play')); parser.add_argument('--config', required=True)
    args = parser.parse_args()
    if not os.environ.get('FILM_LINE_HEAVY'):
        raise RuntimeError('Review captures require the heavy-command gate')
    local = read_json(args.config)
    print(json.dumps((look_worker if args.mode == 'look' else play_worker)(local)))
