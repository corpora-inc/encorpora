"""Ad spec loading, validation, timeline and the centered-text safe-zone rule.

Pure Python, no I/O beyond reading the spec, so every rule here is unit tested.
"""
import json
import math
import os
import re
from pathlib import Path

# Delivery formats. `orientation` picks the generated source (portrait or wide)
# when a shot source uses the `{orientation}` placeholder. `safe` is the area
# that platform chrome leaves clear: (top, right, bottom, left) as fractions.
#   9:16  Reels/Shorts/TikTok: header top ~15%, caption + CTA bottom ~25%,
#         action rail right ~15%.
#   4:5, 1:1  Feed: lighter chrome, but captions and buttons still overlay edges.
#   16:9  YouTube: title bar top, scrubber and controls bottom.
FORMATS = {
    'portrait': {'size': (1080, 1920), 'aspect': '9:16', 'orientation': 'portrait',
                 'safe': (0.15, 0.15, 0.25, 0.06)},
    'feed': {'size': (1080, 1350), 'aspect': '4:5', 'orientation': 'portrait',
             'safe': (0.10, 0.08, 0.15, 0.08)},
    'square': {'size': (1080, 1080), 'aspect': '1:1', 'orientation': 'wide',
               'safe': (0.10, 0.08, 0.15, 0.08)},
    'wide': {'size': (1920, 1080), 'aspect': '16:9', 'orientation': 'wide',
             'safe': (0.12, 0.08, 0.20, 0.08)},
}
# A text box's centre may sit at most this fraction of the frame from the frame centre.
CENTER_TOLERANCE = 0.03
XFADE = {'fade', 'dissolve', 'fadeblack', 'fadewhite', 'smoothleft', 'smoothright',
         'smoothup', 'smoothdown', 'circleopen', 'circleclose', 'radial', 'hblur',
         'zoomin', 'wipeleft', 'wiperight', 'slideleft', 'slideright'}
FPS = {24, 25, 30}
MAX_CARD_WORDS = 10
MAX_CARD_CHARS = 60
SLUG = re.compile(r'^[a-z0-9][a-z0-9-]*$')


class SpecError(ValueError):
    pass


def size(fmt, master=False, divisor=1):
    """Frame size for a format; 4K masters double it, `divisor` shrinks for smoke tests."""
    w, h = FORMATS[fmt]['size']
    k = 2 if master else 1
    return (max(2, (w * k // divisor) // 2 * 2), max(2, (h * k // divisor) // 2 * 2))


def text_box_problems(fmt, box, frame):
    """Return why a text box breaks the centered-text rule (empty list = allowed).

    box = (x1, y1, x2, y2) in pixels, frame = (width, height). The box must lie
    inside the format's safe area AND be centred on the frame both ways. Text is
    never placed at the top or bottom, where platform overlays hide it.
    """
    w, h = frame
    x1, y1, x2, y2 = box
    top, right, bottom, left = FORMATS[fmt]['safe']
    problems = []
    if x2 <= x1 or y2 <= y1:
        return ['empty text box']
    if y1 < top * h:
        problems.append(f'text enters the top {top:.0%} (y1={y1} < {top * h:.0f})')
    if y2 > (1 - bottom) * h:
        problems.append(f'text enters the bottom {bottom:.0%} (y2={y2} > {(1 - bottom) * h:.0f})')
    if x1 < left * w:
        problems.append(f'text enters the left {left:.0%}')
    if x2 > (1 - right) * w:
        problems.append(f'text enters the right {right:.0%}')
    cx, cy = (x1 + x2) / 2, (y1 + y2) / 2
    if abs(cx - w / 2) > CENTER_TOLERANCE * w:
        problems.append(f'text is not horizontally centered (center x={cx:.0f}, frame {w / 2:.0f})')
    if abs(cy - h / 2) > CENTER_TOLERANCE * h:
        problems.append(f'text is not vertically centered (center y={cy:.0f}, frame {h / 2:.0f})')
    return problems


def text_area(fmt, frame):
    """Largest frame-centred box inside the safe area: (width, height) in pixels."""
    w, h = frame
    top, right, bottom, left = FORMATS[fmt]['safe']
    return (math.floor(w * (1 - 2 * max(left, right))), math.floor(h * (1 - 2 * max(top, bottom))))


def _num(value, name, low=None, high=None):
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        raise SpecError(f'{name} must be a number')
    if (low is not None and value < low) or (high is not None and value > high):
        raise SpecError(f'{name} must be between {low} and {high}')
    return float(value)


def _path(base, raw, fmt=None):
    text = str(raw)
    if fmt:
        text = text.replace('{format}', fmt).replace('{orientation}', FORMATS[fmt]['orientation'])
    text = os.path.expanduser(os.path.expandvars(text))
    if '$' in text:
        raise SpecError(f'unset environment variable in path {raw!r} (see README: AMP_MEDIA_ROOT, AMP_MUSIC_POOL)')
    p = Path(text)
    return p if p.is_absolute() else (base / p)


def shot_source(spec, shot, fmt):
    """Resolve a shot's source for one format: a string (with optional
    `{format}`/`{orientation}` placeholders) or a map keyed by format,
    orientation or `default`."""
    src = shot['source']
    if isinstance(src, dict):
        for key in (fmt, FORMATS[fmt]['orientation'], 'default'):
            if key in src:
                src = src[key]
                break
        else:
            raise SpecError(f'shot {shot["id"]} has no source for {fmt}')
    return _path(spec['_base'], src, fmt)


def media_path(spec, raw):
    return _path(spec['_base'], raw)


def timeline(spec):
    """Per-shot edit timing. Adjacent shots overlap by their transition, split
    evenly around the nominal cut, so total length equals the sum of durations."""
    fps = spec['fps']
    shots = spec['shots']
    out, clock = [], 0.0
    for i, shot in enumerate(shots):
        before = _transition_seconds(shots[i - 1], fps) / 2 if i else 0.0
        after = _transition_seconds(shot, fps) / 2 if i < len(shots) - 1 else 0.0
        render = shot['duration'] + before + after
        span = shot['out'] - shot['in']
        out.append({
            'id': shot['id'], 'nominalStart': round(clock, 6), 'nominalEnd': round(clock + shot['duration'], 6),
            'outputStart': round(clock - before, 6), 'renderDuration': round(render, 6),
            'speed': round(span / render, 6) if shot.get('retime', True) else 1.0,
        })
        clock += shot['duration']
    return out


def _transition_seconds(shot, fps):
    t = shot.get('transition') or {'type': 'cut'}
    return 1 / fps if t['type'] == 'cut' else t['duration']


def load(path):
    path = Path(path).resolve()
    spec = json.loads(path.read_text())
    spec['_base'] = path.parent
    spec['_path'] = path
    return validate(spec)


def validate(spec):
    """Check structure and editorial rules; fill defaults. Raises SpecError."""
    if spec.get('schema', 1) != 1:
        raise SpecError('unsupported schema version')
    if not SLUG.match(str(spec.get('id', ''))):
        raise SpecError('id must be a lowercase slug, e.g. 01-when-it-clicks')
    spec.setdefault('_base', Path.cwd())
    duration = _num(spec.get('duration'), 'duration', 5, 60)
    spec['duration'] = duration
    spec['fps'] = spec.get('fps', 24)
    if spec['fps'] not in FPS:
        raise SpecError(f'fps must be one of {sorted(FPS)}')
    formats = spec.get('formats')
    if not formats or not isinstance(formats, list) or any(f not in FORMATS for f in formats) \
            or len(set(formats)) != len(formats):
        raise SpecError(f'formats must be a list drawn from {sorted(FORMATS)}')

    shots = spec.get('shots')
    if not isinstance(shots, list) or not shots:
        raise SpecError('shots must be a non-empty list')
    ids = set()
    for i, shot in enumerate(shots):
        name = f'shots[{i}]'
        if not SLUG.match(str(shot.get('id', ''))) or shot['id'] in ids:
            raise SpecError(f'{name}.id must be a unique lowercase slug')
        ids.add(shot['id'])
        if not isinstance(shot.get('source'), (str, dict)):
            raise SpecError(f'{name}.source must be a path or a map of paths')
        shot['in'] = _num(shot.get('in', 0), f'{name}.in', 0)
        shot['out'] = _num(shot.get('out'), f'{name}.out', 0)
        if shot['out'] <= shot['in']:
            raise SpecError(f'{name}.out must be after in')
        shot['duration'] = _num(shot.get('duration'), f'{name}.duration', 0.2, 60)
        shot.setdefault('fit', 'cover')
        if shot['fit'] not in ('cover', 'contain'):
            raise SpecError(f'{name}.fit must be cover (crop) or contain (letterbox, for product UI)')
        t = shot.get('transition')
        if t is not None:
            if i == len(shots) - 1:
                raise SpecError('the last shot cannot have a transition')
            if t.get('type') != 'cut' and t.get('type') not in XFADE:
                raise SpecError(f'{name}.transition.type must be cut or one of {sorted(XFADE)}')
            if t['type'] != 'cut':
                d = _num(t.get('duration'), f'{name}.transition.duration', 0.04, 2)
                if d > min(shot['duration'], shots[i + 1].get('duration', 0)) / 2:
                    raise SpecError(f'{name}.transition is longer than half an adjacent shot')
    total = sum(s['duration'] for s in shots)
    if abs(total - duration) > 0.001:
        raise SpecError(f'shot durations sum to {total:g}s, not the ad duration {duration:g}s')
    for i, t in enumerate(timeline(spec)):
        if shots[i].get('retime', True) and not 0.4 <= t['speed'] <= 2.5:
            raise SpecError(f'shots[{i}] would play at {t["speed"]:.2f}x; pick in/out closer to its duration '
                            'or set "retime": false to hold the last frame')

    end = spec.get('endCard')
    if not isinstance(end, dict) or not end.get('cta'):
        raise SpecError('endCard with a cta is required')
    end['start'] = _num(end.get('start'), 'endCard.start', 0, duration - 1.5)
    end.setdefault('brand', 'AMP')
    end.setdefault('tagline', 'Adaptive Math Pathways')
    end.setdefault('url', 'amp.corpora.inc')
    for key in ('cta', 'brand', 'tagline', 'url'):
        _check_words(end[key], f'endCard.{key}')

    cards = spec.setdefault('cards', [])
    last = 0.0
    for i, card in enumerate(sorted(cards, key=lambda c: c.get('start', 0))):
        name = f'cards[{i}]'
        _check_words(card.get('text', ''), f'{name}.text')
        if any(k in card for k in ('x', 'y', 'position', 'align', 'top', 'bottom')):
            raise SpecError(f'{name}: text position is not configurable; every card is centered')
        start = _num(card.get('start'), f'{name}.start', 0)
        stop = _num(card.get('end'), f'{name}.end', 0)
        if stop - start < 0.8:
            raise SpecError(f'{name} must stay on screen at least 0.8s')
        if start < last:
            raise SpecError(f'{name} overlaps the previous card')
        if stop > end['start']:
            raise SpecError(f'{name} overlaps the end card')
        last = stop

    voice, music = spec.get('voice'), spec.get('music')
    if not voice and not music:
        raise SpecError('an ad needs a voice, music, or both')
    if voice:
        for key in ('take', 'script', 'voice'):
            if not voice.get(key):
                raise SpecError(f'voice.{key} is required')
        voice['start'] = _num(voice.get('start', 0.45), 'voice.start', 0, duration)
        at = 0.0
        for i, seg in enumerate(voice.get('segments') or []):
            name = f'voice.segments[{i}]'
            a = _num(seg.get('from'), f'{name}.from', 0)
            b = _num(seg.get('to'), f'{name}.to', 0)
            o = _num(seg.get('at'), f'{name}.at', 0)
            if b <= a or o < at - 0.001 or o + (b - a) > duration - 0.3:
                raise SpecError(f'{name} must have from < to, not overlap the previous segment, '
                                'and finish 0.3s before the end')
            at = o + (b - a)
        voice.setdefault('transcriptVerified', False)
    if music:
        if not music.get('path') or not music.get('rights'):
            raise SpecError('music.path and music.rights (licence / provenance) are required')
        music['offset'] = _num(music.get('offset', 0), 'music.offset', 0)
        music['lufs'] = _num(music.get('lufs', -24 if voice else -16), 'music.lufs', -40, -10)
        if 'duck' in music and music['duck'] is not True and music['duck'] is not False:
            raise SpecError('music.duck must be true to sidechain the bed; omit it to leave the music alone')
        music['duck'] = music.get('duck') is True
        music['fade'] = _num(music.get('fade', 0.15), 'music.fade', 0.05, 0.3)
        if music['fade'] * 2 >= duration:
            raise SpecError('music.fade is too long for this piece')
        if music.get('align', 'none') not in ('none', 'bar'):
            raise SpecError('music.align must be none or bar')
        music['align'] = music.get('align', 'none')
    for i, fx in enumerate(spec.setdefault('sfx', [])):
        if not fx.get('path'):
            raise SpecError(f'sfx[{i}].path is required')
        fx['at'] = _num(fx.get('at', 0), f'sfx[{i}].at', 0, duration)
        fx['gainDb'] = _num(fx.get('gainDb', 0), f'sfx[{i}].gainDb', -60, 12)
    qc = spec.setdefault('qc', {})
    qc['maxBlackSeconds'] = _num(qc.get('maxBlackSeconds', 0.5), 'qc.maxBlackSeconds', 0.1, 10)
    return spec


def _check_words(text, name):
    if not isinstance(text, str) or not text.strip():
        raise SpecError(f'{name} must be non-empty text')
    if len(text) > MAX_CARD_CHARS or len(text.split()) > MAX_CARD_WORDS:
        raise SpecError(f'{name} is too long: at most {MAX_CARD_WORDS} words / {MAX_CARD_CHARS} characters '
                        '(fewer, bigger words read on a phone)')
    if text.count('\n') > 2:
        raise SpecError(f'{name} has more than three lines')
