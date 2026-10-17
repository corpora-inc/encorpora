import test from "node:test";
import assert from "node:assert/strict";
import { assertTestDatabaseTarget } from "../scripts/test-database-preflight.js";

test("database test preflight rejects the shared preview before any migration", () => {
  for (const target of [
    "postgres://user:password@localhost:55439/amp",
    "postgresql://localhost/%61mp",
    "postgres://localhost/fixture?dbname=amp",
    "postgres://localhost/fixture?database=amp",
    "postgres://localhost/",
    "not a connection URL",
  ])
    assert.throws(() => assertTestDatabaseTarget(target));
  assert.doesNotThrow(() => assertTestDatabaseTarget(undefined));
  assert.doesNotThrow(() =>
    assertTestDatabaseTarget("postgres://localhost/amp_paid_evidence_1031"),
  );
});

test("direct fixture entrypoints reject preview targets before setup", async () => {
  const { readdir, readFile } = await import("node:fs/promises");
  const { spawnSync } = await import("node:child_process");
  const { fileURLToPath } = await import("node:url");
  const root = fileURLToPath(new URL("..", import.meta.url));
  const entries: string[] = [];
  for (const directory of ["scripts", "tests"]) {
    for (const file of await readdir(
      new URL(`../${directory}/`, import.meta.url),
    )) {
      if (
        !(
          directory === "scripts" ? /^verify-.*\.ts$/ : /\.integration\.ts$/
        ).test(file)
      )
        continue;
      const path = `${directory}/${file}`;
      if (
        (
          await readFile(new URL(`../${path}`, import.meta.url), "utf8")
        ).includes("AMP_TEST_DATABASE_URL")
      )
        entries.push(path);
    }
  }
  assert.ok(entries.length > 0);
  for (const entry of entries) {
    const result = spawnSync(process.execPath, ["--import", "tsx", entry], {
      cwd: root,
      // Port 1 is deliberately not the preview endpoint, even if a regression bypasses the guard.
      env: {
        ...process.env,
        AMP_TEST_DATABASE_URL: "postgres://fixture:fixture@127.0.0.1:1/%61mp",
      },
      encoding: "utf8",
      timeout: 10_000,
    });
    assert.equal(
      result.status,
      1,
      `${entry}: ${result.error ?? result.stderr}`,
    );
    assert.match(
      result.stderr,
      /Integration tests cannot target the shared \/amp preview/,
      entry,
    );
  }
});

test("fixture migration validates its explicit target independently of environment", async () => {
  const { migrate } = await import("../scripts/test-database.js");
  for (const missing of [undefined, null, "", " "]) {
    await assert.rejects(
      migrate(missing as unknown as string),
      /explicit fixture database URL/,
    );
  }
  await assert.rejects(
    migrate("postgres://fixture:fixture@127.0.0.1:1/amp"),
    /shared \/amp preview/,
  );
  assert.doesNotThrow(() =>
    assertTestDatabaseTarget(
      "postgres://localhost/amp_test?options=-c%20search_path%3Dfixture",
    ),
  );
});
