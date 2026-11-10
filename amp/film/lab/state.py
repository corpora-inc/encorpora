"""Private experiment state and a single-coordinator lock."""
from contextlib import contextmanager
import fcntl
import json
import os
from pathlib import Path

from providers import now, write_json


def read_json(path, default=None):
    path = Path(path)
    return json.loads(path.read_text()) if path.exists() else default


def private_destination(root, worktree):
    root, worktree = Path(root).resolve(), Path(worktree).resolve()
    if root == worktree or root.is_relative_to(worktree) or worktree.is_relative_to(root):
        raise ValueError('Private results and the public worktree must be separate trees')
    return root


def freeze_protocol(path, value):
    """A resumed cohort cannot silently change its prompts or assignments."""
    path = Path(path)
    previous = read_json(path)
    if previous is not None and previous != value:
        raise RuntimeError('Experiment protocol changed; preserve this cohort and start a separate run')
    if previous is None:
        write_json(path, value)


@contextmanager
def coordinator_lock(path):
    """OS-owned lock, released after a crash without deleting useful state."""
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open('a+') as handle:
        try:
            fcntl.flock(handle, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError:
            raise RuntimeError('Another experiment coordinator holds '+str(path)) from None
        handle.seek(0)
        handle.truncate()
        handle.write(json.dumps({'pid': os.getpid(), 'started_at': now()})+'\n')
        handle.flush()
        try:
            yield
        finally:
            fcntl.flock(handle, fcntl.LOCK_UN)


def reconcile_interrupted(root):
    """Preserve unknown usage. Never create a fourth agent after a restart."""
    interrupted = []
    for path in (Path(root)/'runs').glob('**/*.json'):
        record = read_json(path, {})
        if record.get('status') != 'running':
            continue
        pid = record.get('pid')
        if pid:
            try:
                os.kill(pid, 0)
            except ProcessLookupError:
                pass
            else:
                raise RuntimeError(f'An earlier model process is active (PID {pid}); wait before resuming')
        record.update(status='failed', interrupted=True, usage_complete=False,
                      error='Coordinator interrupted before the usage receipt completed',
                      reconciled_at=now(), wall_seconds=None)
        record['api_dollars'] = 0 if record.get('transport') == 'subscription-cli' else None
        write_json(path, record)
        interrupted.append(str(path))
    return interrupted
