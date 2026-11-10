import assert from "node:assert/strict";
import test from "node:test";
import { spawnSync } from "node:child_process";
import { generateProblem } from "../src/math/engine.js";

// An independent Python oracle
// (scripts/measurement_precision_report_math_oracle.py) re-reads every
// reading, step and operation from the prompt, carries the windows exactly
// and agrees with every key; corrupted cases are refused.
test("independent oracle: accuracy of reported measurements (HSN.Q.A.3)", () => {
  const ids = [
    "justified-report-from-measurements",
    "measurement-report-meaning",
    "precision-report-critique",
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
import measurement_precision_report_math_oracle as oracle
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
    except (ValueError, TypeError, KeyError, AttributeError, StopIteration, IndexError):
        ok = False
    assert not ok, 'Corrupt case accepted: ' + problem['public']['seed']
    rejected += 1
def other_option(p):
    p['answer'] = next(o['id'] for o in p['public']['response']['options'] if o['id'] != p['answer'])
def other_set(p):
    ids = [o['id'] for o in p['public']['response']['options']]
    key = json.loads(p['answer'])
    swap = next(i for i in ids if i not in key)
    p['answer'] = json.dumps(sorted(key[1:] + [swap]), separators=(',', ':'))
for variant, p in by.items():
    reject(p, other_set if p['public']['response']['kind'] == 'multi-select' else other_option)
def display_off(p):
    # A calculator display that is not the computed value.
    import re
    m = re.search(r'(?:shows|gets|is|=) \$?(\d+\.\d+)\$', p['public']['prompt'])
    old = m.group(1)
    p['public']['prompt'] = p['public']['prompt'].replace(old, old[:-1] + str((int(old[-1]) + 3) % 10), 1)
for variant in ('convert-in-cm', 'product-fuel-economy', 'combine-relay-time'):
    if variant in by:
        reject(by[variant], display_off)
assert len([v for v in by if v.startswith(('convert', 'combine', 'product'))]) >= 10, sorted(by)
assert {'overstated-product', 'mismatched-sum', 'trailing-zero'} <= set(by), sorted(by)
assert len([v for v in by if v.startswith('tool-')]) == 8 and len([v for v in by if v.startswith('report-')]) == 4, sorted(by)
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
