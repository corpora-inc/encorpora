import assert from "node:assert/strict";
import test from "node:test";
import { spawnSync } from "node:child_process";
import { generateProblem } from "../src/math/engine.js";

test("independent quantity oracle checks every role variant from public wording", () => {
  const cases = Array.from({ length: 256 }, (_, index) =>
    generateProblem("independent-dependent-roles", `independent-${index}`),
  );
  const result = spawnSync(
    "python3",
    [
      "-c",
      `import json, runpy, sys
sys.path.insert(0, 'scripts')
import texas_38_math_oracle as oracle
central = runpy.run_path('scripts/independent-math-review.py')
print(oracle.self_test())
cases = json.load(sys.stdin)
prompts, contexts = set(), set()
statements = 0
for problem in cases:
    public = central['plain_reading'](problem['public'])
    assert oracle.solve_roles(public) == problem['answer']
    assert central['solve'](problem['public']) == problem['answer']
    prompt = public['prompt']
    prompts.add('independent' if prompt.endswith('Which is the independent quantity?') else
                'dependent' if prompt.endswith('Which is the dependent quantity?') else prompt)
    contexts.add(public['figure']['scene']['title'])
    statements += prompt == 'Which statement about the table is true?'
assert len(cases) == 256 and len(prompts) == 4 and len(contexts) == 8 and statements > 0
print({'cases': len(cases), 'variants': len(prompts), 'contexts': len(contexts), 'statements': statements})`,
    ],
    { input: JSON.stringify(cases), encoding: "utf8", timeout: 30_000 },
  );
  assert.equal(result.status, 0, result.stderr || String(result.error));
  assert.match(result.stdout, /'cases': 256/);
});
