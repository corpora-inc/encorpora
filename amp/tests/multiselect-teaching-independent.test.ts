import assert from "node:assert/strict";
import test from "node:test";
import { spawnSync } from "node:child_process";
import { generateProblem } from "../src/math/engine.js";

test("number-select oracles validate teaching prose and an exact ordered verdict block", () => {
  const ids = [
    "place-value-forms-select",
    "equivalent-fractions-select",
    "fraction-line-names-select",
    "equivalent-ratios-select",
    "rounds-to-select",
    "compare-to-pi-select",
    "multiplication-fact-grid-select",
    "equal-factor-truth-select",
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
import multiselect_number_math_oracle as oracle
central = runpy.run_path('scripts/independent-math-review.py')
oracle.self_test()
cases = json.load(sys.stdin)
seen, rejected, legacy = set(), 0, 0
for problem in cases:
    assert oracle.review_problem(problem) == problem['answer']
    assert central['solve'](problem['public']) == problem['answer']
    template = problem['public']['templateId']
    lead, tail = oracle.explanation_frame(problem['public'])
    if not lead:
        continue
    old = copy.deepcopy(problem)
    old['explanation'] = old['explanation'][len(lead):-len(tail)]
    assert oracle.review_problem(old) == problem['answer']
    legacy += 1
    # Cover every frame variant, not only the first seed of a family.
    shape = (template, len(lead), 'sqrt' in lead[0], 'comparisons' in tail[0])
    if shape in seen:
        continue
    seen.add(shape)
    def reject(change):
        global rejected
        bad = copy.deepcopy(problem)
        change(bad['explanation'])
        try:
            oracle.review_problem(bad)
        except (ValueError, TypeError, KeyError, AttributeError, StopIteration):
            rejected += 1
        else:
            raise AssertionError('Accepted corrupt explanation: ' + template)
    start = len(lead)
    reject(lambda lines: lines.pop(start))
    reject(lambda lines: lines.insert(start, lines[start]))
    def swap(lines):
        lines[start], lines[start+1] = lines[start+1], lines[start]
    reject(swap)
    reject(lambda lines: lines.__setitem__(start, lines[start].replace(': true.', ': FALSE.').replace(': false.', ': true.').replace(': FALSE.', ': false.')))
    reject(lambda lines: lines.append('$1=2$: true. Extra verdict.'))
    reject(lambda lines: lines.__setitem__(0, 'A mathematical fact: $1=2$.'))
    reject(lambda lines: lines.__setitem__(-1, 'Every option is correct.'))
    reject(lambda lines: lines.insert(start, 'An additional claim: $1=2$.'))
assert len(cases) == 2048 and legacy == 1792
assert len(seen) == 9 and rejected == 72
print({'cases': len(cases), 'legacy': legacy, 'frame_variants': len(seen), 'rejected': rejected})
`,
    ],
    {
      input: JSON.stringify(cases),
      encoding: "utf8",
      timeout: 60000,
      maxBuffer: 1024 * 1024,
    },
  );
  assert.equal(result.status, 0, result.stderr || String(result.error));
  assert.match(result.stdout, /'rejected': 72/);
});

test("independent review reports the failing case and preserves the original error", () => {
  const result = spawnSync(
    "python3",
    [
      "-c",
      String.raw`
import runpy, sys
sys.path.insert(0, 'scripts')
c = runpy.run_path('scripts/independent-math-review.py')
p = {'public': {'templateId': 'booth-equation-slots', 'seed': 'independent-9', 'prompt': 'Use $k$.'}}
calls = []
def bad(problem, record=True):
    calls.append(record)
    raise ValueError('Layout' if '$' in problem['public']['prompt'] else 'Unreadable prompt')
try:
    c['check_generated_case'](p, bad)
except ValueError as e:
    assert str(e) == 'booth-equation-slots/independent-9: Layout', str(e)
else:
    raise AssertionError('Expected contextual case error')
assert calls == [False, False]
try:
    c['read_plainly'](bad)(p)
except ValueError as e:
    assert str(e) == 'Layout'
else:
    raise AssertionError('Expected original nested oracle error')
calls.clear()
def plain_only(problem, record=True):
    if '$' in problem['public']['prompt']:
        raise ValueError('Read plain variables')
    calls.append(record)
c['check_generated_case'](p, plain_only)
assert calls == [False, True], calls
calls.clear()
def valid(problem, record=True):
    calls.append(record)
c['check_generated_case'](p, valid)
assert calls == [False, True], calls
for exception in (ZeroDivisionError, OverflowError):
    def numerical_failure(problem, record=True):
        raise exception('numerical defect')
    try:
        c['check_generated_case'](p, numerical_failure)
    except ValueError as error:
        assert str(error) == 'booth-equation-slots/independent-9: numerical defect'
        assert isinstance(error.__cause__, exception)
    else:
        raise AssertionError('Numerical failure lacks case context')
def bad_solver(public):
    raise ValueError('Original solver defect' if '$' in public['prompt'] else 'Fallback parser defect')
c['solve'].__globals__['solve_family'] = bad_solver
try:
    c['solve'](p['public'])
except ValueError as error:
    assert str(error) == 'Original solver defect'
else:
    raise AssertionError('Solver lost original failure')
print('context, original error, successful fallback and record-once checks passed')
`,
    ],
    { encoding: "utf8", timeout: 30000 },
  );
  assert.equal(result.status, 0, result.stderr || String(result.error));
});
