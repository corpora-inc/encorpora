#!/usr/bin/env python3
"""Reset specific Zheng EN segments to PENDING in pipeline_state_en.json.

Usage:
    /home/skyl/tts_venv/bin/python scripts/reset_pending_en.py <id1> <id2> ...

Backs up the pre-reset state to /tmp/zheng_pipeline_state_en.<ts>.bak.json
(NOT next to the source — see ~/.claude/projects/-home-skyl/memory/
 feedback_no_stray_bak_files.md). Atomic write of the new state file.
"""
import json
import shutil
import sys
from datetime import datetime, timezone
from pathlib import Path

PACK = Path('/home/skyl/encorpora/books/history/pirate-biographies/01-zheng-yi-sao/pack')
LANG = 'en'

RESET_FIELDS = {
    'status': 'PENDING',
    'retry_count': 0,
    'error': None,
    'validation_errors': [],
    'best_quality_score': None,
    'best_attempt': None,
    'plateau_count': 0,
    # endpoints persists historical data for calibration; keep
    # retry_history persists analytics; keep
}


def main() -> int:
    if len(sys.argv) < 2:
        print('usage: reset_pending_en.py <seg_id> [<seg_id>...]', file=sys.stderr)
        return 2

    ids = sys.argv[1:]
    state_path = PACK / f'pipeline_state_{LANG}.json'
    state = json.loads(state_path.read_text())

    ts = datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ')
    backup_path = Path(f'/tmp/zheng_pipeline_state_{LANG}.{ts}.bak.json')
    shutil.copy(state_path, backup_path)
    print(f'backup: {backup_path}', flush=True)

    reset, not_found, already_pending = [], [], []
    for sid in ids:
        if sid not in state or not isinstance(state[sid], dict):
            not_found.append(sid)
            continue
        seg = state[sid]
        if seg.get('status') == 'PENDING':
            already_pending.append(sid)
            continue
        for k, v in RESET_FIELDS.items():
            if k in seg:
                seg[k] = v
            elif v is not None and v != [] and v != 0:
                seg[k] = v
        seg['last_updated'] = datetime.now(timezone.utc).isoformat()
        reset.append(sid)

    # Atomic write
    tmp_path = state_path.with_suffix('.json.tmp')
    tmp_path.write_text(json.dumps(state, indent=2))
    tmp_path.replace(state_path)

    print(f'reset:           {len(reset)}: {reset}')
    print(f'already_pending: {len(already_pending)}: {already_pending}')
    print(f'not_found:       {len(not_found)}: {not_found}')
    return 0


if __name__ == '__main__':
    sys.exit(main())
