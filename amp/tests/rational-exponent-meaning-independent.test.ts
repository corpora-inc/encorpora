import assert from "node:assert/strict";
import test from "node:test";
import { spawnSync } from "node:child_process";
import { generateProblem } from "../src/math/engine.js";

// An independent Python oracle
// (scripts/rational_exponent_meaning_math_oracle.py) evaluates every option
// and argument line from its TeX and applies its own rule base for the
// argument's order and reasons; it agrees with every key and refuses
// corrupted cases.
test("independent oracle: meaning of rational exponents (HSN.RN.A.1)", () => {
  const ids = [
    "rational-exponent-derivation",
    "rational-exponent-definition-test",
    "radical-exponent-notation-reason",
  ];
  const cases = ids.flatMap((id) =>
    Array.from({ length: 256 }, (_, i) =>
      generateProblem(id, `independent-${i}`),
    ),
  );
  const result = spawnSync(
    "python3",
    [
      "-c",
      String.raw`
import copy, json, runpy, sys
sys.path.insert(0, 'scripts')
import rational_exponent_meaning_math_oracle as oracle
central = runpy.run_path('scripts/independent-math-review.py')
oracle.self_test()
cases = json.load(sys.stdin)
by = {}
for problem in cases:
    public = problem['public']
    family = central['FAMILY_ORACLE_FOR'][public['templateId']]
    assert family.review_problem(problem) == problem['answer'], public['seed']
    assert central['solve'](public) == problem['answer'], public['seed']
    by.setdefault(problem['variant']['id'], problem)
rejected = 0
def reject(problem, change):
    global rejected
    problem = copy.deepcopy(problem)
    change(problem)
    try:
        ok = central['FAMILY_ORACLE_FOR'][problem['public']['templateId']].review_problem(problem) == problem['answer']
    except (ValueError, TypeError, KeyError, AttributeError, StopIteration, IndexError, ZeroDivisionError):
        ok = False
    assert not ok, 'Corrupt case accepted: ' + problem['public']['seed']
    rejected += 1
def other_option(p):
    p['answer'] = next(o['id'] for o in p['public']['response']['options'] if o['id'] != p['answer'])
for variant, p in by.items():
    reject(p, other_option)
def second_true(p):
    # Copy the keyed option onto another: two valid options are refused.
    options = p['public']['response']['options']
    key = next(o for o in options if o['id'] == p['answer'])
    other = next(o for o in options if o['id'] != p['answer'])
    other['label'] = key['label'] + ' '
for variant in ('proposals-perfect', 'proposals-plain', 'define-value'):
    if variant in by:
        reject(by[variant], second_true)
def true_line(p):
    # Repair the first false line of a script: its key no longer fits.
    import re
    prompt = p['public']['prompt']
    m = re.search(r'Line 3: so \$(\d+)\^\{1/(\d)\}=(\d+)\^(\d)\$', prompt)
    assert m, prompt
    b, n = m.group(1), m.group(2)
    root = '\\sqrt{' + b + '}' if n == '2' else '\\sqrt[' + n + ']{' + b + '}'
    p['public']['prompt'] = prompt.replace(m.group(0), 'Line 3: so $' + b + '^{1/' + n + '}=' + root + '$')
reject(by['false-line-f2'], true_line)
assert len([v for v in by if v.startswith('false-line')]) == 6, sorted(by)
assert len([v for v in by if v.startswith(('justify', 'line', 'order'))]) >= 10, sorted(by)
print({'cases': len(cases), 'variants': len(by), 'rejected': rejected})
`,
    ],
    {
      input: JSON.stringify(cases),
      encoding: "utf8",
      timeout: 120_000,
      maxBuffer: 16 * 1024 * 1024,
    },
  );
  assert.equal(result.status, 0, result.stderr || String(result.error));
  assert.match(result.stdout, /'cases': 768/);
});
