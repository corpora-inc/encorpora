import assert from "node:assert/strict";
import test from "node:test";
import { spawnSync } from "node:child_process";
import { generateProblem } from "../src/math/engine.js";

test("algebra oracles read compact parameter and extraneous-root explanations", () => {
  const cases = [
    "interpret-linear-parameters",
    "square-root-extraneous",
  ].flatMap((id) =>
    Array.from({ length: 256 }, (_, index) =>
      generateProblem(id, `independent-${index}`),
    ),
  );
  const result = spawnSync(
    "python3",
    [
      "-c",
      `import json, runpy, sys
sys.path.insert(0, 'scripts')
import algebra_requirement_gaps_math_oracle as oracle
central = runpy.run_path('scripts/independent-math-review.py')
print(oracle.self_test())
cases = json.load(sys.stdin)
contexts, combined, reasons = set(), 0, 0
for problem in cases:
    public = problem['public']
    assert oracle.solve(public) == problem['answer']
    assert central['solve'](public) == problem['answer']
    if public['templateId'] == 'interpret-linear-parameters':
        contexts.add(public['prompt'].split(' is modeled by ')[0].split('$')[0])
        combined += 'Which statement interprets both numbers' in public['prompt']
    else:
        reasons += public['prompt'].startswith('To solve ')
assert len(cases) == 512 and len(contexts) == 7 and combined > 0 and reasons > 0
print({'cases': len(cases), 'contexts': len(contexts), 'combined': combined, 'reasons': reasons})`,
    ],
    { input: JSON.stringify(cases), encoding: "utf8", timeout: 30_000 },
  );
  assert.equal(result.status, 0, result.stderr || String(result.error));
  assert.match(result.stdout, /'cases': 512/);
});
