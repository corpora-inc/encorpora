import assert from "node:assert/strict";
import test from "node:test";
import { spawnSync } from "node:child_process";
import { generateProblem } from "../src/math/engine.js";

const TEMPLATES = [
  "rigid-motion-criterion-proof",
  "rigid-motion-criterion-reason",
  "rigid-motion-criterion-flaw",
];

test("the independent oracle reviews every rigid-motion criterion problem and rejects corrupted ones", () => {
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
import copy, json, re, runpy, sys
sys.path.insert(0, 'scripts')
import congruence_criterion_proof_math_oracle as oracle
central = runpy.run_path('scripts/independent-math-review.py')
oracle.self_test()
cases = json.load(sys.stdin)
failures, base = [], {}
for problem in cases:
    public = problem['public']
    template = public['templateId']
    family = central['FAMILY_ORACLE_FOR'][template]
    assert family.name == 'congruence_criterion_proof_math_oracle' and family.returns_answer
    try:
        expected = family.review_problem(problem)
        if expected != problem['answer']:
            raise ValueError('the oracle keys ' + str(expected))
        solved = central['solve'](public)
        if solved.startswith('orders:'):
            if problem['answer'] not in json.loads(solved[len('orders:'):]):
                raise ValueError('the key is not a valid order')
        elif solved != problem['answer']:
            raise ValueError('solve gives ' + solved)
    except (ValueError, KeyError, TypeError) as error:
        failures.append(template + '/' + public['seed'] + ': ' + str(error)[:160])
        continue
    variant = problem['variant']['id']
    if template.endswith('proof'):
        r = public['response']
        blank = 'statements' if any('given' not in row['fields'][0] for row in r['rows']) else 'reasons'
        kind = 'order' if r['mode'] == 'order' else blank
    elif template.endswith('flaw'):
        kind = 'planted' if variant.startswith('planted') else variant
    else:
        kind = variant.split('-')[0]
    base.setdefault((template, kind), problem)

rejected = 0
def reject(key, change, why):
    global rejected
    problem = copy.deepcopy(base[key])
    change(problem)
    try:
        expected = central['FAMILY_ORACLE_FOR'][key[0]].review_problem(problem)
    except (ValueError, TypeError, KeyError, AttributeError, IndexError, StopIteration):
        rejected += 1
        return
    if expected == problem['answer']:
        raise AssertionError('Corrupt case accepted: ' + why)
    rejected += 1

PROOF, REASON, FLAW = 'rigid-motion-criterion-proof', 'rigid-motion-criterion-reason', 'rigid-motion-criterion-flaw'

def reversed_order(p):
    p['answer'] = json.dumps(json.loads(p['answer'])[::-1], separators=(',', ':'))
reject((PROOF, 'order'), reversed_order, 'a reversed proof')

def loosened(p):
    claims = p['workGrading']['claims']
    sid = next(s for s, by in claims.items() if any(alt for alts in by.values() for alt in alts))
    for r in claims[sid]:
        claims[sid][r] = [[]]
reject((PROOF, 'order'), loosened, 'a line credited with nothing above it')

def needs_goal(p):
    claims, goal = p['workGrading']['claims'], p['workGrading']['goal']
    sid = next(s for s, by in claims.items() if s != goal and any(alt for alts in by.values() for alt in alts))
    for r in claims[sid]:
        claims[sid][r] = [alt + [goal] for alt in claims[sid][r]]
reject((PROOF, 'order'), needs_goal, 'a circular claim that needs the conclusion')

def already_ordered(p):
    rows = {row['id']: row for row in p['public']['response']['rows']}
    order = json.loads(p['answer'])
    p['public']['response']['rows'] = [rows[i] for i in order]
reject((PROOF, 'order'), already_ordered, 'an ordering shown already solved')

def false_landing(p):
    shown = {row['fields'][0]['given'] for row in p['public']['response']['rows']}
    for o in p['public']['response']['banks'][0]['options']:
        m = re.fullmatch(r"\$(\w)(\w')=(\w\w)=(\w)(\w)\$, so \$(\w')=(\w)\$\.", o['label'])
        if o['id'] in shown and m and m[2] == m[6]:
            o['label'] = o['label'][:-3] + m[1] + '$.'
            return
    raise AssertionError('no landing line')
reject((PROOF, 'order'), false_landing, "a line that lands B' on D")

def moved_vertex(p):
    for e in p['public']['figure']['scene']['elements']:
        if e['type'] == 'text':
            e['at'] = [e['at'][0] + 0.4, e['at'][1]]
            return
reject((PROOF, 'order'), moved_vertex, 'a figure whose givens fail')

def wrong_reason(p):
    key = json.loads(p['answer'])
    reasons = [o['id'] for o in p['public']['response']['banks'][1]['options']]
    i = next(i for i, cells in enumerate(key) if cells[1])
    key[i][1] = next(r for r in reasons if r != key[i][1])
    p['answer'] = json.dumps(key, separators=(',', ':'))
reject((PROOF, 'reasons'), wrong_reason, 'a wrong reason keyed')

def wrong_statement(p):
    key = json.loads(p['answer'])
    statements = [o['id'] for o in p['public']['response']['banks'][0]['options']]
    i = next(i for i, cells in enumerate(key) if cells[0])
    key[i][0] = next(s for s in statements if s != key[i][0] and s not in {c[0] for c in key})
    p['answer'] = json.dumps(key, separators=(',', ':'))
reject((PROOF, 'statements'), wrong_statement, 'a decoy statement keyed')

def wrong_option(p):
    p['answer'] = next(o['id'] for o in p['public']['response']['options'] if o['id'] != p['answer'])
for key in sorted(base):
    if key[0] != PROOF:
        reject(key, wrong_option, 'a wrong option keyed: ' + key[1])

def two_keys(p):
    options = p['public']['response']['options']
    right = next(o for o in options if o['id'] == p['answer'])
    other = next(o for o in options if o['id'] != p['answer'])
    other['label'] = right['label']
reject((REASON, 'justify'), two_keys, 'two options with the complete reason')

def one_meet(p):
    for e in p['public']['figure']['scene']['elements']:
        if e['type'] == 'text':
            e['at'] = [e['at'][0], e['at'][1] + 0.6]
            return
reject((FLAW, 'ssa'), one_meet, 'an SSA figure whose givens fail')

print(json.dumps({'cases': len(cases), 'failures': failures, 'rejected': rejected, 'stats': oracle.STATS}))
`,
    ],
    {
      input: JSON.stringify(cases),
      encoding: "utf8",
      timeout: 300_000,
      maxBuffer: 8 * 1024 * 1024,
    },
  );
  assert.equal(result.status, 0, result.stderr || String(result.error));
  const report = JSON.parse(result.stdout.trim().split("\n").at(-1)!) as {
    cases: number;
    failures: string[];
    rejected: number;
  };
  assert.equal(report.cases, 768);
  // 8 proof mutations, a wrong key for each kind of choice item (4 reason
  // questions, planted, SSA and AAA flaws), two complete reasons, a broken
  // SSA figure.
  assert.equal(report.rejected, 17);
  assert.deepEqual(
    report.failures,
    [],
    "Generated problems the independent oracle rejects",
  );
});
