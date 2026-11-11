"""Per-film measured costs and read-only narration access checks."""
import json
from pathlib import Path
import urllib.request
from providers import now, write_json
from state import read_json

TEACHERS = ('XescS24CsOySAkKrLAO3', 'J3Ei0Lj6fAobhIqY5ySH')
VOICES = (*TEACHERS, 'SYXbTJsLE7zmSjr1DchT')

def costs(root):
    records = [read_json(p) for p in (root/'runs').glob('**/*.json')]
    known = sum(next((r[k] for k in ('api_dollars', 'reported_dollars', 'partial_api_dollars')
                      if isinstance(r.get(k), (int, float))), 0) for r in records)
    unknown = sum(not any(isinstance(r.get(k), (int, float)) for k in ('api_dollars', 'reported_dollars'))
                  for r in records)
    quota = read_json(root/'voice-quota.json', {})
    ledger = root/'voice-ledger.jsonl'
    entries = [json.loads(line) for line in ledger.read_text().splitlines()] if ledger.exists() else []
    return {'known_model_dollars': round(known, 6), 'model_receipts_without_full_dollars': unknown,
            'voice_input_characters': sum(e.get('input_characters', 0) for e in entries if e.get('kind') == 'reserved'),
            'voice_confirmed_credits': quota.get('confirmed_characters', 0),
            'voice_reserved_credits': quota.get('reserved_characters', 0),
            'voice_dollars': None}

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
