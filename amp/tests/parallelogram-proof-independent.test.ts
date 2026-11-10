import assert from "node:assert/strict";
import test from "node:test";
import { spawnSync } from "node:child_process";
import { generateProblem } from "../src/math/engine.js";

const templates = [
  "parallelogram-proof-fill",
  "parallelogram-proof-order",
  "parallelogram-converse-reasoning",
];

test("the independent parallelogram oracle reviews every case and rejects corrupt ones", () => {
  const cases = templates.flatMap((id) =>
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
import parallelogram_proof_math_oracle as oracle
central = runpy.run_path('scripts/independent-math-review.py')
oracle.self_test()
cases = json.load(sys.stdin)
family = central['FAMILY_ORACLE_FOR']
by = {}
for problem in cases:
    public = problem['public']
    template = public['templateId']
    assert family[template].review_problem(problem) == problem['answer'], public['seed']
    solved = central['solve'](public)
    if template == 'parallelogram-proof-order':
        # Any valid order is credited; the solved one must be accepted as a key.
        assert family[template].review_problem(dict(problem, answer=solved)) == solved
    else:
        assert solved == problem['answer'], public['seed']
    key = (template, problem.get('variant', {}).get('id'))
    by.setdefault(key, problem)
rejected = 0
def reject(problem, change, why):
    global rejected
    bad = copy.deepcopy(problem)
    change(bad)
    try:
        expected = family[bad['public']['templateId']].review_problem(bad)
    except (ValueError, TypeError, KeyError, AttributeError, StopIteration, IndexError):
        rejected += 1
        return
    # The oracle returns the answer it expects; a corrupt key must differ.
    if expected == bad['answer']:
        raise AssertionError('Corrupt case accepted: ' + why)
    rejected += 1
def wrong_reason(p):
    key = json.loads(p['answer'])
    reasons = [o['id'] for o in p['public']['response']['banks'][1]['options']]
    for row in key:
        if row[1]:
            row[1] = next(r for r in reasons if r != row[1])
            break
    else:
        stmts = [o['id'] for o in p['public']['response']['banks'][0]['options']]
        row = next(r for r in key if r[0])
        row[0] = next(s for s in stmts if s != row[0])
    p['answer'] = json.dumps(key, separators=(',', ':'))
def out_of_order(p):
    key = json.loads(p['answer'])
    key[-1], key[-2] = key[-2], key[-1]
    p['answer'] = json.dumps(key, separators=(',', ':'))
def drop_goal_claim(p):
    p['workGrading']['claims'].pop(p['workGrading']['goal'])
def other_option(p):
    p['answer'] = next(o['id'] for o in p['public']['response']['options'] if o['id'] != p['answer'])
for (template, variant), problem in sorted(by.items()):
    if template == 'parallelogram-proof-fill':
        reject(problem, wrong_reason, 'fill key with a wrong choice')
        reject(problem, drop_goal_claim, 'goal without a claim')
    elif template == 'parallelogram-proof-order':
        reject(problem, out_of_order, 'order with the goal not last')
        reject(problem, drop_goal_claim, 'goal without a claim')
    else:
        reject(problem, other_option, 'a wrong option keyed')
print({'cases': len(cases), 'variants': len(by), 'rejected': rejected})
`,
    ],
    {
      input: JSON.stringify(cases),
      encoding: "utf8",
      timeout: 300_000,
      maxBuffer: 1024 * 1024,
    },
  );
  assert.equal(result.status, 0, result.stderr || String(result.error));
  assert.match(result.stdout, /'cases': 768/);
  const variants = Number(/'variants': (\d+)/.exec(result.stdout)![1]);
  const rejected = Number(/'rejected': (\d+)/.exec(result.stdout)![1]);
  assert.ok(variants >= 15, result.stdout);
  assert.ok(rejected >= variants, result.stdout);
});
