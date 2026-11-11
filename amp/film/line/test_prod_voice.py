import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

from prod_voice import POLICY, instrument_production_voice, migrate_voice_runtime
from providers import write_json
from runtime import digest, instrument_voice_retry


class ProductionVoiceTests(unittest.TestCase):

    def test_migration_verifies_archives_updates_hash_and_is_idempotent(self):
        source = (Path(__file__).resolve().parent.parent/'voice.ts').read_text()
        with tempfile.TemporaryDirectory() as directory:
            base = Path(directory)
            root, workspace = base/'private', base/'workspace'
            row = {'id': 'example--aa'}
            config = {'root': str(root), 'production': True}
            voice = workspace/'runtime/amp/film/voice.ts'
            voice.parent.mkdir(parents=True)
            before = instrument_voice_retry(source)
            voice.write_text(before)
            manifest_path = root/'films'/row['id']/'runtime-manifest.json'
            manifest = {'files': [{'relative': 'film/voice.ts', 'runtime_sha256': digest(voice),
                                   'source_sha256': 'source-stays-unchanged'}]}
            write_json(manifest_path, manifest)
            old_manifest = manifest_path.read_text()
            with patch('runtime.verify_runtime') as verify:
                receipt = migrate_voice_runtime(config, row, workspace)
                self.assertEqual(verify.call_count, 2)
                repeated = migrate_voice_runtime(config, row, workspace)
            self.assertEqual(receipt, repeated)
            archive = root/'runtime-migrations'/row['id']/POLICY
            self.assertEqual((archive/'voice.before.ts').read_text(), before)
            self.assertEqual((archive/'runtime-manifest.before.json').read_text(), old_manifest)
            current = json.loads(manifest_path.read_text())
            self.assertEqual(current['production_voice_policy'], POLICY)
            self.assertEqual(current['files'][0]['runtime_sha256'], digest(voice))
            self.assertEqual(current['files'][0]['source_sha256'], 'source-stays-unchanged')
            self.assertEqual(receipt['status'], 'completed')

    def test_migration_rejects_an_active_writer_before_mutating(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            row = {'id': 'example--aa'}
            write_json(root/'runs'/row['id']/'screenplay-sol-1.json',
                       {'status': 'running', 'role': 'screenplay'})
            with patch('runtime.verify_runtime'):
                with self.assertRaisesRegex(RuntimeError, 'active author'):
                    migrate_voice_runtime({'root': str(root), 'production': True}, row, root/'workspace')
            self.assertFalse((root/'runtime-migrations').exists())


if __name__ == '__main__':
    unittest.main()
