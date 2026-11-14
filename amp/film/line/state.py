"""Private production state and scoped advisory locks."""
from contextlib import contextmanager
import fcntl
import json
import os
from pathlib import Path
import re

from providers import now


def read_json(path, default=None):
    path = Path(path)
    return json.loads(path.read_text()) if path.exists() else default


LETTER = re.compile(r'\*([a-z])\*', re.I)


def display_script(script):
    """The screenplay as the kit emits it (film/letters.ts displayScript): a letter marked
    to be spoken by name (*x*) is bare in every say. Compare emitted payloads against this,
    never against the raw screenplay, or any film with a marked letter looks stale."""
    return {**script, 'shots': [{**shot, 'beats': [{**beat, 'say': LETTER.sub(r'\1', beat['say'])} for beat in shot['beats']]}
                                for shot in script['shots']]}


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


@contextmanager
def command_lock(config, command, identifier=None, out=None):
    """Film work is independent; voice capacity and shared indexes are serialized."""
    from contextlib import ExitStack
    from hashlib import sha256
    root = Path(config.get('line_root', config['root']))
    with ExitStack() as stack:
        if identifier:
            # Caller validates identifiers before entering this boundary.
            stack.enter_context(coordinator_lock(root/'locks'/(identifier+'.lock')))
        elif command == 'facts':
            key = sha256(str(Path(out).resolve()).encode()).hexdigest()
            stack.enter_context(coordinator_lock(root/'locks'/('facts-'+key+'.lock')))
        if command == 'voice':
            stack.enter_context(coordinator_lock(root/'voice.lock'))
        elif command in ('predict', 'board', 'release', 'unrelease', 'follow-up'):
            stack.enter_context(shared_lock(config))
        yield


def shared_lock(config):
    # All configurations pointing at the same review data share this lock.
    return coordinator_lock(Path(config['live_data'])/'.line.lock')
