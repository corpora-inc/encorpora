"""Every job declares its own timeout.

Without `timeout-minutes` a hung job holds its pull request, the merge queue
or a release for GitHub's default of six hours. That happened to
`amp-database` four times in one week (three main pushes cancelled at 360
minutes, PR #2559 after 41). Size each value from the job's recent durations
(about 2-3x its p95, with room for npm/pip retries), not one blanket number.
"""

from pathlib import Path

import yaml

WORKFLOWS = Path(__file__).resolve().parents[1] / 'workflows'


def test_every_job_declares_a_bounded_timeout():
    missing = []
    for path in sorted(WORKFLOWS.glob('*.y*ml')):
        jobs = yaml.safe_load(path.read_text())['jobs']
        for name, job in jobs.items():
            # A reusable-workflow call takes its timeouts from the jobs it runs.
            if 'uses' in job:
                continue
            timeout = job.get('timeout-minutes')
            if not isinstance(timeout, int) or not 1 <= timeout < 360:
                missing.append(f'{path.name}: {name} ({timeout!r})')
    assert not missing, 'jobs without a timeout under 360 minutes:\n' + '\n'.join(missing)
