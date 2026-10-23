import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { generateSuccessivePercentChangeProblem } from "../src/math/successive-percent-change.js";

test("successive percentages agree with public-only exact arithmetic and mutation probes", () => {
  const cases = Array.from({ length: 256 }, (_, i) =>
    generateSuccessivePercentChangeProblem(`independent-${i}`),
  );
  const result = spawnSync(
    "python3",
    [
      "-c",
      `
import sys, json, importlib.util
from fractions import Fraction
sys.path.insert(0, 'scripts')
import successive_percent_math_oracle as oracle
spec = importlib.util.spec_from_file_location('central', 'scripts/independent-math-review.py')
central = importlib.util.module_from_spec(spec)
spec.loader.exec_module(central)
print(oracle.self_test())
orders, rounding = set(), set()
equal_opposites = tax = premature = 0
for problem in json.load(sys.stdin):
    public = problem['public']
    assert public['templateId'] in central.SUPPORTED
    assert oracle.review_problem(problem) == central.solve(public)
    start, p, q, first, final = oracle.givens(public)
    orders.add((p > 0, q > 0))
    remainder = (final * 100) % 1
    rounding.add('exact' if remainder == 0 else 'half' if remainder == Fraction(1,2) else 'rounded')
    equal_opposites += p == -q
    tax += 'sales tax' in public['prompt']
    premature += oracle.round_cents(final) != oracle.round_cents(Fraction(oracle.round_cents(first),100) * (1+q/100))
assert len(orders) == 4 and rounding == {'exact','half','rounded'}
assert equal_opposites and tax and premature
print({'sign_orders':len(orders),'rounding_classes':len(rounding),'equal_opposites':equal_opposites,'tax':tax,'premature_rounding_distinctions':premature})
`,
    ],
    { input: JSON.stringify(cases), encoding: "utf8", timeout: 30_000 },
  );
  assert.equal(result.status, 0, result.stderr || String(result.error));
  assert.match(result.stdout, /premature_rounding_distinctions/);
});
