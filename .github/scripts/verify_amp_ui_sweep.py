"""Require completed, disjoint browser partitions covering the whole inventory."""
import argparse
import json
from pathlib import Path


def verify(directory, shard_count):
    if shard_count < 1:
        raise ValueError('Shard count must be positive')
    paths = sorted(Path(directory).glob('shard-*.json'))
    if len(paths) != shard_count:
        raise ValueError(f'Expected {shard_count} manifests, found {len(paths)}')
    inventory = None
    indices, completed = set(), []
    for path in paths:
        value = json.loads(path.read_text())
        index = value.get('shardIndex')
        if (value.get('version') != 1 or type(index) is not int
                or not 0 <= index < shard_count
                or value.get('shardCount') != shard_count or index in indices):
            raise ValueError(f'{path.name}: invalid or duplicate shard identity')
        if path.name != f'shard-{index}.json':
            raise ValueError(f'{path.name}: filename does not match shard identity')
        ids = value.get('inventoryIds')
        if (not isinstance(ids, list) or not ids
                or any(not isinstance(item, str) or not item for item in ids)
                or len(set(ids)) != len(ids)):
            raise ValueError(f'{path.name}: invalid inventory')
        if inventory is None:
            inventory = ids
        elif inventory != ids:
            raise ValueError(f'{path.name}: inventory differs between shards')
        expected = ids[index::shard_count]
        if not expected or value.get('completedIds') != expected:
            raise ValueError(f'{path.name}: completed templates do not match its partition')
        indices.add(index)
        completed.extend(value['completedIds'])
    if indices != set(range(shard_count)) or sorted(completed) != sorted(inventory):
        raise ValueError('Partitions do not cover the inventory exactly once')
    return len(inventory)


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('directory', type=Path)
    parser.add_argument('--shards', type=int, required=True)
    args = parser.parse_args()
    count = verify(args.directory, args.shards)
    print(f'Browser sweep verified: {count} templates, {args.shards} disjoint completed partitions')
