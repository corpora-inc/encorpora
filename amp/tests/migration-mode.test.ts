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
  for (const sql of [
    "",
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
