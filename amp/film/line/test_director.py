"""Director commands against synthetic films and fake author processes."""
from pathlib import Path
from types import SimpleNamespace
import json

import pytest
import line
import providers
import runtime
from state import command_lock, read_json
from test_line import setup


def test_revise_preserves_workspace_and_records_each_attempt(setup, monkeypatch, tmp_path):
    config, args, calls, _ = setup
    first = line.write_film(config, args)
    root, local, _, workspace = line.existing_film(config, args.film)
    author = providers.run_agent
    def revision(*a, **kw):
        assert read_json(workspace/'screenplay.json')['title'] == 'A whole skill'
        assert a[2].startswith(first['prompt'])
        assert "Director's notes on your first cut\nShow the rise." in a[2]
        return author(*a, **kw)
    monkeypatch.setattr(providers, 'run_agent', revision)
    notes = tmp_path/'notes.txt'; notes.write_text('Show the rise.')
    second = line.revise_film(config, args.film, notes)
    assert len(second['author_attempts']) == 2
    assert second['tokens']['input_uncached'] == 200
    assert second['cost']['model_receipts_without_full_dollars'] == 2
    assert (root/'attempts/1/screenplay.json').exists()
    assert second['status'] == 'checked'
    third = line.revise_film(config, args.film, notes)
    assert len(third['author_attempts']) == 3
    line.write_film(config, args)
    assert len(calls) == 3  # Rechecking never launches the first cut again.


def test_lock_scopes_allow_two_films_but_only_one_voice(tmp_path):
    config = {'root': str(tmp_path), 'live_data': str(tmp_path/'live')}
    with command_lock(config, 'write', 'example--a'):
        with command_lock(config, 'revise', 'example--b'):
            pass
        for command in ('facts', 'write', 'revise', 'look', 'voice', 'export'):
            with pytest.raises(RuntimeError, match='holds'):
                with command_lock(config, command, 'example--a'):
                    pass
    with command_lock(config, 'voice', 'example--a'):
        with pytest.raises(RuntimeError, match='holds'):
            with command_lock(config, 'voice', 'example--b'):
                pass
        with command_lock(config, 'look', 'example--b'):
            pass
    with command_lock(config, 'board'):
        with pytest.raises(RuntimeError, match='holds'):
            with command_lock(config, 'release', 'example--a'):
                pass


def test_subscription_uses_login_and_never_reports_dollars(tmp_path, monkeypatch):
    monkeypatch.setenv('ANTHROPIC_API_KEY', 'synthetic-secret')
    observed = []
    class Process:
        pid = 123
        returncode = 0
        def __init__(self, command, **kw):
            observed.append((command, kw['env']))
        def communicate(self, *a, **kw):
            return json.dumps({'type': 'result', 'result': 'Done', 'usage': {'input_tokens': 10, 'output_tokens': 20}, 'total_cost_usd': 1}), ''
    monkeypatch.setattr(providers.subprocess, 'Popen', Process)
    for auth in ('subscription', 'api'):
        record = providers.run_agent('sonnet', 'screenplay', 'Test', tmp_path/'workspace', tmp_path/(auth+'.json'),
            secrets={'ANTHROPIC_API_KEY': 'synthetic-secret'}, check_command='python check.py', claude_auth=auth)
        command, env = observed[-1]
        assert ('--bare' in command) == (auth == 'api')
        assert ('ANTHROPIC_API_KEY' in env) == (auth == 'api')
        assert record['tokens']['output'] == 20
        assert record['api_dollars'] == (1 if auth == 'api' else None)
        if auth == 'subscription':
            assert record['reported_dollars'] is None and record['partial_api_dollars'] is None


def test_auto_references_prefer_band_then_newest_and_freeze_choice(setup):
    config, args, _, pack = setup
    pack['skill']['gradeBand'] = '8'
    data = Path(config['live_data'])
    rows, reviews = [], {}
    for name, added, grade, score in [('old', '1', '8', 8), ('new', '3', '8', 9), ('other', '4', 'K', 10), ('weak', '5', '8', 7)]:
        identifier = 'example--'+name
        rows.append({'id': identifier, 'added': added})
        reviews[identifier] = {'score': score, 'added': added}
        providers.write_json(data/(identifier+'.json'), {'grade': grade, 'script': {'id': identifier, 'cast': {}}})
    providers.write_json(data/'queue.json', rows)
    providers.write_json(data/'reviews.json', reviews)
    args.reference = ['auto']
    assert line.write_film(config, args)['format_references'] == ['example--new', 'example--old']
    providers.write_json(data/'reviews.json', {})
    assert line.write_film(config, args)['format_references'] == ['example--new', 'example--old']


def test_adopt_checks_without_author_and_keeps_external_usage(setup, monkeypatch, tmp_path):
    config, args, _, pack = setup
    script = {'id': args.film, 'title': 'Outside film', 'cast': {'teacher': {}, 'learner': {}},
              'shots': [{'beats': [{'speaker': 'teacher', 'say': 'Two.'}, {'speaker': 'learner', 'say': 'Four.'}]}]}
    source = tmp_path/'screenplay.json'; providers.write_json(source, script)
    monkeypatch.setattr(providers, 'run_agent', lambda *a, **kw: pytest.fail('No author call'))
    def facts(config, skill, out, *, template):
        assert template == 'example'
        providers.write_json(Path(out)/'facts.json', pack)
        return pack
    monkeypatch.setattr(line, 'facts', facts)
    recipe = line.adopt_film(config, SimpleNamespace(film=args.film, screenplay=source, author='External author', effort='high', minutes=12, tokens=300))
    assert recipe['status'] == 'checked' and recipe['adopted']
    assert recipe['external_usage'] == {'minutes': 12, 'tokens': 300}
    with pytest.raises(ValueError, match='already registered'):
        line.adopt_film(config, SimpleNamespace(film=args.film))
