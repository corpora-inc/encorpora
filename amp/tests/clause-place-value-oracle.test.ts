import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import test from "node:test";
import {
  generatePlaceClause,
  numberNamesTemplate,
  placeClauseFamilies,
} from "../src/math/clause-place-value-practice";
import { random } from "../src/math/clause-support";
import { generatedProblemSchema } from "../src/math/contracts";
import { numberWords } from "../src/math/staar-gap-practice";
import { clauseAdditionLessons } from "../src/content/clause-addition-lessons";

test("place-value clauses agree with an independent public-input oracle and reject answer mutations", () => {
  const generationErrors: string[] = [];
  const cases = Object.entries({
    ...placeClauseFamilies,
    "three-digit-number-names": ["number-names"],
  }).flatMap(([id, families]) =>
    families.flatMap((family) =>
      Array.from(
        {
          length:
            family === "count-full-range"
              ? 1000
              : family === "mental-boundaries"
                ? 400
                : 120,
        },
        (_, i) => {
          const seed = `clause-oracle-${i}`;
          let problem;
          try {
            problem = generatePlaceClause({
              meta: { ...numberNamesTemplate, id },
              seed,
              family,
              r: random(`${id}:${family}`, seed),
            });
          } catch (error) {
            generationErrors.push(`${id}/${family}/${seed}: ${String(error)}`);
            return [];
          }
          const parsed = generatedProblemSchema.safeParse(problem);
          if (!parsed.success)
            generationErrors.push(
              `${id}/${family}/${seed}: ${JSON.stringify(parsed.error.issues)}`,
            );
          return [problem];
        },
      ).flat(),
    ),
  );
  cases.push(
    generatePlaceClause({
      meta: { ...numberNamesTemplate, id: "decimal-area-model" },
      seed: "decimal-method-example",
      family: "model-to-written-method",
      r: random(
        "decimal-area-model:model-to-written-method",
        "decimal-method-example",
      ),
    }),
  );
  const result = spawnSync(
    "python3",
    [
      "-c",
      `
import copy, json, sys
sys.path.insert(0, 'scripts')
import clause_place_value_math_oracle as oracle
print(oracle.self_test())
cases = json.load(sys.stdin)
mutations = 0
errors = {}
for case in cases:
    try:
        oracle.review_problem(case)
    except Exception as error:
        errors.setdefault(case['public']['templateId'], (case['public']['seed'], case['public']['prompt'], str(error)))
        continue
    altered = copy.deepcopy(case)
    response = altered['public']['response']
    if response['kind'] in ('number', 'fraction'):
        altered['answer'] = str(oracle.value(altered['answer']) + 1)
    elif response['kind'] in ('choice', 'figure-choice'):
        altered['answer'] = next(o['id'] for o in response['options'] if o['id'] != altered['answer'])
    elif response['kind'] == 'multi-part-choice':
        answer = json.loads(altered['answer'])
        blank = response['blanks'][0]
        answer[blank['id']] = next(o['id'] for o in blank['options'] if o['id'] != answer[blank['id']])
        altered['answer'] = json.dumps(answer)
    else:
        answer = json.loads(altered['answer'])
        for i, row in enumerate(response['rows']):
            changed = False
            for j, field in enumerate(row['fields']):
                if 'given' not in field:
                    answer[i][j] = str(oracle.value(answer[i][j]) + 1)
                    changed = True
                    break
            if changed:
                break
        altered['answer'] = json.dumps(answer)
    try:
        oracle.review_problem(altered)
    except ValueError:
        mutations += 1
    else:
        raise AssertionError(('wrong answer accepted', altered))
assert not errors, errors
assert mutations == len(cases)
counts = [c for c in cases if c['variant']['id'] == 'count-full-range']
starts = [int(oracle.re.search(r'Count on: ([0-9]+)', c['public']['prompt'])[1]) for c in counts]
assert set(n//10 for n in starts) == set(range(12)), 'Every starting decade appears'
assert sum(n+3 >= 100 for n in starts) >= 200, 'At least one fifth of counts reach 100 or higher'
assert {100, 110, 120} <= {n+3 for n in starts}, 'The important decade/hundred endings appear'
assert sum(n//10 != (n+3)//10 for n in starts) >= 400, 'At least two fifths cross a decade'
mental = [oracle.plain(c['public']['prompt']) for c in cases if c['variant']['id'] == 'mental-boundaries']
operations, crossings = {}, 0
for prompt in mental:
    n, sign, amount = oracle.re.fullmatch(r'([0-9]+) ([+-]) (10|100) = □[.]', prompt).groups()
    n, amount = int(n), int(amount)
    operations[sign + str(amount)] = operations.get(sign + str(amount), 0) + 1
    after = n + (amount if sign == '+' else -amount)
    crossings += amount == 10 and n//100 != after//100
assert len(operations) == 4 and all(80 <= n <= 120 for n in operations.values()), operations
assert crossings >= 40, crossings
grids = [c for c in cases if c['variant']['id'] == 'compare-with-grid-justification']
assert grids
for case in grids[:12]:
    altered = copy.deepcopy(case)
    grid = next(e for e in altered['public']['figure']['scene']['elements'] if e['type'] == 'rect')
    grid['size'][0] += 1
    try:
        oracle.solve(altered['public'])
    except ValueError:
        pass
    else:
        raise AssertionError('A grid shaded for the wrong decimal escaped')
fixture = next(c for c in cases if c['public']['seed'] == 'decimal-method-example')
results = {e['text'] for e in fixture['public']['figure']['scene']['elements'] if e['type'] == 'text' and e['at'][1] == -3.5}
assert {'12.03', '7.98', '1203'} <= results, results
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
  assert.deepEqual(
    [
      ...new Set(
        generationErrors.map((error) =>
          error.replace(/clause-oracle-\d+/g, "seed"),
        ),
      ),
    ],
    [],
  );
  assert.match(result.stdout, /rejected_answer_mutations/);
});

test("all three-digit number names have independently checked values and spelling", () => {
  const names = Array.from({ length: 900 }, (_, i) => ({
    number: i + 100,
    name: numberWords(i + 100),
  }));
  const result = spawnSync(
    "python3",
    [
      "-c",
      `
import json, sys
sys.path.insert(0, 'scripts')
from clause_place_value_math_oracle import read_name
for entry in json.load(sys.stdin):
    assert read_name(entry['name']) == entry['number'], entry
print('900 three-digit names checked')
`,
    ],
    { input: JSON.stringify(names), encoding: "utf8", timeout: 10_000 },
  );
  assert.equal(result.status, 0, result.stderr || String(result.error));
  assert.match(result.stdout, /900 three-digit names checked/);
});

test("number-name reference lesson has independently checked examples", () => {
  const lesson = clauseAdditionLessons.find((entry) =>
    entry.templateIds.includes("three-digit-number-names"),
  );
  assert.ok(lesson);
  const result = spawnSync(
    "python3",
    [
      "-c",
      String.raw`
import json, re, sys
sys.path.insert(0, 'scripts')
from clause_place_value_math_oracle import calc, plain, read_name, value
lesson = json.load(sys.stdin)
example = lesson['workedExample']
name = re.fullmatch(r'Write (.+) as a numeral\.', example['prompt'])[1]
assert value(example['answer']) == read_name(name), 'Worked numeral must match the stated number name'
for paragraph in lesson['sections'][0]['paragraphs']:
    match = re.search(r'In ([0-9]+),.*?name is ([^.]+)\.', paragraph)
    assert match and int(match[1]) == read_name(match[2]), paragraph
texts = example['steps'] + [p for section in lesson['closingSections'] for p in section['paragraphs']]
equations = [plain(e) for text in texts for e in re.findall(r'\$([^$]+)\$', text) if '=' in e]
assert len(equations) >= 2, 'Worked and formal place-value equalities are both checked'
for equation in equations:
    left, right = equation.split('=')
    assert calc(left) == calc(right), equation
print('Number-name reference lesson examples checked')
`,
    ],
    { input: JSON.stringify(lesson), encoding: "utf8", timeout: 10_000 },
  );
  assert.equal(result.status, 0, result.stderr || String(result.error));
});
