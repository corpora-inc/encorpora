import assert from "node:assert/strict";
import test from "node:test";
import { spawnSync } from "node:child_process";
import { generateProblem } from "../src/math/engine.js";

const ids = [
  "circle-similarity-proof-steps",
  "circle-similarity-justify-flaw",
  "circle-similarity-general-map",
];

test("the independent oracle proves, judges and simulates every circle-similarity item", () => {
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
import circle_similarity_proof_math_oracle as oracle
central = runpy.run_path('scripts/independent-math-review.py')
oracle.self_test()
cases = json.load(sys.stdin)
by = {}
for problem in cases:
    public = problem['public']
    template = public['templateId']
    expected = central['FAMILY_ORACLE_FOR'][template].review_problem(problem)
    assert expected == problem['answer'], (template, public['seed'], expected, problem['answer'])
    if template != 'circle-similarity-proof-steps':
        assert central['solve'](public) == problem['answer'], (template, public['seed'])
    else:
        assert central['solve'](public).startswith('provable:'), public['seed']
    by.setdefault((template, problem['variant']['id']), problem)
rejected = 0
def reject(problem, change):
    global rejected
    problem = copy.deepcopy(problem)
    change(problem)
    try:
        got = central['FAMILY_ORACLE_FOR'][problem['public']['templateId']].review_problem(problem)
    except (ValueError, KeyError, TypeError, StopIteration, IndexError):
        rejected += 1
        return
    assert got != problem['answer'], 'Corrupt case accepted: ' + problem['public']['seed']
    rejected += 1
def other_option(p):
    r = p['public']['response']
    if r['kind'] == 'choice':
        p['answer'] = next(o['id'] for o in r['options'] if o['id'] != p['answer'])
    else:
        key = json.loads(p['answer'])
        out = next(o['id'] for o in r['options'] if o['id'] not in key)
        p['answer'] = json.dumps(sorted(key[1:] + [out]), separators=(',', ':'))
def drop_claim(p):
    claims = p['workGrading']['claims']
    del claims[p['workGrading']['goal']]
def premature_claim(p):
    claims = p['workGrading']['claims']
    goal = p['workGrading']['goal']
    for rid in claims[goal]:
        claims[goal][rid] = [[]]
def swap_lines(p):
    rows = p['public']['response']['rows']
    key = json.loads(p['answer'])
    if p['public']['response']['mode'] == 'order':
        p['answer'] = json.dumps(list(reversed(key)), separators=(',', ':'))
    elif p['public']['response']['mode'] == 'build':
        p['answer'] = json.dumps([key[1], key[0]] + key[2:], separators=(',', ':'))
    else:
        missing = next(i for i, c in enumerate(key) if c[0])
        key[missing] = [key[missing][0], next(o['id'] for o in p['public']['response']['banks'][1]['options'] if o['id'] != key[missing][1])]
        p['answer'] = json.dumps(key, separators=(',', ':'))
def numeric_radius(p):
    p['public']['prompt'] = p['public']['prompt'].replace('radius $', 'radius $1', 1)
for (template, variant), problem in sorted(by.items()):
    if template == 'circle-similarity-proof-steps':
        reject(problem, drop_claim)
        reject(problem, premature_claim)
        reject(problem, swap_lines)
    else:
        reject(problem, other_option)
        reject(problem, numeric_radius)  # a radius like "1r" is malformed
print({'cases': len(cases), 'variants': len(by), 'rejected': rejected})
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
  assert.match(result.stdout, /'rejected': \d+/);
});
