import assert from "node:assert/strict";
import test from "node:test";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { generateProblem } from "../src/math/engine";

const root = fileURLToPath(new URL("../", import.meta.url));
function python(source: string, input?: unknown) {
  const result = spawnSync("python3", ["-c", source], {
    input: input === undefined ? undefined : JSON.stringify(input),
    cwd: root,
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
    timeout: 300_000,
  });
  assert.equal(
    result.status,
    0,
    [result.stderr || result.stdout, result.error && String(result.error)]
      .filter(Boolean)
      .join("\n"),
  );
  return result.stdout;
}

test("typeset worked arithmetic preserves operators, powers, fraction grouping and coefficient context", () => {
  // These are the readers in factoring_math_oracle.py,
  // percent_change_math_oracle.py, equation_math_oracle.py,
  // quadratic_structure_math_oracle.py, linear_function_math_oracle.py and
  // combinatorics_math_oracle.py, with the central review's wrappers applied.
  python(String.raw`import runpy, sys
from fractions import Fraction
sys.path.insert(0, 'scripts')
runpy.run_path('scripts/independent-math-review.py')
import factoring_math_oracle as f
import percent_change_math_oracle as p
import equation_math_oracle as e
import linear_function_math_oracle as q
import combinatorics_math_oracle as c
from worked_math_text import plain_worked_math

assert f.review_equalities(r'$3x \times 2x = 6x^2$ and $3x \times 3 = 9x$.') == 2
assert f.review_equalities(r'$(x - 3)(x + 2) = x^{2} + 2x - 3x - 6 = x^2 - x - 6$.') == 1
assert f.review_equalities(r'The constant is $c = -6$. The coefficient is $b = -1$.', {'b': -1, 'c': -6}) == 0
assert p.numeric_equalities(r'$0.5 = \tfrac{50}{100}$ and 10 ÷ 1,000 = 0.01.') == [Fraction(1, 2), Fraction(1, 100)]
assert p.numeric_equalities(r'$60 \div \tfrac{3}{4} = 60 \times \tfrac{4}{3} = 80$.') == [Fraction(80)]
assert p.numeric_equalities(r'$\tfrac{\tfrac{1}{2}}{4} = \tfrac{1}{8}$.') == [Fraction(1, 8)]
assert e.chains(r'$n = 7.4 \div 4 = 1.85$.') == 1
assert q.arithmetic_claims(r'Put $x = 3$ into $y = 2 \times 3^2 - 12 \times 3 + 13 = 18 - 36 + 13 = -5$.') == 2
assert c.equalities(r'$4 \times 3 = 12$ sandwich-and-soup pairs.') == 1
line = {'id': 'inequality-number-line-choice', 'templateIds': ['inequality-number-line-choice'],
        'workedExample': {'prompt': r'Describe the number line that shows the solutions of $x \ge -1$: is the circle open or filled?',
                          'answer': 'A filled circle at −1 and a ray pointing right'}}
assert e.worked_answer(line)
line['workedExample']['answer'] = 'An open circle at −1 and a ray pointing right'
assert not e.worked_answer(line)

def rejected(check, text, *args):
    try:
        check(text, *args)
    except ValueError:
        return
    raise AssertionError('Corruption accepted: ' + text)

for text in [r'$3x \times 2x = 6x^3$.', r'$3x \times 3 = 8x$.',
             r'$x^2 = x^3$.', r'$x^{23} = x$.', r'$3x \bogus 2x = 6x^2$.']:
    rejected(f.review_equalities, text)
for text in [r'$c = 6$.', r'$c = -6.5$.', r'$c = -6 + 5$.', r'$b = -2$.']:
    rejected(f.review_equalities, text, {'b': -1, 'c': -6})
rejected(f.review_equalities, r'$c = -6$.')  # no prompt-derived context
for text in [r'$0.5 = \tfrac{51}{100}$.', r'$60 \div \tfrac{3}{4} = 45$.',
             r'$1 = \tfrac{1}{0}$.', r'$0.5 = \sqrt{0.25}$.',
             r'$0.5 = \tfrac{1}{}$.', r'$0.5 = \tfrac{1}{2$.']:
    rejected(p.numeric_equalities, text)
rejected(e.chains, r'$n = 7.4 \div 4 = 1.86$.')
rejected(q.arithmetic_claims, r'$y = 2 \times 3^2 - 12 \times 3 + 13 = -4$.')
rejected(c.equalities, r'$4 \times 3 = 13$ pairs.')
assert plain_worked_math(r'$a \ne 0$ and $\binom{n}{k}$') == r'$a \ne 0$ and $\binom{n}{k}$'
print('ok')`);
});

test("the five affected content reviews retain their corruption and coverage checks", () => {
  const output = python(String.raw`import copy, json, runpy, subprocess, sys
sys.path.insert(0, 'scripts')
checks = runpy.run_path('scripts/independent-math-review.py')
import percent_change_math_oracle as percent
results = {}
for name in ['review_factoring_content', 'review_quadratic_structure_content',
             'review_equation_content', 'review_combinatorics_content',
             'review_linear_function_content', 'review_quadratic_structure_mutations',
             'review_equation_mutations', 'review_combinatorics_mutations']:
    results[name] = checks[name]()

export = subprocess.run(['node', '--import', 'tsx', 'scripts/percent-change-content-oracle.ts'],
                        capture_output=True, text=True, check=True)
records = [json.loads(line) for line in export.stdout.splitlines()]
results['review_percent_change_content'] = percent.check_content_records(records)
unit_problem = next(r['problem'] for r in records if r['kind'] == 'percent-runtime'
                    and r['templateId'] == 'percent-change-final'
                    and 'units' in r['problem']['public']['prompt'])
wrong_units = [step.replace('units', 'dollars') for step in unit_problem['explanation']]
assert wrong_units != unit_problem['explanation']
try:
    percent.check_explanation(unit_problem['public'], wrong_units)
except ValueError:
    pass
else:
    raise AssertionError('Wrong worked units accepted')
lessons = {r['templateId']: r for r in records if r['kind'] == 'percent-lesson'}
for template, required in [('percent-change-rate', 'A percentage point is'),
                           ('percent-change-rate', 'It compares those 5 points'),
                           ('percent-change-original', 'It turns every original into 0'),
                           ('percent-change-original', 'wrong base')]:
    bad = copy.deepcopy(lessons[template])
    changed = False
    for section in bad['lesson']['sections']:
        kept = [p for p in section['paragraphs'] if required not in p]
        changed |= kept != section['paragraphs']
        section['paragraphs'] = kept
    assert changed, 'Mutation did not remove its intended explanation'
    try:
        percent.check_lesson(bad)
    except ValueError:
        pass
    else:
        raise AssertionError('Missing percent concept accepted: ' + required)
print(json.dumps(results))`);
  const result = JSON.parse(output.trim().split("\n").at(-1)!);
  assert.equal(result.review_factoring_content.lessons, 3);
  assert.ok(result.review_factoring_content.rejectedContentMutations >= 15);
  assert.equal(result.review_percent_change_content.lessons, 3);
  assert.ok(
    result.review_percent_change_content.rejectedContentMutations >= 11,
  );
  assert.ok(result.review_quadratic_structure_mutations > 0);
  assert.ok(result.review_equation_mutations > 0);
  assert.ok(result.review_combinatorics_mutations > 0);
});

test("display punctuation readings preserve exact answers and option labels", () => {
  const ids = [
    "linear-equation",
    "one-step-equation",
    "two-step-equation",
    "negative-coefficient-equation",
    "polynomial-addition",
    "affine-linear-inequality",
    "linear-system-pair",
    "greatest-monomial-factor",
    "integer-power",
    "same-base-equation",
    "log-equation",
    "staar-nested-grouping",
  ];
  const problems = ids.flatMap((id) =>
    Array.from({ length: 5 }, (_, i) => generateProblem(id, `display-${i}`)),
  );
  python(
    String.raw`import copy, json, runpy, sys
from fractions import Fraction
sys.path.insert(0, 'scripts')
r = runpy.run_path('scripts/independent-math-review.py')
def canonical(value):
    try: return Fraction(str(value))
    except (ValueError, ZeroDivisionError): return str(value)
recorded = []
def check_problem(problem, record=True):
    solved = r['solve'](problem['public'])
    r['require'](canonical(solved) == canonical(problem['answer']), 'Mismatch: incorrect key')
    if record: recorded.append(problem['public']['id'])
for problem in json.load(sys.stdin):
    original = copy.deepcopy(problem)
    solved = r['solve'](problem['public'])
    assert canonical(solved) == canonical(problem['answer']), problem['public']
    reading = r['sentence_reading'](problem)
    assert reading['answer'] == problem['answer']
    assert reading['public']['response'] == problem['public']['response']
    assert problem == original
    before = len(recorded)
    r['check_generated_case'](problem, check_problem)
    assert len(recorded) == before + 1
    wrong = dict(problem, answer='999999')
    try: r['check_generated_case'](wrong, check_problem)
    except ValueError as error: assert 'Mismatch' in str(error)
    else: raise AssertionError('Corrupt key accepted')
    assert len(recorded) == before + 1
    assert problem == original
public = {'templateId':'negative-coefficient-equation', 'prompt':'Solve 2x = 7',
          'response':{'kind':'fraction', 'label':'x'}}
assert r['solve'](public) == Fraction(7, 2)
public['prompt'] = 'Solve 2x = 9'
assert r['solve'](public) == Fraction(9, 2)
print('60 display cases retain independent exact solving and reject wrong keys')`,
    problems,
  );
});

test("the sector oracle accepts singular and plural radian units", () => {
  python(
    String.raw`import copy, json, runpy, sys
sys.path.insert(0, 'scripts')
r = runpy.run_path('scripts/independent-math-review.py')
problem = json.load(sys.stdin)
assert '1 radian.' in problem['public']['prompt']
for unit in ['radian', 'radians']:
    public = copy.deepcopy(problem['public'])
    public['prompt'] = public['prompt'].replace('1 radian.', '1 ' + unit + '.')
    assert r['solve'](public) == problem['answer']
public['prompt'] = public['prompt'].replace('1 radians.', '1 degree.')
try: r['solve'](public)
except (ValueError, AttributeError): pass
else: raise AssertionError('Wrong angle unit accepted')`,
    generateProblem("arc-sector-derivation", "independent-89"),
  );
});
