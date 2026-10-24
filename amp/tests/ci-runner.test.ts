import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  cpSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

test("CI executes only selected entrypoints, propagates failures, and rejects unknown paths", () => {
  const directory = mkdtempSync(join(tmpdir(), "amp ci runner "));
  try {
    mkdirSync(join(directory, "scripts"));
    mkdirSync(join(directory, "tests"));
    cpSync(
      new URL("../scripts/run-ci-tests.mjs", import.meta.url),
      join(directory, "scripts/run-ci-tests.mjs"),
    );
    symlinkSync(
      fileURLToPath(new URL("../node_modules", import.meta.url)),
      join(directory, "node_modules"),
      "dir",
    );
    writeFileSync(
      join(directory, "package.json"),
      JSON.stringify({
        type: "module",
        scripts: { "test:ui": "tsx scripts/verify-pass.ts" },
      }),
    );
    writeFileSync(
      join(directory, "tests/pass.test.ts"),
      'import test from "node:test"; test("selected pass", () => {});',
    );
    writeFileSync(
      join(directory, "tests/fail.test.ts"),
      'throw new Error("selected failure");',
    );
    writeFileSync(
      join(directory, "tests/pass.integration.ts"),
      'import test from "node:test"; test("selected database", () => {});',
    );
    writeFileSync(
      join(directory, "scripts/verify-pass.ts"),
      'console.log("selected browser");',
    );
    const environment = { ...process.env };
    delete environment.NODE_TEST_CONTEXT;
    const run = (lane: string, plan: unknown) =>
      spawnSync(
        process.execPath,
        [join(directory, "scripts/run-ci-tests.mjs"), lane],
        {
          encoding: "utf8",
          env: { ...environment, AMP_CI_PLAN: JSON.stringify(plan) },
        },
      );
    for (const [lane, selection] of [
      ["core", { core: ["tests/pass.test.ts"] }],
      ["database", { database: ["tests/pass.integration.ts"] }],
      ["browser", { browser_scripts: ["scripts/verify-pass.ts"] }],
    ] as const) {
      const result = run(lane, selection);
      assert.equal(result.status, 0, result.stderr + result.stdout);
      assert.match(result.stdout, /selected (pass|database|browser)/);
      assert.doesNotMatch(result.stdout, /selected failure/);
    }
    assert.notEqual(run("core", { core: ["tests/fail.test.ts"] }).status, 0);
    for (const plan of [
      null,
      {},
      { core: [] },
      { core: ["../escape.test.ts"] },
      { core: ["tests/missing.test.ts"] },
    ])
      assert.notEqual(run("core", plan).status, 0);
    assert.notEqual(run("typo", { core: ["tests/pass.test.ts"] }).status, 0);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
