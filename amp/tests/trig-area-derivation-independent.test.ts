import assert from "node:assert/strict";
import test from "node:test";
import { spawnSync } from "node:child_process";
import { generateProblem } from "../src/math/engine.js";

/** HSG.SRT.D.9: an independent Python oracle rebuilds each triangle from
 * the public figure (or the stated numbers), drops the heights itself and
 * judges every option; it must agree with every generated key and reject
 * corrupted cases. */
const ids = [
  "trig-area-auxiliary-line",
  "trig-area-derivation-fill",
  "trig-area-derivation-reasoning",
];

test("the independent oracle agrees with every trig-area-derivation key and rejects corrupted cases", () => {
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
import trig_area_derivation_math_oracle as oracle
central = runpy.run_path('scripts/independent-math-review.py')
oracle.self_test()
cases = json.load(sys.stdin)
first = {}
for problem in cases:
    public = problem['public']
    template = public['templateId']
    family = central['FAMILY_ORACLE_FOR'][template]
    assert family.review_problem(problem) == problem['answer'], (template, public['seed'])
    assert central['solve'](public) == problem['answer'], (template, public['seed'])
    first.setdefault(template, problem)
rejected = 0
def reject(template, change):
    global rejected
    problem = copy.deepcopy(first[template])
    change(problem)
    try:
        result = oracle.review_problem(problem)
    except (ValueError, TypeError, KeyError, AttributeError, StopIteration):
        rejected += 1
        return
    if result != problem['answer']:
        rejected += 1
        return
    raise AssertionError('Corrupted case accepted: ' + template)
def wrong_answer(p):
    r = p['public']['response']
    if r['kind'] == 'choice':
        p['answer'] = next(o['id'] for o in r['options'] if o['id'] != p['answer'])
    elif r['kind'] == 'point-plot':
        x, y = json.loads(p['answer'])[0]
        p['answer'] = json.dumps([[x, y + 1]], separators=(',', ':'))
    else:
        key = json.loads(p['answer'])
        blank = r['blanks'][-1]
        key[blank['id']] = next(o['id'] for o in blank['options'] if o['id'] != key[blank['id']])
        p['answer'] = json.dumps(key, separators=(',', ':'))
def two_keys(p):
    r = p['public']['response']
    if r['kind'] == 'choice':
        good = next(o for o in r['options'] if o['id'] == p['answer'])
        other = next(o for o in r['options'] if o['id'] != p['answer'])
    else:
        key = json.loads(p['answer'])
        blank = r['blanks'][-1]
        good = next(o for o in blank['options'] if o['id'] == key[blank['id']])
        other = next(o for o in blank['options'] if o['id'] != key[blank['id']])
    other['label'] = good['label']
def move_vertex(p):
    p['public']['response']['given']['vertices'][0]['x'] += 1
def move_foot(p):
    foot = next(e for e in p['public']['figure']['scene']['elements'] if e.get('id') == 'd')
    foot['at'] = [foot['at'][0] + 0.5, foot['at'][1]]
reject('trig-area-auxiliary-line', wrong_answer)
reject('trig-area-auxiliary-line', move_vertex)
for change in (wrong_answer, two_keys, move_foot):
    reject('trig-area-derivation-fill', change)
for change in (wrong_answer, two_keys):
    reject('trig-area-derivation-reasoning', change)
print({'cases': len(cases), 'rejected': rejected})
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
  assert.match(result.stdout, /'rejected': 7/);
});
