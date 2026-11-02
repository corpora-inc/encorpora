import assert from "node:assert/strict";
import test from "node:test";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

test("right-triangle teaching review reads typeset squares and rejects corrupted relations", () => {
  const result = spawnSync(
    "python3",
    [
      "-c",
      String.raw`
import copy, json, runpy, subprocess, sys
sys.path.insert(0, 'scripts')
checks = runpy.run_path('scripts/independent-math-review.py')
from right_triangle_math_oracle import CONVERSE, fixture_public, review_converse_explanation
from right_triangle_figure_oracle import check_worked_examples

right = fixture_public(CONVERSE, (13, 5, 12))
nonright = fixture_public(CONVERSE, (4, 5, 6))
for text in ['5² + 12² = 13².', r'$5^2 + 12^2 = 13^2$.',
             r'$12^{2} + 5^{2} = 13^{2}$.']:
    review_converse_explanation(right, [text])
for text in ['41 ≠ 36.', r'$41 \ne 36$.', r'$41 \neq 36$.']:
    review_converse_explanation(nonright, [text])

def rejected(public, steps):
    try:
        review_converse_explanation(public, steps)
    except ValueError:
        return
    raise AssertionError('Corrupted relation accepted: ' + repr(steps))

for text in [r'$5^3 + 12^2 = 13^2$.', r'$5^2 + 12^2 = 13^{23}$.',
             r'$-5^2 + 12^2 = 13^2$.', r'$1.5^2 + 12^2 = 13^2$.',
             r'$5^2 + 12^2 = 13^2.5$.',
             r'$5^2 + 12^2 = 13^2^3$.', r'$5^2 + 12^2 = 14^2$.',
             r'$5^2 + 12^2 \ne 13^2$.', r'$5^2 - 12^2 = 13^2$.',
             r'$5^2 + 12^2 \bogus = 13^2$.', r'$a^2 + b^2 = c^2$.']:
    rejected(right, [text])
for text in [r'$41 = 36$.', r'$40 \ne 36$.', r'$41 \ne 35$.',
             r'$-41 \ne 36$.', r'$1.41 \ne 36$.', r'$41 \ne 36.5$.',
             r'$41 \nearly 36$.', r'$41 \ne 360$.']:
    rejected(nonright, [text])
rejected(right, [])

export = subprocess.run(['node', '--import', 'tsx', 'scripts/export-right-triangle-review.ts'],
                        capture_output=True, text=True, check=True, timeout=60)
lessons = json.loads(export.stdout)['lessons']
converse = next(lesson for lesson in lessons if lesson['id'] == CONVERSE)
assert '$5^2 + 12^2 = 13^2$' in converse['workedExample']['steps'][-1]
for change in ['wrong-side', 'wrong-power', 'missing-relation', 'wrong-prompt-unit']:
    broken = copy.deepcopy(lessons)
    example = next(lesson for lesson in broken if lesson['id'] == CONVERSE)['workedExample']
    if change == 'missing-relation':
        example['steps'].pop()
    elif change == 'wrong-prompt-unit':
        example['prompt'] = example['prompt'].replace('5 cm', '5 m')
    else:
        old, new = ('13^2', '14^2') if change == 'wrong-side' else ('13^2', '13^3')
        example['steps'][-1] = example['steps'][-1].replace(old, new)
    assert broken != lessons
    try:
        check_worked_examples(broken)
    except ValueError:
        continue
    raise AssertionError('Corrupted lesson accepted: ' + change)
try:
    review_converse_explanation(right, ['Missing relation.'])
except ValueError as error:
    assert right['prompt'] in str(error) and 'Missing relation.' in str(error)
else:
    raise AssertionError('Missing relation accepted')
checks['review_right_triangle_fixtures']()
print(json.dumps(checks['review_right_triangle_figures']()))
`,
    ],
    {
      cwd: fileURLToPath(new URL("../", import.meta.url)),
      encoding: "utf8",
      timeout: 180_000,
      maxBuffer: 8 * 1024 * 1024,
    },
  );
  assert.equal(
    result.status,
    0,
    [result.stderr || result.stdout, result.error && String(result.error)]
      .filter(Boolean)
      .join("\n"),
  );
  const report = JSON.parse(result.stdout.trim().split("\n").at(-1)!);
  assert.equal(report.workedExamples, 3);
  assert.equal(report.rejectedGeometryMutations, 7);
  assert.equal(report.rejectedWorkedExampleMutations, 4);
  assert.equal(report.publications.rejectedPublicationMutations, 5);
  assert.equal(report.coverage.rejectedCoverageMutations, 5);
});
