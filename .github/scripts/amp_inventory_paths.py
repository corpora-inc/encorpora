"""Select the expensive inventory check; unknown AMP areas run it by default."""
import sys

# These application areas are tested by the core suite and database checks.
# Math/content/publication inputs and all scripts remain outside this list.
APPLICATION_AREAS = (
    'amp/src/billing/', 'amp/src/family/', 'amp/src/parent-consent/',
    'amp/src/privacy/', 'amp/src/server/', 'amp/src/web/features/',
    'amp/src/web/app/', 'amp/src/web/lib/', 'amp/src/web/ui/',
)


def requires_inventory(paths):
    for path in paths:
        if path == '.github/workflows/ci.yml' or path.startswith('.github/scripts/'):
            return True
        if not path.startswith('amp/'):
            continue
        if path == 'amp/tests/independent-review.test.ts':
            return True
        if path.startswith(('amp/tests/', 'amp/docs/')) or path in ('amp/README.md', 'amp/AGENTS.md'):
            continue
        if path.startswith(APPLICATION_AREAS):
            continue
        return True
    return False


if __name__ == '__main__':
    print('true' if requires_inventory(sys.stdin.read().splitlines()) else 'false')
