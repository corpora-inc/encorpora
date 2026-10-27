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
# Independent exact math oracles. They are Python, so no runtime, build or
# database code imports them: their consumers are the tests and review scripts
# that name them, found by reference rather than by a hand-kept list.
ORACLE = re.compile(r'amp/scripts/(independent-math-review|[a-z0-9_]+_oracle)\.py')
SMOKE_CORE = ('tests/contracts.test.ts', 'tests/brand.test.ts', 'tests/test-suite.test.ts')
PROTECTED_DATABASE = {
    'amp/src/access-grants/': ('access-grants',),
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


def _sources(root):
    for folder in ('amp/tests', 'amp/scripts', 'amp/src'):
        for path in sorted((root / folder).rglob('*')):
            if path.is_file() and 'node_modules' not in path.parts:
                yield path.relative_to(root).as_posix(), path
    if (root / 'amp/package.json').is_file():
        yield 'amp/package.json', root / 'amp/package.json'


def oracle_consumers(path, root):
    """Consumers reached through literal references or the math-review discovery glob."""
    texts = {}
    for name, file in _sources(root):
        try:
            texts[name] = file.read_text()
        except UnicodeDecodeError:
            continue
    def names(stem):
        return re.compile(r'(?<![\w-])' + re.escape(stem) + r'(?![\w-])')
    users = {path}
    pending = [path]
    while pending:
        current = Path(pending.pop())
        pattern = names(current.stem)
        # discover_family_oracles imports every matching sibling, even without
        # a literal module reference. Include its dispatcher and follow its users.
        dispatcher = 'amp/scripts/independent-math-review.py'
        if (current.parent.as_posix() == 'amp/scripts'
                and current.match('*_math_oracle.py')
                and dispatcher in texts and dispatcher not in users):
            users.add(dispatcher)
            pending.append(dispatcher)
        for name, text in texts.items():
            if (name not in users and name.startswith('amp/scripts/') and name.endswith('.py')
                    and pattern.search(text)):
                users.add(name)
                pending.append(name)
    patterns = [names(Path(user).stem) for user in users]
    return sorted(name for name, text in texts.items() if name not in users
                  and any(pattern.search(text) for pattern in patterns))


def is_review_helper(consumer, root):
    """A non-test script under amp/tests that no test imports, run only by review scripts."""
    if not consumer.startswith('amp/tests/') or re.search(r'\.(test|integration)\.[jt]s$', consumer):
        return False
    stem = re.compile(r'(?<![\w-])' + re.escape(Path(consumer).stem) + r'(?![\w-])')
    for name, file in _sources(root):
        if name.startswith('amp/tests/') and name != consumer:
            try:
                if stem.search(file.read_text()):
                    return False
            except UnicodeDecodeError:
                continue
    return True


def plan(paths, root=ROOT, full=False, quick=False):
    paths = sorted(set(paths))
    # A change to the selection policy or its workflows is validated by the
    # complete selection it produces, on pull requests and the queue as well.
    if any(path in POLICY for path in paths):
        full = True
    catalog = test_catalog(root)
    if not catalog['core'] or not catalog['database']:
        raise ValueError('Cannot plan validation without both test catalogs')
    result = dict(core=[], database=[], build=False, typecheck=False, colors=False,
                  browser=False, browser_scripts=[], content=False, content_force=False, native=False)
    reasons = []
    # Tests selected because a changed input feeds them, kept by quick checks.
    targeted = dict(core=[], database=[])

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
        if ORACLE.fullmatch(path) and (root / path).is_file():
            unknown, users = [], dict(core=[], database=[])
            for consumer in oracle_consumers(path, root):
                relative = consumer.removeprefix('amp/')
                lane = next((name for name, files in catalog.items() if relative in files), None)
                if lane:
                    users[lane].append(relative)
                elif consumer in CONTENT_TESTS or consumer == 'amp/tests/independent-review.test.ts':
                    result['content'] = True
                elif consumer.endswith('.md'):
                    pass
                elif is_review_helper(consumer, root):
                    result['content'] = True
                elif consumer == 'amp/package.json' or consumer.startswith('amp/scripts/'):
                    result['content'] = True
                else:
                    unknown.append(consumer)
            if unknown:
                broad('Math oracle used outside tests and review scripts: ' + ', '.join(unknown))
                continue
            for lane in ('core', 'database'):
                result[lane].extend(users[lane])
                targeted[lane].extend(users[lane])
            result['content'] = True
            reasons.append('Math oracle; run the tests that use it')
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
                          if p.removeprefix('amp/') in files] + targeted[name]
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


def github_outputs(result):
    """Step outputs. Every name is `amp`-prefixed and unique: ci.yml appends
    these to the same $GITHUB_OUTPUT as its area filters, where a repeated name
    silently replaces the earlier value (an unprefixed `native` once switched
    the Rust job on for content PRs and off for Rust PRs)."""
    return {
        'amp_plan': json.dumps(result, separators=(',', ':')),
        **{name: str(enabled).lower() for name, enabled in {
            'amp': result['affected'],
            'amp_core': bool(result['core']), 'amp_database': bool(result['database']),
            'amp_build': result['build'] or result['typecheck'],
            'amp_browser': result['browser'] or bool(result['browser_scripts']),
            'amp_content': result['content'], 'amp_content_force': result['content_force'],
            'amp_mobile': result['native'],
        }.items()},
    }


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
    for name, value in github_outputs(result).items():
        print(f'{name}={value}')


if __name__ == '__main__':
    main()
