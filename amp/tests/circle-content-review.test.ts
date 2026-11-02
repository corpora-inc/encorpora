import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { fileURLToPath } from "node:url";

test("circle explanations retain independently checked arithmetic and verbal quantities", () => {
  const checked = spawnSync(
    "python3",
    [
      "-c",
      String.raw`
import json, sys
sys.path.insert(0, 'scripts')
from circle_measurement_math_oracle import review_circle_fixtures, review_circle_content
review_circle_fixtures()
print(json.dumps(review_circle_content()))
`,
    ],
    {
      cwd: fileURLToPath(new URL("../", import.meta.url)),
      encoding: "utf8",
      timeout: 120_000,
      maxBuffer: 8 * 1024 * 1024,
    },
  );
  assert.equal(checked.status, 0, checked.stderr || String(checked.error));
  const report = JSON.parse(checked.stdout);
  assert.equal(report.runtimeCases, 4096);
  assert.ok(report.approximateAreas >= 100);
  assert.equal(report.worksheetEditions, 64);
  assert.equal(report.lessons, 4);
  assert.ok(report.rejectedContentMutations >= 13);
});
