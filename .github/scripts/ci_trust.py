#!/usr/bin/env python3
"""Select checksum-verified CI roots and refresh an idle Ubuntu Docker daemon.

Run before checkout with workflow-level NODE_OPTIONS=--use-openssl-ca. This
protects subsequent clients; it cannot protect the runner's initial downloads.
"""
import argparse
import hashlib
import json
import os
from pathlib import Path
import re
import shutil
import shlex
import ssl
import stat
import subprocess
import sys
import tempfile
import types
import urllib.request

CA_URL = ('https://raw.githubusercontent.com/corpora-inc/encorpora/'
          '33231bb934b125f4386b7ab00a112259e5eb29f6/'
          'corpan/infra/terraform/tls-trust/ca-certificates.pem')
CA_SHA256 = '796f1389bfea13c0ed78f663b765baaff54a508e5483786bd6ece73c5e3e3cbe'
WINDOWS_ASSETS = {'windows_trust_inventory.py': ('82afa68fa562894d041de9b92e94ae7152838ca85f1fa6ab291b37b899d7cc51', 20000), 'windows_trust_repair.py': ('fb286be0facd0c752bf9910cdcd2ef739e022dc6e7fa4cd6b1e152ca635ed8c5', 40000), 'windows-trust-public-certificates.json': ('38b76c3e74dc30c2feb31bcd81f194b8cc03d49f2e25a06b8769b34c9d37bb8e', 40000)}
BLOCKED = {
    '7dd78d5f4f13459a83dff9abbba62edbaf6f2d102bf257fd712f4d9f2746ed8d',
    'f2edaaff3d9b701fb4d14c9f285f8c0bad90fc3bcc1fa07d47f4718edaba34a5',
    'd7a7a0fb5d7e2731d771e9484ebcdef71d5f0c3e0a2948782bc83ee0ea699ef4',
    '86a1ecba089c4a8d3bbe2734c612ba341d813e043cf9e8a862cd5c57a36bbe6b',
}
HOSTS = [f'{kind}-{variant}-{prefix}emudhra.we-have-a-problem.com'
         for kind in ('dv', 'ov', 'ev') for variant in ('g3b', 'g3c')
         for prefix in ('', 'aaa-')]


def require(condition, message):
    if not condition:
        raise RuntimeError(message)


def fingerprints(data):
    certificates = re.findall(rb'-----BEGIN CERTIFICATE-----.*?-----END CERTIFICATE-----', data, re.S)
    require(bool(certificates), 'unclassified certificate file')
    return {hashlib.sha256(ssl.PEM_cert_to_DER_cert(pem.decode('ascii'))).hexdigest()
            for pem in certificates}


def verify_ca(data):
    require(hashlib.sha256(data).hexdigest() == CA_SHA256, 'CA checksum mismatch')
    hashes = fingerprints(data)
    require(len(hashes) >= 50 and not hashes & BLOCKED, 'CA content rejected')
    require(b'PRIVATE KEY' not in data, 'CA file contains key material')


def selected_environment(bundle, empty):
    return {name: str(bundle if not name.endswith(('DIR', 'CAPATH')) else empty)
            for name in ('SSL_CERT_FILE', 'SSL_CERT_DIR', 'CURL_CA_BUNDLE',
                         'GIT_SSL_CAINFO', 'GIT_SSL_CAPATH', 'REQUESTS_CA_BUNDLE',
                         'PIP_CERT', 'AWS_CA_BUNDLE', 'CLOUDSDK_CORE_CUSTOM_CA_CERTS_FILE',
                         'CARGO_HTTP_CAINFO')}


def protected(path):
    for value in (path, *path.parents):
        item = value.lstat()
        require(not value.is_symlink() and item.st_uid == 0 and not item.st_mode & 0o022,
                'unprotected host trust path')


def harden_distribution_sources(share, sources, allow_hardening):
    """Remove write access from a bounded, root-owned distribution CA tree.

    Some hosted Ubuntu images make these public sources world-writable. Check
    every object before changing permissions; never follow links or touch the
    other children of /usr/share. Containers must arrive with protected sources.
    """
    require(sources.parent == share, 'unexpected distribution source location')
    protected(share.parent)
    pending, records = [sources], []
    item = share.lstat()
    require(stat.S_ISDIR(item.st_mode) and item.st_uid == 0,
            'untrusted distribution source directory')
    records.append((share, item))
    while pending:
        path = pending.pop()
        item = path.lstat()
        require(item.st_uid == 0 and (stat.S_ISDIR(item.st_mode) or stat.S_ISREG(item.st_mode)),
                'unknown distribution source owner or type')
        require(not stat.S_ISREG(item.st_mode) or item.st_nlink == 1,
                'hard-linked distribution source requires review')
        records.append((path, item))
        require(len(records) <= 4096, 'distribution source tree exceeds review bound')
        if stat.S_ISDIR(item.st_mode):
            pending.extend(path.iterdir())
    require(allow_hardening or not any(item.st_mode & 0o022 for _, item in records),
            'container distribution sources require protected permissions')
    changed = 0
    for path, expected in sorted(records, key=lambda record: len(record[0].parts)):
        protected(path.parent)
        flags = os.O_RDONLY | os.O_NOFOLLOW
        if stat.S_ISDIR(expected.st_mode):
            flags |= os.O_DIRECTORY
        descriptor = os.open(path, flags)
        try:
            current = os.fstat(descriptor)
            require((current.st_dev, current.st_ino, current.st_uid, current.st_mode, current.st_nlink) ==
                    (expected.st_dev, expected.st_ino, expected.st_uid, expected.st_mode, expected.st_nlink),
                    'distribution source changed during hardening')
            mode = stat.S_IMODE(current.st_mode)
            if mode & 0o022:
                os.fchmod(descriptor, mode & ~0o022)
                changed += 1
            after = os.fstat(descriptor)
            visible = path.lstat()
            require(after.st_uid == 0 and not after.st_mode & 0o022 and
                    (not stat.S_ISREG(after.st_mode) or after.st_nlink == 1) and
                    (visible.st_dev, visible.st_ino, visible.st_mode) ==
                    (after.st_dev, after.st_ino, after.st_mode),
                    'distribution source hardening not retained')
        finally:
            os.close(descriptor)
    return {'source_objects_checked': len(records), 'source_permissions_hardened': changed}


def run(arguments, **kwargs):
    return subprocess.run(arguments, capture_output=True, text=True, timeout=60, check=True,
                          env={'PATH': '/usr/sbin:/usr/bin:/sbin:/bin', 'LANG': 'C'}, **kwargs)


def host_plan(configuration, sources, local):
    original = configuration.read_text()
    lines, changed = [], 0
    for line in original.splitlines(keepends=True):
        name = line.strip()
        if name and not name.startswith(('#', '!')):
            relative = Path(name)
            require(not relative.is_absolute() and '..' not in relative.parts, 'unknown CA configuration path')
            source = sources / relative
            if fingerprints(source.read_bytes()) & BLOCKED:
                line = '!' + line
                changed += 1
        lines.append(line)
    quarantined = []
    for file in local.rglob('*.crt'):
        hashes = fingerprints(file.read_bytes())
        if hashes & BLOCKED:
            require(not hashes - BLOCKED, 'mixed custom CA bundle requires review')
            quarantined.append(file)
    return original, ''.join(lines), changed, quarantined


def store_fingerprints(directory):
    hashes = set()
    for file in directory.iterdir():
        if file.is_file():
            data = file.read_bytes()
            if b'-----BEGIN CERTIFICATE-----' in data:
                hashes |= fingerprints(data)
    require(len(hashes) >= 50, 'Linux CA store unexpectedly narrow')
    return hashes


def container_context():
    marker = Path('/.dockerenv')
    return marker.is_file() and not marker.is_symlink()


def repair_linux_store():
    require(sys.platform == 'linux' and os.geteuid() == 0 and os.environ.get('GITHUB_ACTIONS') == 'true' and os.environ.get('RUNNER_ENVIRONMENT') == 'github-hosted', 'isolated GitHub-hosted Ubuntu root action required')
    configuration = Path('/etc/ca-certificates.conf')
    sources, local = Path('/usr/share/ca-certificates'), Path('/usr/local/share/ca-certificates')
    permissions = harden_distribution_sources(sources.parent, sources, not container_context())
    for path in (configuration, sources, local):
        protected(path)
    current_roots = store_fingerprints(Path('/etc/ssl/certs'))
    original, patched, disabled, quarantine = host_plan(configuration, sources, local)
    for file in quarantine:
        protected(file)
    backup = Path('/var/lib/corpora-ci-trust')
    backup.mkdir(mode=0o700, exist_ok=True)
    protected(backup)
    saved = backup / ('configuration-' + hashlib.sha256(original.encode()).hexdigest())
    if not saved.exists():
        with saved.open('x') as stream:
            os.chmod(saved, 0o600)
            stream.write(original)
    else:
        protected(saved)
        require(saved.read_text() == original, 'host backup collision')
    for file in quarantine:
        destination = backup / (hashlib.sha256(file.read_bytes()).hexdigest() + '.crt')
        require(not destination.exists(), 'quarantine destination exists')
        file.rename(destination)
    if patched != original:
        # Configuration is a root-owned regular file in a protected directory.
        configuration.write_text(patched)
    # Preserve an already clean image's exact published bundle and hashed layout.
    # Disable source roots regardless, so a later package hook cannot restore them.
    regenerated = bool(current_roots & BLOCKED)
    if regenerated:
        run(['/usr/sbin/update-ca-certificates', '--fresh'])
    require(not store_fingerprints(Path('/etc/ssl/certs')) & BLOCKED, 'affected Linux anchors remain')
    return {'disabled_distribution_roots': disabled, 'quarantined_local_roots': len(quarantine),
            'regenerated': regenerated, **permissions}



def refresh_docker():
    docker = shutil.which('docker')
    if not docker:
        return {'available': False}
    # An ordinary user can inspect this hosted daemon; no credentialed config is used.
    with tempfile.TemporaryDirectory(prefix='corpora-docker-') as directory:
        args = [docker, '--config', directory]
        require(not run(args + ['ps', '-aq']).stdout.strip(),
                'start job services after trust bootstrap; preserve existing containers')
        run(['sudo', '-n', '/bin/systemctl', 'restart', 'docker'])
        require(not run(args + ['ps', '-aq']).stdout.strip(), 'unexpected containers after daemon refresh')
        for host in HOSTS:
            try:
                run(args + ['pull', host + '/corpora-ca-check:unused'])
            except subprocess.CalledProcessError as error:
                require('certificate signed by unknown authority' in error.stderr.lower(),
                        'Docker incident path is accepted or inconclusive')
            else:
                raise RuntimeError('Docker accepted an incident test endpoint')
        run(args + ['pull', 'registry.k8s.io/pause:3.10'])
    return {'available': True, 'incident_issuer_rejections': len(HOSTS), 'valid_control': True}


class RejectWindowsAssetRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        fp.close()
        raise RuntimeError('unexpected Windows trust asset redirect')


def repair_windows_store(source_commit, root, bundle, empty):
    """Load only same-commit assets whose independent digests match this helper."""
    require(isinstance(source_commit, str) and re.fullmatch(r'[0-9a-f]{40}', source_commit),
            'Windows bootstrap requires an immutable --source-commit')
    context = ssl.create_default_context(cafile=str(bundle))
    opener = urllib.request.build_opener(urllib.request.ProxyHandler({}),
                                        urllib.request.HTTPSHandler(context=context),
                                        RejectWindowsAssetRedirect())
    payloads = {}
    for name, (digest, limit) in WINDOWS_ASSETS.items():
        url = ('https://raw.githubusercontent.com/corpora-inc/encorpora/' + source_commit +
               '/.github/scripts/' + name)
        with opener.open(url, timeout=30) as response:
            require(response.url == url, 'unexpected Windows trust asset redirect')
            data = response.read(limit + 1)
        require(len(data) <= limit and hashlib.sha256(data).hexdigest() == digest,
                'Windows trust asset checksum or size mismatch')
        payloads[name] = data
    # Verify every asset before any import or native operation. Execute exactly
    # the verified bytes, rather than reopening a potentially replaced file.
    for name, data in payloads.items():
        path = root / name
        with path.open('xb') as output:
            output.write(data)
        path.chmod(0o600)
    modules = {}
    for name in ('windows_trust_inventory.py', 'windows_trust_repair.py'):
        module = types.ModuleType('_corpora_' + name[:-3])
        module.__file__ = str(root / name)
        module.__source_sha256__ = WINDOWS_ASSETS[name][0]
        exec(compile(payloads[name], module.__file__, 'exec'), module.__dict__)
        modules[name] = module
    return modules['windows_trust_repair.py'].repair(
        modules['windows_trust_inventory.py'],
        payloads['windows-trust-public-certificates.json'], bundle, empty)


def bootstrap(clients_only=False, source_commit=None):
    require(os.environ.get('GITHUB_ACTIONS') == 'true' and os.environ.get('RUNNER_ENVIRONMENT') == 'github-hosted', 'GitHub-hosted Actions execution required')
    require(not any(os.environ.get(name) for name in ('NODE_EXTRA_CA_CERTS', 'NODE_USE_SYSTEM_CA', 'NODE_TLS_REJECT_UNAUTHORIZED', 'GIT_SSL_NO_VERIFY')), 'custom Node/Git trust or bypass setting requires review')
    options = shlex.split(os.environ.get('NODE_OPTIONS', ''))
    require(options.count('--use-openssl-ca') == 1 and not any(flag.split('=', 1)[0] in ('--use-bundled-ca', '--use-system-ca') for flag in options),
            'workflow must select Node OpenSSL trust before actions')
    if sys.platform == 'win32':
        require(not clients_only, 'Windows job-container mode is unsupported')
        require(isinstance(source_commit, str) and re.fullmatch(r'[0-9a-f]{40}', source_commit),
                'Windows bootstrap requires an immutable --source-commit')
    parent = Path(os.environ['RUNNER_TEMP'])
    require(parent.is_dir() and '\n' not in str(parent) and '\r' not in str(parent), 'invalid runner temporary path')
    root = parent / 'corpora-ci-trust-v1'
    root.mkdir(mode=0o700)  # Existing/symlinked state is refused before download or activation.
    root.chmod(0o700)
    opener = urllib.request.build_opener(urllib.request.ProxyHandler({}))
    with opener.open(CA_URL, timeout=30) as response:
        require(response.url == CA_URL, 'unexpected CA redirect')
        data = response.read(300001)
    verify_ca(data)  # No bundle activation or environment output before the digest check.
    bundle, empty = root / 'ca-certificates.pem', root / 'empty'
    bundle.write_bytes(data)
    bundle.chmod(0o600)
    empty.mkdir(mode=0o700)
    environment = selected_environment(bundle, empty)
    environment['RUSTUP_USE_CURL'] = '1'
    host = None
    container_store = None
    docker = {'available': False}
    windows = None
    if sys.platform == 'linux':
        if clients_only:
            require(container_context() and os.geteuid() == 0, 'Linux job-container root context required')
            container_store = repair_linux_store()
        else:
            require(not container_context(), 'job containers must select --clients-only mode')
            source = str(Path(__file__).resolve())
            result = run(['sudo', '-n', '/usr/bin/env', 'GITHUB_ACTIONS=true', 'RUNNER_ENVIRONMENT=github-hosted', sys.executable, '-I', source, '--repair-linux-store'])
            host = json.loads(result.stdout)
            docker = refresh_docker()
    elif sys.platform == 'win32':
        windows = repair_windows_store(source_commit, root, bundle, empty)
    with Path(os.environ['GITHUB_ENV']).open('a') as stream:
        for name, value in environment.items():
            stream.write(name + '=' + value + '\n')
    return {'ca_sha256': CA_SHA256, 'selected_bundle': str(bundle), 'host': host, 'container_store': container_store, 'docker': docker, 'windows': windows,
            'scope': 'job clients only; host/bootstrap unverified' if clients_only else 'subsequent job clients; initial runner downloads unverified'}


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    mode = parser.add_mutually_exclusive_group()
    mode.add_argument('--repair-linux-store', action='store_true')
    mode.add_argument('--clients-only', action='store_true', help='repair Linux job-container trust as container root; never refresh the host daemon')
    parser.add_argument('--source-commit', help='full immutable helper commit used for verified Windows sibling assets')
    options = parser.parse_args()
    try:
        print(json.dumps(repair_linux_store() if options.repair_linux_store else bootstrap(options.clients_only, options.source_commit), sort_keys=True))
    except (RuntimeError, OSError, ValueError, subprocess.SubprocessError) as error:
        print(json.dumps({'ok': False, 'error': str(error) if isinstance(error, RuntimeError) else type(error).__name__}))
        raise SystemExit(1)
