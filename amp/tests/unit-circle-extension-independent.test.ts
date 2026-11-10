import assert from "node:assert/strict";
import test from "node:test";
import { spawnSync } from "node:child_process";
import { generateProblem } from "../src/math/engine.js";

// The independent oracle (scripts/unit_circle_extension_math_oracle.py)
// recomputes every key from the public payload: t from the prompt, terminal
// points from the drawn scene, and each option judged by its own rules.
const ids = [
  "unit-circle-extension-reason",
  "unit-circle-extension-cloze",
  "real-number-terminal-point",
  "real-number-same-terminal-point",
];

test("the independent oracle reviews every unit-circle-extension case and rejects corrupted ones", () => {
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
import unit_circle_extension_math_oracle as oracle
central = runpy.run_path('scripts/independent-math-review.py')
checks = oracle.self_test()
cases = json.load(sys.stdin)
by = {}
for problem in cases:
    public = problem['public']
    template = public['templateId']
    family = central['FAMILY_ORACLE_FOR'][template]
    assert family.name == 'unit_circle_extension_math_oracle', template
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
# The key's point moved off the terminal point: no option is right.
def move_key(p):
    key = next(o for o in p['public']['response']['options'] if o['id'] == p['answer'])
    q = next(e for e in key['scene']['elements'] if e.get('id') == 'Q')
    q['at'] = [math.cos(0.1), math.sin(0.1)]
reject(first('real-number-terminal-point'), move_key)
# A wrong option replaced by a whole-turn shift makes the stated count false.
def extra_turn(p):
    t = p['public']['prompt'].split('$t = ')[1].split('$')[0]
    wrong = next(o for o in p['public']['response']['options'] if o['id'] not in json.loads(p['answer']))
    wrong['label'] = '$' + t + ' + 6\\pi$'
reject(first('real-number-same-terminal-point'), extra_turn)
# A second valid direction-and-distance option.
def second_key(p):
    key = json.loads(p['answer'])['move']
    blank = p['public']['response']['blanks'][0]
    label = next(o['label'] for o in blank['options'] if o['id'] == key)
    other = next(o for o in blank['options'] if o['id'] != key)
    other['label'] = label
reject(first('unit-circle-extension-cloze'), second_key)
# The dashed figure point moved: P is no longer the terminal point of t.
def move_p(p):
    pt = next(e for e in p['public']['figure']['scene']['elements'] if e.get('id') == 'P')
    pt['at'] = [math.cos(0.2), math.sin(0.2)]
for prefix in ('r1-', 'r2-', 'r3-'):
    reject(first('unit-circle-extension-reason', prefix), move_p)
# The key answer swapped for a distractor.
def swap_key(p):
    p['answer'] = next(o['id'] for o in p['public']['response']['options'] if o['id'] != p['answer'])
reject(first('unit-circle-extension-reason', 'r2-'), swap_key)
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
  assert.match(result.stdout, /'cases': 1024/);
  assert.match(result.stdout, /'rejected': 7/);
});
