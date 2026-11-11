from pathlib import Path
import io
import json
from types import SimpleNamespace

import pytest
import line
import live_export
import pages
import providers
import release
from release import release_film, unrelease_film
from runtime import digest
from state import read_json
from test_line import setup


def exported(setup):
    config, args, _, _ = setup
    line.write_film(config, args)
    root, local, recipe, workspace = line.existing_film(config, args.film)
    payload = {'title': 'Synthetic film', 'script': read_json(workspace/'screenplay.json'), 'timing': {'duration': 42}}
    data = Path(config['live_data'])
    providers.write_json(data/(args.film+'.json'), payload)
    (data/(args.film+'.m4a')).write_bytes(b'fake audio')
    receipt = {'added': 'edition-one', 'json_sha256': digest(data/(args.film+'.json')), 'audio_sha256': digest(data/(args.film+'.m4a'))}
    providers.write_json(root/'films'/args.film/'export.json', receipt)
    return config, args, root, local, workspace


def test_release_unrelease_and_board_share_one_queue(setup, monkeypatch):
    timestamps = iter(["2026-01-01T10:00:00+00:00", "2026-01-02T10:00:00+00:00"])
    monkeypatch.setattr(release, "now", lambda: next(timestamps))
    config, args, root, local, workspace = exported(setup)
    data = Path(config['live_data'])
    pages.board(config)
    assert args.film not in (data.parent/'board.html').read_text()
    release_film(config, args.film, 'Grade 8')
    assert read_json(data/'queue.json')[0]['released'] == '2026-01-01T10:00:00+00:00'
    release_film(config, args.film, 'Grade 8')
    rows = read_json(data/'queue.json')
    assert rows == [{'id': args.film, 'title': 'Synthetic film', 'level': 'Grade 8', 'seconds': 42, 'added': 'edition-one', 'released': '2026-01-02T10:00:00+00:00'}]
    assert read_json(data/'index.json')[0]['id'] == args.film
    page = (data.parent/'line.html').read_text()
    assert 'const films='+pages.script_json(rows)+';' in page
    assert 'location.replace' in page and 'gpt-6.1-sol' not in page
    queue = Path(config['queue_page']).read_text()
    assert 'Waiting for your score' in queue and 'Scored' not in queue and 'Scoreboard' in queue
    assert 'gpt-6.1-sol' not in (data.parent/'board.html').read_text()
    providers.write_json(data/'reviews.json', {args.film: {'score': 8, 'added': 'edition-one'}})
    assert 'gpt-6.1-sol' in pages.board(config).read_text()
    unrelease_film(config, args.film)
    assert read_json(data/'queue.json') == [] and read_json(data/'index.json') == []
    assert 'const films=[];' in (data.parent/'line.html').read_text()
    assert args.film not in (data.parent/'board.html').read_text()
    assert read_json(data/'reviews.json')[args.film]['score'] == 8


def test_release_rejects_stale_export(setup):
    config, args, root, local, workspace = exported(setup)
    (Path(config['live_data'])/(args.film+'.m4a')).write_bytes(b'changed')
    with pytest.raises(ValueError, match='Export'):
        release_film(config, args.film, 'Grade 8')
    assert not (Path(config['live_data'])/'queue.json').exists()


@pytest.mark.parametrize('released', [False, True])
def test_export_preserves_release_and_only_updates_existing_index(setup, monkeypatch, released):
    config, args, root, local, workspace = exported(setup)
    data = Path(config['live_data']); row = local['film']
    providers.write_json(data/'index.json', [{'id': 'other--film'}])
    if released:
        release_film(config, args.film, 'Grade 8')
        queue_before = (data/'queue.json').read_bytes()
        providers.write_json(data/'reviews.json', {args.film: {'score': 8, 'at': providers.now()}})
        reviews_before = (data/'reviews.json').read_bytes()
    stage = root/'export-staging'/args.film; stage.mkdir(parents=True)
    emitted = {'id': args.film, 'title': 'Synthetic', 'script': read_json(workspace/'screenplay.json'),
        'timing': {'duration': 42, 'voices': {'teacher': row['teacher'], 'learner': line.CHAMP}}}
    providers.write_json(stage/(args.film+'.json'), emitted)
    providers.write_json(stage/'index.json', [{'id': args.film, 'title': 'Synthetic', 'seconds': 42, 'added': 'new'}])
    (stage/(args.film+'.m4a')).write_bytes(b'fake audio')
    monkeypatch.setenv('FILM_LINE_HEAVY', '1')
    monkeypatch.setattr(live_export, 'migrate_export_paths', lambda *a: None)
    monkeypatch.setattr(live_export.subprocess, 'run', lambda *a, **kw: SimpleNamespace(returncode=0))
    def get(request, **kw):
        url = request if isinstance(request, str) else request.full_url
        if url.endswith('.json'):
            return io.BytesIO((data/(args.film+'.json')).read_bytes())
        result = io.BytesIO(); result.headers = {'Content-Length': '10'}
        return result
    monkeypatch.setattr(live_export.urllib.request, 'urlopen', get)
    receipt = live_export.export_worker(local, row, workspace)
    assert receipt['exported']
    if released:
        assert (data/'queue.json').read_bytes() == queue_before
        assert (data/'reviews.json').read_bytes() == reviews_before
        index = read_json(data/'index.json')
        assert index[0] == {'id': 'other--film'}
        assert index[1]['added'] == receipt['added'] == 'new'
        assert index[1]['level'] == 'Grade 8'
        assert index[1]['released'] == read_json(data/'queue.json')[0]['released']
        assert pages.board_rows(config)[0]['score'] == 8
    else:
        assert read_json(data/'index.json') == [{'id': 'other--film'}]
        assert not (data/'queue.json').exists() and not (data.parent/'line.html').exists()
        assert not Path(config['queue_page']).exists()


def test_release_order_and_edition_scores_are_stable(setup):
    config, args, root, local, workspace = exported(setup)
    first = args.film
    release_film(config, first, 'Grade 8')
    args.film = 'example--second'
    exported(setup)
    release_film(config, args.film, 'Grade 8')
    release_film(config, first, 'Grade 8')
    data = Path(config['live_data'])
    assert [r['id'] for r in read_json(data/'queue.json')] == [first, args.film]
    unrelease_film(config, first)
    release_film(config, first, 'Grade 8')
    assert [r['id'] for r in read_json(data/'queue.json')] == [args.film, first]


@pytest.mark.parametrize('exit_code', [0, 7])
def test_follow_up_cli_forwards_literal_note_and_reports_output(setup, monkeypatch, capsys, exit_code):
    config, args, _, _ = setup
    note = 'Fixed labels; $(do-not-run) `literal`\nSecond line.'
    calls = []
    def run(command, **options):
        calls.append((command, options))
        return SimpleNamespace(returncode=exit_code, stdout='Recorded response\n', stderr='Publisher detail\n')
    monkeypatch.setattr(line.subprocess, 'run', run)
    config_path = Path(config['root']).parent/'config.json'
    providers.write_json(config_path, config)
    argv = ['--config', str(config_path), 'follow-up', '--film', args.film, '--note', note]
    if exit_code:
        with pytest.raises(SystemExit) as error:
            line.main(argv)
        assert error.value.code == exit_code
    else:
        line.main(argv)
    assert len(calls) == 1
    command, options = calls[0]
    assert command == ['npm', 'run', 'film:publish', '--', '--follow-up', args.film, '--note', note]
    assert options['cwd'] == Path(config['worktree'])/'amp'
    assert options.get('shell', False) is False
    output = capsys.readouterr()
    assert output.out == 'Recorded response\n' and output.err == 'Publisher detail\n'
    assert not (Path(config['live_data'])/'queue.json').exists()


def test_follow_up_rejects_empty_note_before_running(setup, monkeypatch):
    config, args, _, _ = setup
    monkeypatch.setattr(line.subprocess, 'run', lambda *a, **kw: pytest.fail('Must not run publisher'))
    with pytest.raises(ValueError, match='needs a note'):
        line.follow_up(config, args.film, ' \n ')
