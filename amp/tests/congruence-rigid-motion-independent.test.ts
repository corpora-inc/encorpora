import assert from "node:assert/strict";
import test from "node:test";
import { spawnSync } from "node:child_process";
import { generateProblem } from "../src/math/engine.js";

/** HSG.CO.B.7: the independent Python oracle (scripts/
 * congruence_rigid_motion_math_oracle.py) recomputes every key of the
 * congruence-rigid-motion family from the public payload, checks the private
 * proof rule against its own reason rules, and rejects corrupted cases. */
const TEMPLATES = [
  "six-parts-imply-rigid-motion-proof",
  "congruence-definition-reasoning",
  "rigid-motion-from-six-parts-coordinates",
];

test("congruence-rigid-motion: the independent oracle agrees on 256 seeds per template and rejects corrupted cases", () => {
  const cases = TEMPLATES.flatMap((id) =>
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
import congruence_rigid_motion_math_oracle as oracle
central = runpy.run_path('scripts/independent-math-review.py')
oracle.self_test()
PROOF, REASONING, COORDS = 'six-parts-imply-rigid-motion-proof', 'congruence-definition-reasoning', 'rigid-motion-from-six-parts-coordinates'
family = central['FAMILY_ORACLE_FOR']
assert all(family[t].name == 'congruence_rigid_motion_math_oracle' and family[t].returns_answer for t in (PROOF, REASONING, COORDS))
cases = json.load(sys.stdin)

def kind(public):
    t, prompt = public['templateId'], public['prompt']
    if t == PROOF:
        return 'proof-' + public['response']['mode']
    if t == COORDS:
        return 'coordinates'
    if prompt.startswith('Given:'):
        return 'flaw'
    if prompt.startswith('Let $P$'):
        return 'remains' if 'What else must be proved' in prompt else 'direction'
    return 'forward'

failures, by = [], {}
for problem in cases:
    public = problem['public']
    t = public['templateId']
    try:
        expected = family[t].review_problem(problem)
        if expected != problem['answer']:
            raise ValueError('expected ' + expected + ', answer ' + problem['answer'])
        solved = central['solve'](public)
        if solved != problem['answer']:
            raise ValueError('solve gave ' + solved)
    except (ValueError, TypeError, KeyError, AttributeError, StopIteration, IndexError) as error:
        failures.append(t + '/' + public['seed'] + ': ' + str(error)[:240])
        continue
    by.setdefault(kind(public), problem)

rejected = 0
def reject(name, change):
    global rejected
    problem = copy.deepcopy(by[name])
    change(problem)
    try:
        got = family[problem['public']['templateId']].review_problem(problem)
    except (ValueError, TypeError, KeyError, AttributeError, StopIteration, IndexError):
        rejected += 1
        return
    if got != problem['answer']:
        rejected += 1
        return
    raise AssertionError('Corrupt case accepted: ' + name)

def other(ids, current):
    return next(i for i in ids if i != current)

# Proofs: a wrong reason on the last line, a conclusion credited with nothing
# above it, an order key that is not a proof, a wrong given reason, a stated
# orientation the figure does not have.
def last_reason(p):
    key = json.loads(p['answer'])
    reasons = [o['id'] for o in p['public']['response']['banks'][1]['options']]
    key[-1][1] = other(reasons, key[-1][1])
    p['answer'] = json.dumps(key, separators=(',', ':'))
reject('proof-build', last_reason)
def premature_goal(p):
    claims = p['workGrading']['claims']
    goal = p['workGrading']['goal']
    for rid in claims[goal]:
        claims[goal][rid] = [[]]
for name in ('proof-build', 'proof-fill', 'proof-order'):
    reject(name, premature_goal)
reject('proof-order', lambda p: p.__setitem__('answer', json.dumps(json.loads(p['answer'])[::-1], separators=(',', ':'))))
def given_reason(p):
    reasons = [o['id'] for o in p['public']['response']['banks'][1]['options']]
    row = next(r for r in p['public']['response']['rows'] if 'given' in r['fields'][1])
    row['fields'][1]['given'] = other(reasons, row['fields'][1]['given'])
reject('proof-fill', given_reason)
def orientation(p):
    prompt = p['public']['prompt']
    p['public']['prompt'] = prompt.replace('runs counterclockwise', 'runs @').replace('runs clockwise', 'runs counterclockwise').replace('runs @', 'runs clockwise')
reject('proof-build', orientation)

# Reasoning: a wrong key for every task; a remains item whose swapped-names
# option is made equivalent to the missing direction (two valid options).
def wrong_choice(p):
    p['answer'] = other([o['id'] for o in p['public']['response']['options']], p['answer'])
for name in ('forward', 'direction', 'remains', 'flaw'):
    reject(name, wrong_choice)
def swapped_valid(p):
    import re
    for o in p['public']['response']['options']:
        m = re.fullmatch(r"That if rigid motions map (.+) onto (.+), the six pairs are congruent\.", o['label'])
        n = re.fullmatch(r"That if the six pairs are congruent, rigid motions map (.+) onto (.+)\.", o['label'])
        if m:
            o['label'] = 'That if the six pairs are congruent, rigid motions map ' + m[1] + ' onto ' + m[2] + '.'
        elif n:
            o['label'] = 'That if rigid motions map ' + n[1] + ' onto ' + n[2] + ', the six pairs are congruent.'
reject('remains', swapped_valid)

# Coordinates: every other option in every part, a moved vertex, a reversed
# translation in the explanation.
coordinates = by['coordinates']
for blank in coordinates['public']['response']['blanks']:
    def change(p, blank_id=blank['id']):
        key = json.loads(p['answer'])
        b = next(x for x in p['public']['response']['blanks'] if x['id'] == blank_id)
        key[blank_id] = other([o['id'] for o in b['options']], key[blank_id])
        p['answer'] = json.dumps(key, separators=(',', ':'))
    reject('coordinates', change)
def moved(p):
    import re
    prompt = p['public']['prompt']
    found = re.findall(r"\$(\w)\((-?\d+),(-?\d+)\)\$", prompt)
    name, x, y = found[4]
    p['public']['prompt'] = prompt.replace('$%s(%s,%s)$' % (name, x, y), '$%s(%s,%d)$' % (name, x, int(y) + 1))
reject('coordinates', moved)
def reversed_vector(p):
    import re
    for i, e in enumerate(p['explanation']):
        m = re.search(r"so the translation is \$\(x,y\)\\to\(x([+-]\d+)?,\\,y([+-]\d+)?\)\$", e)
        if m:
            dx, dy = -int(m[1] or 0), -int(m[2] or 0)
            p['explanation'][i] = e.replace(m[0], 'so the translation is $(x,y)\\to(x%+d,\\,y%+d)$' % (dx, dy))
reject('coordinates', reversed_vector)

print(json.dumps({'cases': len(cases), 'kinds': sorted(by), 'rejected': rejected, 'failures': failures}))
`,
    ],
    {
      input: JSON.stringify(cases),
      encoding: "utf8",
      timeout: 300_000,
      maxBuffer: 16 * 1024 * 1024,
    },
  );
  assert.equal(result.status, 0, result.stderr || String(result.error));
  const report = JSON.parse(result.stdout.trim().split("\n").at(-1)!) as {
    cases: number;
    kinds: string[];
    rejected: number;
    failures: string[];
  };
  assert.equal(report.cases, 768);
  assert.deepEqual(report.kinds, [
    "coordinates",
    "direction",
    "flaw",
    "forward",
    "proof-build",
    "proof-fill",
    "proof-order",
    "remains",
  ]);
  assert.equal(report.rejected, 19);
  assert.deepEqual(
    report.failures,
    [],
    `${report.failures.length} cases disagree with the oracle`,
  );
});
