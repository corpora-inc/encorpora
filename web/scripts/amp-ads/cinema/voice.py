"""Voice takes. The normal path is the ElevenLabs MCP (see README); this module
checks a take against its spec and, optionally, generates takes over the REST
API with ELEVENLABS_API_KEY from the environment. The key is never written."""
import json
import os
import urllib.request
from pathlib import Path

from .render import probe, sha, stamp, write_json
from .spec import SpecError, media_path

# Low style keeps the read natural: no trailer voice, no exaggerated emotion.
DEFAULT_SETTINGS = {'stability': 0.5, 'similarity_boost': 0.75, 'style': 0.0, 'use_speaker_boost': True}


def check(spec):
    v = spec.get('voice')
    if not v:
        return {'voice': None}
    take = media_path(spec, v['take'])
    if not take.is_file():
        raise SpecError(f'voice take not found: {take}. Produce takes with the ElevenLabs MCP (README, step 3).')
    took = float(probe(take)['format']['duration'])
    return {'take': str(take), 'seconds': round(took, 2), 'sha256': sha(take), 'voice': v['voice'],
            'fits': bool(v.get('segments')) or v['start'] + took <= spec['duration'] - 0.3,
            'transcriptVerified': v['transcriptVerified']}


def request_body(v):
    return {'text': v['script'], 'model_id': v['model'], 'voice_settings': {**DEFAULT_SETTINGS, **v.get('settings', {})}}


def generate(spec, takes=2):
    """Write take-1.mp3 .. take-N.mp3 beside voice.take (never overwriting) with
    a receipt per take. Billable: each call spends ElevenLabs credits."""
    v = spec['voice']
    key = os.environ.get('ELEVENLABS_API_KEY')
    if not key:
        raise SpecError('ELEVENLABS_API_KEY is not set; use the ElevenLabs MCP instead (README, step 3)')
    if not v.get('voiceId') or not v.get('model'):
        raise SpecError('voice.voiceId and voice.model are required to generate takes')
    folder = media_path(spec, v['take']).parent
    folder.mkdir(parents=True, exist_ok=True)
    base = os.environ.get('ELEVENLABS_API_BASE', 'https://api.elevenlabs.io')
    written = []
    n = 1
    while len(written) < takes:
        path = folder / f'take-{n}.mp3'
        n += 1
        if path.exists():
            continue
        body = request_body(v)
        req = urllib.request.Request(
            f'{base}/v1/text-to-speech/{v["voiceId"]}?output_format=mp3_44100_192',
            data=json.dumps(body).encode(), method='POST',
            headers={'xi-api-key': key, 'Content-Type': 'application/json', 'Accept': 'audio/mpeg'})
        with urllib.request.urlopen(req, timeout=180) as r:
            path.write_bytes(r.read())
        write_json(path.with_suffix('.json'), {'voice': v['voice'], 'voiceId': v['voiceId'], **body,
                                               'sha256': sha(path), 'at': stamp(), 'source': 'elevenlabs-rest'})
        written.append(str(path))
    return written


def transcript_matches(script, transcript):
    """Loose wording check: same words in order, ignoring case and punctuation."""
    norm = lambda s: ''.join(c.lower() if c.isalnum() else ' ' for c in s).split()  # noqa: E731
    return norm(script) == norm(transcript)


def verify(spec, transcript_file):
    """Compare a transcription (e.g. ElevenLabs Scribe via the MCP) with the script."""
    text = Path(transcript_file).read_text()
    try:
        text = json.loads(text).get('text', text)
    except ValueError:
        pass
    return transcript_matches(spec['voice']['script'], text)
