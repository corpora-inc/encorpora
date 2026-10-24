import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readdirSync } from "node:fs";
import test from "node:test";
import { fileURLToPath } from "node:url";
const runner = fileURLToPath(
  new URL("../scripts/test-suite.mjs", import.meta.url),
);
function list(suite: string): string[] {
  const result = spawnSync(process.execPath, [runner, suite, "--list"], {
    encoding: "utf8",
  });
  assert.equal(result.status, 0, result.stderr);
  return JSON.parse(result.stdout);
}
test("core, content and inventory partition every unit test exactly once", () => {
  const core = list("core");
  const inventory = list("inventory");
  const content = list("content");
  const all = list("all");
  assert.deepEqual(inventory, ["independent-review.test.ts"]);
  assert.ok(core.length > 0);
  assert.equal(
    core.some((name) => inventory.includes(name)),
    false,
  );
  assert.ok(content.includes("publications.test.ts"));
  assert.ok(core.includes("math.test.ts"));
  assert.equal(
    new Set([...core, ...content, ...inventory]).size,
    core.length + content.length + inventory.length,
  );
  assert.deepEqual([...core, ...content, ...inventory].sort(), all);
  assert.deepEqual(
    all,
    readdirSync(new URL("./", import.meta.url))
      .filter((name) => name.endsWith(".test.ts"))
      .sort(),
  );
});
test("unknown suites fail instead of skipping tests", () => {
  const result = spawnSync(process.execPath, [runner, "typo"], {
    encoding: "utf8",
  });
  assert.notEqual(result.status, 0);
  assert.match(
    result.stderr,
    /Expected test suite: core, content, inventory, or all/,
  );
});
