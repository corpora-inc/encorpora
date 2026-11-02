"""Select the expensive inventory check; unknown AMP areas run it by default."""
import sys
import hashlib
import subprocess

# These application areas are tested by the core suite and database checks.
# Math/content/publication inputs and all scripts remain outside this list.
APPLICATION_AREAS = (
    'amp/src/billing/', 'amp/src/family/', 'amp/src/parent-consent/',
    'amp/src/privacy/', 'amp/src/account/', 'amp/src/analytics/',
    'amp/src/commerce/', 'amp/src/feedback/', 'amp/src/funding/',
    'amp/src/funding-purchase/', 'amp/src/server/',
    'amp/src/web/app/', 'amp/src/web/features/',
)


CONTENT_TESTS = ('amp/tests/grammar.test.ts', 'amp/tests/math-typography.test.ts', 'amp/tests/publications.test.ts', 'amp/tests/instance-hints.test.ts', 'amp/tests/problem-lessons.test.ts', 'amp/tests/glossary-baseline.test.ts', 'amp/tests/plain-language.test.ts')


def requires_inventory(paths):
    for path in paths:
        if path in ('.github/workflows/ci.yml', '.github/workflows/amp-deep-checks.yml') or path.startswith('.github/scripts/'):
            return True
        if not path.startswith('amp/'):
            continue
        if path == 'amp/tests/independent-review.test.ts' or path in CONTENT_TESTS:
            return True
        if (path.startswith('amp/tests/') and path.endswith(('.test.ts', '.integration.ts'))) or path.startswith('amp/docs/') or path in ('amp/README.md', 'amp/AGENTS.md'):
            continue
        if path.startswith(APPLICATION_AREAS):
            continue
        return True
    return False


def fingerprint(records):
    selected = []
    for record in records:
        if not record:
            continue
        _, path = record.split(b'\t', 1)
        if requires_inventory([path.decode('utf-8')]):
            selected.append(record)
    if not selected:
        raise ValueError('No content inputs found')
    return hashlib.sha256(b'\0'.join(sorted(selected))).hexdigest()


if __name__ == '__main__':
    if sys.argv[1:] == ['--fingerprint']:
        tree = subprocess.check_output(['git', 'ls-tree', '-rz', '--full-tree', 'HEAD'])
        print(fingerprint(tree.split(b'\0')))
    elif not sys.argv[1:]:
        print('true' if requires_inventory(sys.stdin.read().splitlines()) else 'false')
    else:
        raise SystemExit('Expected --fingerprint or paths on stdin')
