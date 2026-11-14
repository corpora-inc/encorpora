"""Release is the only operation that adds a film to founder-facing lists."""
from pathlib import Path

from providers import now, write_json
from state import display_script, read_json
from pages import board, line_page, queue_page, queue_location


def refresh(config):
    line_page(config)
    queue_page(config)
    if (Path(config['live_data']).parent/'board.html').exists():
        board(config)


def release_film(config, identifier, level):
    from line import existing_film
    from runtime import digest
    queue_location(config)  # Validate before changing shared state.
    if not level.strip():
        raise ValueError('A level is required')
    root, local, recipe, workspace = existing_film(config, identifier)
    check = read_json(workspace/'check.json', {})
    if not check.get('passed') or check.get('screenplay_sha256') != digest(workspace/'screenplay.json'):
        raise ValueError('Check the current screenplay before release')
    receipt = read_json(root/'films'/identifier/'export.json', {})
    data = Path(config['live_data'])
    for suffix, key in (('.json', 'json_sha256'), ('.m4a', 'audio_sha256')):
        path = data/(identifier+suffix)
        if not path.is_file() or receipt.get(key) != digest(path):
            raise ValueError('Export this film before release')
    payload = read_json(data/(identifier+'.json'))
    # Playback binds voices; all other screenplay fields must match the checked cut.
    current = display_script(read_json(workspace/'screenplay.json'))
    if {**payload['script'], 'cast': current['cast']} != current:
        raise ValueError('Export the current screenplay before release')
    row = {'id': identifier, 'title': payload['title'], 'level': level.strip(),
           'seconds': payload['timing']['duration'], 'added': receipt['added'], 'released': now()}
    queue = read_json(data/'queue.json', [])
    prior = next((i for i, r in enumerate(queue) if r['id'] == identifier), None)
    if prior is None:
        queue.append(row)
    else:
        queue[prior] = row
    write_json(data/'queue.json', queue)
    index = read_json(data/'index.json', [])
    index = [r for r in index if r['id'] != identifier]
    index.append({**receipt.get('index_row', {}), **row})
    write_json(data/'index.json', index)
    recipe['status'] = 'released'
    write_json(root/'recipe.json', recipe)
    refresh(config)
    return queue_location(config)


def unrelease_film(config, identifier):
    from line import film_root
    queue_location(config)
    root = film_root(config, identifier)
    data = Path(config['live_data'])
    for name in ('queue', 'index'):
        write_json(data/(name+'.json'), [r for r in read_json(data/(name+'.json'), []) if r['id'] != identifier])
    recipe = read_json(root/'recipe.json')
    if recipe and recipe['status'] == 'released':
        recipe['status'] = 'exported'
        write_json(root/'recipe.json', recipe)
    refresh(config)
    return queue_location(config)
