"""Upload a finished ad to YouTube as PRIVATE. Publishing is a separate, human
decision made in YouTube Studio after review (and ideally 24-48 h after upload).

Credentials: AMP_YOUTUBE_TOKEN points at an OAuth authorized-user JSON
(client_id, client_secret, refresh_token, token_uri) with the youtube.upload
scope, kept outside the repo in approved secret storage. AMP_YOUTUBE_CHANNEL_ID
is the channel the token must resolve to; the upload refuses any other channel.
"""
import json
import os
import urllib.parse
import urllib.request
from pathlib import Path

from .render import sha, stamp, write_json
from .spec import SpecError

API = 'https://www.googleapis.com/youtube/v3'
UPLOAD = 'https://www.googleapis.com/upload/youtube/v3/videos'


def metadata(title, description, tags=()):
    if not title or len(title) > 100:
        raise SpecError('title is required and at most 100 characters')
    return {
        'snippet': {'title': title, 'description': description, 'categoryId': '27', 'tags': list(tags),
                    'defaultLanguage': 'en', 'defaultAudioLanguage': 'en'},
        # Always private; generated footage is disclosed; ads target parents, not children.
        'status': {'privacyStatus': 'private', 'selfDeclaredMadeForKids': False, 'containsSyntheticMedia': True,
                   'embeddable': True},
    }


def _token():
    path = os.environ.get('AMP_YOUTUBE_TOKEN')
    if not path or not Path(path).is_file():
        raise SpecError('set AMP_YOUTUBE_TOKEN to the authorized-user token file (never commit it)')
    t = json.loads(Path(path).read_text())
    body = urllib.parse.urlencode({'client_id': t['client_id'], 'client_secret': t['client_secret'],
                                   'refresh_token': t['refresh_token'], 'grant_type': 'refresh_token'}).encode()
    with urllib.request.urlopen(urllib.request.Request(t.get('token_uri', 'https://oauth2.googleapis.com/token'),
                                                       data=body), timeout=30) as r:
        return json.loads(r.read())['access_token']


def _call(method, url, token, data=None, headers=None):
    req = urllib.request.Request(url, data=data, method=method,
                                 headers={'Authorization': f'Bearer {token}', **(headers or {})})
    return urllib.request.urlopen(req, timeout=600)


def upload(video, title, description, tags=()):
    video = Path(video)
    receipt = video.with_name(video.stem + '-youtube.json')
    if receipt.exists():
        raise SpecError(f'{receipt} exists: this file was already uploaded')
    expected = os.environ.get('AMP_YOUTUBE_CHANNEL_ID')
    if not expected:
        raise SpecError('set AMP_YOUTUBE_CHANNEL_ID so the upload cannot land on the wrong channel')
    body = metadata(title, description, tags)
    token = _token()
    with _call('GET', f'{API}/channels?part=id&mine=true', token) as r:
        channels = [c['id'] for c in json.loads(r.read()).get('items', [])]
    if expected not in channels:
        raise SpecError('the token does not belong to AMP_YOUTUBE_CHANNEL_ID; nothing uploaded')
    raw = video.read_bytes()
    with _call('POST', f'{UPLOAD}?uploadType=resumable&part=snippet,status&notifySubscribers=false', token,
               json.dumps(body).encode(), {'Content-Type': 'application/json',
                                           'X-Upload-Content-Length': str(len(raw)),
                                           'X-Upload-Content-Type': 'video/mp4'}) as r:
        session = r.headers['Location']
    with _call('PUT', session, token, raw, {'Content-Type': 'video/mp4'}) as r:
        result = json.loads(r.read())
    if result['status']['privacyStatus'] != 'private':
        raise SpecError(f'YouTube reports {result["status"]["privacyStatus"]}; set it to private in Studio now')
    write_json(receipt, {'videoId': result['id'], 'url': f'https://www.youtube.com/watch?v={result["id"]}',
                         'privacy': 'private', 'title': title, 'sha256': sha(video), 'at': stamp()})
    return receipt
