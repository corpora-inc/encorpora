#!/usr/bin/env python3
"""AHA release checks. Never log credential values, API bodies, or tester identities."""
from __future__ import annotations
import argparse
import datetime
import json
import os
from pathlib import Path
import struct
import time
import zipfile

BUNDLE = 'inc.corpora.aha'
PAGE = 16384


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
                attached = store.request('GET', f'builds/{build_id}/betaGroups', params={'limit': 200})['data']
                if not any(g['id'] == group for g in attached):
                    store.request('POST', f'betaGroups/{group}/relationships/builds', json={'data': [{'type': 'builds', 'id': build_id}]})
                    attached = store.request('GET', f'builds/{build_id}/betaGroups', params={'limit': 200})['data']
                if not any(g['id'] == group for g in attached):
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


def play_check(store: Store, build: str | None):
    edit = store.request('POST', f'{BUNDLE}/edits', json={})['id']
    try:
        track = store.request('GET', f'{BUNDLE}/edits/{edit}/tracks/internal')
        testers = store.request('GET', f'{BUNDLE}/edits/{edit}/testers/internal')
        if not testers.get('googleGroups'):
            raise ReleaseCheckError('Play API cannot verify a configured existing tester audience; verify Console email-list access privately')
        if build is not None:
            releases = [r for r in track.get('releases', []) if build in [str(v) for v in r.get('versionCodes', [])]]
            if len(releases) != 1 or releases[0].get('status') != 'completed':
                raise ReleaseCheckError('AHA build is not a completed release on the internal track; drafts do not count')
            print(f'Android {BUNDLE} versionCode {build}: internal track completed with a configured existing group audience. Verify an authorized tester can install.')
    finally:
        store.request('DELETE', f'{BUNDLE}/edits/{edit}')


def main():
    parser = argparse.ArgumentParser()
    sub = parser.add_subparsers(dest='command', required=True)
    elf = sub.add_parser('elf'); elf.add_argument('bundle', type=Path)
    for name in ('preflight', 'verify'):
        cmd = sub.add_parser(name); cmd.add_argument('--platform', choices=['ios', 'android'], required=True)
        if name == 'verify':
            cmd.add_argument('--build', required=True); cmd.add_argument('--since', type=int, required=True)
    args = parser.parse_args()
    if args.command == 'elf':
        verify_bundle(args.bundle); return
    store = Store(args.platform)
    if args.platform == 'ios':
        if args.command == 'preflight': ios_app_and_group(store)
        else: ios_verify(store, args.build, args.since)
    else: play_check(store, args.build if args.command == 'verify' else None)
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
