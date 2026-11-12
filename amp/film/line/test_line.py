"""Offline orchestration tests. No author or narration provider may run."""
from argparse import Namespace
from pathlib import Path
import shutil

import pytest

import line
import pages
import providers
import runtime
from state import read_json


@pytest.fixture
def setup(tmp_path, monkeypatch):
    source = Path(__file__).resolve().parents[1]
    worktree = tmp_path/'checkout'
    kit = worktree/'amp/film'
    kit.mkdir(parents=True)
    for path in source.iterdir():
        if path.is_file() and path.suffix in ('.ts', '.tsx', '.css', '.html'):
            shutil.copyfile(path, kit/path.name)
    for name in ('browser-security.mjs', 'package.json', 'src/web/ui/tokens.css'):
        dest = worktree/'amp'/name
        dest.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(source.parent/name, dest)
    (worktree/'amp/node_modules').mkdir()
    env = tmp_path/'env'; env.write_text('')
    config = {'root': str(tmp_path/'private'), 'worktree': str(worktree), 'env_file': str(env),
              'heavy': '/usr/bin/env', 'standards': str(tmp_path/'standards.json'),
              'live_data': str(tmp_path/'live/data'), 'player_url': 'http://localhost/live/',
              'queue_page': str(tmp_path/'index.html'),
              'review_url': 'http://localhost/live/line.html', 'voice_cache': str(tmp_path/'cache')}
    pack = {'skill': {'id': 'example.skill', 'title': 'One whole skill'},
            'standards': [{'code': 'X.1', 'text': 'Exact synthetic standard.'}], 'standards_sha256': 'fixture',
            'problem_types': [{'type': 'example', 'problems': [{'answer': '4'}]}, {'type': 'second-example'}]}
    def fake_facts(config, skill, out):
        assert skill == 'example.skill'
        providers.write_json(Path(out)/'facts.json', pack)
        return pack
    monkeypatch.setattr(line, 'facts', fake_facts)
    monkeypatch.setattr(providers, 'run_agent', lambda *a, **kw: pytest.fail('Unexpected model call'))
    monkeypatch.setattr(line, 'voice_access', lambda *a, **kw: pytest.fail('Unexpected voice access'))
    monkeypatch.setattr(line, 'voice_film', lambda *a, **kw: pytest.fail('Unexpected narration'))
    brief = tmp_path/'brief.txt'; brief.write_text('Explain a whole skill, with pictures.\n')
    args = Namespace(film='example--pilot-1', skill='example.skill', model='sol', effort='high',
                     brief=str(brief), concept=None, reference=[])
    calls = []
    def author(model, role, prompt, workspace, receipt, **options):
        calls.append((model, options['effort']))
        script = {'id': args.film, 'title': 'A whole skill', 'cast': {'teacher': {}, 'learner': {}},
                  'shots': [{'beats': [{'speaker': 'teacher', 'say': 'Two plus two.'},
                                       {'speaker': 'learner', 'say': 'Four.'}]}]}
        providers.write_json(workspace/'screenplay.json', script)
        record = {'status': 'succeeded', 'api_dollars': None, 'reported_dollars': None,
                  'tokens': {'input_uncached': 100, 'input_cached': 20, 'cache_write': 0, 'output': 30},
                  'usage_complete': True, 'wall_seconds': 1.25}
        providers.write_json(receipt, record)
        return record
    def check(config, row, workspace):
        result = {'passed': True, 'errors': [], 'screenplay_sha256': runtime.digest(workspace/'screenplay.json')}
        providers.write_json(workspace/'check.json', result)
        return result
    monkeypatch.setattr(providers, 'run_agent', author)
    monkeypatch.setattr(line, 'check_film', check)
    return config, args, calls, pack


def test_write_recipe_reuses_author_and_covers_the_skill(setup):
    config, args, calls, pack = setup
    recipe = line.write_film(config, args)
    root = line.film_root(config, args.film)
    assert recipe['status'] == 'checked'
    assert recipe['standards'] == pack['standards']
    assert recipe['problem_types'] == ['example', 'second-example']
    assert recipe['prompt'].startswith(Path(args.brief).read_text())
    assert 'example.skill' in recipe['prompt'] and 'second-example' in recipe['prompt']
    assert set(recipe['stages']) == {'facts', 'workspace', 'screenplay', 'kit-check'}
    assert recipe['tokens']['input_uncached'] == 100
    assert recipe['dollars']['api_dollars'] is None
    assert recipe['cost']['model_receipts_without_full_dollars'] == 1
    assert read_json(root/'recipe.json') == recipe
    line.write_film(config, args)
    assert calls == [('sol', 'high')]
    assert len(read_json(root/'recipe.json')['stages']['kit-check']['attempts']) == 2
    Path(args.brief).write_text('A changed assignment')
    with pytest.raises(ValueError, match='inputs changed'):
        line.write_film(config, args)


def test_failed_check_is_recorded_and_retry_does_not_call_author(setup, monkeypatch):
    config, args, calls, _ = setup
    monkeypatch.setattr(line, 'check_film', lambda *a: {'passed': False, 'errors': ['portrait overlap']})
    for _ in range(2):
        with pytest.raises(RuntimeError, match='portrait overlap'):
            line.write_film(config, args)
    recipe = read_json(line.film_root(config, args.film)/'recipe.json')
    assert recipe['status'] == 'failed'
    assert recipe['stages']['kit-check']['status'] == 'failed'
    assert recipe['total_seconds'] >= 0 and calls == [('sol', 'high')]


def test_failed_author_and_primary_template_mismatch_stop(setup, monkeypatch):
    config, args, calls, _ = setup
    args.film = 'wrong-template--pilot'
    with pytest.raises(ValueError, match='does not belong'):
        line.write_film(config, args)
    assert not calls
    args.film = 'example--other'
    def failed(*a, **kw):
        record = {'status': 'failed', 'partial_api_dollars': 0.3, 'tokens': {'output': 40}}
        providers.write_json(a[4], record)
        return record
    monkeypatch.setattr(providers, 'run_agent', failed)
    with pytest.raises(RuntimeError, match='Author did not succeed'):
        line.write_film(config, args)
    recipe = read_json(line.film_root(config, args.film)/'recipe.json')
    assert recipe['dollars']['partial_api_dollars'] == 0.3
    assert recipe['status'] == 'failed'


def test_runtime_tampering_and_stale_check_block_voice(setup):
    config, args, _, _ = setup
    line.write_film(config, args)
    root = line.film_root(config, args.film)
    local = read_json(root/'config.json'); workspace = runtime.workspace_for(local, args.film)
    script = workspace/'screenplay.json'; script.write_text(script.read_text()+' ')
    with pytest.raises(ValueError, match='check the current screenplay'):
        line.finish_film(config, args.film, 'voice')
    module = workspace/'runtime/amp/film/make.ts'; module.write_text(module.read_text()+'// altered')
    with pytest.raises(RuntimeError, match='modified the kit'):
        runtime.verify_runtime(local, local['film'], workspace)


def test_predict_and_board_only_reveal_author_after_current_score(setup):
    config, args, _, _ = setup
    line.write_film(config, args)
    prediction = line.predict(config, args.film, 8.5, 'The picture explains the operation.')
    assert prediction['score'] == 8.5
    data = Path(config['live_data'])
    providers.write_json(data/'queue.json', [{'id': args.film, 'title': 'A < B', 'seconds': 90, 'added': 'new'}])
    providers.write_json(data/'reviews.json', {args.film: {'score': 7, 'added': 'old', 'summary': 'Old note'}})
    page = pages.board(config).read_text()
    assert 'gpt-6.1-sol' not in page and 'Old note' not in page
    assert '8.5' in page and 'The picture explains' in page
    providers.write_json(data/'reviews.json', {args.film: {'score': 0, 'added': 'new', 'summary': '<script>note</script>'}})
    page = pages.board(config).read_text()
    assert 'gpt-6.1-sol / high' in page
    assert '&lt;script&gt;note&lt;/script&gt;' in page and '<script>note</script>' not in page
    pages.line_page(config)
    page = (data.parent/'line.html').read_text()
    assert 'gpt-6.1-sol' not in page and 'note' not in page.split('const films=')[1]
    assert args.film in page and 'A \\u003c B' in page and 'location.replace' in page
    for score in (True, float('nan'), -1, 11):
        with pytest.raises(ValueError):
            line.predict(config, args.film, score, 'reason')


def test_board_last_ten_and_grade_fallback():
    rows = [{'score': n, 'dollars': None if n == 0 else n} for n in range(11)]
    values = pages.averages(rows)
    assert values['score'] == {'value': 4.5, 'count': 10}
    assert values['dollars'] == {'value': 5, 'count': 9}
    assert pages.founder_score('x', {'added': 'v'}, {}, {'x': {'score': 6, 'note': 'legacy'}}) == (6, 'legacy')
    assert pages.founder_score('x', {'added': 'v'}, {'x': {'score': None}}, {'x': {'score': 6}})[0] is None


def test_voice_reuse_requires_current_payload_voices_and_a_passing_check(setup, monkeypatch):
    config, args, _, _ = setup
    line.write_film(config, args)
    root = line.film_root(config, args.film)
    local = read_json(root/'config.json'); row = local['film']
    workspace = runtime.workspace_for(local, args.film)
    out = root/'voiced'/args.film
    providers.write_json(out/'line-payload.json', {'script': read_json(workspace/'screenplay.json')})
    providers.write_json(out/'timing.json', {'voices': {'teacher': row['teacher'], 'learner': runtime.CHAMP}})
    (out/'narration.wav').write_bytes(b'fake-audio')
    monkeypatch.setattr(runtime, 'heavy', lambda *a, **kw: pytest.fail('Should reuse narration'))
    assert runtime.completed_voice(local, row, workspace) is None
    providers.write_json(root/'films'/args.film/'voice-run.json', {'exit_code': 0})
    assert runtime.voice_film(local, row, workspace, {})['check_passed']
    providers.write_json(out/'timing.json', {'voices': {'teacher': 'wrong', 'learner': runtime.CHAMP}})
    assert runtime.completed_voice(local, row, workspace) is None


def test_accounting_retains_unknown_and_partial_costs_without_double_counting(tmp_path):
    from accounting import costs
    providers.write_json(tmp_path/'runs/full.json', {'api_dollars': 1, 'reported_dollars': 1, 'partial_api_dollars': 0.5})
    providers.write_json(tmp_path/'runs/partial.json', {'partial_api_dollars': 0.25})
    providers.write_json(tmp_path/'runs/unknown.json', {'api_dollars': None})
    providers.write_json(tmp_path/'voice-quota.json', {'confirmed_characters': 100, 'reserved_characters': 120})
    (tmp_path/'voice-ledger.jsonl').write_text('{"kind":"reserved","input_characters":110}\n{"kind":"succeeded","input_characters":110}\n')
    result = costs(tmp_path)
    assert result['known_model_dollars'] == 1.25
    assert result['model_receipts_without_full_dollars'] == 2
    assert result['voice_input_characters'] == 110
    assert result['voice_confirmed_credits'] == 100 and result['voice_reserved_credits'] == 120
    assert result['voice_dollars'] is None


def test_board_is_newest_first_and_line_preserves_release_order_without_author(setup):
    config, args, _, _ = setup
    first = line.write_film(config, args)
    second = {**first, 'id': 'example--second', 'started_at': '9999', 'model': 'PRIVATE_AUTHOR'}
    providers.write_json(Path(config['root'])/'example--second/recipe.json', second)
    providers.write_json(Path(config['live_data'])/'queue.json', [
        {'id': first['id'], 'title': 'First', 'added': '2026-01-01', 'seconds': 60},
        {'id': second['id'], 'title': 'Second', 'added': '2026-01-02', 'seconds': 90}])
    assert [r['id'] for r in pages.board_rows(config)] == [second['id'], first['id']]
    assert 'PRIVATE_AUTHOR' not in pages.board(config).read_text()
    pages.line_page(config)
    page = (Path(config['live_data']).parent/'line.html').read_text()
    assert page.index('First') < page.index('Second')
    assert 'PRIVATE_AUTHOR' not in page


def test_concept_named_references_and_source_changes(setup):
    config, args, _, _ = setup
    root = Path(config['root']).parent
    concept = root/'concept.txt'; concept.write_text('Show the change in height.')
    args.concept = str(concept); args.reference = ['example-format']
    providers.write_json(Path(config['worktree'])/'amp/film/lessons/example-format.json',
                         {'id': 'example-format', 'title': 'Format', 'cast': {'teacher': {'voice': 'reference-voice'}}})
    recipe = line.write_film(config, args)
    assert 'Show the change in height.' in recipe['prompt']
    local = read_json(line.film_root(config, args.film)/'config.json')
    workspace = runtime.workspace_for(local, args.film)
    assert read_json(workspace/'references/example-format.json')['cast'] == {'teacher': {}}
    (Path(config['worktree'])/'amp/src/changed.ts').write_text('// changed shared figure')
    with pytest.raises(RuntimeError, match='Shared app source changed'):
        runtime.verify_runtime(local, local['film'], workspace)


def test_facts_command_reads_configured_standards_and_all_types(tmp_path):
    # Real deterministic curriculum generation; no provider or browser is involved.
    worktree = Path(__file__).resolve().parents[3]
    standards = tmp_path/'standards.json'
    providers.write_json(standards, [{'code': '8.EE.B.5', 'aliases': ['8.EE.5'],
        'text': 'Exact fixture text, including punctuation.', 'parts': [{'label': 'a', 'text': 'Part text.'}], 'source': 'fixture'}])
    config = {'worktree': str(worktree), 'heavy': '/usr/bin/env', 'standards': str(standards)}
    pack = line.facts(config, 'slope', tmp_path/'facts')
    assert pack['skill']['id'] == 'slope'
    assert len(pack['problem_types']) > 1
    assert pack['standards'][0]['text'] == 'Exact fixture text, including punctuation.'
    for problem in pack['problem_types']:
        assert len(problem['problems']) == 10
        assert all('answer' in p for p in problem['problems'])
        assert problem['written_lesson']['example']
        assert {'kind', 'components', 'named_parts'} <= problem['kit_figure'].keys()
    with pytest.raises(ValueError, match='separate trees'):
        line.facts(config, 'slope', worktree/'amp/film/line/private')


def test_cast_is_teacher_with_learner_or_teacher_alone(tmp_path):
    path = tmp_path/'screenplay.json'
    beat = lambda who: {'speaker': who, 'say': 'Two.'}
    def script(cast, speakers):
        providers.write_json(path, {'id': 'example--a', 'title': 'Example', 'cast': cast,
                                    'shots': [{'beats': [beat(who) for who in speakers]}]})
    script({'teacher': {}, 'learner': {}}, ['teacher', 'learner'])
    assert runtime.validate_cast(path, 'example--a')['cast'] == {'teacher': {}, 'learner': {}}
    script({'teacher': {}}, ['teacher', 'teacher'])
    assert runtime.validate_cast(path, 'example--a')['cast'] == {'teacher': {}}
    script({'teacher': {}}, ['teacher', 'learner'])
    with pytest.raises(ValueError, match='every role in the cast must speak'):
        runtime.validate_cast(path, 'example--a')
    script({'teacher': {}, 'learner': {}}, ['teacher'])
    with pytest.raises(ValueError, match='every role in the cast must speak'):
        runtime.validate_cast(path, 'example--a')
    script({'learner': {}}, ['learner'])
    with pytest.raises(ValueError, match='teacher alone'):
        runtime.validate_cast(path, 'example--a')
    script({'teacher': {'voice': 'x'}}, ['teacher'])
    with pytest.raises(ValueError, match='empty voice bindings'):
        runtime.validate_cast(path, 'example--a')



def test_make_binds_a_learner_voice_only_when_the_cast_has_a_learner(tmp_path, monkeypatch):
    workspace = tmp_path/'workspace'
    workspace.mkdir()
    seen = []
    monkeypatch.setattr(runtime, 'verify_runtime', lambda *a: None)
    monkeypatch.setattr(runtime, '_run', lambda command, cwd, env: seen.append(command) or {'stdout': ''})
    config = {'root': str(tmp_path/'root'), 'voice_cache': str(tmp_path/'voices')}
    row = {'id': 'example--a', 'teacher': next(iter(runtime.TEACHERS))}
    def voices(cast):
        providers.write_json(workspace/'screenplay.json', {'id': 'example--a', 'cast': cast})
        runtime._make(config, row, workspace)
        command = seen[-1]
        return [command[i + 1].split('=')[0] for i, part in enumerate(command) if part == '--voice']
    assert voices({'teacher': {}, 'learner': {}}) == ['teacher', 'learner']
    assert voices({'teacher': {}}) == ['teacher']
