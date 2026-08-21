// Truncation guard — static + behavioral (content-resolver.md §6).
//
// The Rust `content_packs_query_db` hard-caps at 2,000 rows and truncates
// SILENTLY (R7). Every resolver SQL string must carry an explicit LIMIT,
// and a full page (LIMIT > 1) must log the truncation warning — we never
// want to learn about the cap in production.

import { test } from "node:test"
import assert from "node:assert/strict"

import { DISTRACTOR_SQL } from "./distractors.ts"
import { SQL, sqlLimit } from "./resolve.ts"

test("every resolver SQL string carries an explicit LIMIT", () => {
  const all = { ...SQL, ...DISTRACTOR_SQL }
  const names = Object.keys(all)
  assert.ok(names.length >= 10, "SQL registry looks incomplete")
  for (const [name, sql] of Object.entries(all)) {
    assert.match(sql, /LIMIT \d+/, `${name} must carry an explicit LIMIT`)
    assert.ok(sqlLimit(sql) >= 1, `${name} LIMIT must be ≥ 1`)
    // All resolver queries are point lookups or small pages (§2).
    assert.ok(sqlLimit(sql) <= 60, `${name} LIMIT unexpectedly large`)
    // Parameterized only — no string interpolation into SQL.
    assert.ok(!sql.includes("${"), `${name} must be parameterized`)
  }
})

test("sqlLimit throws on SQL without LIMIT (guard for future queries)", () => {
  assert.throws(() => sqlLimit("SELECT * FROM items"))
})
