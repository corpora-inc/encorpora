"""Exercise gRPC trust with temporary certificates and fresh client processes."""

import os
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest
from concurrent.futures import ThreadPoolExecutor

import grpc

WORKBENCH = Path(__file__).resolve().parents[1]
CLIENT = """
import sys
from unittest.mock import patch
import campaigns
with patch('certifi.where', return_value=sys.argv[1]):
    campaigns.configure_tls()
import grpc
with grpc.secure_channel(sys.argv[2], grpc.ssl_channel_credentials()) as channel:
    try:
        grpc.channel_ready_future(channel).result(timeout=3)
    except grpc.FutureTimeoutError:
        sys.exit(2)
"""


class TransportTrustTests(unittest.TestCase):
    def test_accepts_selected_ca_and_rejects_untrusted_server(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            for name in ['trusted', 'other']:
                subprocess.run([
                    'openssl', 'req', '-x509', '-newkey', 'rsa:2048', '-nodes',
                    '-keyout', str(root / f'{name}.key'),
                    '-out', str(root / f'{name}.pem'), '-days', '1',
                    '-subj', '/CN=localhost',
                    '-addext', 'subjectAltName=DNS:localhost',
                ], check=True, capture_output=True)
            server = grpc.server(ThreadPoolExecutor(max_workers=1))
            credentials = grpc.ssl_server_credentials([(
                (root / 'trusted.key').read_bytes(),
                (root / 'trusted.pem').read_bytes(),
            )])
            port = server.add_secure_port('localhost:0', credentials)
            self.assertGreater(port, 0)
            server.start()
            try:
                for name, expected in [('trusted', 0), ('other', 2)]:
                    with self.subTest(bundle=name):
                        env = {**os.environ, 'PYTHONPATH': str(WORKBENCH),
                               'PYTHONDONTWRITEBYTECODE': '1',
                               'GRPC_DEFAULT_SSL_ROOTS_FILE_PATH': str(root / 'other.pem')}
                        result = subprocess.run([
                            sys.executable, '-c', CLIENT, str(root / f'{name}.pem'),
                            f'localhost:{port}',
                        ], env=env, capture_output=True, text=True, timeout=15)
                        self.assertEqual(result.returncode, expected, result.stderr)
            finally:
                server.stop(0).wait()

    def test_missing_and_malformed_bundle_fail_before_channel_creation(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root / 'malformed.pem').write_text('not a certificate')
            for name in ['missing.pem', 'malformed.pem']:
                with self.subTest(bundle=name):
                    result = subprocess.run([
                        sys.executable, '-c', CLIENT, str(root / name), 'localhost:1',
                    ], env={**os.environ, 'PYTHONPATH': str(WORKBENCH),
                            'PYTHONDONTWRITEBYTECODE': '1'},
                        capture_output=True, text=True, timeout=15)
                    self.assertEqual(result.returncode, 1)
                    self.assertNotIn('channel_ready_future', result.stderr)
