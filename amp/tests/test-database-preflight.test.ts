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
