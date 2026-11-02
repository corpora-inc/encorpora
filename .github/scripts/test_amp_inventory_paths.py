from amp_inventory_paths import requires_inventory, fingerprint


def test_receipt_and_application_changes_do_not_run_inventory():
    assert not requires_inventory([
        'amp/src/billing/evidence/pdf.ts',
        'amp/tests/payment-evidence.test.ts',
        'amp/docs/billing.md',
    ])
    assert not requires_inventory(['amp/src/server/auth.ts'])
    assert requires_inventory(['amp/src/web/ui/tokens.css'])


def test_math_and_unknown_inputs_run_inventory():
    for path in (
        'amp/src/math/engine.ts', 'amp/src/content/lessons.ts',
        'amp/src/curriculum/catalog.ts', 'amp/src/books/catalog.ts',
        'amp/src/publishing/book.tsx', 'amp/src/web/FractionFigure.tsx',
        'amp/scripts/fraction_math_oracle.py', 'amp/scripts/export-math-cases.ts',
        'amp/tests/independent-review.test.ts', 'amp/books/book.json',
        'amp/package.json', 'amp/package-lock.json', 'amp/tsconfig.json',
        'amp/src/new-shared-area/value.ts', '.github/workflows/ci.yml',
        '.github/workflows/amp-deep-checks.yml',
        '.github/scripts/amp_inventory_paths.py',
    ):
        assert requires_inventory([path]), path


def test_mixed_changes_cannot_hide_inventory_input():
    assert requires_inventory(['amp/src/billing/evidence/pdf.ts', 'amp/src/math/engine.ts'])
    assert not requires_inventory(['corpora-site/src/legal.tsx'])


def test_fingerprint_tracks_exact_inputs_including_deletions_and_renames():
    math = b'100644 blob aaa\tamp/src/math/engine.ts'
    billing = b'100644 blob bbb\tamp/src/billing/evidence/pdf.ts'
    initial = fingerprint([math, billing])
    assert initial == fingerprint([billing.replace(b'bbb', b'ccc'), math])
    assert initial != fingerprint([math.replace(b'aaa', b'ddd'), billing])
    other = b'100644 blob eee\tamp/scripts/other.py'
    assert initial != fingerprint([math, other])
    assert fingerprint([math, other]) != fingerprint([other])
    assert initial != fingerprint([math.replace(b'engine.ts', b'new.ts')])


def test_simulations_and_helpers_are_content_inputs():
    assert requires_inventory(['amp/tests/placement.sim.ts'])
    assert requires_inventory(['amp/tests/fixtures/model.json'])


def test_cache_reuse_requires_exact_hit_and_matching_success_marker(tmp_path):
    import os
    from pathlib import Path
    import subprocess
    workflow = (Path(__file__).resolve().parents[1] / 'workflows/amp-deep-checks.yml').read_text()
    block = workflow.split('      - name: Verify reusable result\n', 1)[1]
    script = block.split('        run: |\n', 1)[1].split('      - name:', 1)[0]
    script = '\n'.join(line[10:] for line in script.splitlines() if line.startswith('          '))
    artifacts = tmp_path / 'artifacts'
    artifacts.mkdir()
    marker = artifacts / 'content-check-publications-success.txt'
    for exact, content, expected in (
        ('true', 'key', 'true'), ('false', 'key', 'false'),
        ('true', 'wrong', 'false'), ('true', None, 'false'),
    ):
        if content is None:
            marker.unlink(missing_ok=True)
        else:
            marker.write_text(content + '\n')
        output = tmp_path / 'output'
        output.write_text('')
        subprocess.run(['bash', '-e', '-c', script], cwd=tmp_path, check=True,
                       env={**os.environ, 'EXACT_HIT': exact, 'EXPECTED': 'key', 'CONTENT_LANE': 'publications',
                            'GITHUB_OUTPUT': str(output), 'GITHUB_STEP_SUMMARY': str(tmp_path / 'summary')})
        assert output.read_text().strip() == f'verified={expected}'


def test_application_changes_do_not_repeat_math_inventory():
    for path in ('amp/src/server/trials.ts', 'amp/src/account/routes.ts',
                 'amp/src/funding-purchase/contracts.ts', 'amp/src/commerce/event.ts'):
        assert not requires_inventory([path]), path


def test_deep_checks_are_separate_from_release_gate():
    from pathlib import Path
    import yaml
    workflows = Path(__file__).resolve().parents[1] / 'workflows'
    ci = yaml.safe_load((workflows / 'ci.yml').read_text())
    deep = yaml.safe_load((workflows / 'amp-deep-checks.yml').read_text())
    assert 'amp' in ci['jobs']['ci-gate']['needs']
    assert 'amp-browser' not in ci['jobs']
    assert 'amp-content' not in ci['jobs']
    assert set(ci['jobs']['amp']['needs']) == {'changes', 'amp-core', 'amp-database', 'amp-build'}
    for lane, command in (('amp-core', 'node scripts/run-ci-tests.mjs core'),
                          ('amp-database', 'node scripts/run-ci-tests.mjs database'),
                          ('amp-build', 'npm run build')):
        assert command in [s.get('run', '') for s in ci['jobs'][lane]['steps']]
    assert set(deep['jobs']['report']['needs']) == {
        'changes', 'amp-browser', 'amp-ui-sweep', 'amp-ui-coverage', 'amp-content'}
    content = str(deep['jobs']['amp-content-checks']['steps'])
    for command in ('npm run audit', 'npm run review:math', 'npm run test:inventory',
                    'npm run test:placement-sim'):
        assert command in content
    # Scheduled/manual runs must not silently reuse an old successful result.
    restore = next(s for s in deep['jobs']['amp-content-checks']['steps']
                   if s.get('uses') == 'actions/cache/restore@v4')
    assert restore['if'] == "github.event_name == 'push' && needs.changes.outputs.content_force != 'true'"


def test_every_background_content_test_triggers_content_workflow():
    from pathlib import Path
    import json
    import subprocess
    root = Path(__file__).resolve().parents[2]
    filenames = json.loads(subprocess.check_output(
        ['node', 'amp/scripts/test-suite.mjs', 'content', '--list'], cwd=root))
    for filename in filenames:
        assert requires_inventory(['amp/tests/' + filename])


def test_parallel_content_lanes_preserve_all_checks_and_fail_closed(tmp_path):
    import os
    from pathlib import Path
    import subprocess
    import yaml
    workflow = Path(__file__).resolve().parents[1] / 'workflows/amp-deep-checks.yml'
    jobs = yaml.safe_load(workflow.read_text())['jobs']
    matrix = jobs['amp-content-checks']
    assert matrix['strategy'] == {
        'fail-fast': False, 'matrix': {'lane': ['publications', 'inventory']}}
    assert matrix['timeout-minutes'] == 120
    assert matrix['if'] == "needs.changes.outputs.content == 'true'"
    assert matrix['env']['CONTENT_LANE'] == '${{ matrix.lane }}'
    steps = matrix['steps']
    commands = {step['run']: step for step in steps if 'run' in step}
    for command in ('npm run audit', 'npm run publications', 'npm run production:queue',
                    'npm run review:math', 'npm run test:placement-sim', 'npm run test:content'):
        assert commands[command]['if'] == "matrix.lane == 'publications' && steps.reuse.outputs.verified != 'true'"
    assert commands['npm run test:inventory']['if'] == "matrix.lane == 'inventory' && steps.reuse.outputs.verified != 'true'"
    assert commands['npm ci']['if'] == "steps.reuse.outputs.verified != 'true'"
    assert not any(step.get('continue-on-error') for step in steps)
    aggregate = jobs['amp-content']
    assert aggregate['name'] == 'amp-content'
    assert set(aggregate['needs']) == {'changes', 'amp-content-checks'}
    assert aggregate['if'] == "${{ always() && needs.changes.outputs.content == 'true' }}"
    gate = aggregate['steps'][-1]
    assert gate['env']['CONTENT_RESULT'] == '${{ needs.amp-content-checks.result }}'
    for result in ('success', 'failure', 'cancelled', 'skipped', ''):
        actual = subprocess.run(['bash', '-e', '-c', gate['run']], cwd=tmp_path,
                                env={**os.environ, 'CONTENT_RESULT': result}, capture_output=True)
        assert (actual.returncode == 0) == (result == 'success')
    assert 'amp-content' in jobs['report']['needs']
    artifact = next(step for step in steps if step.get('uses') == 'actions/upload-artifact@v4')
    assert artifact['if'] == "failure() && matrix.lane == 'publications'"
    assert artifact['with']['name'] == 'amp-book-overflow-${{ matrix.lane }}-${{ github.run_attempt }}'


def test_content_lane_success_caches_are_isolated_and_force_invalidated(tmp_path):
    import os
    from pathlib import Path
    import subprocess
    import yaml
    workflow = Path(__file__).resolve().parents[1] / 'workflows/amp-deep-checks.yml'
    matrix = yaml.safe_load(workflow.read_text())['jobs']['amp-content-checks']
    assert matrix['permissions']['actions'] == 'write'
    steps = matrix['steps']
    key = next(step for step in steps if step.get('id') == 'content-key')['run']
    assert 'amp_inventory_paths.py --fingerprint' in key
    assert all(item in key for item in ('$ImageOS', '$ImageVersion', '$(node --version)', '$(python3 --version)'))
    assert 'amp-content-success-v2-${CONTENT_LANE}-${inputs}-${environment}' in key
    restore = next(step for step in steps if step.get('uses') == 'actions/cache/restore@v4')
    save = next(step for step in steps if step.get('uses') == 'actions/cache/save@v4')
    marker_path = 'amp/artifacts/content-check-${{ matrix.lane }}-success.txt'
    assert restore['with'] == {'path': marker_path, 'key': '${{ steps.content-key.outputs.key }}'}
    assert save['with'] == restore['with']
    assert restore['if'] == "github.event_name == 'push' && needs.changes.outputs.content_force != 'true'"
    assert save['if'] == "success() && steps.reuse.outputs.verified != 'true' && github.ref == 'refs/heads/main'"
    invalidate = next(step for step in steps if step.get('name') == 'Invalidate earlier success before revalidation')
    assert invalidate['if'] == "steps.reuse.outputs.verified != 'true' && github.ref == 'refs/heads/main'"
    assert invalidate['env']['CONTENT_CACHE_KEY'] == '${{ steps.content-key.outputs.key }}'
    assert 'key: process.env.CONTENT_CACHE_KEY' in invalidate['with']['script']
    assert "ref: 'refs/heads/main'" in invalidate['with']['script']
    assert 'if (error.status !== 404) throw error' in invalidate['with']['script']
    assert steps.index(invalidate) < next(i for i, step in enumerate(steps) if step.get('run') == 'npm ci')
    record = next(step for step in steps if step.get('name') == 'Record successful content check')
    assert record['if'] == "success() && steps.reuse.outputs.verified != 'true'"
    assert steps.index(record) > next(i for i, step in enumerate(steps) if step.get('run') == 'npm run test:inventory')
    assert steps.index(save) > steps.index(record)
    reuse = next(step for step in steps if step.get('id') == 'reuse')['run']
    artifacts = tmp_path / 'artifacts'
    artifacts.mkdir()
    for lane in ('publications', 'inventory'):
        expected = f'amp-content-success-v2-{lane}-inputs-runner'
        other = 'inventory' if lane == 'publications' else 'publications'
        other_key = f'amp-content-success-v2-{other}-inputs-runner'
        for existing_lane, contents, passes in ((other, expected, False),
                                               (lane, other_key, False),
                                               (lane, expected, True)):
            for marker in artifacts.iterdir():
                marker.unlink()
            (artifacts / f'content-check-{existing_lane}-success.txt').write_text(contents + '\n')
            output = tmp_path / 'output'
            output.write_text('')
            subprocess.run(['bash', '-e', '-c', reuse], cwd=tmp_path, check=True,
                           env={**os.environ, 'CONTENT_LANE': lane, 'EXACT_HIT': 'true',
                                'EXPECTED': expected, 'GITHUB_OUTPUT': str(output),
                                'GITHUB_STEP_SUMMARY': str(tmp_path / 'summary')})
            assert output.read_text().strip() == f'verified={str(passes).lower()}'
