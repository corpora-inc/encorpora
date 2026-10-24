"""Prevent pre-checkout trust regressions and unsafe database-service ordering."""
import hashlib
import importlib.util
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch
import io
import os
import subprocess
import sys

import yaml

ROOT = Path(__file__).resolve().parents[2]
spec = importlib.util.spec_from_file_location('sync_ci_trust', Path(__file__).with_name('sync_ci_trust.py'))
sync = importlib.util.module_from_spec(spec)
spec.loader.exec_module(sync)
EXPECTED = yaml.safe_load('steps:\n' + sync.LOADER)['steps'][0]
SCRIPT = EXPECTED['run'].split("python3 -I - <<'PY'\n", 1)[1].rsplit('\nPY', 1)[0]


def validate(workflow):
    if workflow.get('env', {}).get('NODE_OPTIONS') != '--use-openssl-ca':
        raise ValueError('workflow must select exclusive Node trust')
    for job in workflow['jobs'].values():
        if 'uses' in job:
            continue
        if job.get('services') or job.get('container'):
            raise ValueError('pre-step service/container requires independent trust review')
        forbidden = {'NODE_OPTIONS', 'NODE_EXTRA_CA_CERTS', 'NODE_USE_SYSTEM_CA',
                     'NODE_TLS_REJECT_UNAUTHORIZED', 'GIT_SSL_NO_VERIFY',
                     'SSL_CERT_FILE', 'SSL_CERT_DIR', 'CURL_CA_BUNDLE', 'GIT_SSL_CAINFO',
                     'GIT_SSL_CAPATH', 'REQUESTS_CA_BUNDLE', 'PIP_CERT', 'AWS_CA_BUNDLE',
                     'CLOUDSDK_CORE_CUSTOM_CA_CERTS_FILE', 'CARGO_HTTP_CAINFO', 'RUSTUP_USE_CURL'}
        if forbidden.intersection(job.get('env', {})):
            raise ValueError('job overrides workflow trust')
        if job['steps'][0] != EXPECTED:
            raise ValueError('first step must be the pinned loader without conditions')
        for step in job['steps']:
            if forbidden.intersection(step.get('env', {})):
                raise ValueError('step overrides workflow trust')


class WorkflowTrust(unittest.TestCase):
    def test_all_runnable_jobs_bootstrap_before_actions_and_services(self):
        paths = sorted((* (ROOT / '.github/workflows').glob('*.yml'),
                        * (ROOT / '.github/workflows').glob('*.yaml')))
        self.assertTrue(paths)
        jobs = 0
        for path in paths:
            with self.subTest(workflow=path.name):
                workflow = yaml.safe_load(path.read_text())
                validate(workflow)
                jobs += sum('uses' not in job for job in workflow['jobs'].values())
                self.assertEqual(sync.synchronize(path.read_text()), path.read_text())
        self.assertGreater(jobs, 0)

    def test_missing_conditional_tampered_and_inherited_directory_bootstrap_fail(self):
        import copy
        fixture = {'env': {'NODE_OPTIONS': '--use-openssl-ca'},
                   'jobs': {'test': {'steps': [EXPECTED], 'defaults': {'run': {'working-directory': 'not-checked-out'}}}}}
        validate(fixture)
        for mutation in ('missing', 'condition', 'checksum', 'directory', 'services', 'node'):
            with self.subTest(mutation=mutation):
                value = copy.deepcopy(fixture)
                job = value['jobs']['test']
                if mutation == 'missing': job['steps'] = [{'uses': 'actions/checkout@v4'}]
                if mutation == 'condition': job['steps'][0]['if'] = 'false'
                if mutation == 'checksum': job['steps'][0]['run'] = SCRIPT.replace(sync.HELPER_SHA256, '0' * 64)
                if mutation == 'directory': del job['steps'][0]['working-directory']
                if mutation == 'services': job['services'] = {'postgres': {'image': 'postgres:17-alpine'}}
                if mutation == 'node': job['env'] = {'NODE_OPTIONS': '--use-bundled-ca'}
                with self.assertRaises(ValueError): validate(value)

    def test_later_empty_null_or_custom_trust_settings_cannot_clear_bootstrap(self):
        for scope in ('job', 'step'):
            for name in ('NODE_OPTIONS', 'NODE_EXTRA_CA_CERTS', 'NODE_USE_SYSTEM_CA',
                         'NODE_TLS_REJECT_UNAUTHORIZED', 'GIT_SSL_NO_VERIFY',
                         'SSL_CERT_FILE', 'SSL_CERT_DIR', 'CURL_CA_BUNDLE', 'GIT_SSL_CAINFO',
                         'GIT_SSL_CAPATH', 'REQUESTS_CA_BUNDLE', 'PIP_CERT', 'AWS_CA_BUNDLE',
                         'CLOUDSDK_CORE_CUSTOM_CA_CERTS_FILE', 'CARGO_HTTP_CAINFO', 'RUSTUP_USE_CURL'):
                for value in ('', None, 'custom-setting'):
                    with self.subTest(scope=scope, name=name, value=value):
                        job = {'steps': [EXPECTED, {'uses': 'actions/checkout@v4'}]}
                        target = job if scope == 'job' else job['steps'][1]
                        target['env'] = {name: value}
                        with self.assertRaises(ValueError):
                            validate({'env': {'NODE_OPTIONS': '--use-openssl-ca'}, 'jobs': {'test': job}})

    def test_changes_to_any_protected_workflow_route_to_existing_ci_scripts_gate(self):
        import shlex
        ci = yaml.safe_load((ROOT / '.github/workflows/ci.yml').read_text())
        body = next(step['run'] for step in ci['jobs']['changes']['steps'] if step.get('id') == 'filter')
        line = next(line.strip() for line in body.splitlines() if line.strip().startswith('set_output ci_scripts '))
        pattern = shlex.split(line)[2]
        paths = [str(path.relative_to(ROOT)) for path in (ROOT / '.github/workflows').glob('*.yml')]
        for name in paths + ['.github/workflows/future.yaml', '.github/scripts/test_workflow_trust.py']:
            with self.subTest(path=name):
                result = subprocess.run(['grep', '-Eq', pattern], input=name + '\n', text=True)
                self.assertEqual(result.returncode, 0)
        result = subprocess.run(['grep', '-Eq', pattern], input='amp/src/ordinary.ts\n', text=True)
        self.assertEqual(result.returncode, 1)

    def test_loader_rejects_altered_bytes_before_execution(self):
        class Response(io.BytesIO):
            url = 'https://raw.githubusercontent.com/corpora-inc/encorpora/' + sync.HELPER_COMMIT + '/.github/scripts/ci_trust.py'
        with patch('urllib.request.build_opener') as opener, patch('subprocess.run') as run:
            opener.return_value.open.return_value = Response(b'forged script')
            with self.assertRaises(SystemExit): exec(compile(SCRIPT, '<loader>', 'exec'), {})
            run.assert_not_called()

    def test_loader_executes_only_verified_real_temporary_file(self):
        # Consumer pins track a published revision independently of new helper
        # source changes. Exercise execution with a checksum-bound fixture.
        helper = b"print('verified fixture')\n"
        script = SCRIPT.replace(sync.HELPER_SHA256, hashlib.sha256(helper).hexdigest())
        class Response(io.BytesIO):
            url = 'https://raw.githubusercontent.com/corpora-inc/encorpora/' + sync.HELPER_COMMIT + '/.github/scripts/ci_trust.py'
        def execute(args, **kwargs):
            self.assertEqual(args[:2], [sys.executable, '-I'])
            file = Path(args[2])
            self.assertEqual(file.read_bytes(), helper)
            self.assertEqual(file.stat().st_mode & 0o777, 0o600)
            self.assertTrue(kwargs['check'])
            return subprocess.CompletedProcess(args, 0)
        with tempfile.TemporaryDirectory() as temporary, patch.dict(os.environ, {'RUNNER_TEMP': temporary}), \
             patch('urllib.request.build_opener') as opener, patch('subprocess.run', side_effect=execute) as run:
            opener.return_value.open.return_value = Response(helper)
            exec(compile(script, '<loader>', 'exec'), {})
            run.assert_called_once()
            self.assertFalse(list(Path(temporary).iterdir()))

    def test_postgres_runs_after_bootstrap_with_owned_cleanup_and_original_database(self):
        for name, identifier in (('ci.yml', 'amp-database'), ('amp-deep-checks.yml', 'amp-browser')):
            job = yaml.safe_load((ROOT / '.github/workflows' / name).read_text())['jobs'][identifier]
            self.assertNotIn('services', job)
            start, stop = job['steps'][1], job['steps'][-1]
            self.assertEqual(start['id'], 'ci-postgres')
            self.assertEqual(start['working-directory'], '${{ runner.temp }}')
            for value in ('postgres:17-alpine@sha256:', '--health-cmd', 'pg_isready -U amp',
                          'POSTGRES_USER=amp', 'POSTGRES_PASSWORD=amp', 'POSTGRES_DB=amp_test',
                          '--publish 127.0.0.1:5432:5432', '>> "$GITHUB_OUTPUT"', 'for attempt in {1..20}'):
                self.assertIn(value, start['run'])
            self.assertEqual(stop['if'], "${{ always() && steps.ci-postgres.outputs.container_id != '' }}")
            self.assertEqual(stop['env']['CI_POSTGRES_CONTAINER_ID'], '${{ steps.ci-postgres.outputs.container_id }}')
            self.assertIn('^[0-9a-f]{64}$', stop['run'])
            self.assertIn('docker rm --force --volumes "$CI_POSTGRES_CONTAINER_ID"', stop['run'])
            self.assertEqual(job['env']['AMP_TEST_DATABASE_URL'], 'postgres://amp:amp@127.0.0.1:5432/amp_test')


if __name__ == '__main__':
    unittest.main()
