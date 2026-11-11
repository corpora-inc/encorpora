"""Private production state and a single-coordinator lock."""
from contextlib import contextmanager
import fcntl
import json
import os
from pathlib import Path

from providers import now


def read_json(path, default=None):
    path = Path(path)
    return json.loads(path.read_text()) if path.exists() else default


def private_destination(root, worktree):
    root, worktree = Path(root).resolve(), Path(worktree).resolve()
    if root == worktree or root.is_relative_to(worktree) or worktree.is_relative_to(root):
        raise ValueError('Private results and the public worktree must be separate trees')
    if any((parent/'.git').exists() for parent in (root, *root.parents)):
        raise ValueError('Private state must live outside Git checkouts')
    return root


@contextmanager
def coordinator_lock(path):
    """OS-owned lock, released after a crash without deleting useful state."""
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open('a+') as handle:
        try:
            fcntl.flock(handle, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError:
            raise RuntimeError('Another line command holds '+str(path)) from None
        handle.seek(0)
        handle.truncate()
        handle.write(json.dumps({'pid': os.getpid(), 'started_at': now()})+'\n')
        handle.flush()
        try:
            yield
        finally:
            fcntl.flock(handle, fcntl.LOCK_UN)
