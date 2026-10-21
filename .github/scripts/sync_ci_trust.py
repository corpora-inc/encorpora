#!/usr/bin/env python3
"""Maintain the identical pre-checkout trust loader in every runnable CI job."""
from pathlib import Path
import sys

HELPER_COMMIT = '17ff4c57cf68f96f9509825afa285ef658b82f6f'
HELPER_SHA256 = '36c05f8077fd4bc7b8498ca966ef68532257a839093f610cc1b8b7bd62bc76e9'
LOADER = '''      - name: Initialize verified client trust
        id: ci-trust
        shell: bash
        working-directory: ${{ runner.temp }}
        run: |
          python3 -I - <<'PY'
          import hashlib, os, pathlib, subprocess, sys, tempfile, urllib.request
          url = 'https://raw.githubusercontent.com/corpora-inc/encorpora/COMMIT/.github/scripts/ci_trust.py'
          opener = urllib.request.build_opener(urllib.request.ProxyHandler({}))
          with opener.open(url, timeout=30) as response:
              if response.url != url:
                  raise SystemExit('Unexpected CI trust helper redirect')
              source = response.read(50001)
          if hashlib.sha256(source).hexdigest() != 'SHA256':
              raise SystemExit('CI trust helper checksum mismatch')
          descriptor, name = tempfile.mkstemp(prefix='corpora-ci-bootstrap-', suffix='.py', dir=os.environ['RUNNER_TEMP'])
          try:
              with os.fdopen(descriptor, 'wb') as output:
                  output.write(source)
              subprocess.run([sys.executable, '-I', name], check=True)
          finally:
              pathlib.Path(name).unlink()
          PY
'''.replace('COMMIT', HELPER_COMMIT).replace('SHA256', HELPER_SHA256)


def synchronize(text):
    """Insert/update generated loaders while preserving all other YAML text."""
    import re
    # The block ends immediately before the following step, comment, or job.
    pattern = r'^      - name: Initialize verified client trust\n.*?^          PY\n'
    text = re.sub(pattern, '', text, flags=re.M | re.S)
    return text.replace('    steps:\n', '    steps:\n' + LOADER)


def main():
    workflows = Path(__file__).resolve().parents[1] / 'workflows'
    mismatches = []
    for path in sorted((*workflows.glob('*.yml'), *workflows.glob('*.yaml'))):
        original = path.read_text()
        expected = synchronize(original)
        if original != expected:
            mismatches.append(path.name)
            if '--write' in sys.argv:
                path.write_text(expected)
    if mismatches and '--write' not in sys.argv:
        raise SystemExit('Run python3 .github/scripts/sync_ci_trust.py --write: ' + ', '.join(mismatches))


if __name__ == '__main__':
    main()
