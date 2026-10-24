import json
import os
from pathlib import Path
import subprocess

import pytest
import yaml

from amp_ci_plan import ROOT, plan, test_catalog as catalog


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
    assert values['amp_core'] == values['browser'] == values['content'] == 'false'
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
    for step in deep['amp-browser']['steps']:
        if step.get('run') in ('npm run test:ui', 'npm run test:family-ui', 'npm run test:contrast'):
            assert 'amp_plan).browser' in step['if']


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
