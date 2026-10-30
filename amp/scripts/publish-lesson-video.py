"""Publish reviewed lesson assets to an existing S3/CDN delivery service.

Credentials stay in the AWS credential provider chain. Immutable object keys
refuse replacement; the committed manifest pins the bytes delivered to clients.
"""
import argparse
import hashlib
import json
import mimetypes
from pathlib import Path
import subprocess
import urllib.request
APPROVED_VOICES = {'XescS24CsOySAkKrLAO3', 'J3Ei0Lj6fAobhIqY5ySH'}

def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('manifest', type=Path)
    parser.add_argument('production', type=Path)
    parser.add_argument('--bucket', required=True)
    parser.add_argument('--origin-prefix', default='artifacts')
    parser.add_argument('--profile', required=True)
    args = parser.parse_args()
    manifest = json.loads(args.manifest.read_text())
    narration = json.loads((args.production / 'assets/narration.json').read_text())
    if not manifest['voiceId'] in APPROVED_VOICES:
        raise ValueError('Unapproved narration voice')
    if not narration['voiceId'] == manifest['voiceId']:
        raise ValueError('Narration metadata differs')
    if not sha(args.production / 'assets/narration.mp3') == narration['sha256']:
        raise ValueError('Narration audio differs')
    assets = []
    for kind, asset in manifest['assets'].items():
        url = urllib.parse.urlparse(asset['url'])
        if not (url.scheme == 'https' and (not url.query) and (not url.fragment)):
            raise ValueError('Publication validation failed')
        if not f"/amp/lessons/{manifest['id']}/v{manifest['version']}/" in url.path:
            raise ValueError('Publication validation failed')
        path = args.production / 'deliverables' / Path(url.path).name
        if not sha(path) == asset['sha256']:
            raise ValueError(f'Changed {kind}; create a new version')
        assets.append((kind, asset, url, path))
    for kind, asset, url, path in assets:
        key = args.origin_prefix.strip('/') + url.path
        try:
            with urllib.request.urlopen(asset['url'], timeout=30) as response:
                current = hashlib.sha256(response.read()).hexdigest()
            if not current == asset['sha256']:
                raise ValueError('Immutable URL already holds different bytes')
        except urllib.error.HTTPError as error:
            if error.code not in (403, 404):
                raise
            content_type = 'text/vtt; charset=utf-8' if path.suffix == '.vtt' else 'text/plain; charset=utf-8' if path.suffix == '.srt' else mimetypes.guess_type(path.name)[0]
            result = subprocess.run(['aws', 's3api', 'put-object', '--profile', args.profile, '--bucket', args.bucket, '--key', key, '--body', str(path), '--content-type', content_type or 'application/octet-stream', '--cache-control', 'public,max-age=31536000,immutable', '--metadata', 'sha256=' + asset['sha256'], '--if-none-match', '*'], stdout=subprocess.DEVNULL, stderr=subprocess.PIPE)
            if result.returncode:
                raise RuntimeError(f'Upload failed for {kind}; inspect AWS permissions or an existing object')
        with urllib.request.urlopen(asset['url'] + '?verify=' + asset['sha256'], timeout=60) as response:
            if not hashlib.sha256(response.read()).hexdigest() == asset['sha256']:
                raise ValueError(f'CDN bytes differ: {kind}')
        print(f'Verified {kind}')
if __name__ == '__main__':
    main()
