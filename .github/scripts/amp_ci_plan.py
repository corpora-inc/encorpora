"""Select fast PR checks and broad affected validation on main from changed paths."""

import argparse
import json
from pathlib import Path
import re
import sys

from amp_inventory_paths import CONTENT_TESTS, requires_inventory

ROOT = Path(__file__).resolve().parents[2]
POLICY = {
    '.github/workflows/ci.yml', '.github/workflows/amp-deep-checks.yml',
    '.github/scripts/amp_ci_plan.py', '.github/scripts/test_amp_ci_plan.py',
    '.github/scripts/amp_inventory_paths.py', '.github/scripts/test_amp_inventory_paths.py',
}
# These directories contain application screens/providers, not the shared
# mathematical figures imported by publication rendering on the server.
APP_UI = ('amp/src/web/app/', 'amp/src/web/features/')
NATIVE = ('amp/mobile/', 'amp/src/web/native-', 'amp/src/web/Native',
          'amp/scripts/verify-native-session.')
SMOKE_CORE = ('tests/contracts.test.ts', 'tests/brand.test.ts', 'tests/test-suite.test.ts')
PROTECTED_DATABASE = {
    'amp/src/billing/': ('stripe', 'purchase-consent'),
    'amp/src/parent-consent/': ('parent-consent', 'purchase-consent'),
    'amp/src/privacy/': ('retention', 'advertising-permission'),
    'amp/src/family/': ('family',),
    'amp/src/account/': ('accounts', 'account-security'),
    'amp/src/funding/': ('funding-invoice', 'funding-purchase'),
    'amp/src/funding-purchase/': ('funding-purchase',),
    'amp/src/commerce/': ('commerce',),
}


def test_catalog(root):
    files = sorted((root / 'amp/tests').glob('*.ts'))
    return {
        'core': [p.relative_to(root / 'amp').as_posix() for p in files
                 if p.name.endswith('.test.ts')
                 and 'amp/tests/' + p.name not in CONTENT_TESTS
                 and p.name != 'independent-review.test.ts'],
        'database': [p.relative_to(root / 'amp').as_posix() for p in files
                     if p.name.endswith('.integration.ts')],
    }


def browser_entries(root):
    scripts = json.loads((root / 'amp/package.json').read_text())['scripts']
    return {'amp/' + match for name, command in scripts.items() if name.startswith('test:')
            for match in re.findall(r'\btsx (scripts/verify-[\w-]+\.ts)\b', command)}


def referenced_entry(path, root):
    """An entrypoint reused as a helper is not safe to validate in isolation."""
    stem = Path(path).stem
    for folder in ('amp/tests', 'amp/scripts', 'amp/src'):
        for other in (root / folder).rglob('*'):
            if other.suffix not in ('.ts', '.tsx', '.js', '.mjs') or other == root / path:
                continue
            if re.search(r'[\'"`][^\'"`\n]*/' + re.escape(stem)
                         + r'(?:\.[cm]?[jt]sx?)?[\'"`]', other.read_text()):
                return True
    return False


def plan(paths, root=ROOT, full=False, quick=False):
    paths = sorted(set(paths))
    catalog = test_catalog(root)
    if not catalog['core'] or not catalog['database']:
        raise ValueError('Cannot plan validation without both test catalogs')
    result = dict(core=[], database=[], build=False, typecheck=False, colors=False,
                  browser=False, browser_scripts=[], content=False, content_force=False, native=False)
    reasons = []

    def broad(reason):
        result.update(core=catalog['core'][:], database=catalog['database'][:],
                      build=True, typecheck=True, colors=True, browser=True,
                      content=True, content_force=True, native=True)
        reasons.append(reason)

    if full:
        broad('Full validation requested or comparison base unavailable')
    entries = browser_entries(root)
    for path in paths:
        # Git quotes unusual names. Never mistake an unparsed name for an
        # unrelated file, or interpolate filenames into shell commands.
        if not path or path.startswith('/') or any(c in path for c in ('"', '\\', '\n', '\r')) or '..' in Path(path).parts:
            broad('Unrecognized changed-path encoding')
            continue
        if path in POLICY:
            broad('Validation policy changed')
            continue
        if path == 'web/io/data/apps.json':
            result['core'].append('tests/brand.test.ts')
            reasons.append('Product manifest contract')
            continue
        if not path.startswith('amp/'):
            continue
        if path.startswith('amp/docs/') or path in ('amp/README.md', 'amp/AGENTS.md'):
            reasons.append('Documentation only')
            continue
        if path.startswith(NATIVE):
            broad('Native or shared native integration changed')
            continue
        relative = path.removeprefix('amp/')
        lane = next((name for name, files in catalog.items() if relative in files), None)
        if lane and not referenced_entry(path, root):
            result[lane].append(relative)
            result['typecheck'] = True
            reasons.append('Changed ' + lane + ' test entrypoint')
            continue
        if path in CONTENT_TESTS or path == 'amp/tests/independent-review.test.ts':
            result.update(content=True, typecheck=True)
            reasons.append('Content validation entrypoint')
            continue
        if path in entries and (root / path).is_file() and not referenced_entry(path, root):
            result['browser_scripts'].append(relative)
            result['typecheck'] = True
            reasons.append('Changed browser entrypoint')
            continue
        if path.startswith(APP_UI) or (path.startswith('amp/src/web/') and path.endswith('.css')):
            result.update(core=catalog['core'][:], build=True, typecheck=True,
                          colors=True, browser=True)
            result['content'] |= requires_inventory([path])
            reasons.append('Application UI; no database runtime changed')
            continue
        if path.startswith('amp/src/'):
            result.update(core=catalog['core'][:], database=catalog['database'][:],
                          build=True, typecheck=True, colors=True, browser=True)
            result['content'] |= requires_inventory([path])
            result['native'] |= bool(re.match(r'amp/src/(server/(app|auth)\.|web/(auth|main|learning-transport|BookReader)\.)', path))
            reasons.append('Shared runtime or server code')
            continue
        broad('Unknown, shared helper, fixture, configuration, or removed entrypoint: ' + path)
    result['affected'] = bool(reasons)
    # PRs and queue candidates prove compilation, stable contracts and changed
    # tests. Broad regression suites run asynchronously on main; protected
    # account/money/consent areas retain focused database checks before merge.
    if quick and not full:
        changed = {name: [p.removeprefix('amp/') for p in paths
                          if p.removeprefix('amp/') in files]
                   for name, files in catalog.items()}
        if result['build']:
            changed['core'].extend(p for p in SMOKE_CORE if p in catalog['core'])
        api_changed = any(p.startswith(('amp/src/server/', 'amp/migrations/')) for p in paths)
        if api_changed:
            changed['database'].extend(['tests/database.integration.ts', 'tests/trials.integration.ts'])
        for prefix, names in PROTECTED_DATABASE.items():
            if any(p.startswith(prefix) for p in paths):
                changed['database'].extend(f'tests/{name}.integration.ts' for name in names)
        for name in ('core', 'database'):
            if any(p not in catalog[name] for p in changed[name]):
                raise ValueError('A required quick-check test is missing')
            result[name] = changed[name]
        if result['affected']:
            reasons.append('Fast PR/queue checks; broad regression runs on main')
    for name in ('core', 'database', 'browser_scripts'):
        result[name] = sorted(set(result[name]))
    if result['browser']:
        result['browser_scripts'] = []
    result['reasons'] = sorted(set(reasons))
    result['mode'] = 'full' if full else 'quick' if quick else 'affected'
    return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--full', action='store_true')
    parser.add_argument('--github', action='store_true')
    parser.add_argument('--quick', action='store_true')
    args = parser.parse_args()
    result = plan(sys.stdin.read().splitlines(), full=args.full, quick=args.quick)
    if not args.github:
        print(json.dumps(result, indent=2))
        return
    print('amp_plan=' + json.dumps(result, separators=(',', ':')))
    for name, enabled in {
        'amp': result['affected'],
        'amp_core': bool(result['core']), 'amp_database': bool(result['database']),
        'amp_build': result['build'] or result['typecheck'],
        'browser': result['browser'] or bool(result['browser_scripts']),
        'content': result['content'], 'content_force': result['content_force'], 'native': result['native'],
    }.items():
        print(f'{name}={str(enabled).lower()}')


if __name__ == '__main__':
    main()
