"""Upload a reviewed lesson once, attach captions and a poster, schedule with the shared release policy.

Requires an authorized-user OAuth JSON in AMP_YOUTUBE_TOKEN and the intended
channel ID in AMP_YOUTUBE_CHANNEL_ID. The receipt belongs outside Git. Run
without --schedule to prepare a private upload; reruns resume from the receipt.
"""
import argparse
import hashlib
import json
import os
import fcntl
from datetime import datetime, timezone
from youtube_policy import POLICY_VERSION, validate_plan, validate_review, release_time, timestamp, calendar_event
from pathlib import Path
import urllib.parse
import urllib.request
import urllib.error
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
    parser.add_argument('--plan', type=Path, required=True)
    parser.add_argument('--schedule', action='store_true')
    args = parser.parse_args()
    args.receipt.parent.mkdir(parents=True, exist_ok=True)
    with args.receipt.with_suffix(args.receipt.suffix + '.lock').open('a') as lock:
        fcntl.flock(lock, fcntl.LOCK_EX)
        execute(args)


def execute(args):
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
    plan = json.loads(args.plan.read_text())
    validate_plan(plan)
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
    status = {'privacyStatus': 'private', 'selfDeclaredMadeForKids': False, 'containsSyntheticMedia': plan['aiDisclosure']['required'], 'embeddable': True, 'license': 'youtube', 'publicStatsViewable': True}
    if args.receipt.exists():
        receipt = json.loads(args.receipt.read_text())
        if not (receipt['sha256'] == m['assets']['video']['sha256'] and receipt['channelId'] == channel):
            raise ValueError('Publication validation failed')
    else:
        metadata = {'snippet': {'title': args.title, 'description': description, 'categoryId': '27', 'defaultLanguage': 'en', 'defaultAudioLanguage': 'en'}, 'status': status}
        result = upload('videos', metadata, files['video'], 'video/mp4', ',status&notifySubscribers=true')
        receipt = {'videoId': result['id'], 'channelId': channel, 'sha256': m['assets']['video']['sha256'], 'voiceId': m['voiceId'], 'uploadedAt': datetime.now(timezone.utc).isoformat(), 'policyVersion': POLICY_VERSION}
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
    # Persist completed upload work before scheduling so a failed check resumes it.
    args.receipt.write_text(json.dumps(receipt, indent=2) + '\n')
    if args.schedule:
        # All local agents share a per-channel lock. Refresh the channel calendar
        # while holding it; a second agent cannot reserve the same cadence budget.
        state = Path(os.environ.get('AMP_YOUTUBE_STATE_DIR', Path.home() / '.local/state/corpora/youtube')) / channel
        state.mkdir(parents=True, exist_ok=True)
        with (state / 'release.lock').open('a') as lock:
            fcntl.flock(lock, fcntl.LOCK_EX)
            now = datetime.now(timezone.utc)
            current = request('GET', API + '/videos?part=snippet,status,processingDetails&id=' + video_id)['items'][0]
            validate_review(plan, receipt, current, now)
            uploads = request('GET', API + '/channels?part=contentDetails&id=' + channel)['items'][0]['contentDetails']['relatedPlaylists']['uploads']
            ids, page = [], ''
            while True:
                listing = request('GET', API + '/playlistItems?part=contentDetails&maxResults=50&playlistId=' + uploads + ('&pageToken=' + page if page else ''))
                ids.extend(item['contentDetails']['videoId'] for item in listing['items'])
                page = listing.get('nextPageToken')
                if not page:
                    break
            events = []
            for offset in range(0, len(ids), 50):
                items = request('GET', API + '/videos?part=snippet,status,liveStreamingDetails&id=' + ','.join(ids[offset:offset + 50]))['items']
                for item in items:
                    if item['id'] == video_id:
                        continue
                    event = calendar_event(item)
                    if event:
                        events.append(event)
            # Upcoming broadcasts need not have entered the uploads playlist yet.
            page = ''
            while True:
                try:
                    broadcasts = request('GET', API + '/liveBroadcasts?part=snippet,status&broadcastStatus=upcoming&broadcastType=all&maxResults=50' + ('&pageToken=' + page if page else ''))
                except urllib.error.HTTPError as error:
                    detail = json.loads(error.read())
                    reasons = {entry.get('reason') for entry in detail.get('error', {}).get('errors', [])}
                    if error.code == 403 and reasons == {'liveStreamingNotEnabled'}:
                        break
                    raise
                for item in broadcasts.get('items', []):
                    event = calendar_event({**item, 'liveStreamingDetails': item['snippet']})
                    if event:
                        events.append(event)
                page = broadcasts.get('nextPageToken')
                if not page:
                    break
            events = list({event['id']: event for event in events}.values())
            chosen = release_time(timestamp(receipt['uploadedAt']), now, events, plan['relatedVideoIds'], plan.get('publishAt'))
            status['publishAt'] = chosen.isoformat().replace('+00:00', 'Z')
            request('PUT', API + '/videos?part=status', {'id': video_id, 'status': status})
            receipt['publishAt'] = status['publishAt']
            receipt['pinAction'] = {'status': 'pending-publication', 'text': plan['pinnedComment']}
            (state / (video_id + '.json')).write_text(json.dumps(receipt, indent=2) + '\n')
    result = request('GET', API + '/videos?part=status,contentDetails&id=' + video_id)['items'][0]
    if result['status'].get('selfDeclaredMadeForKids') is not False:
        raise ValueError('Audience readback differs from the reviewed general-audience plan')
    if args.schedule and (result['status']['privacyStatus'] != 'private' or timestamp(result['status']['publishAt']) != chosen):
        raise ValueError('YouTube did not confirm the requested private schedule')
    receipt.update({'url': 'https://www.youtube.com/watch?v=' + video_id, 'status': result['status'], 'duration': result['contentDetails']['duration']})
    args.receipt.write_text(json.dumps(receipt, indent=2) + '\n')
    print(receipt['url'], result['status']['privacyStatus'])
if __name__ == '__main__':
    main()
