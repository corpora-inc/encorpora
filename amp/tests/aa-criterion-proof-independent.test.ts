import assert from "node:assert/strict";
import test from "node:test";
import { spawnSync } from "node:child_process";
import { generateProblem } from "../src/math/engine.js";

const templates = [
  "aa-criterion-proof-build",
  "aa-criterion-step-reason",
  "aa-criterion-argument-check",
];

test("the independent AA-criterion oracle reviews every case and rejects corrupt ones", () => {
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
import aa_criterion_proof_math_oracle as oracle
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
    if public['response']['kind'] == 'structured-work' and public['response']['mode'] == 'build':
        # A build may have more than one valid proof; the solved one is credited.
        assert family[template].review_problem(dict(problem, answer=solved)) == solved
    else:
        assert solved == problem['answer'], public['seed']
    variant = problem.get('variant', {})
    by.setdefault((template, json.dumps(variant.get('axes', {}), sort_keys=True)), problem)
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
    row = next(r for r in key if r[1])
    row[1] = next(r for r in reasons if r != row[1])
    p['answer'] = json.dumps(key, separators=(',', ':'))
def drop_goal_claim(p):
    p['workGrading']['claims'].pop(p['workGrading']['goal'])
def other_option(p):
    p['answer'] = next(o['id'] for o in p['public']['response']['options'] if o['id'] != p['answer'])
for (template, axes), problem in sorted(by.items()):
    if template == 'aa-criterion-proof-build':
        reject(problem, wrong_reason, 'a wrong reason keyed')
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
