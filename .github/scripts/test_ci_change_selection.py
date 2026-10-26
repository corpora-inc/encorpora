"""End-to-end selection: run ci.yml's real `changes` step against real commits.

Each case builds a throwaway repository, points the step's git at it, and
checks which jobs the produced outputs would run.
"""
import os
from pathlib import Path
import re
import subprocess

import pytest
import yaml

from amp_ci_plan import github_outputs, plan

ROOT = Path(__file__).resolve().parents[2]
WORKFLOW = yaml.safe_load((ROOT / '.github/workflows/ci.yml').read_text())
CHANGES = WORKFLOW['jobs']['changes']
SCRIPT = next(step['run'] for step in CHANGES['steps'] if step.get('id') == 'filter')
AREAS = set(re.findall(r'^\s*set_output (\w+) ', SCRIPT, re.M))
# Areas that are not AMP and must stay off for an AMP-only change.
OTHER = AREAS - {'amp_native', 'corpora_site'}

# The shape of a typical AMP content PR (#1618 and its neighbours), using
# files that exist so the planner can follow their consumers.
CONTENT_PR = [
    'amp/scripts/point_plot_math_oracle.py', 'amp/scripts/independent-math-review.py',
    'amp/src/content/lessons.ts', 'amp/src/content/facet-mappings.ts',
    'amp/src/content/problem-methods.ts', 'amp/src/content/problem-principles.ts',
    'amp/src/content/connections.ts', 'amp/src/curriculum/sat-coverage.ts',
    'amp/src/math/engine.ts', 'amp/src/math/point-plot-practice.ts',
    'amp/tests/sat.test.ts',
]


class Repo:
    def __init__(self, path):
        self.path = path
        path.mkdir(parents=True)
        self.git('init', '-q', '-b', 'main')
        self.commit(['README.md'])

    def git(self, *args):
        return subprocess.run(
            ['git', '-c', 'user.name=ci', '-c', 'user.email=ci@example.invalid',
             '-c', 'commit.gpgsign=false', *args],
            cwd=self.path, check=True, capture_output=True, text=True).stdout.strip()

    def commit(self, paths):
        for name in paths:
            file = self.path / name
            file.parent.mkdir(parents=True, exist_ok=True)
            file.write_text(file.read_text() + 'x\n' if file.exists() else 'x\n')
        self.git('add', '-A')
        self.git('commit', '-q', '-m', 'change')
        return self.git('rev-parse', 'HEAD')

    def select(self, tmp_path, event, base, head):
        output = tmp_path / 'github-output'
        output.write_text('')
        env = {**os.environ, 'GIT_DIR': str(self.path / '.git'), 'GIT_WORK_TREE': str(self.path),
               'BASE_SHA': base, 'HEAD_SHA': head, 'EVENT_NAME': event,
               'GITHUB_OUTPUT': str(output)}
        # cwd is the real checkout so the step runs the real planner and catalog.
        result = subprocess.run(['bash', '-e', '-c', SCRIPT], cwd=ROOT, env=env,
                                capture_output=True, text=True)
        assert result.returncode == 0, result.stdout + result.stderr
        names = [line.split('=', 1)[0] for line in output.read_text().splitlines()]
        assert len(names) == len(set(names)), 'an output name was written twice'
        values = dict(line.split('=', 1) for line in output.read_text().splitlines())
        for declared in CHANGES['outputs']:
            assert declared in values, declared
        return {name: value for name, value in values.items() if name != 'amp_plan'}


@pytest.fixture
def repo(tmp_path):
    return Repo(tmp_path / 'repo')


def on(values):
    return {name for name, value in values.items() if value == 'true'}


@pytest.mark.parametrize('event', ['pull_request', 'merge_group', 'push'])
def test_amp_content_change_runs_only_amp_core_build_and_the_site_that_imports_it(tmp_path, repo, event):
    base = repo.git('rev-parse', 'HEAD')
    head = repo.commit(CONTENT_PR)
    values = repo.select(tmp_path, event, base, head)
    assert values['native'] == 'false'
    assert values['amp_native'] == 'false'
    assert not on(values) & OTHER
    assert {'amp', 'amp_core', 'amp_build', 'corpora_site'} <= on(values)
    if event != 'push':
        assert values['amp_database'] == 'false'


def test_oracle_only_change_runs_its_consumer_tests_without_build_or_database(tmp_path, repo):
    base = repo.git('rev-parse', 'HEAD')
    head = repo.commit(['amp/scripts/point_plot_math_oracle.py'])
    values = repo.select(tmp_path, 'pull_request', base, head)
    assert on(values) == {'amp', 'amp_core', 'amp_content'}


@pytest.mark.parametrize('path', [
    'corpan/plugins/tauri-plugin-tts/src/lib.rs',
    'corpan/corpan-app/src-tauri/Cargo.lock',
    'dynawalla/dynawalla-app/src-tauri/tauri.conf.json',
    'amp/mobile/session-core/src/lib.rs',
    'aha/aha-app/rust-toolchain.toml',
    'native/README.md',
    'corpan/dja/release.sqlite3',  # embedded by corpan-app's db.rs
    'dynawalla/games/new-game/pack.json',  # read by the packs:: Rust tests
])
@pytest.mark.parametrize('event', ['pull_request', 'merge_group'])
def test_native_change_runs_the_native_job(tmp_path, repo, event, path):
    base = repo.git('rev-parse', 'HEAD')
    head = repo.commit([path])
    values = repo.select(tmp_path, event, base, head)
    assert values['native'] == 'true'
    if not path.startswith(('amp/', 'corpan/dja/')):
        assert values['amp'] == values['amp_core'] == values['amp_database'] == 'false'


def test_pull_request_behind_main_is_compared_from_its_fork_point(tmp_path, repo):
    fork = repo.git('rev-parse', 'HEAD')
    repo.git('checkout', '-q', '-b', 'feature')
    head = repo.commit(['amp/docs/guide.md'])
    repo.git('checkout', '-q', 'main')
    main_tip = repo.commit(['corpan/plugins/tauri-plugin-tts/src/lib.rs', 'corpan/dja/app.py'])
    values = repo.select(tmp_path, 'pull_request', main_tip, head)
    assert on(values) == {'amp'}, 'main\'s own changes leaked into the PR selection'
    assert fork != main_tip


def test_merge_group_entry_is_compared_with_the_entry_ahead_of_it(tmp_path, repo):
    repo.commit(['corpan/plugins/tauri-plugin-tts/src/lib.rs'])  # the entry ahead
    ahead = repo.git('rev-parse', 'HEAD')
    head = repo.commit(['amp/src/content/lessons.ts'])
    values = repo.select(tmp_path, 'merge_group', ahead, head)
    assert values['native'] == 'false' and values['amp'] == 'true'


@pytest.mark.parametrize('event', ['pull_request', 'merge_group'])
def test_workflow_change_runs_every_job(tmp_path, repo, event):
    base = repo.git('rev-parse', 'HEAD')
    head = repo.commit(['.github/workflows/ci.yml'])
    values = repo.select(tmp_path, event, base, head)
    # `shared_ts` has no job and deliberately ignores workflow edits.
    assert on(values) >= (AREAS - {'shared_ts'}) | {'amp_core', 'amp_database', 'amp_build'}


@pytest.mark.parametrize('event', ['merge_group', 'push'])
def test_unrelated_or_missing_base_runs_every_job(tmp_path, repo, event):
    repo.git('checkout', '-q', '-b', 'other')
    other = repo.commit(['amp/docs/a.md'])
    repo.git('checkout', '-q', 'main')
    head = repo.commit(['amp/docs/b.md'])
    for base in (other, '0' * 40):
        values = repo.select(tmp_path, event, base, head)
        assert on(values) >= AREAS | {'amp_core', 'amp_database', 'amp_build'}


def test_planner_outputs_never_share_a_name_with_an_area_filter():
    names = set(github_outputs(plan(['amp/src/math/engine.ts'])))
    assert all(name.startswith('amp') for name in names)
    assert not names & AREAS
