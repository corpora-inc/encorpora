import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { generateProblem, gradeAnswer } from "../src/math/engine";
import { generatedProblemSchema } from "../src/math/contracts";
import { problemLesson } from "../src/content/problem-lessons";

test("decimal model methods have independent answers and retain the single-choice area exercise", () => {
  const cases = Array.from({ length: 160 }, (_, index) => {
    const seed = `decimal-method:${index}`;
    const original = generateProblem("decimal-area-model", seed);
    assert.equal(original.public.response.kind, "choice");
    assert.equal(original.public.templateVersion, 1);
    const problem = generateProblem("decimal-model-written-method", seed);
    generatedProblemSchema.parse(problem);
    assert.equal(problem.public.response.kind, "multi-part-choice");
    assert.equal(problem.public.skillId, original.public.skillId);
    assert.ok(gradeAnswer(problem, problem.answer));
    assert.doesNotThrow(() =>
      problemLesson(
        problem.public.templateId,
        seed,
        undefined,
        undefined,
        problem,
      ),
    );
    return problem;
  });
  const result = spawnSync(
    "python3",
    [
      "-c",
      String.raw`
import copy, json, sys
sys.path.insert(0, 'scripts')
import clause_place_value_math_oracle as oracle
operations = set()
for case in json.load(sys.stdin):
    oracle.review_problem(case)
    expression = oracle.re.search(r'model for (.+?)\? Choose', oracle.plain(case['public']['prompt']))[1]
    operations.add(next(symbol for symbol in '+-*/' if symbol in expression))
    changed = copy.deepcopy(case)
    blank = changed['public']['response']['blanks'][0]
    answer = json.loads(changed['answer'])
    answer[blank['id']] = next(option['id'] for option in blank['options'] if option['id'] != answer[blank['id']])
    changed['answer'] = json.dumps(answer)
    try:
        oracle.review_problem(changed)
    except ValueError:
        pass
    else:
        raise AssertionError('Incorrect written equation accepted')
assert operations == set('+-*/'), operations
print('All four operations independently checked; incorrect equations rejected')
`,
    ],
    { input: JSON.stringify(cases), encoding: "utf8", timeout: 60_000 },
  );
  assert.equal(result.status, 0, result.stderr || String(result.error));
});
