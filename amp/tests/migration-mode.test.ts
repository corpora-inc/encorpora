import test from "node:test";
import assert from "node:assert/strict";
import { concurrentIndexes } from "../scripts/migrate.js";

test("only an explicit index-only directive opts out of migration transactions", () => {
  assert.equal(concurrentIndexes("CREATE TABLE amp_fixture(id text);"), null);
  const statement =
    "CREATE INDEX CONCURRENTLY amp_fixture_idx ON amp_fixture(id,day DESC) WHERE attempts>0";
  assert.deepEqual(
    concurrentIndexes(
      `-- migrate:concurrent-indexes\n-- comment\n${statement};\n`,
    ),
    [{ name: "amp_fixture_idx", statement }],
  );
  const unique =
    "CREATE UNIQUE INDEX CONCURRENTLY amp_fixture_one_idx ON amp_fixture(account_id) WHERE profile IS NOT NULL AND deleted_at IS NULL";
  assert.deepEqual(
    concurrentIndexes(`-- migrate:concurrent-indexes\n${unique};\n`),
    [{ name: "amp_fixture_one_idx", statement: unique }],
  );
  for (const sql of [
    "",
    "CREATE UNIQUE INDEX CONCURRENTLY amp_fixture_idx ON amp_fixture(id) WHERE a IS NULL OR b IS NULL;",
    "CREATE UNIQUE INDEX CONCURRENTLY amp_fixture_idx ON amp_fixture(id) WHERE a IS NULL AND;",
    "CREATE INDEX CONCURRENTLY amp_fixture_idx ON amp_fixture(id) WHERE a = 'x';",
    "BEGIN;",
    "CREATE INDEX amp_fixture_idx ON amp_fixture(id);",
    `${statement}; DROP TABLE amp_fixture;`,
    "CREATE INDEX CONCURRENTLY amp_fixture_idx ON amp_fixture((some_function('a;b')));",
  ]) {
    assert.throws(
      () => concurrentIndexes(`-- migrate:concurrent-indexes\n${sql}`),
      /Empty|Unsupported/,
    );
  }
});
