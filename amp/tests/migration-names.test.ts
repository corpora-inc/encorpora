import test from "node:test";
import assert from "node:assert/strict";
import { readdirSync } from "node:fs";
import { renamedMigrations } from "../scripts/migrate.js";

const names = readdirSync(new URL("../migrations/", import.meta.url))
  .filter((name) => name.endsWith(".sql"))
  .sort();

// Already applied in production under these names; renaming one would apply
// it again. Never add to this list: take the next free number instead.
const shippedDuplicates = [
  "0023-implicit-provider-linking.sql",
  "0023-problem-flags.sql",
  "0101-learner-free-allowance.sql",
  "0101-unit-square-marking-problem-flags.sql",
  "0104-counter-builder-problem-flags.sql",
  "0104-family-second-parent.sql",
  "0106-equal-addends-problem-flags.sql",
  "0106-peg-board-problem-flags.sql",
  "0106-trend-line-fit-problem-flags.sql",
  "0125-external-runtime-errors.sql",
  "0125-funded-pending-invoices.sql",
];

test("every new migration takes its own number", () => {
  const byPrefix = new Map<string, string[]>();
  for (const name of names) {
    const prefix = /^(\d{4})(?:-|\.sql$)/.exec(name)?.[1];
    assert.ok(prefix, `${name} starts with a four-digit number`);
    byPrefix.set(prefix, [...(byPrefix.get(prefix) ?? []), name]);
  }
  const duplicated = [...byPrefix.values()]
    .filter((group) => group.length > 1)
    .flat();
  assert.deepEqual(duplicated, shippedDuplicates);
});

test("each renumbered migration exists under its new name only", () => {
  for (const [name, earlier] of Object.entries(renamedMigrations)) {
    assert.ok(names.includes(name), `${name} exists`);
    assert.ok(!names.includes(earlier), `${earlier} is gone`);
  }
});
