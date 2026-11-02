import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { generateProblem } from "../src/math/engine.js";

test("independent fraction-rate review reads singular units without accepting wrong rates or units", () => {
  const problems = Array.from({ length: 256 }, (_, seed) =>
    generateProblem("mcas-fraction-rate-select", `independent-${seed}`),
  );
  const checked = spawnSync(
    "python3",
    [
      "-c",
      String.raw`
import copy, json, runpy, sys
sys.path.insert(0, 'scripts')
runpy.run_path('scripts/independent-math-review.py')
import mcas_gap_math_oracle as oracle
problems = json.load(sys.stdin)
for problem in problems:
    oracle.review_problem(problem)
case = problems[60]
options = case['public']['response']['options']
singular = next(i for i, option in enumerate(options) if option['label'] == 'Friday: $1$ mile per hour')
assert options[singular]['id'] not in json.loads(case['answer'])

def reject(problem):
    try:
        oracle.review_problem(problem)
    except ValueError:
        return
    raise AssertionError('Corrupt rate accepted')

# The generated singular option is false: two miles in half an hour is 4 mph.
bad = copy.deepcopy(case)
bad['answer'] = json.dumps(sorted([options[singular]['id'], *json.loads(case['answer'])[1:]]), separators=(',', ':'))
reject(bad)
for label in ['Friday: $1$ kilometer per hour', 'Friday: $1$ mile per minute',
              'Friday: $1$ mile per hour plus 1', 'Friday: $4$ miles per hour',
              'Friday: $1 + bogus$ mile per hour']:
    bad = copy.deepcopy(case)
    bad['public']['response']['options'][singular]['label'] = label
    reject(bad)

# Singular wording can also be a true rate, not merely an ignored distractor.
good = copy.deepcopy(case)
good['public']['prompt'] = good['public']['prompt'].replace('On Friday the hiker walked $2$ miles', 'On Friday the hiker walked $\\frac{1}{2}$ miles')
old_true = next(option['id'] for option in options if option['label'] == 'Friday: $4$ miles per hour')
expected = sorted([value for value in json.loads(case['answer']) if value != old_true] + [options[singular]['id']])
assert oracle.solve(good['public']) == json.dumps(expected, separators=(',', ':'))
print(json.dumps({'cases': len(problems), 'mutations': 6}))
`,
    ],
    {
      cwd: fileURLToPath(new URL("../", import.meta.url)),
      input: JSON.stringify(problems),
      encoding: "utf8",
      timeout: 30_000,
      maxBuffer: 8 * 1024 * 1024,
    },
  );
  assert.equal(checked.status, 0, checked.stderr || String(checked.error));
  assert.deepEqual(JSON.parse(checked.stdout), { cases: 256, mutations: 6 });
});

test("independent mixture and sector readers retain exact math with articles and singular area units", () => {
  const problems = ["rate-combination-model", "arc-sector-derivation"].flatMap(
    (id) =>
      Array.from({ length: 256 }, (_, seed) =>
        generateProblem(id, `independent-${seed}`),
      ),
  );
  const checked = spawnSync(
    "python3",
    [
      "-c",
      String.raw`
import copy, json, runpy, sys
sys.path.insert(0, 'scripts')
checks = runpy.run_path('scripts/independent-math-review.py')
problems = json.load(sys.stdin)
for problem in problems:
    assert checks['solve'](problem['public']) == problem['answer']

def reject(problem):
    try:
        actual = checks['solve'](problem['public'])
    except ValueError:
        return
    assert actual != problem['answer'], 'Corruption accepted'

mixture = problems[20]
assert 'an 11%' in mixture['public']['prompt']
for before, after in [('an 11%', 'another 11%'), ('liters', 'gallons'),
                      ('11%', '12%'), ('as a percent?', 'as a percent? plus 1')]:
    bad = copy.deepcopy(mixture)
    assert before in bad['public']['prompt']
    bad['public']['prompt'] = bad['public']['prompt'].replace(before, after)
    reject(bad)
for index in [81, 96, 120, 159, 212, 250]:
    assert 'of an ' in problems[index]['public']['prompt']

sector = problems[256 + 239]
options = sector['public']['response']['options']
singular = next(i for i, option in enumerate(options) if option['label'] == '$1$ square centimeter')
for label in ['$1$ cubic centimeter', '$1$ square meter', '$1$ square centimeter nonsense',
              '$4$ square centimeters', '$1 + bogus$ square centimeter']:
    bad = copy.deepcopy(sector)
    bad['public']['response']['options'][singular]['label'] = label
    reject(bad)
bad = copy.deepcopy(sector)
bad['answer'] = options[singular]['id']
reject(bad)
good = copy.deepcopy(sector['public'])
assert 'radius 4 cm' in good['prompt']
good['prompt'] = good['prompt'].replace('radius 4 cm', 'radius 2 cm')
assert checks['solve'](good) == options[singular]['id']
print(json.dumps({'cases': len(problems), 'mutations': 10}))
`,
    ],
    {
      cwd: fileURLToPath(new URL("../", import.meta.url)),
      input: JSON.stringify(problems),
      encoding: "utf8",
      timeout: 30_000,
      maxBuffer: 8 * 1024 * 1024,
    },
  );
  assert.equal(checked.status, 0, checked.stderr || String(checked.error));
  assert.deepEqual(JSON.parse(checked.stdout), { cases: 512, mutations: 10 });
});
