"""Check the actual full-format paid-video set before any upload."""
import json
import math
from pathlib import Path

from .render import probe, sha
from .spec import FORMATS, GOOGLE_FORMATS, SpecError


def check(manifest, video=None):
    """Validate local bytes, Full HD geometry, audio and placement duration.

    Paths are relative to the manifest. This technical check does not replace
    editorial review or certify live campaign settings.
    """
    if not manifest:
        raise SpecError('a delivery manifest with wide, square and portrait exports is required')
    path = Path(manifest).resolve()
    try:
        data = json.loads(path.read_text())
        exports = data['exports']
        if not isinstance(exports, dict) or not GOOGLE_FORMATS <= exports.keys():
            raise SpecError('delivery requires wide, square and portrait; feed cannot replace square')
        if set(exports) - FORMATS.keys():
            raise SpecError('unknown delivery format')
        checked = {}
        for fmt, entry in exports.items():
            file = (path.parent / entry['file']).resolve()
            if sha(file) != entry['sha256']:
                raise SpecError(f'{fmt}: export hash differs from the delivery manifest')
            media = probe(file)
            streams = media['streams']
            videos = [s for s in streams if s['codec_type'] == 'video'
                      and not s.get('disposition', {}).get('attached_pic')]
            if len(videos) != 1 or not any(s['codec_type'] == 'audio' for s in streams):
                raise SpecError(f'{fmt}: exactly one video stream and audio are required')
            stream = videos[0]
            width, height = stream['width'], stream['height']
            required_w, required_h = FORMATS[fmt]['size']
            rotated = any(float(s.get('rotation', 0)) % 360 for s in stream.get('side_data_list', []))
            rotated = rotated or float(stream.get('tags', {}).get('rotate', 0)) % 360
            if (width < required_w or height < required_h or width * required_h != height * required_w
                    or stream.get('sample_aspect_ratio', '1:1') not in ('1:1', 'N/A') or rotated):
                raise SpecError(f'{fmt}: requires unrotated square pixels, {required_w}x{required_h} or larger at the same ratio')
            duration = float(stream.get('duration', media['format']['duration']))
            if not math.isfinite(duration) or duration < 10 or (fmt == 'portrait' and duration > 60):
                raise SpecError(f'{fmt}: duration must be at least 10 seconds; portrait must be 10–60 seconds')
            checked[fmt] = {'file': str(file), 'sha256': entry['sha256'],
                            'width': width, 'height': height, 'duration': duration}
        if video is not None and str(Path(video).resolve()) not in {e['file'] for e in checked.values()}:
            raise SpecError('upload video is not in the checked delivery manifest')
        return checked
    except (OSError, KeyError, TypeError, ValueError, RuntimeError) as exc:
        if isinstance(exc, SpecError):
            raise
        raise SpecError(f'cannot validate delivery: {exc}') from exc
