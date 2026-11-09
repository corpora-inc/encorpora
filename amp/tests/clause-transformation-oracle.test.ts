import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import test from "node:test";
import {
  generateTransformationClause,
  transformationClauseFamilies,
} from "../src/math/clause-transformation-practice";
import { random } from "../src/math/clause-support";
import {
  generatedProblemSchema,
  type GeneratedProblem,
  type TemplateMetadata,
} from "../src/math/contracts";
import { gradeStructuredWork } from "../src/math/structured-work";
import { clauseAdditionLessons } from "../src/content/clause-addition-lessons";

test("transformation clauses have independent coordinate and proof checks with mutation rejection", () => {
  const cases: GeneratedProblem[] = [];
  const generationErrors: string[] = [];
  for (const [id, families] of Object.entries({
    ...transformationClauseFamilies,
    "similarity-by-transformation-grade-8": ["grade-8-origin"],
  })) {
    for (const family of families) {
      for (let i = 0; i < (family === "two-step-sequence" ? 1000 : 120); i++) {
        const seed = `clause-transform-oracle-${i}`;
        const meta: TemplateMetadata = {
          id,
          version: 1,
          skillId: "rigid-motions",
          gradeBand: "6–8",
          title: "Independent oracle case",
          description: "Independent oracle case",
        };
        try {
          const problem = generateTransformationClause({
            meta,
            seed,
            family,
            r: random(`${id}:${family}`, seed),
          });
          const parsed = generatedProblemSchema.safeParse(problem);
          if (!parsed.success)
            generationErrors.push(
              `${id}/${family}: ${JSON.stringify(parsed.error.issues)}`,
            );
          cases.push(problem);
        } catch (error) {
          generationErrors.push(`${id}/${family}: ${String(error)}`);
        }
      }
    }
  }
  cases.push(
    generateTransformationClause({
      meta: {
        id: "place-transformed-image",
        version: 1,
        skillId: "rigid-motions",
        gradeBand: "9–12",
        title: "Independent oracle case",
        description: "Independent oracle case",
      },
      seed: "geometry-draw-example",
      family: "geometry-draw",
      r: random(
        "place-transformed-image:geometry-draw",
        "geometry-draw-example",
      ),
    }),
  );
  const proofGoals = new Set<string>();
  for (const problem of cases.filter(
    (p) => p.variant?.id === "cpctc-relationship",
  )) {
    const response = problem.public.response;
    assert.equal(response.kind, "structured-work");
    if (response.kind !== "structured-work" || !problem.workGrading) continue;
    proofGoals.add(response.goal!);
    const cpctc = response.banks
      .find((b) => b.id === "reason")!
      .options.find((o) => o.label === "CPCTC")!.id;
    const original = JSON.parse(problem.answer) as string[][];
    const early = original.map((row) => [...row]);
    const index = early.findIndex((row) => row[1] === cpctc);
    [early[index - 1], early[index]] = [early[index]!, early[index - 1]!];
    assert.equal(
      gradeStructuredWork(response, problem.workGrading, JSON.stringify(early)),
      false,
      "CPCTC requires the triangle congruence first",
    );
    const alternate = original.map((row) => [...row]);
    [alternate[0], alternate[1]] = [alternate[1]!, alternate[0]!];
    assert.equal(
      gradeStructuredWork(
        response,
        problem.workGrading,
        JSON.stringify(alternate),
      ),
      true,
      "Independent premise steps may be exchanged",
    );
  }
  assert.equal(proofGoals.size, 4);
  const result = spawnSync(
    "python3",
    [
      "-c",
      `
import copy, json, sys
sys.path.insert(0, 'scripts')
import clause_transformation_math_oracle as oracle
print(oracle.self_test())
cases = json.load(sys.stdin)
errors, mutations = {}, 0
for case in cases:
    try:
        oracle.review_problem(case)
    except Exception as error:
        errors.setdefault(case['public']['templateId'] + '/' + case['variant']['id'], (case['public']['seed'], case['public']['prompt'], str(error)))
        continue
    altered = copy.deepcopy(case)
    response = altered['public']['response']
    if response['kind'] == 'choice':
        altered['answer'] = next(o['id'] for o in response['options'] if o['id'] != altered['answer'])
    elif response['kind'] == 'multi-select':
        answer = json.loads(altered['answer'])
        answer[-1] = next(o['id'] for o in response['options'] if o['id'] not in answer)
        altered['answer'] = json.dumps(sorted(answer))
    elif response['kind'] == 'point-plot':
        answer = json.loads(altered['answer'])
        answer[0][0] += 1
        altered['answer'] = json.dumps(answer)
    else:
        answer = json.loads(altered['answer'])
        field = response['rows'][0]['fields'][0]
        if field['kind'] == 'choice':
            bank = next(b for b in response['banks'] if b['id'] == field['bank'])
            answer[0][0] = next(o['id'] for o in bank['options'] if o['id'] != answer[0][0])
        else:
            answer[0][0] = str(oracle.Fraction(answer[0][0]) + 1)
        altered['answer'] = json.dumps(answer)
    try:
        oracle.review_problem(altered)
    except ValueError:
        mutations += 1
    else:
        raise AssertionError(('wrong answer accepted', altered))
assert not errors, errors
assert mutations == len(cases)
fixture = next(c for c in cases if c['public']['seed'] == 'geometry-draw-example')
assert json.loads(oracle.solve(fixture['public'])) == [[4, 4], [4, 1], [6, 1]], 'Nonorigin clockwise-rotation fixture'
proofs = [c for c in cases if c['variant']['id'] == 'converse-parallel']
assert proofs
for case in proofs[:12]:
    altered = copy.deepcopy(case)
    rows = altered['public']['response']['rows']
    rows[-1], rows[-2] = rows[-2], rows[-1]
    try:
        oracle.solve(altered['public'])
    except ValueError:
        pass
    else:
        raise AssertionError('A proof concluding parallel before corresponding angles escaped')
print({'cases': len(cases), 'rejected_answer_mutations': mutations})
`,
    ],
    {
      input: JSON.stringify(cases),
      encoding: "utf8",
      maxBuffer: 16 * 1024 * 1024,
      timeout: 60_000,
    },
  );
  assert.equal(result.status, 0, result.stderr || String(result.error));
  assert.deepEqual([...new Set(generationErrors)], []);
  assert.match(result.stdout, /rejected_answer_mutations/);
});

test("grade-eight similarity reference lesson has independently checked image coordinates", () => {
  const lesson = clauseAdditionLessons.find((entry) =>
    entry.templateIds.includes("similarity-by-transformation-grade-8"),
  );
  assert.ok(lesson);
  const result = spawnSync(
    "python3",
    [
      "-c",
      String.raw`
import json, re, sys
sys.path.insert(0, 'scripts')
import clause_transformation_math_oracle as oracle
example = json.load(sys.stdin)['workedExample']
prompt = oracle.plain(example['prompt'])
original = oracle.named_triangle(oracle.named_points(prompt), 'ABC')
factor, motion = re.search(r'Dilate by ([0-9]+) about the origin, then (.+?)\. Find', prompt).groups()
factor = oracle.Fraction(factor)
dilated = [tuple(factor*v for v in p) for p in original]
image = oracle.sequence(motion.replace('about the origin', 'about (0,0)'), dilated)
expected = dict(zip(["A'", "B'", "C'"], image))
assert oracle.named_points(example['answer']) == expected, 'The answer must apply both stated transformations'
intermediate = [oracle.point(x, y) for x, y in re.findall(oracle.POINT, example['steps'][0])]
assert intermediate == dilated, 'The first step must show the dilation images'
assert oracle.named_points(example['steps'][2]) == expected, 'The rotation step must agree with the computed images'
assert all(after == factor**2*before for before, after in zip(oracle.squared_sides(original), oracle.squared_sides(image))), 'Every side has the same length scale factor'
print('Similarity reference lesson coordinates and side ratios checked')
`,
    ],
    { input: JSON.stringify(lesson), encoding: "utf8", timeout: 10_000 },
  );
  assert.equal(result.status, 0, result.stderr || String(result.error));
});
