import assert from "node:assert/strict";
import test from "node:test";
import { databasePoolMax } from "../src/server/database.js";

test("local database budget defaults to 10 and accepts integers at least 2", () => {
  assert.equal(databasePoolMax({}), 10);
  for (const max of [2, 3, 10, 100])
    assert.equal(databasePoolMax({ AMP_DATABASE_POOL_MAX: String(max) }), max);
});

test("invalid database budgets fail closed without echoing configuration", () => {
  for (const value of [
    "",
    " ",
    "1",
    "0",
    "-3",
    "2.5",
    "3.0",
    "3e1",
    "0x10",
    "3foo",
    " 3",
    "3\n",
    "NaN",
    "Infinity",
    "9007199254740993",
  ])
    assert.throws(() => databasePoolMax({ AMP_DATABASE_POOL_MAX: value }), {
      message: "AMP_DATABASE_POOL_MAX must be an integer of at least 2",
    });
});

test("hosted API and production jobs default to 3 unless explicitly configured", () => {
  for (const env of [
    { NODE_ENV: "production" },
    { AMP_AUTH_MODE: "accounts" },
    { AMP_AUTH_MODE: "oidc" },
  ]) {
    assert.equal(databasePoolMax(env), 3);
    assert.equal(databasePoolMax({ ...env, AMP_DATABASE_POOL_MAX: "2" }), 2);
    assert.equal(databasePoolMax({ ...env, AMP_DATABASE_POOL_MAX: "8" }), 8);
    assert.throws(() => databasePoolMax({ ...env, AMP_DATABASE_POOL_MAX: "" }));
  }
  assert.equal(
    databasePoolMax({ NODE_ENV: "development", AMP_AUTH_MODE: "development" }),
    10,
  );
});
