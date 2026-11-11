"""Production boards and blind exports using the installed review player."""
from __future__ import annotations

import argparse
import json
import os
from pathlib import Path
import sys

from providers import clean_environment, write_json
from runtime import HERE, _run, pages, workspace_for
from state import read_json


def _worker(config, mode, *, identifier='', items=None):
    env = clean_environment()
    env['FILM_LINE_HEAVY'] = '1'
    command = [config['heavy'], sys.executable, str(HERE/'prod_runtime.py'), mode,
               '--config', config['_config_path']]
    if identifier:
        command += ['--id', identifier]
    if items:
        command += ['--items', str(items)]
    return _run(command, config['worktree'], env)


def capture_worker(config, items_path):
    """Read the live player's HTML/assets at capture time; never freeze a copy."""
    if not os.environ.get('FILM_LINE_HEAVY'):
        raise RuntimeError('Browser captures require the heavy-command gate')
    root = Path(config['root'])
    env = clean_environment()
    env['FILM_LINE_HEAVY'] = '1'
    result = _run([config.get('node', 'node'), '--import', 'tsx', str(HERE/'capture.ts'),
                   '--items', str(items_path), '--url', config['player_url'],
                   '--out', str(root/'boards')],
                  Path(config['worktree'])/'amp', env)
    if result['exit_code']:
        raise RuntimeError(result['stderr'][-6000:] or result['stdout'][-6000:])
    for item in read_json(items_path):
        directory = root/'boards'/item['id']
        images = pages(directory/'board-wide', directory/'pages', 'wide')
        images += pages(directory/'board-tall', directory/'pages', 'tall', True)
        write_json(directory/'pages.json', images)
    return result


def export_worker(config, row, workspace):
    from live_export import export_worker as export
    from runtime import completed_voice
    result = read_json(Path(config['root'])/'films'/row['id']/'voice-run.json',{})
    if result.get('exit_code') != 0 or not completed_voice(config, row, workspace):
        raise RuntimeError('Voiced timing has no passing kit check; export stopped')
    return export(config, row, workspace)


def export_film(config, row, workspace):
    result = _worker(config, 'export-worker', identifier=row['id'])
    write_json(Path(config['root'])/'films'/row['id']/'export-run.json', result)
    if result['exit_code']:
        return {'exported': False, 'error': result['stderr'][-6000:] or result['stdout'][-6000:]}
    return read_json(Path(config['root'])/'films'/row['id']/'export.json')


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('mode', choices=('capture-worker', 'export-worker'))
    parser.add_argument('--config', required=True)
    parser.add_argument('--id')
    parser.add_argument('--items')
    args = parser.parse_args()
    config = read_json(args.config)
    config['_config_path'] = str(Path(args.config).resolve())
    if args.mode == 'capture-worker':
        result = capture_worker(config, args.items)
    else:
        row = config['film']
        if row['id'] != args.id:
            raise ValueError('Film ID does not match its configuration')
        result = export_worker(config, row, workspace_for(config, row['id']))
    print(json.dumps(result, ensure_ascii=False), flush=True)


if __name__ == '__main__':
    main()
