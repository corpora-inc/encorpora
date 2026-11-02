import assert from "node:assert/strict";
import test from "node:test";
import { spawnSync } from "node:child_process";
import { generateProblem } from "../src/math/engine.js";
import { equationSlotsAxes } from "../src/math/equation-slots-practice.js";

test("independent oracles review all card families and preserve picker checks", () => {
  const ids = [
    ...Object.keys(equationSlotsAxes),
    "conversion-proportion-blanks",
    "compare-symbol-blanks",
    "inequality-number-blanks",
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
import equation_slots_math_oracle as equations
import place_value_blanks_math_oracle as place
import form_and_model_blanks_math_oracle as forms
import statement_blanks_math_oracle as statements
import multi_part_choice_math_oracle as multipart
central = runpy.run_path('scripts/independent-math-review.py')
for oracle in (equations, place, forms, statements, multipart):
    oracle.self_test()
cases = json.load(sys.stdin)
by, card_families = {}, set()
for problem in cases:
    public = problem['public']
    template = public['templateId']
    oracle = central['FAMILY_ORACLE_FOR'][template]
    assert oracle.review_problem(problem) == problem['answer']
    assert central['solve'](public) == problem['answer']
    by.setdefault(template, problem)
    if public['response']['layout'] == 'cards':
        card_families.add(template)
assert len(card_families) == 14
assert any('1,029' == o['label'] for p in cases for b in p['public']['response']['blanks'] for o in b['options'])
assert equations.value_of('1,029') == 1029
try:
    equations.value_of('10,29')
except ValueError:
    pass
else:
    raise AssertionError('Malformed grouping accepted')
rejected = 0
def reject(template, change):
    global rejected
    problem = copy.deepcopy(by[template])
    change(problem)
    try:
        central['FAMILY_ORACLE_FOR'][template].review_problem(problem)
    except (ValueError, TypeError, KeyError, AttributeError, StopIteration):
        rejected += 1
    else:
        raise AssertionError('Corrupt card case accepted: ' + template)
def wrong_answer(p):
    key = json.loads(p['answer'])
    blank = p['public']['response']['blanks'][0]
    key[blank['id']] = next(o['id'] for o in blank['options'] if o['id'] != key[blank['id']])
    p['answer'] = json.dumps(key, separators=(',', ':'))
for template in sorted(card_families):
    reject(template, wrong_answer)
reject('booth-equation-slots', lambda p: p['public']['response'].update(label='Choose'))
reject('booth-equation-slots', lambda p: p['public']['response'].update(reuse=False))
reject('booth-equation-slots', lambda p: p['public']['response']['sentence'].append({'blank': 'rate'}))
def overlap(p):
    blanks = p['public']['response']['blanks']
    numeric = next(b for b in blanks if b['id'] == 'rate')
    operation = next(b for b in blanks if b['id'] == 'op')
    operation['options'][0]['label'] = numeric['options'][0]['label']
reject('booth-equation-slots', overlap)
# Reusable numeric cards are required for both copies of the radius/multiplier.
for template in ('cylinder-volume-slots', 'dilation-rule-slots'):
    assert by[template]['public']['response']['reuse'] is True
    reject(template, lambda p: p['public']['response'].pop('reuse'))
reject('square-root-solutions-slots', lambda p: p['explanation'].__setitem__(1, 'Both solutions are zero.'))
reject('array-division-slots', lambda p: p['explanation'].__setitem__(0, 'The array has zero counters.'))
print({'cases': len(cases), 'card_families': len(card_families), 'rejected': rejected})
`,
    ],
    {
      input: JSON.stringify(cases),
      encoding: "utf8",
      timeout: 60_000,
      maxBuffer: 1024 * 1024,
    },
  );
  assert.equal(result.status, 0, result.stderr || String(result.error));
  assert.match(result.stdout, /'cases': 4608/);
  assert.match(result.stdout, /'card_families': 14/);
  assert.match(result.stdout, /'rejected': 22/);
});
