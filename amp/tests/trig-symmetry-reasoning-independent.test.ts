import assert from "node:assert/strict";
import test from "node:test";
import { spawnSync } from "node:child_process";
import { generateProblem } from "../src/math/engine.js";

// The independent oracle (scripts/trig_symmetry_reasoning_math_oracle.py)
// reads P and the target angle from the prompt and figure, computes the
// image point, evaluates every equation in an option numerically, and
// decides each conclusion from the equation's form.
const ids = [
  "unit-circle-symmetry-derivation",
  "trig-periodicity-explanation",
  "unit-circle-claim-check",
];

test("the independent oracle reviews every trig-symmetry case and rejects corrupted ones", () => {
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
import copy, json, math, runpy, sys
sys.path.insert(0, 'scripts')
import trig_symmetry_reasoning_math_oracle as oracle
central = runpy.run_path('scripts/independent-math-review.py')
checks = oracle.self_test()
cases = json.load(sys.stdin)
by = {}
for problem in cases:
    public = problem['public']
    template = public['templateId']
    family = central['FAMILY_ORACLE_FOR'][template]
    assert family.name == 'trig_symmetry_reasoning_math_oracle', template
    assert family.review_problem(problem) == problem['answer'], (template, public['seed'])
    assert central['solve'](public) == problem['answer'], (template, public['seed'])
    by.setdefault((template, problem['variant']['id']), problem)
rejected = 0
def reject(problem, change):
    global rejected
    bad = copy.deepcopy(problem)
    change(bad)
    try:
        result = oracle.review_problem(bad)
    except (ValueError, KeyError, StopIteration):
        rejected += 1
        return
    assert result != bad['answer'], 'Corrupt case accepted: ' + bad['public']['templateId']
    rejected += 1
def first(template, prefix=''):
    return next(p for (t, v), p in sorted(by.items()) if t == template and v.startswith(prefix))
# Q drawn at the wrong angle.
def move_q(p):
    q = next(e for e in p['public']['figure']['scene']['elements'] if e.get('id') == 'Q')
    q['at'] = [-q['at'][0], q['at'][1]] if abs(q['at'][0]) > 0.1 else [q['at'][1], q['at'][0]]
for prefix in ('neg-theta-', 'pi-plus-theta', 'pi-minus-theta'):
    reject(first('unit-circle-symmetry-derivation', prefix), move_q)
# A second correct conclusion.
def second_result(p):
    key = json.loads(p['answer'])['result']
    blank = next(b for b in p['public']['response']['blanks'] if b['id'] == 'result')
    label = next(o['label'] for o in blank['options'] if o['id'] == key)
    next(o for o in blank['options'] if o['id'] != key)['label'] = label
reject(first('unit-circle-symmetry-derivation', 'neg-theta-tan'), second_result)
# A counterexample option replaced by another true counterexample.
def two_counterexamples(p):
    key = p['answer']
    other = next(o for o in p['public']['response']['options'] if o['id'] != key)
    other['label'] = next(o['label'] for o in p['public']['response']['options'] if o['id'] == key).replace('$\\theta = ', '$\\theta = 2\\pi + ')
reject(first('trig-periodicity-explanation', 'counterexample'), two_counterexamples)
# The flaw keyed to the wrong step.
def wrong_step(p):
    p['answer'] = next(o['id'] for o in p['public']['response']['options'] if o['id'] != p['answer'])
reject(first('trig-periodicity-explanation', 'flaw-'), wrong_step)
# The stated count no longer matches the true statements.
def count(p):
    p['public']['response']['selectionCount'] += 1
reject(first('unit-circle-claim-check'), count)
print({'cases': len(cases), 'checks': checks, 'rejected': rejected})
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
  assert.match(result.stdout, /'rejected': 7/);
});
