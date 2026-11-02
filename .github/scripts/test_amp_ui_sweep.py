"""Missing, overlapping, partial and mismatched browser coverage must fail."""
import copy
import json
from pathlib import Path
import tempfile
import unittest

from verify_amp_ui_sweep import verify


class BrowserSweepCoverage(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory()
        self.addCleanup(self.temporary.cleanup)
        self.root = Path(self.temporary.name)
        inventory = [f'template-{index}' for index in range(19)]
        self.manifests = [dict(version=1, shardIndex=index, shardCount=8,
                               inventoryIds=inventory[:], completedIds=inventory[index::8])
                          for index in range(8)]

    def write(self, manifests):
        for path in self.root.glob('*.json'):
            path.unlink()
        for index, value in enumerate(manifests):
            (self.root / f'shard-{index}.json').write_text(json.dumps(value))

    def test_complete_partition_including_uneven_remainder_passes(self):
        self.write(self.manifests)
        self.assertEqual(verify(self.root, 8), 19)

    def test_missing_overlap_partial_or_changed_inventory_fails(self):
        for mutation in ('missing', 'duplicate-index', 'overlap', 'partial', 'extra',
                         'wrong-order', 'wrong-count', 'wrong-version', 'different-inventory',
                         'duplicate-inventory', 'empty-inventory', 'boolean-index'):
            with self.subTest(mutation=mutation):
                values = copy.deepcopy(self.manifests)
                first = values[0]
                if mutation == 'missing': values.pop()
                elif mutation == 'duplicate-index': values[1]['shardIndex'] = 0
                elif mutation == 'overlap': first['completedIds'] = values[1]['completedIds']
                elif mutation == 'partial': first['completedIds'].pop()
                elif mutation == 'extra': first['completedIds'].append('unknown')
                elif mutation == 'wrong-order': first['completedIds'].reverse()
                elif mutation == 'wrong-count': first['shardCount'] = 7
                elif mutation == 'wrong-version': first['version'] = 2
                elif mutation == 'different-inventory': first['inventoryIds'].reverse()
                elif mutation == 'duplicate-inventory': first['inventoryIds'].append('template-0')
                elif mutation == 'empty-inventory': first['inventoryIds'] = []
                elif mutation == 'boolean-index': first['shardIndex'] = False
                self.write(values)
                with self.assertRaises(ValueError): verify(self.root, 8)

    def test_filename_identity_and_invalid_json_fail(self):
        self.write(self.manifests)
        (self.root / 'shard-0.json').rename(self.root / 'shard-99.json')
        with self.assertRaises(ValueError): verify(self.root, 8)
        self.write(self.manifests)
        (self.root / 'shard-0.json').write_text('{')
        with self.assertRaises(ValueError): verify(self.root, 8)


if __name__ == '__main__':
    unittest.main()
