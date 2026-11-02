import assert from "node:assert/strict";
import test from "node:test";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { generateProblem } from "../src/math/engine.js";

const root = fileURLToPath(new URL("../", import.meta.url));
const families = [
  "negative-integer-power",
  "product-of-powers-exponent",
  "quotient-of-powers-exponent",
  "power-of-power-exponent",
];

function python(source: string, input = "") {
  return spawnSync("python3", ["-c", source], {
    cwd: root,
    encoding: "utf8",
    input,
    maxBuffer: 64 * 1024 * 1024,
  });
}

test("integer-exponent oracle checks typeset explanation claims instead of failing on them", () => {
  const cases = families.flatMap((id) =>
    Array.from({ length: 64 }, (_, index) => {
      const problem = generateProblem(id, `independent-${index}`);
      return { public: problem.public, explanation: problem.explanation };
    }),
  );
  // Through the central review, exactly as review:math checks each case.
  const checked = python(
    `import json, runpy, sys
sys.path.insert(0, 'scripts')
central = runpy.run_path('scripts/independent-math-review.py')
import integer_exponent_math_oracle as o
review = central['review_integer_exponent_explanation']
cases = json.load(sys.stdin)
for case in cases:
    review(case['public'], case['explanation'])
assert o.plain_math('$x^{-3} = \\\\frac{1}{x^3}$') == 'x^(-3) = ((1)/(x^3))'
assert o.equalities('Here $x^{-3} = \\\\frac{1}{x^3}$ for every nonzero $x$.', 3) == 1
typeset = next(c for c in cases if c['public']['templateId'] == 'product-of-powers-exponent' and '\\\\frac{1}{x^3}' in ' '.join(c['explanation']))
for wrong in ['\\\\frac{1}{x^2}', '\\\\frac{1}{3}', '']:
    bad = [step.replace('\\\\frac{1}{x^3}', wrong) for step in typeset['explanation']]
    try:
        review(typeset['public'], bad)
    except ValueError:
        continue
    raise SystemExit('accepted ' + repr(wrong))
print(len(cases))`,
    JSON.stringify(cases),
  );
  assert.equal(checked.status, 0, checked.stderr || checked.stdout);
  assert.match(checked.stdout, /256/);
});

test("integer-exponent content passes and every content mutant is rejected", () => {
  // The central review reads typeset labels ($k$ as k) for each check.
  const checked = python(`import json, runpy, sys
sys.path.insert(0, 'scripts')
runpy.run_path('scripts/independent-math-review.py')
import integer_exponent_math_oracle as o
print(json.dumps(o.review_integer_exponent_content()))`);
  assert.equal(checked.status, 0, checked.stderr || checked.stdout);
  const report = JSON.parse(checked.stdout.trim().split("\n").at(-1)!);
  assert.ok(report.rejectedContentMutations >= 10);
});
