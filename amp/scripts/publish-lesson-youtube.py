"""Upload a reviewed lesson once, attach captions and a poster, then publish.

Requires an authorized-user OAuth JSON in AMP_YOUTUBE_TOKEN and the intended
channel ID in AMP_YOUTUBE_CHANNEL_ID. The receipt belongs outside Git. Run
without --publish to prepare a private upload; reruns resume from the receipt.
"""
import argparse
import hashlib
import json
import os
from pathlib import Path
import urllib.parse
import urllib.request
API = 'https://www.googleapis.com/youtube/v3'
UPLOAD = 'https://www.googleapis.com/upload/youtube/v3'
VOICES = {'XescS24CsOySAkKrLAO3', 'J3Ei0Lj6fAobhIqY5ySH'}

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('manifest', type=Path)
    parser.add_argument('deliverables', type=Path)
    parser.add_argument('receipt', type=Path)
    parser.add_argument('--title', required=True)
    parser.add_argument('--description-file', type=Path, required=True)
    parser.add_argument('--publish', action='store_true')
    args = parser.parse_args()
    m = json.loads(args.manifest.read_text())
    if not m['voiceId'] in VOICES:
        raise ValueError('Unapproved voice')
    if not 0 < len(args.title) <= 100:
        raise ValueError('Publication validation failed')
    description = args.description_file.read_text().strip()
    if not len(description.encode()) <= 5000:
        raise ValueError('Publication validation failed')
    files = {}
    for kind in ('video', 'subtitles', 'poster'):
        asset = m['assets'][kind]
        path = args.deliverables / Path(urllib.parse.urlparse(asset['url']).path).name
        if not hashlib.sha256(path.read_bytes()).hexdigest() == asset['sha256']:
            raise ValueError(f'Changed {kind}')
        files[kind] = path
    auth = json.loads(Path(os.environ['AMP_YOUTUBE_TOKEN']).read_text())
    refresh = {k: auth[k] for k in ('client_id', 'client_secret', 'refresh_token')}
    refresh['grant_type'] = 'refresh_token'
    with urllib.request.urlopen(urllib.request.Request('https://oauth2.googleapis.com/token', data=urllib.parse.urlencode(refresh).encode()), timeout=30) as response:
        token = json.load(response)['access_token']

    def call(method, url, body=None, headers=None):
        return urllib.request.urlopen(urllib.request.Request(url, data=body, method=method, headers={'Authorization': 'Bearer ' + token, **(headers or {})}), timeout=120)

    def request(method, url, data=None):
        with call(method, url, None if data is None else json.dumps(data).encode(), {'Content-Type': 'application/json'}) as response:
            return json.load(response)
    channel = os.environ['AMP_YOUTUBE_CHANNEL_ID']
    if not channel in [c['id'] for c in request('GET', API + '/channels?part=id&mine=true')['items']]:
        raise ValueError('Wrong channel')

    def upload(resource, metadata, path, mime, extra=''):
        raw = path.read_bytes()
        with call('POST', UPLOAD + f'/{resource}?uploadType=resumable&part=snippet' + extra, json.dumps(metadata).encode(), {'Content-Type': 'application/json', 'X-Upload-Content-Type': mime, 'X-Upload-Content-Length': str(len(raw))}) as response:
            session = response.headers['Location']
        with call('PUT', session, raw, {'Content-Type': mime}) as response:
            return json.load(response)
    status = {'privacyStatus': 'private', 'selfDeclaredMadeForKids': True, 'containsSyntheticMedia': True, 'embeddable': True, 'license': 'youtube', 'publicStatsViewable': True}
    if args.receipt.exists():
        receipt = json.loads(args.receipt.read_text())
        if not (receipt['sha256'] == m['assets']['video']['sha256'] and receipt['channelId'] == channel):
            raise ValueError('Publication validation failed')
    else:
        metadata = {'snippet': {'title': args.title, 'description': description, 'categoryId': '27', 'defaultLanguage': 'en', 'defaultAudioLanguage': 'en'}, 'status': status}
        result = upload('videos', metadata, files['video'], 'video/mp4', ',status&notifySubscribers=false')
        receipt = {'videoId': result['id'], 'channelId': channel, 'sha256': m['assets']['video']['sha256'], 'voiceId': m['voiceId']}
        args.receipt.parent.mkdir(parents=True, exist_ok=True)
        args.receipt.write_text(json.dumps(receipt, indent=2) + '\n')
    video_id = receipt['videoId']
    current = request('GET', API + '/videos?part=snippet,status,processingDetails&id=' + video_id)['items'][0]
    if not current['snippet']['channelId'] == channel:
        raise ValueError('Publication validation failed')
    if not (current['snippet']['title'] == args.title and current['snippet']['description'] == description):
        raise ValueError("Metadata differs from receipt's upload")
    captions = request('GET', API + '/captions?part=snippet&videoId=' + video_id)['items']
    if not any((c['snippet']['name'] == 'English' for c in captions)):
        upload('captions', {'snippet': {'videoId': video_id, 'language': 'en', 'name': 'English', 'isDraft': False}}, files['subtitles'], 'application/octet-stream')
    if not receipt.get('thumbnail'):
        with call('POST', UPLOAD + '/thumbnails/set?videoId=' + video_id + '&uploadType=media', files['poster'].read_bytes(), {'Content-Type': 'image/png'}) as response:
            json.load(response)
        receipt['thumbnail'] = True
    if args.publish:
        if not current.get('processingDetails', {}).get('processingStatus') == 'succeeded':
            raise ValueError('Video is processing; rerun after it finishes')
        status['privacyStatus'] = 'public'
        request('PUT', API + '/videos?part=status', {'id': video_id, 'status': status})
    result = request('GET', API + '/videos?part=status,contentDetails&id=' + video_id)['items'][0]
    if not result['status']['selfDeclaredMadeForKids'] is True:
        raise ValueError('Publication validation failed')
    if args.publish:
        if not result['status']['privacyStatus'] == 'public':
            raise ValueError('Publication validation failed')
    receipt.update({'url': 'https://www.youtube.com/watch?v=' + video_id, 'status': result['status'], 'duration': result['contentDetails']['duration']})
    args.receipt.write_text(json.dumps(receipt, indent=2) + '\n')
    print(receipt['url'], result['status']['privacyStatus'])
if __name__ == '__main__':
    main()
