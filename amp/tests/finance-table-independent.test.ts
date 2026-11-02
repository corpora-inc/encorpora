import assert from "node:assert/strict";
import test from "node:test";
import { spawnSync } from "node:child_process";
import { generateProblem } from "../src/math/engine.js";

test("savings oracle accepts singular months without accepting wrong or ambiguous choices", () => {
  const cases = Array.from({ length: 256 }, (_, index) =>
    generateProblem("savings-plan-growth", `independent-${index}`),
  );
  const result = spawnSync("python3", ["-c", `
import copy, json, sys
sys.path.insert(0, 'scripts')
import finance_credit_math_oracle as oracle
cases = json.load(sys.stdin)
singular = 0
for problem in cases:
    assert oracle.review_problem(problem) == problem['answer']
    singular += any(o['label'] == '1 month' for o in problem['public']['response']['options'])
assert singular > 0, 'Regression sample never exercised the singular month'
base = {
    'public': {'templateId': 'savings-plan-growth', 'figure': None,
        'prompt': 'Plan A starts with 100 dollars and adds 50 dollars each month. Plan B starts with 125 dollars and adds 25 dollars each month. After how many monthly deposits do the two plans hold the same amount?',
        'response': {'kind': 'choice', 'options': [
            {'id': 'a', 'label': '1 month'}, {'id': 'b', 'label': '2 months'},
            {'id': 'c', 'label': '3 months'}, {'id': 'd', 'label': '4 months'}]}},
    'answer': 'a',
}
assert oracle.review_problem(base) == 'a'
for label, answer, expected_error in [
    ('1 month', 'b', 'Finance answer key mismatch'),
    ('2 months', 'a', 'Mathematically duplicate choices'),
    ('5 months', 'a', 'Missing or ambiguous correct choice'),
    ('1 minute', 'a', 'Unreadable choice'),
]:
    bad = copy.deepcopy(base)
    bad['answer'] = answer
    bad['public']['response']['options'][0]['label'] = label
    try:
        oracle.review_problem(bad)
    except ValueError as error:
        assert str(error).startswith(expected_error), str(error)
    else:
        raise AssertionError('Corruption accepted')
duplicate = copy.deepcopy(base)
duplicate['public']['response']['options'][1]['label'] = '1 months'
try:
    oracle.review_problem(duplicate)
except ValueError as error:
    assert str(error) == 'Mathematically duplicate choices', str(error)
else:
    raise AssertionError('Singular/plural duplicate accepted')
print({'cases': len(cases), 'singular': singular})
`], { input: JSON.stringify(cases), encoding: "utf8", timeout: 30_000 });
  assert.equal(result.status, 0, result.stderr || String(result.error));
  assert.match(result.stdout, /'cases': 256/);
});

test("finance oracle compares the stated principal exactly without Fraction formatting", () => {
  const cases = Array.from({ length: 256 }, (_, index) =>
    generateProblem("interest-table-type", `independent-${index}`),
  );
  const result = spawnSync(
    "python3",
    [
      "-c",
      `import copy, json, re, sys
sys.path.insert(0, 'scripts')
import finance_credit_math_oracle as oracle
oracle.self_test()
cases = json.load(sys.stdin)
earned = rejected = 0
for problem in cases:
    assert oracle.review_problem(problem) == problem['answer']
    prompt = problem['public']['prompt']
    if 'How much interest does the compound-interest account earn during year' not in prompt:
        continue
    earned += 1
    amount = re.search(r'started with ' + oracle.NUM + r' dollars', prompt)
    assert amount is not None
    for replacement in ('9,999,999', ''):
        bad = copy.deepcopy(problem)
        bad['public']['prompt'] = prompt[:amount.start(1)] + replacement + prompt[amount.end(1):]
        try:
            oracle.review_problem(bad)
        except ValueError as error:
            assert str(error) == 'Starting amount mismatch', str(error)
            rejected += 1
        else:
            raise AssertionError('Invalid principal accepted')
    equivalent = copy.deepcopy(problem)
    equivalent['public']['prompt'] = prompt[:amount.start(1)] + amount[1].replace(',', '') + '.00' + prompt[amount.end(1):]
    assert oracle.review_problem(equivalent) == problem['answer']
assert len(cases) == 256 and earned > 0 and rejected == earned * 2
print({'cases': len(cases), 'earned': earned, 'rejected': rejected})`,
    ],
    { input: JSON.stringify(cases), encoding: "utf8", timeout: 30_000 },
  );
  assert.equal(result.status, 0, result.stderr || String(result.error));
  assert.match(result.stdout, /'cases': 256/);
});
