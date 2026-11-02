import json
import os
from pathlib import Path
import re
import subprocess

import pytest
import yaml

from amp_ci_plan import ROOT, browser_entries, plan, test_catalog as catalog


def test_single_database_regression_does_not_rebuild_or_sweep_unrelated_suites():
    result = plan(['amp/tests/trial-exhaustion.integration.ts'])
    assert result['database'] == ['tests/trial-exhaustion.integration.ts']
    assert result['typecheck']
    for key in ('core', 'build', 'browser', 'browser_scripts', 'content', 'native'):
        assert not result[key], key


def test_unit_entrypoint_and_browser_entrypoint_are_independent():
    result = plan(['amp/tests/frontier.test.ts', 'amp/scripts/verify-multiselect-ui.ts'])
    assert result['core'] == ['tests/frontier.test.ts']
    assert result['browser_scripts'] == ['scripts/verify-multiselect-ui.ts']
    assert result['typecheck']
    assert not any(result[key] for key in ('database', 'build', 'browser', 'content'))


@pytest.mark.parametrize('path', ['amp/docs/deployment.md', 'amp/README.md', 'amp/AGENTS.md'])
def test_documentation_does_not_start_expensive_jobs(path):
    result = plan([path])
    assert not any(value for key, value in result.items() if key not in ('reasons', 'mode', 'affected'))


def test_ui_screens_keep_unit_build_browser_coverage_without_database_or_inventory():
    result = plan(['amp/src/web/app/LegacyApp.tsx'])
    assert result['core'] == catalog(ROOT)['core']
    assert all(result[key] for key in ('build', 'typecheck', 'colors', 'browser'))
    assert not result['database'] and not result['content']
    # Shared print styles and figures retain inventory coverage.
    for path in ('amp/src/web/ui/tokens.css', 'amp/src/web/Figure.tsx'):
        assert plan([path])['content']


@pytest.mark.parametrize('path', [
    'amp/src/server/app.ts', 'amp/src/account/routes.ts', 'amp/src/billing/routes.ts',
    'amp/src/parent-consent/routes.ts', 'amp/src/privacy/routes.ts', 'amp/src/family/routes.ts',
    'amp/src/math/engine.ts', 'amp/src/learning/frontier.ts',
])
def test_shared_runtime_and_protected_areas_keep_all_database_checks(path):
    result = plan([path])
    assert result['database'] == catalog(ROOT)['database']
    assert result['core'] == catalog(ROOT)['core']
    assert result['build'] and result['browser']


@pytest.mark.parametrize('path', [
    'amp/tests/fixtures/model.json', 'amp/tests/removed.integration.ts',
    'amp/tests/shared-helper.ts', 'amp/migrations/9999.sql',
    'amp/scripts/verify-ui-viewports.ts', 'amp/scripts/run-ci-tests.mjs',
    'amp/scripts/print_review_batches.py', 'amp/package-lock.json',
    'amp/tsconfig.json', 'amp/new-area/file.ts', '.github/scripts/amp_ci_plan.py',
    '"amp/quoted\\npath.ts"',
])
def test_unknown_or_shared_inputs_force_broad_fresh_validation(path):
    result = plan([path])
    assert result['core'] == catalog(ROOT)['core']
    assert result['database'] == catalog(ROOT)['database']
    assert all(result[key] for key in ('build', 'browser', 'content', 'content_force'))


def test_union_is_monotonic_order_independent_and_cannot_hide_a_runtime_change():
    paths = ['amp/docs/guide.md', 'amp/tests/frontier.test.ts', 'amp/src/server/app.ts',
             'amp/scripts/verify-multiselect-ui.ts']
    result = plan(paths)
    assert result == plan(paths[::-1] + paths)
    assert result['database'] == catalog(ROOT)['database']
    assert result['browser'] and not result['browser_scripts']


def test_manual_or_missing_base_is_exhaustive_even_without_changed_files():
    result = plan([], full=True)
    assert result['core'] == catalog(ROOT)['core']
    assert result['database'] == catalog(ROOT)['database']
    assert all(result[key] for key in ('build', 'browser', 'content', 'content_force', 'native'))


def test_fast_feature_checks_defer_broad_regression_but_run_changed_tests():
    paths = ['amp/src/learning/frontier.ts', 'amp/tests/frontier.test.ts']
    quick = plan(paths, quick=True)
    main = plan(paths)
    assert quick['mode'] == 'quick' and main['mode'] == 'affected'
    assert 'tests/frontier.test.ts' in quick['core']
    assert 'tests/contracts.test.ts' in quick['core']
    assert len(quick['core']) < len(main['core'])
    assert not quick['database'] and main['database']
    assert quick['build'] and quick['typecheck']
    full = plan(paths, full=True, quick=True)
    assert full['mode'] == 'full' and full['database'] == catalog(ROOT)['database']


@pytest.mark.parametrize('path,expected', [
    ('amp/src/billing/routes.ts', 'tests/stripe.integration.ts'),
    ('amp/src/parent-consent/routes.ts', 'tests/parent-consent.integration.ts'),
    ('amp/src/privacy/routes.ts', 'tests/retention.integration.ts'),
    ('amp/src/family/routes.ts', 'tests/family.integration.ts'),
    ('amp/src/server/app.ts', 'tests/database.integration.ts'),
    ('amp/migrations/9999.sql', 'tests/database.integration.ts'),
])
def test_fast_checks_retain_focused_database_coverage_for_sensitive_paths(path, expected):
    result = plan([path], quick=True)
    assert expected in result['database']
    assert len(result['database']) < len(catalog(ROOT)['database'])


def test_unrelated_changes_do_not_enable_amp_even_in_quick_mode():
    result = plan(['corpan/corpan-app/src/App.tsx'], quick=True)
    assert not result['affected'] and not result['core'] and not result['database']


def test_new_test_is_discovered_and_a_reused_entrypoint_is_not_isolated(tmp_path):
    (tmp_path / 'amp/tests').mkdir(parents=True)
    (tmp_path / 'amp/scripts').mkdir()
    (tmp_path / 'amp/src').mkdir()
    (tmp_path / 'amp/package.json').write_text('{"scripts":{}}')
    (tmp_path / 'amp/tests/new.test.ts').write_text('')
    (tmp_path / 'amp/tests/account.integration.ts').write_text('')
    result = plan(['amp/tests/new.test.ts'], root=tmp_path)
    assert result['core'] == ['tests/new.test.ts'] and not result['database']
    (tmp_path / 'amp/tests/consumer.test.ts').write_text('import "./new.test";')
    result = plan(['amp/tests/new.test.ts'], root=tmp_path)
    assert len(result['core']) == 2 and result['database']
    assert result['content_force']


def test_core_catalog_matches_the_existing_runner_and_discovers_every_integration():
    expected = json.loads(subprocess.check_output(
        ['node', 'amp/scripts/test-suite.mjs', 'core', '--list'], cwd=ROOT))
    assert catalog(ROOT)['core'] == ['tests/' + name for name in expected]
    assert len(catalog(ROOT)['database']) == len(list((ROOT / 'amp/tests').glob('*.integration.ts')))


def test_github_output_is_complete_and_uses_encoded_data_not_shell_commands():
    output = subprocess.check_output(
        ['python3', '.github/scripts/amp_ci_plan.py', '--github'], cwd=ROOT,
        input='amp/tests/trial-exhaustion.integration.ts\n', text=True)
    values = dict(line.split('=', 1) for line in output.splitlines())
    assert values['amp'] == values['amp_database'] == values['amp_build'] == 'true'
    assert values['amp_core'] == values['amp_browser'] == values['amp_content'] == 'false'
    assert json.loads(values['amp_plan'])['database'] == ['tests/trial-exhaustion.integration.ts']


def test_workflow_wiring_keeps_parallel_lanes_behind_existing_required_statuses():
    ci = yaml.safe_load((ROOT / '.github/workflows/ci.yml').read_text())['jobs']
    assert set(ci['amp']['needs']) == {'changes', 'amp-core', 'amp-database', 'amp-build'}
    assert 'always()' in ci['amp']['if'] and 'always()' in ci['ci-gate']['if']
    assert 'amp' in ci['ci-gate']['needs']
    assert ci['amp']['name'] == "${{ (github.event_name == 'pull_request' || github.event_name == 'merge_group') && 'amp-quick' || 'amp' }}"
    # The deployment selector requires the main/manual name, never amp-quick.
    release = (ROOT / 'amp/scripts/release-status.sh').read_text()
    assert 'required=\'["amp", "ci-gate"]\'' in release
    for lane in ('amp-core', 'amp-database', 'amp-build'):
        assert ci[lane]['needs'] == 'changes'
    assert not any(step.get('id') == 'ci-postgres' for step in ci['amp-core']['steps'])
    assert not any(step.get('id') == 'ci-postgres' for step in ci['amp-build']['steps'])
    detection = next(s['run'] for s in ci['changes']['steps'] if s.get('id') == 'filter')
    assert 'amp_full=true' in detection and 'git diff --no-renames' in detection
    assert 'amp_ci_plan.py' in detection
    deep = yaml.safe_load((ROOT / '.github/workflows/amp-deep-checks.yml').read_text())['jobs']
    detection = next(s['run'] for s in deep['changes']['steps'] if s.get('id') == 'paths')
    assert 'amp_ci_plan.py --full --github' in detection
    assert 'git diff --no-renames' in detection
    browser = deep['amp-browser']
    assert browser['strategy']['fail-fast'] is False
    assert browser['strategy']['matrix']['lane'] == '${{ fromJSON(needs.changes.outputs.amp_plan).browser && fromJSON(\'["ui-1", "ui-2a", "ui-2b", "family", "contrast-light-390", "contrast-light-1280", "contrast-dark-390", "contrast-dark-1280"]\') || fromJSON(\'["selected"]\') }}'
    commands = {step['run']: step for step in browser['steps'] if 'run' in step}
    for command, lane in [('npm run test:ui:1', 'ui-1'), ('npm run test:ui:2a', 'ui-2a'), ('npm run test:ui:2b', 'ui-2b'),
                          ('npm run test:family-ui', 'family'),
                          ('node scripts/run-ci-tests.mjs browser', 'selected')]:
        assert commands[command]['if'] == f"matrix.lane == '{lane}'"
    assert commands['npm run test:native-session']['if'] == "needs.changes.outputs.native == 'true' && (matrix.lane == 'ui-1' || matrix.lane == 'selected')"
    assert sum(step.get('run') == 'npm run test:native-session' for step in browser['steps']) == 1
    contrast_report = next(step for step in browser['steps'] if step.get('name') == 'Preserve the contrast sweep report')
    assert contrast_report['if'] == "always() && (startsWith(matrix.lane, 'contrast-') || matrix.lane == 'selected')"
    assert contrast_report['with']['name'] == 'amp-contrast-${{ matrix.lane }}-${{ github.run_attempt }}'
    contrast = next(step for step in browser['steps'] if step.get('if') == "startsWith(matrix.lane, 'contrast-')")
    assert contrast['env'] == {'AMP_CONTRAST_LANE': '${{ matrix.lane }}'}
    assert contrast['run'].strip() == 'pair="${AMP_CONTRAST_LANE#contrast-}"\nnpm run test:contrast -- "--only=${pair/-/:}"'
    # Exercise the actual shell mapping: all four pairs occur exactly once.
    matrix = json.loads(re.findall(r"fromJSON\('([^']+)'\)", browser['strategy']['matrix']['lane'])[0])
    pairs = []
    for lane in matrix:
        if not lane.startswith('contrast-'):
            continue
        script = contrast['run'].replace('npm run test:contrast -- ', 'printf "%s\\n" ')
        pair = subprocess.check_output(['bash', '-eu', '-c', script], env={**os.environ, 'AMP_CONTRAST_LANE': lane}, text=True).strip()
        pairs.append(pair)
    assert pairs == ['--only=light:390', '--only=light:1280', '--only=dark:390', '--only=dark:1280']
    assert 'amp-browser' in deep['report']['needs']



def test_ui_groups_preserve_the_full_ordered_suite_without_duplicates():
    scripts = json.loads((ROOT / 'amp/package.json').read_text())['scripts']

    def expand(name, active=()):
        assert name not in active, f"Recursive npm alias: {name}"
        commands = []
        for command in scripts[name].split(' && '):
            match = re.fullmatch(r'npm run ([\w:-]+)', command)
            commands.extend(expand(match[1], (*active, name)) if match else [command])
        return commands

    # test:ui keeps its independent full chain. Any missing, reordered or
    # duplicated command in any hosted group fails this comparison.
    full = expand('test:ui')
    first, second = expand('test:ui:1'), expand('test:ui:2')
    assert first and second
    assert first + second == full
    second_a, second_b = expand('test:ui:2a'), expand('test:ui:2b')
    assert second_a and second_b
    assert second_a + second_b == second
    assert first + second_a + second_b == full
    assert not set(second_a) & set(second_b)
    assert len(set(full)) == len(full)
    assert not set(first) & set(second)
    assert any('verify-ui.ts' in command for command in first)
    assert all('verify-ui.ts' not in command for command in second)
    assert any('verify-structured-work-ui.ts' in command for command in first)
    assert any('verify-consent-ui.ts' in command for command in second)
    # Every direct verifier remains discoverable for targeted main runs.
    entries = browser_entries(ROOT)
    for command in full:
        for entry in re.findall(r'\btsx (scripts/verify-[\w-]+\.ts)\b', command):
            assert 'amp/' + entry in entries


def test_pending_main_runtime_validation_cannot_be_displaced_by_a_later_doc_commit():
    ci = yaml.safe_load((ROOT / '.github/workflows/ci.yml').read_text())
    # GitHub replaces pending runs sharing a group even with cancellation off.
    # Distinct main SHAs must have distinct groups; PR refs keep their group.
    assert ci['concurrency']['group'] == "ci-${{ github.ref }}${{ github.ref == 'refs/heads/main' && format('-{0}', github.sha) || '' }}"
    assert ci['concurrency']['cancel-in-progress'] == "${{ github.ref != 'refs/heads/main' }}"
    runtime = plan(['amp/src/learning/frontier.ts'])
    later_doc = plan(['amp/docs/deployment.md'])
    assert runtime['core'] and runtime['database']
    assert not later_doc['core'] and not later_doc['database']


def test_template_sweep_partitions_cover_full_and_selected_browser_runs():
    jobs = yaml.safe_load((ROOT / '.github/workflows/amp-deep-checks.yml').read_text())['jobs']
    broad, sweep, coverage = (jobs[name] for name in ('amp-browser', 'amp-ui-sweep', 'amp-ui-coverage'))
    assert broad['env']['AMP_UI_SKIP_TEMPLATE_SWEEP'] == '1'
    assert 'AMP_UI_SHARD_INDEX' not in broad['env']
    assert sweep['strategy'] == {'fail-fast': False, 'matrix': {'shard': list(range(8))}}
    assert sweep['env']['AMP_UI_SHARD_COUNT'] == 8
    assert sweep['env']['AMP_UI_SHARD_INDEX'] == '${{ matrix.shard }}'
    assert 'AMP_UI_SKIP_TEMPLATE_SWEEP' not in sweep['env']
    assert sweep['timeout-minutes'] == broad['timeout-minutes'] == 60
    assert sweep['if'] == "${{ needs.changes.outputs.browser == 'true' && (fromJSON(needs.changes.outputs.amp_plan).browser || contains(fromJSON(needs.changes.outputs.amp_plan).browser_scripts, 'scripts/verify-ui.ts')) }}"
    assert plan(['amp/scripts/verify-ui.ts'])['browser_scripts'] == ['scripts/verify-ui.ts']
    upload = next(step for step in sweep['steps'] if step.get('uses') == 'actions/upload-artifact@v4')
    assert upload['with']['if-no-files-found'] == 'error'
    assert upload['with']['name'] == 'amp-ui-sweep-${{ matrix.shard }}'
    assert upload['with']['overwrite'] is True
    assert upload['with']['path'] == 'amp/artifacts/ui-sweep/shard-${{ matrix.shard }}.json'
    failure_upload = next(step for step in sweep['steps'] if step.get('name') == 'Preserve synthetic UI failure')
    assert failure_upload['if'] == '${{ failure() }}'
    assert failure_upload['with']['name'] == 'amp-ui-failure-${{ matrix.shard }}-${{ github.run_attempt }}'
    assert failure_upload['with']['path'] == 'amp/artifacts/ui-failure/'
    assert failure_upload['with']['if-no-files-found'] == 'ignore'
    assert not failure_upload['with']['name'].startswith('amp-ui-sweep-')
    assert coverage['needs'] == 'amp-ui-sweep'
    assert coverage['if'] == "${{ needs.amp-ui-sweep.result == 'success' }}"
    download = next(step for step in coverage['steps'] if step.get('uses') == 'actions/download-artifact@v4')
    assert download['with']['pattern'] == 'amp-ui-sweep-*'
    assert 'run-id' not in download['with']
    assert '--shards 8' in coverage['steps'][-1]['run']
    assert {'amp-ui-sweep', 'amp-ui-coverage'} <= set(jobs['report']['needs'])
    for path in ('.github/scripts/verify_amp_ui_sweep.py', '.github/scripts/test_amp_ui_sweep.py'):
        assert plan([path])['browser'], path


@pytest.mark.parametrize('selected,outcome,passes', [
    (True, 'success', True), (True, 'failure', False),
    (True, 'cancelled', False), (True, 'skipped', False),
    (False, 'skipped', True), (False, 'failure', False),
])
@pytest.mark.parametrize('lane', ['amp-core', 'amp-database', 'amp-build'])
def test_aggregate_rejects_failures_cancellations_and_accidentally_skipped_jobs(tmp_path, lane, selected, outcome, passes):
    workflow = yaml.safe_load((ROOT / '.github/workflows/ci.yml').read_text())
    script = workflow['jobs']['amp']['steps'][-1]['run']
    selection = dict(core=[], database=[], build=False, typecheck=False)
    if selected:
        selection[{'amp-core': 'core', 'amp-database': 'database', 'amp-build': 'build'}[lane]] = True
    needs = {name: {'result': 'skipped'} for name in ('amp-core', 'amp-database', 'amp-build')}
    needs[lane]['result'] = outcome
    needs['changes'] = {'result': 'success', 'outputs': {'amp_plan': json.dumps(selection)}}
    result = subprocess.run(['bash', '-e', '-c', script], capture_output=True,
                            env={**os.environ, 'AMP_NEEDS': json.dumps(needs),
                                 'GITHUB_STEP_SUMMARY': str(tmp_path / 'summary')})
    assert (result.returncode == 0) == passes, result.stderr


def test_access_gifts_keep_database_authorization_checks_in_feature_prs():
    result = plan(['amp/src/access-grants/repository.ts'], quick=True)
    assert 'tests/access-grants.integration.ts' in result['database']


@pytest.mark.parametrize('quick', [True, False])
def test_math_oracle_runs_the_tests_that_use_it_without_database_build_or_mobile(quick):
    result = plan(['amp/scripts/point_plot_math_oracle.py'], quick=quick)
    assert 'tests/sat.test.ts' in result['core']  # runs independent-math-review.py
    assert len(result['core']) < len(catalog(ROOT)['core'])
    assert result['content'] and not result['content_force']
    assert not any(result[key] for key in ('database', 'build', 'typecheck', 'browser', 'native'))


def test_oracle_consumers_are_followed_through_python_imports(tmp_path):
    (tmp_path / 'amp/tests').mkdir(parents=True)
    (tmp_path / 'amp/scripts').mkdir()
    (tmp_path / 'amp/src').mkdir()
    (tmp_path / 'amp/package.json').write_text('{"scripts":{}}')
    (tmp_path / 'amp/tests/account.integration.ts').write_text('')
    (tmp_path / 'amp/scripts/base_math_oracle.py').write_text('')
    (tmp_path / 'amp/scripts/independent-math-review.py').write_text('from base_math_oracle import x\n')
    (tmp_path / 'amp/tests/review.test.ts').write_text("run('scripts/independent-math-review.py')")
    (tmp_path / 'amp/tests/other.test.ts').write_text('')
    result = plan(['amp/scripts/base_math_oracle.py'], root=tmp_path, quick=True)
    assert result['core'] == ['tests/review.test.ts'] and not result['database']
    # An oracle that runtime code depends on is no longer an isolated input.
    (tmp_path / 'amp/src/server.ts').write_text("spawn('scripts/base_math_oracle.py')")
    result = plan(['amp/scripts/base_math_oracle.py'], root=tmp_path, quick=True)
    assert result['content_force'] and result['native']


@pytest.mark.parametrize('quick', [True, False])
def test_oracle_consumers_include_glob_discovery_and_transitive_helpers(tmp_path, quick):
    (tmp_path / 'amp/tests').mkdir(parents=True)
    (tmp_path / 'amp/scripts').mkdir()
    (tmp_path / 'amp/src').mkdir()
    (tmp_path / 'amp/package.json').write_text('{"scripts":{}}')
    (tmp_path / 'amp/tests/account.integration.ts').write_text('')
    (tmp_path / 'amp/tests/review.test.ts').write_text("run('scripts/independent-math-review.py')")
    (tmp_path / 'amp/tests/other.test.ts').write_text('')
    (tmp_path / 'amp/scripts/shared_oracle.py').write_text('')
    (tmp_path / 'amp/scripts/new_math_oracle.py').write_text('from shared_oracle import solve\n')
    (tmp_path / 'amp/scripts/unrelated_oracle.py').write_text('')
    (tmp_path / 'amp/scripts/independent-math-review.py').write_text(
        "for path in directory.glob('*_math_oracle.py'):\n"
        "    importlib.import_module(path.stem)\n")
    for path in ('new_math_oracle.py', 'shared_oracle.py'):
        result = plan(['amp/scripts/' + path], root=tmp_path, quick=quick)
        assert result['core'] == ['tests/review.test.ts']
        assert result['content'] and not result['content_force']
        assert not any(result[key] for key in ('database', 'build', 'typecheck', 'browser', 'native'))
    assert not plan(['amp/scripts/unrelated_oracle.py'], root=tmp_path, quick=quick)['core']
    # A runtime consumer of the dynamic dispatcher must still force broad checks.
    (tmp_path / 'amp/src/server.ts').write_text("spawn('scripts/independent-math-review.py')")
    result = plan(['amp/scripts/new_math_oracle.py'], root=tmp_path, quick=quick)
    assert result['content_force'] and result['native']


def test_content_pr_quick_checks_skip_database_and_mobile():
    result = plan(['amp/src/content/lessons.ts', 'amp/src/math/engine.ts',
                   'amp/scripts/independent-math-review.py', 'amp/tests/sat.test.ts'], quick=True)
    assert result['build'] and 'tests/sat.test.ts' in result['core']
    assert not result['database'] and not result['native']


def test_policy_change_runs_full_validation_even_for_pull_requests():
    result = plan(['.github/workflows/ci.yml'], quick=True)
    assert result['mode'] == 'full'
    assert result['database'] == catalog(ROOT)['database']
    assert result['core'] == catalog(ROOT)['core']


def test_browser_lanes_verify_configured_font_before_journeys():
    from pathlib import Path
    import yaml
    workflow = Path(__file__).resolve().parents[1] / 'workflows/amp-deep-checks.yml'
    jobs = yaml.safe_load(workflow.read_text())['jobs']
    for name in ('amp-browser', 'amp-ui-sweep'):
        job = jobs[name]
        assert job['env']['AMP_EXPECT_UI_FONT'] == 'Roboto'
        steps = job['steps']
        install = next(i for i, step in enumerate(steps) if 'apt-get install -y poppler-utils fonts-roboto' in step.get('run', ''))
        verify = next(i for i, step in enumerate(steps) if step.get('run') == 'node scripts/verify-ci-fonts.mjs')
        journeys = [i for i, step in enumerate(steps) if 'test:ui:' in step.get('run', '') or 'node --import tsx scripts/verify-ui.ts' in step.get('run', '')]
        assert journeys and install < verify < min(journeys)
        assert 'if' not in steps[verify]
        assert not steps[verify].get('continue-on-error')
