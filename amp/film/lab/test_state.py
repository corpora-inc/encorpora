from pathlib import Path
import tempfile
import unittest

from state import coordinator_lock, freeze_protocol, private_destination


class StateSafetyTests(unittest.TestCase):
    def test_only_one_coordinator_can_own_a_run(self):
        with tempfile.TemporaryDirectory() as directory:
            lock = Path(directory)/'coordinator.lock'
            with coordinator_lock(lock):
                with self.assertRaisesRegex(RuntimeError, 'Another experiment'):
                    with coordinator_lock(lock):
                        self.fail('second coordinator entered')
            with coordinator_lock(lock):
                self.assertTrue(lock.exists())

    def test_private_outputs_cannot_be_inside_public_worktree(self):
        with self.assertRaises(ValueError):
            private_destination('/tmp/repo/private', '/tmp/repo')
        with self.assertRaises(ValueError):
            private_destination('/tmp/repo', '/tmp/repo/work')
        self.assertEqual(private_destination('/tmp/private', '/tmp/repo'), Path('/tmp/private').resolve())

    def test_protocol_change_cannot_silently_enter_a_resumed_cohort(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory)/'protocol.json'
            freeze_protocol(path, {'prompt': 'first'})
            freeze_protocol(path, {'prompt': 'first'})
            with self.assertRaisesRegex(RuntimeError, 'protocol changed'):
                freeze_protocol(path, {'prompt': 'different'})


if __name__ == '__main__':
    unittest.main()
