import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { generateProblem } from "../src/math/engine.js";

test("multi-select hierarchy agrees with independent public implication models", () => {
  const cases = Array.from({ length: 256 }, (_, index) =>
    generateProblem(
      "quadrilateral-hierarchy-multiselect",
      `independent-${index}`,
    ),
  );
  const result = spawnSync(
    "python3",
    [
      "-c",
      `import sys, json, importlib.util
sys.path.insert(0, 'scripts')
import quadrilateral_hierarchy_multiselect_oracle as oracle
spec = importlib.util.spec_from_file_location('central', 'scripts/independent-math-review.py')
central = importlib.util.module_from_spec(spec)
spec.loader.exec_module(central)
oracle.self_test()
counts = set()
labels = set()
for problem in json.load(sys.stdin):
    public = problem['public']
    assert public['templateId'] in central.SUPPORTED
    assert oracle.review_problem(problem) == central.solve(public)
    counts.add(len(public['response']['options']))
    labels.update(option['label'] for option in public['response']['options'])
assert counts == {5, 6}
assert len(labels) == 20
print('independent cases and corruption fixtures passed')`,
    ],
    { input: JSON.stringify(cases), encoding: "utf8", timeout: 30_000 },
  );
  assert.equal(result.status, 0, result.stderr || String(result.error));
  assert.match(
    result.stdout,
    /independent cases and corruption fixtures passed/,
  );
});
