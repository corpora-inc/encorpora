import assert from "node:assert/strict";
import test from "node:test";
import { spawnSync } from "node:child_process";
import { generateProblem } from "../src/math/engine.js";

// An independent Python oracle (scripts/parabola_derivation_math_oracle.py)
// reads the focus and directrix, tests every printed line on exact points of
// the parabola, checks each step and stated mistake against the lines, and
// agrees with every key; corrupted cases are refused.
test("independent oracle: deriving a parabola from focus and directrix (HSG.GPE.A.2)", () => {
  const ids = [
    "parabola-derive-equation",
    "parabola-derivation-check",
    "parabola-point-equidistance",
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
import parabola_derivation_math_oracle as oracle
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
def other_blank(p):
    key = json.loads(p['answer'])
    blank = p['public']['response']['blanks'][-1]
    key[blank['id']] = next(o['id'] for o in blank['options'] if o['id'] != key[blank['id']])
    p['answer'] = json.dumps(key, separators=(',', ':'))
for variant, p in by.items():
    reject(p, other_blank if p['public']['response']['kind'] == 'multi-part-choice' else other_option)
def directrix_moved(p):
    # Another directrix makes the shown derivation wrong.
    import re
    prompt = p['public']['prompt']
    m = re.search(r'directrix \$([xy])=(-?\d+)\$', prompt)
    p['public']['prompt'] = prompt.replace(m.group(0), 'directrix $' + m.group(1) + '=' + str(int(m.group(2)) + 1) + '$', 1)
justify = next(p for v, p in by.items() if v.startswith('justify'))
reject(justify, directrix_moved)
reject(by['coordinate'], directrix_moved)
assert len([v for v in by if v.startswith('flaw-')]) == 8, sorted(by)
assert {'horizontal', 'vertical', 'coordinate', 'check-on', 'check-off'} <= set(by), sorted(by)
print({'cases': len(cases), 'variants': len(by), 'rejected': rejected})
`,
    ],
    {
      input: JSON.stringify(cases),
      encoding: "utf8",
      timeout: 180_000,
      maxBuffer: 16 * 1024 * 1024,
    },
  );
  assert.equal(result.status, 0, result.stderr || String(result.error));
  assert.match(result.stdout, /'cases': 768/);
});
