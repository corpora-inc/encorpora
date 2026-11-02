import assert from "node:assert/strict";
import test from "node:test";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));

function python(source: string) {
  return spawnSync("python3", ["-c", source], {
    cwd: root,
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  });
}

test("ratio and rate oracle rejects malformed arithmetic instead of crashing", () => {
  const checked = python(`import sys
sys.path.insert(0, 'scripts')
import ratio_rate_math_oracle as r
from fractions import Fraction
for claim in ['', '$', '6 ÷', '(4 + 3', '5 ÷ 0']:
    try:
        r.value(claim)
    except ValueError:
        continue
    raise SystemExit('accepted ' + repr(claim))
assert r.value('$1/22$') == Fraction(1, 22)
assert r.equalities('So divide minutes by pages: 6 ÷ 132 = $\\\\tfrac{1}{22}$ minute per page.') == 1
assert r.equalities('For 132 pages, $132 \\\\div 6 = 22$ pages per minute.') == 1
assert r.equalities('Multiply: $\\\\tfrac{3}{4} \\\\times \\\\tfrac{3}{2} = \\\\tfrac{3 \\\\times 3}{4 \\\\times 2} = \\\\tfrac{9}{8}$.') == 2
assert r.equalities('So 6 ÷ $\\\\tfrac{1}{22}$ = 132 pages.') == 1
for claim in ['6 ÷ 132 = $\\\\tfrac{1}{21}$ minute.', '6 ÷ 132 = $ minute.', 'So 6 ÷ $\\\\tfrac{1}{22}$ = 6/22 pages.']:
    try:
        r.equalities(claim)
    except ValueError:
        continue
    raise SystemExit('accepted ' + repr(claim))
print('ok')`);
  assert.equal(checked.status, 0, checked.stderr || checked.stdout);
  assert.match(checked.stdout, /ok/);
});

test("ratio and rate content passes the central review and every content mutant is rejected", () => {
  // The central review wraps each oracle check to also read typeset names
  // plainly; run the content and mutation reviews exactly as review:math does.
  const checked = python(`import json, runpy, sys
sys.path.insert(0, 'scripts')
runpy.run_path('scripts/independent-math-review.py')
import ratio_rate_math_oracle as r
print(json.dumps({'content': r.review_ratio_rate_content(), 'mutants': r.review_content_mutations()}))`);
  assert.equal(checked.status, 0, checked.stderr || checked.stdout);
  const result = JSON.parse(checked.stdout.trim().split("\n").at(-1)!);
  assert.equal(result.content.lessons, 7);
  assert.ok(result.content.checkedEqualities > 0);
  assert.ok(result.mutants >= 14, `only ${result.mutants} content mutants`);
});
