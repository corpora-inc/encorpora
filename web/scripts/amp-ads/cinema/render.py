"""Render an ad spec: centered text cards -> ducked, loudness-normalised mix ->
one video per format -> QC. Every artifact gets a receipt (exact argv, input
and output SHA-256) and is reused only when its recipe is unchanged."""
import datetime
import hashlib
import json
import os
import re
import shutil
import subprocess
from pathlib import Path

from . import graph
from .spec import FORMATS, SpecError, media_path, shot_source, size, text_area, text_box_problems

HERE = Path(__file__).resolve().parent


def run(args, **kw):
    r = subprocess.run([str(a) for a in args], capture_output=True, text=True, **kw)
    if r.returncode:
        raise RuntimeError(f'{args[0]} failed ({r.returncode}):\n{r.stderr[-3000:]}')
    return r


def sha(path):
    h = hashlib.sha256()
    with open(path, 'rb') as f:
        for chunk in iter(lambda: f.read(1 << 20), b''):
            h.update(chunk)
    return h.hexdigest()


def write_json(path, data):
    tmp = Path(str(path) + '.tmp')
    tmp.write_text(json.dumps(data, indent=2, default=str) + '\n')
    tmp.replace(path)


def stamp():
    return datetime.datetime.now(datetime.timezone.utc).isoformat(timespec='seconds')


def probe(path):
    return json.loads(run(['ffprobe', '-v', 'error', '-show_streams', '-show_format', '-of', 'json', path]).stdout)


def loudness(path, offset=None, duration=None):
    """EBU R128 measurement (loudnorm first pass, targets matching the second pass)."""
    a = ['ffmpeg', '-hide_banner', '-nostdin']
    if offset:
        a += ['-ss', str(offset)]
    if duration:
        a += ['-t', str(duration)]
    a += ['-i', path, '-vn', '-af',
          f'loudnorm=I={graph.TARGET_LUFS}:TP={graph.TARGET_TP}:LRA=11:print_format=json', '-f', 'null', '-']
    err = run(a).stderr
    return json.loads(err[err.rfind('{'):err.rfind('}') + 1])


def ink_box(png):
    """Bounding box of every visible (alpha > ~10%) pixel, measured by FFmpeg."""
    err = run(['ffmpeg', '-hide_banner', '-nostdin', '-v', 'info', '-i', png,
               '-vf', 'alphaextract,bbox=min_val=24', '-f', 'null', '-']).stderr
    found = re.findall(r'x1:(\d+) x2:(\d+) y1:(\d+) y2:(\d+)', err)
    if not found:
        return None
    x1, x2, y1, y2 = map(int, found[-1])
    return (x1, y1, x2 + 1, y2 + 1)


def check_card(fmt, png, frame):
    box = ink_box(png)
    problems = ['card has no visible text'] if box is None else text_box_problems(fmt, box, frame)
    if problems:
        raise SpecError(f'{png.name} breaks the centered-text rule: ' + '; '.join(problems))
    return box


class Outputs:
    """Reuse an artifact only when its recipe matches; otherwise refuse, or with
    replace=True move the old files to superseded/<time>/ (never delete)."""

    def __init__(self, root, replace=False):
        self.root, self.replace = Path(root), replace
        self.root.mkdir(parents=True, exist_ok=True)

    def fresh(self, receipt, recipe, *files):
        recipe = json.loads(json.dumps(recipe, default=str))  # compare as stored (tuples -> lists)
        files = [Path(f) for f in files]
        if receipt.exists() and all(f.exists() for f in files):
            saved = json.loads(receipt.read_text())
            if saved.get('recipe') == recipe and all(saved.get('sha256', {}).get(f.name) == sha(f) for f in files):
                return False
        existing = [p for p in [receipt, *files] if p.exists()]
        if existing:
            if not self.replace:
                raise SpecError(f'{existing[0]} exists with different inputs; rerun with --replace '
                                '(old files move to superseded/) or use a new ad id')
            dest = self.root / 'superseded' / stamp().replace(':', '')
            dest.mkdir(parents=True, exist_ok=True)
            for p in existing:
                shutil.move(str(p), dest / p.name)
        return True

    @staticmethod
    def record(receipt, recipe, files, **extra):
        write_json(receipt, {'recipe': recipe, 'sha256': {Path(f).name: sha(f) for f in files},
                             'at': stamp(), **extra})


def cards(spec, fmt, name, frame, out, outputs):
    """Render (or reuse) this format's text cards; gate every one through the
    pixel-measured safe-zone check before it can reach a video."""
    d = out / 'cards'
    d.mkdir(exist_ok=True)
    area = text_area(fmt, frame)
    items = [{'name': f'{name}-card-{i}', 'kind': 'card', 'text': c['text']} for i, c in enumerate(spec['cards'])]
    e = spec['endCard']
    items.append({'name': f'{name}-end', 'kind': 'end', **{k: e[k] for k in ('brand', 'tagline', 'cta', 'url')}})
    for it in items:
        it.update(width=frame[0], height=frame[1], area=list(area),
                  out=str(d / f'{it["name"]}.png'), textOut=str(d / f'{it["name"]}.text.png'))
    receipt = d / f'{name}-cards.json'
    builder = HERE / 'cards.mjs'
    recipe = {'items': [{k: v for k, v in it.items() if k not in ('out', 'textOut')} for it in items],
              'builderSha256': sha(builder), 'safe': FORMATS[fmt]['safe']}
    files = [p for it in items for p in (it['out'], it['textOut'])]
    if outputs.fresh(receipt, recipe, *files):
        job = d / f'{name}-job.json'
        job.write_text(json.dumps({'items': items}))
        layout = json.loads(run(['node', builder, job], cwd=HERE.parent).stdout)
        job.unlink()
        boxes = {it['name']: check_card(fmt, Path(it['textOut']), frame) for it in items}
        outputs.record(receipt, recipe, files, layout=layout, inkBoxes=boxes)
    else:  # re-check: the gate runs on every render, not only the first
        for it in items:
            check_card(fmt, Path(it['textOut']), frame)
    pngs = [Path(it['out']) for it in items]
    timed = [(pngs[i], c['start'], c['end']) for i, c in enumerate(spec['cards'])]
    return timed, pngs[-1]


def audio(spec, out, outputs):
    v, m = spec.get('voice'), spec.get('music')
    voice = media_path(spec, v['take']) if v else None
    music = media_path(spec, m['path']) if m else None
    sfx = [media_path(spec, fx['path']) for fx in spec['sfx']]
    for p in [voice, music, *sfx]:
        if p and not p.is_file():
            raise SpecError(f'missing audio input {p}')
    total = spec['duration']
    took = float(probe(voice)['format']['duration']) if voice else None
    # Every placed piece must really be as long as the timeline assumes, or the mix ends early.
    for seg in (v or {}).get('segments') or []:
        if seg['to'] > took + 0.02:
            raise SpecError(f'voice segment ends at {seg["to"]}s but the take is only {took:.2f}s')
    if music and float(probe(music)['format']['duration']) - m['offset'] < total - 0.02:
        raise SpecError('the music track ends before the ad: lower music.offset or pick a longer track')
    if voice and not v.get('segments'):
        if v['start'] + took > total - 0.3:
            raise SpecError(f'voice take is {took:.2f}s; it must finish 0.3s before the end '
                            '(trim pauses with voice.segments or lengthen the ad)')
    premix, mix, receipt = out / 'premix.wav', out / 'mix.m4a', out / 'audio-receipt.json'
    recipe = {'voice': v and {**v, 'sha256': sha(voice)}, 'music': m and {**m, 'sha256': sha(music)},
              'sfx': [{**fx, 'sha256': sha(p)} for fx, p in zip(spec['sfx'], sfx)], 'duration': total,
              'graphSha256': sha(HERE / 'graph.py')}
    if not outputs.fresh(receipt, recipe, mix):
        return mix
    voice_gain = graph.VOICE_LUFS - float(loudness(voice)['input_i']) if voice else 0.0
    music_gain = (m['lufs'] - float(loudness(music, m['offset'], total)['input_i'])) if music else 0.0
    if premix.exists():
        premix.unlink()
    sfx_seconds = [float(probe(p)['format']['duration']) for p in sfx]
    pre_args = graph.premix_command(spec, voice, music, sfx, voice_gain, music_gain, premix, took, sfx_seconds)
    run(pre_args)
    measured = loudness(premix)
    final_args = graph.loudnorm_command(premix, measured, mix)
    run(final_args)
    result = loudness(mix)
    premix.unlink()
    outputs.record(receipt, recipe, [mix], voiceGainDb=round(voice_gain, 2), musicGainDb=round(music_gain, 2),
                   ducking=graph.DUCK if voice and music else None, premixCommand=pre_args,
                   loudnormCommand=final_args, measuredPremix=measured, measured=result,
                   transcriptVerified=bool(v and v['transcriptVerified']))
    captions(spec, out)
    return mix


def captions(spec, out):
    segs = (spec.get('voice') or {}).get('segments') or []
    if not segs or not all(s.get('text') for s in segs):
        return

    def ts(x):
        ms = round(x * 1000)
        return f'{ms // 3600000:02d}:{ms // 60000 % 60:02d}:{ms // 1000 % 60:02d}.{ms % 1000:03d}'
    cues = [f'{ts(s["at"])} --> {ts(s["at"] + s["to"] - s["from"])}\n{s["text"]}' for s in segs]
    (out / 'captions.vtt').write_text('WEBVTT\n\n' + '\n\n'.join(cues) + '\n')


def qc(spec, fmt, path, frame, contact):
    total = spec['duration']
    meta = probe(path)
    video = next(s for s in meta['streams'] if s['codec_type'] == 'video')
    sound = [s for s in meta['streams'] if s['codec_type'] == 'audio']
    decode = subprocess.run(['ffmpeg', '-v', 'error', '-nostdin', '-i', str(path), '-f', 'null', '-'],
                            capture_output=True, text=True)
    err = run(['ffmpeg', '-hide_banner', '-nostdin', '-i', path,
               '-vf', f'blackdetect=d={spec["qc"]["maxBlackSeconds"]}:pix_th=0.06',
               '-af', f'loudnorm=I={graph.TARGET_LUFS}:TP={graph.TARGET_TP}:LRA=11:print_format=json',
               '-f', 'null', '-']).stderr
    black = [{'start': float(a), 'end': float(b)} for a, b in re.findall(r'black_start:([\d.]+) black_end:([\d.]+)', err)]
    loud = json.loads(err[err.rfind('{'):err.rfind('}') + 1])
    duration = float(meta['format']['duration'])
    checks = {
        'dimensions': [video['width'], video['height']] == list(frame),
        'duration': abs(duration - total) <= 0.1 and bool(sound) and abs(float(sound[0]['duration']) - total) <= 0.1,
        'audioPresent': bool(sound) and int(sound[0]['sample_rate']) == 48000 and float(loud['input_i']) > -30,
        'loudness': -15.5 <= float(loud['input_i']) <= -12.5,
        'truePeak': float(loud['input_tp']) <= -1.0,
        'noBlackFrames': not black,
        'decodesCleanly': decode.returncode == 0 and not decode.stderr.strip(),
    }
    run(['ffmpeg', '-hide_banner', '-nostdin', '-y', '-i', path, '-vf',
         f'fps={8 / total:.6f},scale=360:-2,tile=4x2', '-frames:v', '1', '-q:v', '3', contact])
    return {'passed': all(checks.values()), 'checks': checks, 'durationSeconds': duration,
            'integratedLufs': float(loud['input_i']), 'truePeakDbtp': float(loud['input_tp']),
            'blackIntervals': black, 'decodeErrors': decode.stderr[-800:]}


def render(spec, out_root, formats=None, master=False, divisor=1, replace=False):
    out = Path(out_root) / spec['id']
    outputs = Outputs(out, replace)
    encoder = os.environ.get('AMP_VIDEO_ENCODER', 'libx264')
    preset = os.environ.get('AMP_X264_PRESET', 'slow')
    mix = audio(spec, out, outputs)
    results = {}
    for fmt in formats or spec['formats']:
        if fmt not in spec['formats']:
            raise SpecError(f'{fmt} is not enabled in this spec')
        frame = size(fmt, master, divisor)
        name = f'{fmt}-4k' if master else fmt
        timed, end_png = cards(spec, fmt, name, frame, out, outputs)
        sources = [shot_source(spec, s, fmt) for s in spec['shots']]
        for p in sources:
            if not p.is_file():
                raise SpecError(f'missing shot source {p}')
        video, receipt, contact = out / f'{name}.mp4', out / f'{name}-receipt.json', out / f'{name}-contact.jpg'
        args = graph.video_command(spec, frame, sources, timed, end_png, mix, video, encoder, preset)
        recipe = {'args': args, 'inputs': {str(p): sha(p) for p in [*sources, *(c[0] for c in timed), end_png, mix]}}
        if outputs.fresh(receipt, recipe, video):
            run(args)
            report = qc(spec, fmt, video, frame, contact)
            v = spec.get('voice') or {}
            status = 'failed-qc' if not report['passed'] else (
                'needs-voice-check' if v and not v['transcriptVerified'] else 'ready-for-review')
            outputs.record(receipt, recipe, [video], status=status, format=fmt, aspect=FORMATS[fmt]['aspect'],
                           dimensions=list(frame), title=spec.get('title'), script=v.get('script'),
                           voice=v.get('voice'), music=(spec.get('music') or {}).get('title'),
                           generatedMedia=spec.get('generatedMedia', True), qc=report,
                           publicationApproved=False)
        saved = json.loads(receipt.read_text())
        results[fmt] = {'file': str(video), 'status': saved['status'], 'qc': saved['qc']['checks']}
        if saved['status'] == 'failed-qc':
            raise SpecError(f'{video.name} failed QC: ' +
                            ', '.join(k for k, ok in saved['qc']['checks'].items() if not ok))
    return results
