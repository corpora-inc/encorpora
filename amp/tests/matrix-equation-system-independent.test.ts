import assert from "node:assert/strict";
import test from "node:test";
import { spawnSync } from "node:child_process";
import { generateProblem } from "../src/math/engine.js";

// An independent Python oracle (scripts/matrix_equation_system_math_oracle.py)
// re-reads every system and matrix equation from the public prompt and agrees
// with every key; corrupted cases are refused.
test("independent oracle: matrix equations of systems (HSA.REI.C.8)", () => {
  const ids = ["system-to-matrix-equation", "matrix-equation-reading"];
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
import matrix_equation_system_math_oracle as oracle
import tex_value_kit as kit
central = runpy.run_path('scripts/independent-math-review.py')
kit.self_test()
oracle.self_test()
cases = json.load(sys.stdin)
by = {}
for problem in cases:
    public = problem['public']
    template = public['templateId']
    family = central['FAMILY_ORACLE_FOR'][template]
    assert family.review_problem(problem) == problem['answer'], public['seed']
    assert central['solve'](public) == problem['answer'], public['seed']
    variant = problem['variant']['id']
    by.setdefault(variant.split('-')[0] if template == 'system-to-matrix-equation' else variant, problem)
rejected = 0
def reject(problem, change):
    global rejected
    problem = copy.deepcopy(problem)
    change(problem)
    try:
        ok = central['FAMILY_ORACLE_FOR'][problem['public']['templateId']].review_problem(problem) == problem['answer']
    except (ValueError, TypeError, KeyError, AttributeError, StopIteration, IndexError):
        ok = False
    assert not ok, 'Corrupt case accepted: ' + problem['public']['seed']
    rejected += 1
def other_option(p):
    p['answer'] = next(o['id'] for o in p['public']['response']['options'] if o['id'] != p['answer'])
reading = [p for v, p in by.items() if not v.startswith(('aligned', 'rearranged', 'shape'))]
for p in reading:
    reject(p, other_option)
def wrong_entry(p):
    key = json.loads(p['answer'])
    key[0][0] = str(int(key[0][0]) + 1)
    p['answer'] = json.dumps(key, separators=(',', ':'))
for v in ('aligned', 'rearranged', 'shape'):
    reject(by[v], wrong_entry)
def wrong_rule(p):
    p['workGrading']['fields'][2][1]['value'] = str(int(p['workGrading']['fields'][2][1]['value']) + 1)
reject(by['aligned'], wrong_rule)
def twin_system(p):
    # A second option that states the same system: two keys, refused.
    options = p['public']['response']['options']
    correct = next(o for o in options if o['id'] == p['answer'])
    wrong = next(o for o in options if o['id'] != p['answer'])
    wrong['label'] = correct['label'] + ' '
which = next(p for v, p in by.items() if v.startswith('which-system'))
reject(which, twin_system)
# Every flaw kind and both substitution outcomes were reviewed.
assert sum(v.startswith('find-flaw') for v in by) == 6, sorted(by)
assert {'substitute-solution', 'substitute-near-miss', 'coefficient', 'coefficient-zero'} <= set(by), sorted(by)
assert rejected >= 18, rejected
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
  assert.match(result.stdout, /'cases': 512/);
});
