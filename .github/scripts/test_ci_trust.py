"""Security controls for trust activation, host selection and daemon isolation."""
import contextlib
import importlib.util
import io
import json
import os
from pathlib import Path
import re
import stat
import subprocess
import tempfile
from types import SimpleNamespace
import unittest
from unittest.mock import patch

SPEC = importlib.util.spec_from_file_location('ci_trust', Path(__file__).with_name('ci_trust.py'))
trust = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(trust)
ROOT = Path(__file__).resolve().parents[2]
CA = (ROOT / 'corpan/infra/terraform/tls-trust/ca-certificates.pem').read_bytes()
BAD = (ROOT / '.github/scripts/java-trust-fixtures/affected-roots.pem').read_bytes()


class BootstrapTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.root = Path(self.tmp.name)
        self.output = self.root / 'environment'
        self.output.write_text('PREEXISTING=preserved\n')
        self.environment = {'GITHUB_ACTIONS': 'true', 'RUNNER_ENVIRONMENT': 'github-hosted', 'NODE_OPTIONS': '--use-openssl-ca',
                            'RUNNER_TEMP': str(self.root), 'GITHUB_ENV': str(self.output)}

    def invoke(self, data=CA, clients_only=False, platform='darwin'):
        response = io.BytesIO(data)
        response.url = trust.CA_URL
        opener = SimpleNamespace(open=lambda *args, **kwargs: response)
        with patch.dict(os.environ, self.environment, clear=True), \
             patch.object(trust.sys, 'platform', platform), \
             patch.object(trust.urllib.request, 'build_opener', return_value=opener):
            return trust.bootstrap(clients_only)

    def test_real_public_bundle_and_blocked_fixture(self):
        trust.verify_ca(CA)
        self.assertEqual(len(trust.fingerprints(BAD) & trust.BLOCKED), 2)
        self.assertFalse(trust.fingerprints(BAD) - trust.BLOCKED)
        with self.assertRaisesRegex(RuntimeError, 'checksum'):
            trust.verify_ca(CA + b' ')

    def test_checksum_failure_never_activates_bundle_or_exports_environment(self):
        before = self.output.read_bytes()
        with patch.object(trust, 'repair_linux_store') as host:
            with self.assertRaisesRegex(RuntimeError, 'checksum'):
                self.invoke(CA + b' ')
            host.assert_not_called()
        self.assertEqual(self.output.read_bytes(), before)
        self.assertFalse((self.root / 'corpora-ci-trust-v1/ca-certificates.pem').exists())

    def test_verified_bundle_selects_private_stable_exclusive_paths(self):
        result = self.invoke()
        bundle = Path(result['selected_bundle'])
        empty = bundle.parent / 'empty'
        self.assertEqual(bundle.read_bytes(), CA)
        self.assertEqual(bundle.stat().st_mode & 0o777, 0o600)
        self.assertEqual(empty.stat().st_mode & 0o777, 0o700)
        self.assertEqual(list(empty.iterdir()), [])
        values = dict(line.split('=', 1) for line in self.output.read_text().splitlines())
        self.assertEqual(values['PREEXISTING'], 'preserved')
        for key in ('SSL_CERT_FILE', 'CURL_CA_BUNDLE', 'GIT_SSL_CAINFO', 'CARGO_HTTP_CAINFO'):
            self.assertEqual(values[key], str(bundle))
        self.assertEqual(values['SSL_CERT_DIR'], str(empty))
        self.assertEqual(values['GIT_SSL_CAPATH'], str(empty))
        self.assertEqual(values['RUSTUP_USE_CURL'], '1')
        self.assertNotIn('NODE_OPTIONS', values)  # GitHub forbids exporting this through GITHUB_ENV.

    def test_existing_or_symlinked_state_refused_without_network_or_export(self):
        for symlink in (False, True):
            target = self.root / 'corpora-ci-trust-v1'
            if symlink:
                target.symlink_to(self.root)
            else:
                target.mkdir()
            before = self.output.read_bytes()
            with self.assertRaises(FileExistsError):
                self.invoke()
            self.assertEqual(self.output.read_bytes(), before)
            target.unlink() if symlink else target.rmdir()

    def test_missing_node_selector_refused_before_network(self):
        self.environment['NODE_OPTIONS'] = ''
        with self.assertRaisesRegex(RuntimeError, 'Node OpenSSL'):
            self.invoke()
        self.assertFalse((self.root / 'corpora-ci-trust-v1').exists())

    def test_self_hosted_runner_refused_before_network_or_environment_changes(self):
        self.environment['RUNNER_ENVIRONMENT'] = 'self-hosted'
        before = self.output.read_bytes()
        with self.assertRaisesRegex(RuntimeError, 'GitHub-hosted'):
            self.invoke()
        self.assertEqual(self.output.read_bytes(), before)
        self.assertFalse((self.root / 'corpora-ci-trust-v1').exists())

    def test_additional_node_roots_and_verification_bypasses_refused(self):
        for name in ('NODE_EXTRA_CA_CERTS', 'NODE_USE_SYSTEM_CA', 'NODE_TLS_REJECT_UNAUTHORIZED', 'GIT_SSL_NO_VERIFY'):
            with self.subTest(name=name):
                self.environment[name] = 'unreviewed'
                with self.assertRaisesRegex(RuntimeError, 'requires review'):
                    self.invoke()
                self.environment.pop(name)
                self.assertFalse((self.root / 'corpora-ci-trust-v1').exists())

    def test_job_container_repairs_its_store_without_host_subprocess_or_daemon(self):
        with patch.object(trust, 'container_context', return_value=True), \
             patch.object(trust.os, 'geteuid', return_value=0), \
             patch.object(trust, 'repair_linux_store', return_value={'regenerated': True}) as store, \
             patch.object(trust, 'run') as command, patch.object(trust, 'refresh_docker') as restart:
            result = self.invoke(clients_only=True, platform='linux')
        store.assert_called_once()
        command.assert_not_called()
        restart.assert_not_called()
        self.assertIsNone(result['host'])
        self.assertEqual(result['container_store'], {'regenerated': True})
        self.assertIn('host/bootstrap unverified', result['scope'])

    def test_host_plan_preserves_unaffected_sources_and_only_selects_exact_bad_roots(self):
        sources, local = self.root / 'sources', self.root / 'local'
        sources.mkdir(); local.mkdir()
        good = re.findall(rb'-----BEGIN CERTIFICATE-----.*?-----END CERTIFICATE-----', CA, re.S)[0]
        (sources / 'bad.crt').write_bytes(BAD)
        (sources / 'good.crt').write_bytes(good)
        (local / 'blocked.crt').write_bytes(BAD)
        (local / 'custom.crt').write_bytes(good)
        config = self.root / 'config'
        config.write_text('# preserve comment\nbad.crt\ngood.crt\n!previous.crt\n')
        original, patched, disabled, quarantine = trust.host_plan(config, sources, local)
        self.assertEqual(config.read_text(), original)
        self.assertEqual(patched, '# preserve comment\n!bad.crt\ngood.crt\n!previous.crt\n')
        self.assertEqual(disabled, 1)
        self.assertEqual(quarantine, [local / 'blocked.crt'])
        self.assertEqual((local / 'custom.crt').read_bytes(), good)
        (local / 'mixed.crt').write_bytes(BAD + b'\n' + good)
        with self.assertRaisesRegex(RuntimeError, 'mixed custom CA'):
            trust.host_plan(config, sources, local)
        (local / 'mixed.crt').unlink()
        config.write_text('../outside.crt\n')
        with self.assertRaisesRegex(RuntimeError, 'configuration path'):
            trust.host_plan(config, sources, local)

    def test_existing_containers_prevent_daemon_restart(self):
        with patch.object(trust.shutil, 'which', return_value='/usr/bin/docker'), \
             patch.object(trust, 'run', return_value=SimpleNamespace(stdout='service-id\n')) as run:
            with self.assertRaisesRegex(RuntimeError, 'preserve existing containers'):
                trust.refresh_docker()
            self.assertEqual(run.call_count, 1)
            self.assertEqual(run.call_args.args[0][-2:], ['ps', '-aq'])

    def test_daemon_requires_twelve_explicit_certificate_failures_and_valid_control(self):
        pulls = []
        def run(args, **kwargs):
            if 'pull' in args:
                pulls.append(args[-1])
                if 'registry.k8s.io' not in args[-1]:
                    diagnostic = ('x509: certificate signed by unknown authority' if len(pulls) % 2 else
                                  'Error response from daemon: Get "https://' + args[-1].split('/')[0] +
                                  '/v2/": tls: failed to verify certificate: x509: no valid chains built\n')
                    raise subprocess.CalledProcessError(1, args, stderr=diagnostic)
            return SimpleNamespace(stdout='')
        with patch.object(trust.shutil, 'which', return_value='/usr/bin/docker'), patch.object(trust, 'run', side_effect=run):
            result = trust.refresh_docker()
        self.assertEqual(len(pulls), 13)
        self.assertEqual(result['incident_certificate_rejections'], 12)
        self.assertTrue(result['valid_control'])

    def test_daemon_acceptance_and_inconclusive_errors_stop_verification(self):
        for diagnostic in (None, '', 'DNS timeout', 'certificate has expired', 'certificate is valid for another host',
                           "invalid character '<'", 'HTTP 500: x509: no valid chains built',
                           'tls: failed to verify certificate: x509: no valid chains built: 1 candidate chains with invalid policies',
                           'tls: failed to verify certificate: x509: no valid chains built; unrelated error'):
            def run(args, **kwargs):
                if 'pull' in args and diagnostic is not None:
                    raise subprocess.CalledProcessError(1, args, stderr=diagnostic)
                return SimpleNamespace(stdout='')
            with self.subTest(diagnostic=diagnostic), \
                 patch.object(trust.shutil, 'which', return_value='/usr/bin/docker'), \
                 patch.object(trust.time, 'sleep'), contextlib.redirect_stderr(io.StringIO()), \
                 patch.object(trust, 'run', side_effect=run):
                with self.assertRaises(RuntimeError):
                    trust.refresh_docker()

    def test_daemon_valid_control_failure_is_not_a_success(self):
        def run(args, **kwargs):
            if 'pull' in args:
                raise subprocess.CalledProcessError(1, args, stderr=
                    'tls: failed to verify certificate: x509: no valid chains built')
            return SimpleNamespace(stdout='')
        with patch.object(trust.shutil, 'which', return_value='/usr/bin/docker'), \
             patch.object(trust.time, 'sleep'), contextlib.redirect_stderr(io.StringIO()), \
             patch.object(trust, 'run', side_effect=run):
            with self.assertRaises(subprocess.CalledProcessError):
                trust.refresh_docker()


class DockerRetryTests(unittest.TestCase):
    """Daemon errors below were captured from Docker 29 against stub registries."""
    FIRST, SECOND = trust.HOSTS[:2]
    REJECTED = ('Error response from daemon: Get "https://h/v2/": tls: failed to verify certificate: '
                'x509: no valid chains built\n')
    TRANSPORT = ('Error response from daemon: Get "https://h/v2/": net/http: TLS handshake timeout',
                 'Error response from daemon: Get "https://h/v2/": EOF',
                 'Error response from daemon: Get "https://h/v2/": net/http: request canceled while waiting '
                 'for connection (Client.Timeout exceeded while awaiting headers)',
                 'Error response from daemon: Get "https://h/v2/": read tcp 1.2.3.4:5->6.7.8.9:443: read: '
                 'connection reset by peer',
                 'Error response from daemon: Get "https://h/v2/": dial tcp: lookup h: no such host',
                 'Cannot connect to the Docker daemon at unix:///var/run/docker.sock.',
                 '')
    # Each one needs a finished TLS handshake. The real incident hosts answer every
    # path with 200 text/plain, so their acceptance looks like the first, not exit 0.
    HTTP_ANSWERS = ('Error response from daemon: unsupported manifest media type and no default available: text/plain',
                    'Error response from daemon: received unexpected HTTP status: 503 Service Unavailable',
                    'Error response from daemon: unknown: Your client successfully connected to the site.',
                    'Error response from daemon: unauthorized: Your client successfully connected to the site.',
                    'Error response from daemon: failed to resolve reference "h/x:unused": unexpected status '
                    'from HEAD request to https://h/v2/x/manifests/unused: 503 Service Unavailable')

    def refresh(self, script=None):
        """Run the probe. A script maps a pull to outcomes: None exits 0, text fails."""
        self.pulls, self.sleeps, self.timeouts = [], [], []
        remaining = {target: list(outcomes) for target, outcomes in (script or {}).items()}
        def run(args, **kwargs):
            if 'pull' not in args:
                return SimpleNamespace(stdout='')
            target = args[-1].removesuffix('/corpora-ca-check:unused')
            self.pulls.append(target)
            self.timeouts.append(kwargs.get('timeout'))
            if remaining.get(target):
                outcome = remaining[target].pop(0)
            else:
                outcome = None if target == trust.VALID_CONTROL else self.REJECTED
            if isinstance(outcome, Exception):
                raise outcome
            if outcome is not None:
                raise subprocess.CalledProcessError(1, args, stderr=outcome)
            return SimpleNamespace(stdout='')
        log = io.StringIO()
        try:
            with patch.object(trust.shutil, 'which', return_value='/usr/bin/docker'), \
                 patch.object(trust.time, 'sleep', side_effect=self.sleeps.append), \
                 contextlib.redirect_stderr(log), patch.object(trust, 'run', side_effect=run):
                return trust.refresh_docker()
        finally:
            self.log = log.getvalue()

    def test_clean_probe_never_retries_or_logs(self):
        result = self.refresh()
        self.assertEqual(self.pulls, [*trust.HOSTS, trust.VALID_CONTROL])
        self.assertEqual((self.sleeps, self.log), ([], ''))
        self.assertEqual(result['incident_certificate_rejections'], 12)

    def test_accepted_endpoint_fails_immediately(self):
        with self.assertRaisesRegex(RuntimeError, 'Docker accepted an incident test endpoint'):
            self.refresh({self.FIRST: [None]})
        self.assertEqual((self.pulls, self.sleeps), ([self.FIRST], []))

    def test_acceptance_after_an_inconclusive_attempt_still_fails_immediately(self):
        with self.assertRaisesRegex(RuntimeError, 'Docker accepted an incident test endpoint'):
            self.refresh({self.FIRST: [self.TRANSPORT[0], None]})
        self.assertEqual((self.pulls, self.sleeps), ([self.FIRST] * 2, [5]))

    def test_http_level_answers_prove_the_handshake_and_fail_without_retry(self):
        for answer in self.HTTP_ANSWERS:
            with self.subTest(answer=answer):
                with self.assertRaisesRegex(RuntimeError, 'accepted or inconclusive'):
                    self.refresh({self.FIRST: [answer, self.REJECTED]})
                self.assertEqual((self.pulls, self.sleeps), ([self.FIRST], []))
                self.assertEqual(json.loads(self.log)['attempt'], 1)

    def test_http_level_answer_after_an_inconclusive_attempt_cannot_be_retried_away(self):
        with self.assertRaisesRegex(RuntimeError, 'accepted or inconclusive'):
            self.refresh({self.FIRST: [self.TRANSPORT[0], self.HTTP_ANSWERS[0], self.REJECTED]})
        self.assertEqual((self.pulls, self.sleeps), ([self.FIRST] * 2, [5]))

    def test_inconclusive_attempts_then_rejection_pass_after_backoff(self):
        timeout = subprocess.TimeoutExpired(['docker'], 20)
        for failure in (*self.TRANSPORT, timeout):
            with self.subTest(failure=failure):
                result = self.refresh({self.FIRST: [failure, failure]})
                self.assertEqual(self.pulls, [self.FIRST] * 3 + trust.HOSTS[1:] + [trust.VALID_CONTROL])
                self.assertEqual(self.sleeps, [5, 15])
                self.assertEqual(result['incident_certificate_rejections'], 12)
                self.assertTrue(result['valid_control'])

    def test_always_inconclusive_host_fails_at_the_bound_and_stops_the_probe(self):
        for failure in (self.TRANSPORT[0], subprocess.TimeoutExpired(['docker'], 20)):
            with self.subTest(failure=failure):
                with self.assertRaisesRegex(RuntimeError, '^Docker incident path is accepted or inconclusive$'):
                    self.refresh({self.FIRST: [failure] * 9})
                self.assertEqual((self.pulls, self.sleeps), ([self.FIRST] * 3, [5, 15]))
                self.assertEqual([json.loads(line)['attempt'] for line in self.log.splitlines()], [1, 2, 3])

    def test_retry_budget_is_shared_across_hosts(self):
        script = {host: [self.TRANSPORT[0]] for host in trust.HOSTS}
        with self.assertRaisesRegex(RuntimeError, 'accepted or inconclusive'):
            self.refresh(script)
        self.assertEqual(self.sleeps, [5] * trust.INCIDENT_RETRY_BUDGET)
        self.assertEqual(self.pulls.count(trust.HOSTS[trust.INCIDENT_RETRY_BUDGET]), 1)
        self.assertNotIn(trust.HOSTS[trust.INCIDENT_RETRY_BUDGET + 1], self.pulls)

    def test_retries_cannot_outlast_a_ten_minute_job(self):
        # Worst passing path: the budget's longest backoffs, then every pull at its cap.
        timeout = subprocess.TimeoutExpired(['docker'], 20)
        script = {host: [timeout, timeout] for host in trust.HOSTS[:3]}
        script[trust.VALID_CONTROL] = [timeout, timeout]
        self.assertTrue(self.refresh(script)['valid_control'])
        self.assertEqual(len(self.pulls), 12 + trust.INCIDENT_RETRY_BUDGET + 3)
        self.assertLess(sum(self.timeouts) + sum(self.sleeps), 600)

    def test_pull_timeouts_reach_the_command_and_other_commands_keep_the_default(self):
        self.refresh()
        self.assertEqual(self.timeouts, [trust.INCIDENT_PULL_TIMEOUT] * 12 + [trust.CONTROL_PULL_TIMEOUT])
        self.assertGreater(trust.INCIDENT_PULL_TIMEOUT, 15)
        with patch.object(trust.subprocess, 'run') as execute:
            trust.run(['x'])
            self.assertEqual(execute.call_args.kwargs['timeout'], 60)
            trust.run(['x'], timeout=20)
            self.assertEqual(execute.call_args.kwargs['timeout'], 20)

    def test_valid_control_is_retried_and_still_fails_after_the_bound(self):
        failure = 'Error response from daemon: Get "https://registry.k8s.io/v2/": EOF'
        result = self.refresh({trust.VALID_CONTROL: [failure, subprocess.TimeoutExpired(['docker'], 30)]})
        self.assertTrue(result['valid_control'])
        self.assertEqual(self.sleeps, [5, 15])
        self.assertEqual(self.pulls.count(trust.VALID_CONTROL), 3)
        with self.assertRaises(subprocess.CalledProcessError):
            self.refresh({trust.VALID_CONTROL: [failure] * 9})
        self.assertEqual(self.pulls.count(trust.VALID_CONTROL), 3)
        with self.assertRaises(subprocess.TimeoutExpired):
            self.refresh({trust.VALID_CONTROL: [subprocess.TimeoutExpired(['docker'], 30)] * 9})

    def test_diagnostic_is_one_bounded_line_without_workflow_commands(self):
        hostile = ('Error response from daemon: Get "https://h/v2/": x\n::add-mask::secret\r\n'
                   '##[set-output name=a]b\n' + 'y' * 500)
        with self.assertRaises(RuntimeError):
            self.refresh({self.FIRST: [hostile] * 3})
        lines = self.log.splitlines()
        self.assertEqual(len(lines), 3)
        entry = json.loads(lines[0])
        self.assertEqual((entry['docker_pull'], entry['attempt'], entry['error']), (self.FIRST, 1, 'CalledProcessError'))
        self.assertLessEqual(len(entry['stderr']), 200)
        self.assertNotIn('##[', self.log)
        self.assertTrue(all(line.startswith('{') for line in lines))

    def test_timeout_bytes_are_decoded_for_the_diagnostic(self):
        failure = subprocess.TimeoutExpired(['docker'], 20, stderr=b'partial \xff output')
        with self.assertRaises(RuntimeError):
            self.refresh({self.FIRST: [failure] * 3})
        self.assertIn('partial', json.loads(self.log.splitlines()[0])['stderr'])

    def test_failure_report_names_the_failed_linux_command_only(self):
        failure = subprocess.CalledProcessError(1, ['sudo', '-n', '/bin/systemctl', 'restart', 'docker'],
                                                output='', stderr='unit failed\n::add-mask::x')
        with patch.object(trust.sys, 'platform', 'linux'):
            report = trust.failure_report(failure)
            self.assertEqual(report['error'], 'CalledProcessError')
            self.assertEqual(report['command'], 'sudo -n /bin/systemctl restart docker')
            self.assertEqual(report['output'], 'unit failed ::add-mask::x')
            self.assertEqual(trust.failure_report(RuntimeError('plain')), {'ok': False, 'error': 'plain'})
        with patch.object(trust.sys, 'platform', 'win32'):
            self.assertEqual(trust.failure_report(failure), {'ok': False, 'error': 'CalledProcessError'})


class DistributionPermissionsTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.root = Path(self.tmp.name)
        self.share = self.root / 'share'
        self.sources = self.share / 'ca-certificates'
        self.mozilla = self.sources / 'mozilla'
        self.mozilla.mkdir(parents=True)
        self.certificate = self.mozilla / 'root.crt'
        self.certificate.write_bytes(CA)
        self.outside = self.share / 'unrelated'
        self.outside.write_bytes(b'unrelated content')
        for path in (self.share, self.sources, self.mozilla, self.certificate, self.outside):
            path.chmod(0o777)

    def invoke(self, allow=True, unowned=None, race=False):
        original_lstat, original_fstat, original_open = Path.lstat, os.fstat, os.open
        def root_stat(value, owner=0):
            return SimpleNamespace(st_uid=owner, st_mode=value.st_mode, st_dev=value.st_dev,
                                   st_ino=value.st_ino, st_nlink=value.st_nlink)
        def lstat(path):
            return root_stat(original_lstat(path), 123 if path == unowned else 0)
        def open_file(path, flags):
            if race and path == self.certificate:
                replacement = path.with_name('replacement')
                replacement.write_bytes(b'replaced source')
                replacement.chmod(0o777)
                os.replace(replacement, path)
            return original_open(path, flags)
        with patch.object(Path, 'lstat', new=lstat), \
             patch.object(trust.os, 'fstat', side_effect=lambda fd: root_stat(original_fstat(fd))), \
             patch.object(trust.os, 'open', side_effect=open_file), \
             patch.object(trust, 'protected'):
            return trust.harden_distribution_sources(self.share, self.sources, allow)

    def test_hardening_preserves_bytes_inodes_other_bits_and_unrelated_share_children(self):
        content = self.certificate.read_bytes()
        inode = self.certificate.stat().st_ino
        result = self.invoke()
        self.assertEqual(result, {'source_objects_checked': 4, 'source_permissions_hardened': 4})
        self.assertEqual(self.certificate.read_bytes(), content)
        self.assertEqual(self.certificate.stat().st_ino, inode)
        for path in (self.share, self.sources, self.mozilla, self.certificate):
            self.assertEqual(stat.S_IMODE(path.stat().st_mode), 0o755)
        self.assertEqual(stat.S_IMODE(self.outside.stat().st_mode), 0o777)
        self.assertEqual(self.outside.read_bytes(), b'unrelated content')
        self.assertEqual(self.invoke()['source_permissions_hardened'], 0)

    def test_unknown_owner_symlink_hardlink_and_special_type_refused_before_any_chmod(self):
        for kind in ('owner', 'symlink', 'hardlink', 'fifo'):
            with self.subTest(kind=kind):
                extra = self.mozilla / 'extra'
                if kind == 'symlink': extra.symlink_to(self.outside)
                if kind == 'hardlink': os.link(self.certificate, extra)
                if kind == 'fifo': os.mkfifo(extra)
                try:
                    with self.assertRaises(RuntimeError):
                        self.invoke(unowned=self.certificate if kind == 'owner' else None)
                    self.assertEqual(stat.S_IMODE(self.share.stat().st_mode), 0o777)
                    self.assertEqual(stat.S_IMODE(self.certificate.stat().st_mode), 0o777)
                finally:
                    if extra.exists() or extra.is_symlink(): extra.unlink()

    def test_container_refuses_mutable_sources_without_changing_permissions(self):
        with self.assertRaisesRegex(RuntimeError, 'container distribution sources'):
            self.invoke(allow=False)
        self.assertEqual(stat.S_IMODE(self.share.stat().st_mode), 0o777)

    def test_replaced_inode_refused_before_chmod_of_replacement(self):
        with self.assertRaisesRegex(RuntimeError, 'changed during hardening'):
            self.invoke(race=True)
        self.assertEqual(stat.S_IMODE(self.certificate.stat().st_mode), 0o777)


class WindowsAssetLoaderTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.root = Path(self.tmp.name)
        self.bundle = self.root / 'ca.pem'
        self.bundle.write_bytes(CA)
        self.empty = self.root / 'empty'
        self.empty.mkdir()
        self.commit = '1' * 40
        self.assets = {name: (Path(__file__).parent / name).read_bytes()
                       for name in trust.WINDOWS_ASSETS}

    def invoke(self, fault=None, replace_file=False):
        events = []
        self.events = events
        def download(url, **kwargs):
            self.assertIn('/' + self.commit + '/.github/scripts/', url)
            name = url.rsplit('/', 1)[-1]
            events.append('download:' + name)
            data = self.assets[name]
            if fault == 'checksum' and name.endswith('.json'):
                data += b' '
            if fault == 'oversize' and name.endswith('.json'):
                data = b'x' * (trust.WINDOWS_ASSETS[name][1] + 1)
            response = io.BytesIO(data)
            response.url = url + '/redirect' if fault == 'redirect' else url
            return response
        def repaired(inventory, manifest, bundle, empty):
            events.append('repair')
            self.assertEqual(inventory.__source_sha256__,
                             trust.WINDOWS_ASSETS['windows_trust_inventory.py'][0])
            self.assertEqual(manifest, self.assets['windows-trust-public-certificates.json'])
            self.assertEqual((bundle, empty), (self.bundle, self.empty))
            return {'available': True, 'idempotent': True}
        def execute(code, namespace):
            events.append('execute:' + Path(namespace['__file__']).name)
            if replace_file:
                Path(namespace['__file__']).write_text("raise RuntimeError('unverified file executed')")
            exec(code, namespace)
            if namespace['__name__'].endswith('windows_trust_repair'):
                namespace['repair'] = repaired
        opener = SimpleNamespace(open=download)
        with patch.object(trust.urllib.request, 'build_opener', return_value=opener) as build, \
             patch.object(trust, 'exec', side_effect=execute, create=True):
            result = trust.repair_windows_store(self.commit, self.root, self.bundle, self.empty)
        handlers = build.call_args.args
        self.assertEqual(handlers[0].proxies, {})
        context = handlers[1]._context
        self.assertTrue(context.check_hostname)
        self.assertEqual(context.verify_mode, trust.ssl.CERT_REQUIRED)
        self.assertEqual(events[:3], ['download:' + name for name in trust.WINDOWS_ASSETS])
        self.assertEqual(events[-1], 'repair')
        return result

    def test_all_asset_digests_and_individual_limits_match_public_source(self):
        for name, (digest, limit) in trust.WINDOWS_ASSETS.items():
            self.assertLess(limit, 50000)
            self.assertLessEqual(len(self.assets[name]), limit)
            self.assertEqual(trust.hashlib.sha256(self.assets[name]).hexdigest(), digest)
        self.assertLess(Path(trust.__file__).stat().st_size, 50000)

    def test_all_assets_are_verified_before_native_module_execution(self):
        self.assertTrue(self.invoke()['idempotent'])

    def test_replaced_disk_file_cannot_replace_verified_in_memory_execution(self):
        self.assertTrue(self.invoke(replace_file=True)['available'])

    def test_checksum_size_and_redirect_fail_before_any_execution_or_asset_write(self):
        for fault in ('checksum', 'oversize', 'redirect'):
            with self.subTest(fault=fault):
                with self.assertRaises(RuntimeError):
                    self.invoke(fault)
                self.assertFalse(any(event.startswith('execute:') or event == 'repair' for event in self.events))
            self.assertEqual({p.name for p in self.root.iterdir()}, {'ca.pem', 'empty'})

    def test_mutable_or_malformed_revision_fails_before_network(self):
        for commit in (None, '', 'main', 'a' * 39, 'g' * 40, 'a' * 40 + '/path'):
            with patch.object(trust.urllib.request, 'build_opener') as network:
                with self.assertRaisesRegex(RuntimeError, 'immutable'):
                    trust.repair_windows_store(commit, self.root, self.bundle, self.empty)
                network.assert_not_called()

    def test_redirect_is_denied_without_following_even_if_destination_returns_to_original(self):
        from email.message import Message
        from urllib.response import addinfourl
        requests = []
        responses = []
        class RedirectingHTTPS(trust.urllib.request.HTTPSHandler):
            def https_open(inner, request):
                requests.append(request.full_url)
                headers = Message()
                # A second response would return to the original URL. It must
                # never be reached, even though a final-URL check could pass.
                headers['Location'] = request.full_url + '/elsewhere' if len(requests) == 1 else requests[0]
                response = addinfourl(io.BytesIO(b''), headers, request.full_url, 302)
                response.msg = 'Found'
                responses.append(response)
                return response
        with patch.object(trust.urllib.request, 'HTTPSHandler', RedirectingHTTPS), \
             patch.object(trust, 'exec', create=True) as execute:
            with self.assertRaisesRegex(RuntimeError, 'redirect'):
                trust.repair_windows_store(self.commit, self.root, self.bundle, self.empty)
        self.assertEqual(len(requests), 1)
        self.assertTrue(responses[0].closed)
        execute.assert_not_called()
        self.assertEqual({p.name for p in self.root.iterdir()}, {'ca.pem', 'empty'})


class WindowsBootstrapTests(unittest.TestCase):
    setUp = BootstrapTests.setUp
    def test_windows_requires_full_revision_and_supported_host_mode_before_network(self):
        with patch.dict(os.environ, self.environment, clear=True), \
             patch.object(trust.sys, 'platform', 'win32'), \
             patch.object(trust.urllib.request, 'build_opener') as network:
            with self.assertRaisesRegex(RuntimeError, 'immutable'):
                trust.bootstrap()
            with self.assertRaisesRegex(RuntimeError, 'job-container'):
                trust.bootstrap(True, '1' * 40)
        network.assert_not_called()
        self.assertFalse((self.root / 'corpora-ci-trust-v1').exists())

    def test_windows_store_failure_never_exports_partial_job_environment(self):
        response = io.BytesIO(CA)
        response.url = trust.CA_URL
        before = self.output.read_bytes()
        with patch.dict(os.environ, self.environment, clear=True), \
             patch.object(trust.sys, 'platform', 'win32'), \
             patch.object(trust.urllib.request, 'build_opener', return_value=SimpleNamespace(open=lambda *a, **k: response)), \
             patch.object(trust, 'repair_windows_store', side_effect=RuntimeError('unsafe synthetic store')):
            with self.assertRaisesRegex(RuntimeError, 'unsafe synthetic'):
                trust.bootstrap(source_commit='1' * 40)
        self.assertEqual(self.output.read_bytes(), before)

    def test_windows_exports_only_after_verified_repair_and_keeps_linux_daemon_untouched(self):
        response = io.BytesIO(CA)
        response.url = trust.CA_URL
        def repaired(commit, root, bundle, empty):
            self.assertEqual(commit, '1' * 40)
            self.assertEqual(self.output.read_text(), 'PREEXISTING=preserved\n')
            self.assertEqual(bundle.read_bytes(), CA)
            return {'available': True, 'fresh_default_context_clear': True}
        with patch.dict(os.environ, self.environment, clear=True), \
             patch.object(trust.sys, 'platform', 'win32'), \
             patch.object(trust.urllib.request, 'build_opener', return_value=SimpleNamespace(open=lambda *a, **k: response)), \
             patch.object(trust, 'repair_windows_store', side_effect=repaired), \
             patch.object(trust, 'refresh_docker') as docker:
            result = trust.bootstrap(source_commit='1' * 40)
        docker.assert_not_called()
        self.assertTrue(result['windows']['fresh_default_context_clear'])
        self.assertIn('SSL_CERT_FILE=', self.output.read_text())


if __name__ == '__main__':
    unittest.main()
