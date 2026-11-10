"""Unit-only CI selection for the lesson-film kit."""
import re

import yaml

from amp_ci_plan import ROOT, plan


def test_film_kit_uses_its_unit_job_without_application_or_media_work():
    for quick in (False, True):
        result = plan(['amp/film/cast.ts', 'amp/film/lessons/rectangle-area.json'], quick=quick)
        assert not result['affected']
        assert not any(result[key] for key in ('core', 'database', 'build', 'browser', 'content', 'native'))
    workflow = yaml.safe_load((ROOT / '.github/workflows/ci.yml').read_text())
    jobs = workflow['jobs']
    film = jobs['amp-film']
    assert film['if'] == "needs.changes.outputs.amp_film == 'true'"
    assert 'amp-film' in jobs['ci-gate']['needs']
    commands = [step.get('run', '') for step in film['steps']]
    assert 'npm run film:test' in commands
    assert not any('film/make' in command or 'film:build' in command for command in commands)
    detection = next(step['run'] for step in jobs['changes']['steps'] if step.get('id') == 'filter')
    pattern = re.search(r"set_output amp_film '([^']+)'", detection).group(1)
    for path in ('amp/film/cast.ts', 'amp/film/lessons/rectangle-area.json',
                 'amp/src/web/Figure.tsx', 'amp/package-lock.json', 'amp/tsconfig.json',
                 '.github/workflows/ci.yml'):
        assert re.search(pattern, path), path
    for path in ('corpan/packs/example/main.ts', 'amp/docs/product-model.md', 'README.md'):
        assert not re.search(pattern, path), path
