"""Unit cases for ci_workflow_change: what an edit to ci.yml selects.

End-to-end selection through the real `changes` step is in
test_ci_change_selection.py; these cover the shapes that must fall back to
every job.
"""
from pathlib import Path

from ci_workflow_change import affected

WORKFLOW = (Path(__file__).resolve().parents[1] / 'workflows/ci.yml').read_text()
JOB = '''  probe:
    needs: changes
    if: needs.changes.outputs.dja == 'true'
    runs-on: ubuntu-24.04
    steps:
      - run: echo probe
'''


def with_job(text, job):
    return text.replace('\n  ci-gate:\n', '\n' + job + '  ci-gate:\n', 1)


def test_an_unchanged_workflow_selects_nothing():
    assert affected(WORKFLOW, WORKFLOW) == (set(), False)


def test_a_new_gated_job_selects_the_area_it_reads():
    assert affected(WORKFLOW, with_job(WORKFLOW, JOB)) == ({'dja'}, False)
    assert affected(with_job(WORKFLOW, JOB), WORKFLOW) == ({'dja'}, False)


def test_a_new_job_that_is_not_path_gated_selects_everything():
    ungated = JOB.replace("    if: needs.changes.outputs.dja == 'true'\n", '')
    assert affected(WORKFLOW, with_job(WORKFLOW, ungated)) is None


def test_a_job_reading_planner_outputs_keeps_amp_policy():
    amp = JOB.replace('outputs.dja', 'outputs.amp_core')
    assert affected(WORKFLOW, with_job(WORKFLOW, amp)) == (set(), True)


def test_ci_gate_edits_select_nothing_because_it_always_runs():
    edited = WORKFLOW.replace('\n  ci-gate:\n    name: ci-gate\n',
                              '\n  ci-gate:\n    name: ci-gate\n    env:\n      PROBE: "1"\n', 1)
    assert edited != WORKFLOW
    assert affected(WORKFLOW, edited) == (set(), False)


def test_unexpected_shapes_select_everything():
    assert affected(WORKFLOW, 'name: CI\n') is None
    assert affected('x\n', WORKFLOW) is None
    # A top-level key after `jobs:`.
    assert affected(WORKFLOW, WORKFLOW + 'env:\n  PROBE: "1"\n') is None
    # A job defined twice.
    assert affected(WORKFLOW, with_job(WORKFLOW, JOB + JOB)) is None
    # A trigger change.
    assert affected(WORKFLOW, WORKFLOW.replace('  merge_group:\n', '  merge_group:\n    types: [checks_requested]\n', 1)) is None


def test_an_output_wired_to_another_name_selects_everything():
    old = '      dja: ${{ steps.filter.outputs.dja }}'
    assert WORKFLOW.count(old) == 1
    assert affected(WORKFLOW, WORKFLOW.replace(old, '      dja: ${{ steps.filter.outputs.lambda }}')) is None
