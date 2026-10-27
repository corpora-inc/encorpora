import assert from "node:assert/strict";
import test from "node:test";
import { spawnSync } from "node:child_process";
import { generateProblem } from "../src/math/engine.js";

test("similarity oracle reads shared origins and verifies every transformed vertex", () => {
  const cases = Array.from({ length: 256 }, (_, index) =>
    generateProblem("similarity-by-transformation", `independent-${index}`),
  );
  const result = spawnSync(
    "python3",
    [
      "-c",
      `import json, runpy, sys
sys.path.insert(0, 'scripts')
import geometry_requirement_gaps_math_oracle as oracle
central = runpy.run_path('scripts/independent-math-review.py')
print(oracle.self_test())
cases = json.load(sys.stdin)
prompts, rotations, dilations = set(), 0, 0
for problem in cases:
    public = problem['public']
    assert oracle.review_problem(problem) == problem['answer']
    assert central['solve'](public) == problem['answer']
    prompts.add(public['prompt'])
    labels = ' '.join(option['label'].lower() for option in public['response']['options'])
    rotations += 'rotate ' in labels
    dilations += 'dilate ' in labels
assert len(cases) == 256 and len(prompts) == 3 and rotations > 0 and dilations > 0
print({'cases': len(cases), 'prompts': len(prompts), 'rotations': rotations, 'dilations': dilations})`,
    ],
    { input: JSON.stringify(cases), encoding: "utf8", timeout: 30_000 },
  );
  assert.equal(result.status, 0, result.stderr || String(result.error));
  assert.match(result.stdout, /'cases': 256/);
});
