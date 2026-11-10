import assert from "node:assert/strict";
import test from "node:test";
import { spawnSync } from "node:child_process";
import { generateProblem } from "../src/math/engine.js";

// The independent oracle (scripts/trig_inverse_restriction_math_oracle.py)
// decides one-to-one and "takes every value of the range" from each
// interval's turning points and asymptotes, reads highlighted pieces from the
// drawn graphs, and finds the one x in D with f(x) = v.
const ids = [
  "trig-restriction-domain",
  "trig-restriction-domain-graph",
  "trig-one-to-one-intervals",
  "restricted-trig-inverse",
  "trig-inverse-why-restrict",
];

test("the independent oracle reviews every trig-inverse-restriction case and rejects corrupted ones", () => {
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
import trig_inverse_restriction_math_oracle as oracle
central = runpy.run_path('scripts/independent-math-review.py')
checks = oracle.self_test()
cases = json.load(sys.stdin)
by = {}
for problem in cases:
    public = problem['public']
    template = public['templateId']
    family = central['FAMILY_ORACLE_FOR'][template]
    assert family.name == 'trig_inverse_restriction_math_oracle', template
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
# The key interval duplicated into a wrong option: two answers.
def duplicate_key(p):
    key = next(o['label'] for o in p['public']['response']['options'] if o['id'] == p['answer'])
    next(o for o in p['public']['response']['options'] if o['id'] != p['answer'])['label'] = key
reject(first('trig-restriction-domain', 'another-interval'), duplicate_key)
reject(first('trig-restriction-domain', 'convention'), duplicate_key)
# A card's highlighted piece moved onto a turning point.
def widen(p):
    for o in p['public']['response']['options']:
        if o['id'] == p['answer']:
            g = next(e for e in o['scene']['elements'] if e.get('type') == 'graph')
            piece = next(c for c in g['curves'] if 'domain' in c)
            piece['domain'] = [piece['domain'][0], piece['domain'][1] + math.pi / 2]
reject(first('trig-restriction-domain-graph'), widen)
# The stated count no longer matches.
def count(p):
    p['public']['response']['selectionCount'] -= 1
reject(first('trig-one-to-one-intervals'), count)
# The dashed line drawn at another value than the prompt states.
def other_level(p):
    g = next(e for e in p['public']['figure']['scene']['elements'] if e.get('type') == 'graph')
    g['lines'][0]['line']['b'] += 0.25
reject(first('restricted-trig-inverse'), other_level)
# A student's b that does not give v.
def wrong_b(p):
    p['public']['prompt'] = p['public']['prompt'].replace('$b = ', '$b = \\frac{\\pi}{12} + ', 1)
reject(first('trig-inverse-why-restrict', 'two-values'), wrong_b)
reject(first('trig-inverse-why-restrict', 'no-inverse'), wrong_b)
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
  assert.match(result.stdout, /'cases': 1280/);
  assert.match(result.stdout, /'rejected': 7/);
});
