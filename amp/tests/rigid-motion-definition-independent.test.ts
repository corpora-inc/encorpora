import assert from "node:assert/strict";
import test from "node:test";
import { spawnSync } from "node:child_process";
import { generateProblem } from "../src/math/engine.js";

const ids = [
  "rigid-motion-definition-select",
  "rigid-motion-definition-check",
  "rigid-motion-definition-slots",
];

test("the independent oracle recomputes every rigid-motion definition item from its public payload", () => {
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
import rigid_motion_definition_math_oracle as oracle
central = runpy.run_path('scripts/independent-math-review.py')
oracle.self_test()
cases = json.load(sys.stdin)
checked, by = 0, {}
for problem in cases:
    public = problem['public']
    template = public['templateId']
    family = central['FAMILY_ORACLE_FOR'][template]
    expected = family.review_problem(problem)
    assert expected == problem['answer'], (template, public['seed'], expected, problem['answer'])
    assert central['solve'](public) == problem['answer'], (template, public['seed'])
    by.setdefault((template, problem['variant']['id']), problem)
    checked += 1
rejected = 0
def reject(problem, change):
    global rejected
    problem = copy.deepcopy(problem)
    change(problem)
    try:
        got = central['FAMILY_ORACLE_FOR'][problem['public']['templateId']].review_problem(problem)
    except (ValueError, KeyError, TypeError, StopIteration, AttributeError):
        rejected += 1
        return
    assert got != problem['answer'], 'Corrupt case accepted: ' + problem['public']['templateId']
    rejected += 1
def other_option(p):
    ids = [o['id'] for o in p['public']['response']['options'] if o['id'] != p['answer']]
    p['answer'] = ids[0]
def move_image(p):
    for e in p['public']['figure']['scene']['elements']:
        if e.get('id') in ('q', 'i') and e['type'] == 'point':
            e['at'] = [e['at'][0] + 1, e['at'][1]]
def flip_verdict(p):
    key = json.loads(p['answer'])
    key['verdict'] = 'a' if key['verdict'] != 'a' else 'b'
    p['answer'] = json.dumps(key, separators=(',', ':'))
def move_claimed(p):
    p['public']['prompt'] = p['public']['prompt'].replace("to $P'(", "to $P'(1")
def swap_blank(p):
    key = json.loads(p['answer'])
    blank = p['public']['response']['blanks'][-1]
    key[blank['id']] = next(o['id'] for o in blank['options'] if o['id'] != key[blank['id']])
    p['answer'] = json.dumps(key, separators=(',', ':'))
for (template, variant), problem in sorted(by.items()):
    if template.endswith('select'):
        reject(problem, other_option)
        reject(problem, move_image)
    elif template.endswith('check'):
        reject(problem, flip_verdict)
        reject(problem, move_claimed)
    else:
        reject(problem, swap_blank)
        reject(problem, move_image)
print({'cases': len(cases), 'checked': checked, 'variants': len(by), 'rejected': rejected})
`,
    ],
    {
      input: JSON.stringify(cases),
      encoding: "utf8",
      timeout: 120_000,
      maxBuffer: 1024 * 1024,
    },
  );
  assert.equal(result.status, 0, result.stderr || String(result.error));
  assert.match(result.stdout, /'cases': 768/);
  const m = /'checked': (\d+), 'variants': (\d+), 'rejected': (\d+)/.exec(
    result.stdout,
  )!;
  assert.equal(Number(m[1]), 768);
  assert.equal(Number(m[3]), 2 * Number(m[2]));
});
