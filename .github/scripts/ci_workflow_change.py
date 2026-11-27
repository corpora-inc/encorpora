"""Which CI areas an edit to ci.yml itself can affect.

Every area filter used to match `.github/workflows/ci.yml`, and the AMP
planner treated it as a policy change. So adding one crane job ran every job
in the repository, including the full AMP core and database suites (about 30
minutes), on the pull request and again in the merge queue.

This compares the workflow at both commits, job by job, and prints the area
outputs whose jobs changed. It prints `all` for anything it cannot attribute
to specific jobs, which selects every job as before:

- the file is missing or not shaped as expected at either commit;
- anything outside `jobs:` changed (triggers, concurrency, env, permissions);
- a `changes` job line changed other than an area's own `set_output` line or
  its `outputs:` entry (comments aside, and the warn-only `uncovered` step,
  which runs in that job on every pull request and so tests its own edit);
- a job that is not path gated changed (any job but `ci-gate`, which runs
  on every event and so tests its own edit).

A changed job selects every area it reads (`needs.changes.outputs.<name>`,
in its `if:` or its steps). A name that no `set_output` defines comes from the
AMP planner. The script then prints `amp_policy`, and ci.yml keeps the whole
file in the planner's input, so AMP still gets full validation.

Only `changes` job lines are compared without comments: they are YAML,
bash or Python comments there. In any other job a changed comment selects
that job, because a `#` line in a run block may be data.

Usage: ci_workflow_change.py BASE HEAD   (git revisions; reads ci.yml at both)
"""

import difflib
import re
import subprocess
import sys

PATH = '.github/workflows/ci.yml'
JOB = re.compile(r'^  ([A-Za-z0-9_-]+):\s*$')
REF = re.compile(r'needs\.changes\.outputs\.(\w+)')
SET_OUTPUT = re.compile(r"^\s*set_output (\w+) '[^']*'\s*$")
OUTPUT = re.compile(r'^      (\w+): \$\{\{ steps\.filter\.outputs\.(\w+) \}\}\s*$')
UNGATED = {'ci-gate'}
STEP = re.compile(r'^      - ')
UNCOVERED = '      - id: uncovered'


def _comment(line):
    return line.strip().startswith('#')


def without_uncovered(lines):
    """The `changes` job without its warn-only coverage step."""
    kept, skipping = [], False
    for line in lines:
        if STEP.match(line):
            skipping = line.rstrip() == UNCOVERED
        if not skipping:
            kept.append(line)
    return kept


def split(text):
    """(header lines, {job: lines}), or None when the shape is unexpected."""
    lines = text.split('\n')
    if 'jobs:' not in lines:
        return None
    start = lines.index('jobs:')
    header = [line.rstrip() for line in lines[:start] if line.strip() and not _comment(line)]
    jobs, name = {}, None
    for line in lines[start + 1:]:
        match = JOB.match(line)
        if match:
            name = match.group(1)
            if name in jobs:
                return None
            jobs[name] = []
        elif not line.strip():
            continue
        elif not line.startswith('    ') and not _comment(line):
            return None  # something at the top or job level that is not a job
        elif name is not None:
            jobs[name].append(line.rstrip())
    return header, jobs


def affected(base_text, head_text):
    """(areas, amp_policy), or None when every job must run."""
    base, head = split(base_text), split(head_text)
    if base is None or head is None or base[0] != head[0]:
        return None
    base_jobs, head_jobs = base[1], head[1]
    if 'changes' not in base_jobs or 'changes' not in head_jobs:
        return None
    areas = set()
    old, new = ([line for line in without_uncovered(jobs['changes']) if not _comment(line)]
                for jobs in (base_jobs, head_jobs))
    matcher = difflib.SequenceMatcher(a=old, b=new, autojunk=False)
    for tag, i1, i2, j1, j2 in matcher.get_opcodes():
        if tag == 'equal':
            continue
        for line in old[i1:i2] + new[j1:j2]:
            area = SET_OUTPUT.match(line)
            output = OUTPUT.match(line)
            if area:
                areas.add(area.group(1))
            elif output and output.group(1) == output.group(2):
                areas.add(output.group(1))
            else:
                return None
    filters = {m.group(1) for m in map(SET_OUTPUT.match, old + new) if m}
    amp_policy = False
    for name in sorted(set(base_jobs) | set(head_jobs)):
        if name == 'changes' or name in UNGATED:
            continue
        before, after = base_jobs.get(name), head_jobs.get(name)
        if before == after:
            continue
        reads = set(REF.findall('\n'.join((before or []) + (after or []))))
        if not reads:
            return None
        for read in reads:
            if read in filters:
                areas.add(read)
            else:
                amp_policy = True
    return areas, amp_policy


def show(revision):
    result = subprocess.run(['git', 'show', f'{revision}:{PATH}'],
                            capture_output=True, text=True)
    return result.stdout if result.returncode == 0 else None


def main(argv):
    if len(argv) != 3:
        raise SystemExit('usage: ci_workflow_change.py BASE HEAD')
    texts = [show(revision) for revision in argv[1:]]
    result = None if None in texts else affected(*texts)
    if result is None:
        print('all')
        return
    areas, amp_policy = result
    for area in sorted(areas):
        print(area)
    if amp_policy:
        print('amp_policy')


if __name__ == '__main__':
    main(sys.argv)
