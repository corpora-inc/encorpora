#!/usr/bin/env python3
"""AHA release checks. Never log credential values, API bodies, or tester identities."""
from __future__ import annotations
import argparse
import datetime
import json
import os
import re
from pathlib import Path
import struct
import subprocess
import time
import unicodedata
import zipfile

BUNDLE = 'inc.corpora.aha'
PAGE = 16384
TESTFLIGHT_NOTES_LIMIT = 4000  # betaBuildLocalizations.whatsNew
PLAY_NOTES_LIMIT = 500  # Play release notes, per language
NOTES_LOCALE = 'en-US'


class ReleaseCheckError(ValueError):
    """Safe, deliberately authored diagnostic suitable for public CI logs."""


def verify_elf(data: bytes) -> int:
    if len(data) < 64 or data[:4] != b'\x7fELF' or data[5] not in (1, 2):
        raise ReleaseCheckError('Invalid ELF header')
    endian = '<' if data[5] == 1 else '>'
    if data[4] == 2:
        offset = struct.unpack_from(endian+'Q', data, 32)[0]
        size, count = struct.unpack_from(endian+'HH', data, 54)
        fmt = endian+'IIQQQQQQ'
    elif data[4] == 1:
        offset = struct.unpack_from(endian+'I', data, 28)[0]
        size, count = struct.unpack_from(endian+'HH', data, 42)
        fmt = endian+'IIIIIIII'
    else:
        raise ReleaseCheckError('Unsupported ELF class')
    if size < struct.calcsize(fmt) or not count or offset + size*count > len(data):
        raise ReleaseCheckError('Invalid ELF program table')
    loads = 0
    for i in range(count):
        fields = struct.unpack_from(fmt, data, offset+i*size)
        if data[4] == 2:
            kind, _, off, address, _, _, memsize, alignment = fields
        else:
            kind, off, address, _, _, memsize, _, alignment = fields
        if kind == 1:
            loads += 1
            if alignment < PAGE or alignment & (alignment-1) or (address-off) % PAGE:
                raise ReleaseCheckError('ELF LOAD segment is not 16 KiB compatible')
        if kind == 0x6474e552 and (address+memsize) % PAGE:
            raise ReleaseCheckError('ELF RELRO endpoint is not 16 KiB compatible')
    if not loads:
        raise ReleaseCheckError('ELF contains no load segments')
    return loads


def verify_bundle(path: Path) -> int:
    count = 0
    with zipfile.ZipFile(path) as bundle:
        for entry in bundle.infolist():
            if entry.filename.endswith('.so'):
                verify_elf(bundle.read(entry))
                count += 1
    if count == 0:
        raise ReleaseCheckError('Bundle contains no shared libraries; check cannot pass vacuously')
    print(f'All {count} bundled shared libraries pass ELF LOAD and RELRO 16 KiB checks.')
    return count


def required(name: str) -> str:
    value = os.environ.get(name, '').strip()
    if not value:
        raise ReleaseCheckError(f'Required release configuration is absent: {name}')
    return value


class Store:
    def __init__(self, platform: str):
        import requests
        self.http = requests.Session()
        self.platform = platform
        self.token = ''
        self.expires = 0.0

    def authorization(self) -> str:
        import jwt
        if time.time() < self.expires:
            return self.token
        now = int(time.time())
        if self.platform == 'ios':
            self.token = jwt.encode({'iss': required('ASC_ISSUER_ID'), 'iat': now,
                'exp': now+1100, 'aud': 'appstoreconnect-v1'}, required('ASC_API_KEY_P8'),
                algorithm='ES256', headers={'kid': required('ASC_KEY_ID')})
            self.expires = now+900
        else:
            credentials = json.loads(required('PLAY_SERVICE_ACCOUNT_JSON'))
            # Fixed endpoint; do not trust a URL embedded in a credential export.
            assertion = jwt.encode({'iss': credentials['client_email'], 'iat': now,
                'exp': now+3600, 'aud': 'https://oauth2.googleapis.com/token',
                'scope': 'https://www.googleapis.com/auth/androidpublisher'},
                credentials['private_key'], algorithm='RS256')
            response = self.http.post('https://oauth2.googleapis.com/token', data={
                'grant_type': 'urn:ietf:params:oauth:grant-type:jwt-bearer', 'assertion': assertion}, timeout=30)
            if response.status_code != 200:
                raise ReleaseCheckError(f'Google authorization failed (HTTP {response.status_code})')
            self.token = response.json()['access_token']
            self.expires = now+3000
        return self.token

    def request(self, method: str, path: str, **kwargs):
        base = 'https://api.appstoreconnect.apple.com/v1/' if self.platform == 'ios' else 'https://androidpublisher.googleapis.com/androidpublisher/v3/applications/'
        response = self.http.request(method, base+path, headers={'Authorization': 'Bearer '+self.authorization()}, timeout=30, **kwargs)
        if response.status_code not in (200, 201, 204):
            raise ReleaseCheckError(f'{self.platform} store operation failed (HTTP {response.status_code}); inspect account permissions privately')
        return response.json() if response.content else {}


def ios_app_and_group(store: Store):
    apps = store.request('GET', 'apps', params={'filter[bundleId]': BUNDLE})['data']
    if len(apps) != 1:
        raise ReleaseCheckError('AHA App Store Connect app record is not available; complete authorized app setup')
    group_id = required('AHA_TESTFLIGHT_GROUP_ID')
    group = store.request('GET', f'betaGroups/{group_id}')['data']
    if group.get('attributes', {}).get('isInternalGroup') is not True:
        raise ReleaseCheckError('Configured TestFlight group is not an internal group')
    app = store.request('GET', f'betaGroups/{group_id}/app')['data']
    if app['id'] != apps[0]['id']:
        raise ReleaseCheckError('Configured TestFlight group belongs to another app')
    testers = store.request('GET', f'betaGroups/{group_id}/betaTesters', params={'limit': 1})['data']
    if not testers:
        raise ReleaseCheckError('The existing authorized internal group has no tester')
    return apps[0]['id'], group_id


def ios_group_has_build(store: Store, group: str, build: str) -> bool:
    # Apple permits reading this direction, not GET builds/{id}/betaGroups.
    from urllib.parse import urlsplit
    endpoint = f'betaGroups/{group}/builds'
    path = endpoint
    seen = set()
    for _ in range(100):
        if path in seen:
            raise ReleaseCheckError('Apple returned a repeated group-build page')
        seen.add(path)
        page = store.request('GET', path, **({'params': {'limit': 200}} if path == endpoint else {}))
        if any(item['id'] == build for item in page['data']):
            return True
        next_url = (page.get('links') or {}).get('next')
        if not next_url:
            return False
        parsed = urlsplit(next_url)
        if (parsed.scheme != 'https' or parsed.netloc != 'api.appstoreconnect.apple.com'
                or parsed.path != '/v1/'+endpoint or parsed.fragment):
            raise ReleaseCheckError('Apple returned an unexpected group-build pagination URL')
        path = endpoint + ('?'+parsed.query if parsed.query else '')
    raise ReleaseCheckError('Apple group-build pagination exceeded the verification bound')


def ios_verify(store: Store, build: str, since: int):
    app, group = ios_app_and_group(store)
    deadline = time.monotonic()+2700
    while time.monotonic() < deadline:
        builds = store.request('GET', 'builds', params={'filter[app]': app, 'filter[version]': build, 'limit': 20})['data']
        if len(builds) > 1:
            raise ReleaseCheckError('Ambiguous build version; use a unique build number')
        if builds:
            candidate = builds[0]
            attrs = candidate['attributes']
            uploaded = datetime.datetime.fromisoformat(attrs['uploadedDate'].replace('Z', '+00:00')).timestamp()
            if uploaded < since:
                raise ReleaseCheckError('This build predates the release run; refusing duplicate evidence')
            state = attrs['processingState']
            if state in ('FAILED', 'INVALID'):
                raise ReleaseCheckError('Apple rejected build processing')
            if state == 'VALID':
                if attrs.get('expired'):
                    raise ReleaseCheckError('The uploaded build has expired')
                build_id = candidate['id']
                if not ios_group_has_build(store, group, build_id):
                    store.request('POST', f'betaGroups/{group}/relationships/builds', json={'data': [{'type': 'builds', 'id': build_id}]})
                if not ios_group_has_build(store, group, build_id):
                    raise ReleaseCheckError('Processed build is not assigned to the authorized internal group')
                detail = store.request('GET', f'builds/{build_id}/buildBetaDetail')['data']['attributes']
                beta = detail.get('internalBuildState')
                if beta == 'IN_BETA_TESTING':
                    print(f'iOS {BUNDLE} build {build}: processing VALID, internal beta testing, assigned to a nonempty existing authorized internal group.')
                    return
                if beta not in ('READY_FOR_BETA_TESTING', 'PROCESSING'):
                    raise ReleaseCheckError('Apple requires export compliance or another platform action before internal testing')
        print('Waiting for Apple processing; transfer alone is not delivery.', flush=True)
        time.sleep(30)
    raise ReleaseCheckError('Apple processing did not complete within the verification window')


def validate_play_attestation(build: str | None, since: int | None, *, final=False, now=None):
    """Validate one dispatch's private-Console evidence reference, never tester identities."""
    now = int(time.time()) if now is None else now
    raw = required('PLAY_EMAIL_AUDIENCE_ATTESTATION')
    if len(raw) > 2048:
        raise ReleaseCheckError('Console audience attestation is too large')
    try:
        evidence = json.loads(raw)
    except (TypeError, ValueError):
        raise ReleaseCheckError('Console audience attestation is not valid JSON') from None
    fields = {'version', 'bundleId', 'track', 'versionCode', 'verifiedAt', 'existingTesterCount', 'evidenceSha256'}
    if not isinstance(evidence, dict) or set(evidence) != fields:
        raise ReleaseCheckError('Console audience attestation has an invalid schema; do not include identities')
    if (type(evidence['version']) is not int or evidence['version'] != 1
        or evidence['bundleId'] != BUNDLE or evidence['track'] != 'internal'
        or not isinstance(build, str) or not re.fullmatch(r'[1-9][0-9]{0,9}', build)
        or evidence['versionCode'] != build):
        raise ReleaseCheckError('Console audience attestation does not match this app, track, and build')
    verified = evidence['verifiedAt']
    count = evidence['existingTesterCount']
    if type(count) is not int or not 1 <= count <= 100:
        raise ReleaseCheckError('Console audience attestation needs an existing authorized tester count')
    if not isinstance(evidence['evidenceSha256'], str) or not re.fullmatch(r'[0-9a-f]{64}', evidence['evidenceSha256']):
        raise ReleaseCheckError('Console audience attestation needs a private evidence SHA-256 reference')
    if (type(verified) is not int or type(since) is not int
        or not verified <= since <= now or since - verified > 3600
        or now - verified > (14400 if final else 3600)):
        raise ReleaseCheckError('Console audience evidence is stale or future-dated; verify it again without reuploading')
    return evidence


def play_app_access(store: Store):
    edit = store.request('POST', f'{BUNDLE}/edits', json={})['id']
    try:
        store.request('GET', f'{BUNDLE}/edits/{edit}/tracks/internal')
    finally:
        store.request('DELETE', f'{BUNDLE}/edits/{edit}')
    print('Android app access verified for artifact-only build; no audience, upload, or delivery verified.')


def play_check(store: Store, build: str | None, *, audience_build=None, since=None):
    edit = store.request('POST', f'{BUNDLE}/edits', json={})['id']
    try:
        track = store.request('GET', f'{BUNDLE}/edits/{edit}/tracks/internal')
        testers = store.request('GET', f'{BUNDLE}/edits/{edit}/testers/internal')
        audience = 'a configured existing group audience'
        if not testers.get('googleGroups'):
            if not os.environ.get('PLAY_EMAIL_AUDIENCE_ATTESTATION'):
                raise ReleaseCheckError('Play API cannot verify an email-list audience; supply fresh build-scoped Console evidence')
            validate_play_attestation(build or audience_build, since, final=build is not None)
            audience = 'a Console-attested existing email-list audience (not API-verified membership)'
            if build is None:
                print('Console-attested email audience accepted for this build; membership is not verified by the Play API.')
        if build is not None:
            releases = [r for r in track.get('releases', []) if build in [str(v) for v in r.get('versionCodes', [])]]
            if len(releases) != 1 or releases[0].get('status') != 'completed':
                raise ReleaseCheckError('AHA build is not a completed release on the internal track; drafts do not count')
            print(f'Android {BUNDLE} versionCode {build}: internal track completed with {audience}. Verify an authorized tester can install.')
    finally:
        store.request('DELETE', f'{BUNDLE}/edits/{edit}')


REDACTED = '[redacted]'
# Ordered: the broad opaque-token pattern runs after the specific ones.
_SECRET_PATTERNS = [
    re.compile(r'-----BEGIN[A-Z ]*-----.*?(?:-----END[A-Z ]*-----|\Z)', re.S),
    re.compile(r'\b[a-z][a-z0-9+.-]*://[^\s/@]+@\S+', re.I),
    re.compile(r'[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}'),
    re.compile(r'\beyJ[A-Za-z0-9_-]{4,}\.[A-Za-z0-9_-]{4,}(?:\.[A-Za-z0-9_-]*)?'),
    re.compile(r'\b(?:gh[pousr]_[A-Za-z0-9]{16,}|github_pat_[A-Za-z0-9_]{16,}|AKIA[0-9A-Z]{16}|ASIA[0-9A-Z]{16}'
               r'|AIza[0-9A-Za-z_-]{20,}|xox[abposr]-[A-Za-z0-9-]{8,}|sk-[A-Za-z0-9_-]{12,}|glpat-[A-Za-z0-9_-]{12,})'),
    re.compile(r'(?i)\b(?:password|passwd|secret|token|api[_-]?key|private[_-]?key|client[_-]?secret|authorization)'
               r'\s*[:=]\s*\S+'),
    re.compile(r'(?i)\bbearer\s+\S+'),
    re.compile(r'[A-Za-z0-9+/_=-]{32,}'),
    re.compile(r'(?<![\w@])@[A-Za-z0-9][A-Za-z0-9-]{0,38}\b'),
]


def sanitize_notes(text: str) -> str:
    """Plain, single-language release notes with secrets and identities removed."""
    if not isinstance(text, str):
        raise ReleaseCheckError('Release notes must be text')
    text = text[:20000].replace('\r\n', '\n').replace('\r', '\n').replace('\t', ' ')
    # Drop control and format characters (including bidi overrides), keeping newlines.
    text = ''.join(c for c in text if c == '\n' or unicodedata.category(c) not in ('Cc', 'Cf', 'Cs', 'Co'))
    for pattern in _SECRET_PATTERNS:
        text = pattern.sub(REDACTED, text)
    lines = [line.rstrip() for line in text.split('\n')]
    text = re.sub(r'\n{3,}', '\n\n', '\n'.join(lines))
    return text.strip()


def truncate_notes(text: str, limit: int) -> str:
    if len(text) <= limit:
        return text
    cut = text[:limit-1]
    newline = cut.rfind('\n')
    if newline > limit // 2:
        cut = cut[:newline]
    return cut.rstrip() + '\u2026'


def aha_commit_subjects(head: str, previous: str = '', *, run=subprocess.run) -> tuple[list[str], bool]:
    """Subjects of commits touching aha/ since a previous release commit (or recent ones)."""
    def git(*args):
        return run(['git', *args], text=True, capture_output=True, check=False)
    since = bool(previous and re.fullmatch(r'[0-9a-f]{40}', previous)
                 and git('merge-base', '--is-ancestor', previous, head).returncode == 0)
    span = [f'{previous}..{head}', '-n', '30'] if since else [head, '-n', '10']
    result = git('log', '--no-merges', '--format=%s', *span, '--', 'aha/')
    if result.returncode != 0:
        return [], since
    return [line.strip() for line in result.stdout.splitlines() if line.strip()], since


def release_notes(build: str, sha: str, raw: str = '', previous: str = '', *, run=subprocess.run) -> str:
    if not re.fullmatch(r'[1-9][0-9]{0,9}', build or '') or not re.fullmatch(r'[0-9a-f]{40}', sha or ''):
        raise ReleaseCheckError('Release notes need a numeric build and a full commit SHA')
    custom = sanitize_notes(raw or '')
    if custom:
        return truncate_notes(custom, TESTFLIGHT_NOTES_LIMIT)
    text = f'Build {build} from {sha[:9]}.'
    subjects, since = aha_commit_subjects(sha, previous, run=run)
    if subjects:
        heading = 'Changes since the previous release:' if since else 'Recent changes:'
        text += '\n\n' + heading + '\n' + '\n'.join('- '+subject for subject in subjects)
    return truncate_notes(sanitize_notes(text), TESTFLIGHT_NOTES_LIMIT)


def notes_from_env(build: str) -> str:
    """Gate-composed notes; a missing or unusable value falls back to the build number."""
    try:
        text = sanitize_notes(json.loads(os.environ.get('RELEASE_NOTES_JSON', '')))
    except (ValueError, ReleaseCheckError):
        text = ''
    if text:
        return text
    if not re.fullmatch(r'[0-9][0-9.]{0,30}', build or ''):
        raise ReleaseCheckError('Release notes are unavailable and the build number is invalid')
    print('::warning::Composed release notes were unavailable; using the build number only.')
    return f'Build {build}.'


def ios_set_whats_new(store: Store, build: str, text: str):
    """Create or update the en-US TestFlight "What to Test" text of one processed build."""
    text = truncate_notes(sanitize_notes(text), TESTFLIGHT_NOTES_LIMIT)
    if not text:
        raise ReleaseCheckError('Release notes are empty')
    apps = store.request('GET', 'apps', params={'filter[bundleId]': BUNDLE})['data']
    if len(apps) != 1:
        raise ReleaseCheckError('AHA App Store Connect app record is not available')
    builds = store.request('GET', 'builds', params={'filter[app]': apps[0]['id'], 'filter[version]': build, 'limit': 20})['data']
    if len(builds) != 1:
        raise ReleaseCheckError('Expected exactly one build with this build number')
    if builds[0]['attributes'].get('processingState') != 'VALID':
        raise ReleaseCheckError('Build is not processed; What to Test is set only on a VALID build')
    build_id = builds[0]['id']
    existing = store.request('GET', f'builds/{build_id}/betaBuildLocalizations', params={'limit': 50})['data']
    matches = [item for item in existing if item.get('attributes', {}).get('locale') == NOTES_LOCALE]
    if matches:
        store.request('PATCH', f'betaBuildLocalizations/{matches[0]["id"]}', json={'data': {
            'type': 'betaBuildLocalizations', 'id': matches[0]['id'], 'attributes': {'whatsNew': text}}})
    else:
        store.request('POST', 'betaBuildLocalizations', json={'data': {
            'type': 'betaBuildLocalizations', 'attributes': {'locale': NOTES_LOCALE, 'whatsNew': text},
            'relationships': {'build': {'data': {'type': 'builds', 'id': build_id}}}}})
    print(f'TestFlight What to Test set for build {build} ({NOTES_LOCALE}, {len(text)} characters).')


def write_play_notes(directory: Path, text: str) -> Path:
    text = truncate_notes(sanitize_notes(text), PLAY_NOTES_LIMIT)
    if not text:
        raise ReleaseCheckError('Release notes are empty')
    directory.mkdir(parents=True, exist_ok=True)
    path = directory/f'whatsnew-{NOTES_LOCALE}'
    path.write_text(text, encoding='utf-8')
    print(f'Play release notes written ({NOTES_LOCALE}, {len(text)} characters).')
    return path


def main():
    parser = argparse.ArgumentParser()
    sub = parser.add_subparsers(dest='command', required=True)
    elf = sub.add_parser('elf'); elf.add_argument('bundle', type=Path)
    sub.add_parser('android-app')
    audience = sub.add_parser('audience')
    audience.add_argument('--build', required=True)
    audience.add_argument('--since', type=int, required=True)
    for name in ('preflight', 'verify'):
        cmd = sub.add_parser(name); cmd.add_argument('--platform', choices=['ios', 'android'], required=True)
        cmd.add_argument('--build', required=name == 'verify')
        cmd.add_argument('--since', type=int, required=name == 'verify')
    notes = sub.add_parser('notes')
    notes.add_argument('--build', required=True)
    notes.add_argument('--sha', required=True)
    notes.add_argument('--previous', default='')
    whats_new = sub.add_parser('whats-new')
    whats_new.add_argument('--platform', choices=['ios', 'android'], required=True)
    whats_new.add_argument('--build')
    whats_new.add_argument('--dir', type=Path)
    args = parser.parse_args()
    if args.command == 'notes':
        # One ASCII line, safe to write to GITHUB_OUTPUT.
        print(json.dumps(release_notes(args.build, args.sha, os.environ.get('RELEASE_NOTES', ''), args.previous)))
        return
    if args.command == 'whats-new':
        if not args.build:
            raise ReleaseCheckError('whats-new needs --build')
        if args.platform == 'ios':
            ios_set_whats_new(Store('ios'), args.build, notes_from_env(args.build))
        else:
            if not args.dir:
                raise ReleaseCheckError('whats-new for Android needs --dir')
            write_play_notes(args.dir, notes_from_env(args.build))
        return
    if args.command == 'elf':
        verify_bundle(args.bundle); return
    if args.command == 'android-app':
        play_app_access(Store('android'))
        return
    if args.command == 'audience':
        validate_play_attestation(args.build, args.since)
        print('Build-scoped Console audience attestation is current; actual tester installation remains unverified.')
        return
    store = Store(args.platform)
    if args.platform == 'ios':
        if args.command == 'preflight': ios_app_and_group(store)
        else: ios_verify(store, args.build, args.since)
    else: play_check(store, args.build if args.command == 'verify' else None, audience_build=args.build, since=args.since)
    if args.command == 'preflight': print('App record and existing internal audience preflight passed.')


if __name__ == '__main__':
    try:
        main()
    except Exception as error:
        # Exception messages from HTTP/crypto libraries can include sensitive input.
        if isinstance(error, ReleaseCheckError):
            print(f'Release check failed: {error}')
        else:
            print(f'Release check failed ({type(error).__name__}); inspect configuration privately.')
        raise SystemExit(1)
