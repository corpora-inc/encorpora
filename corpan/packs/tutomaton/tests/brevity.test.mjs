import assert from "node:assert/strict"
import { existsSync, readFileSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import test from "node:test"

import { BREVITY, brevityDirective } from "../src/brevity.ts"

const here = path.dirname(fileURLToPath(import.meta.url))
const manifest = JSON.parse(readFileSync(path.join(here, "..", "manifest.json"), "utf8"))
const TARGET_LANGS = (manifest.languages ?? []).map((l) => l.code)

test("every shipped target language has a brevity directive (by code or base)", () => {
  assert.ok(TARGET_LANGS.length >= 50)
  const has = (c) => BREVITY[c] || BREVITY[c.split("-")[0]]
  const missing = TARGET_LANGS.filter((c) => !has(c))
  assert.deepEqual(missing, [], `missing brevity for: ${missing.join(", ")}`)
})

test("brevityDirective: beginner vs brief, both non-empty target-language strings", () => {
  for (const code of ["es", "ja", "ar", "zh-Hant", "ko-polite"]) {
    const brief = brevityDirective(code, false)
    const beg = brevityDirective(code, true)
    assert.ok(brief && beg && brief !== beg, `${code} should differ`)
    // not the English source (these are localized)
    assert.notEqual(brief, BREVITY.en.brief, `${code} brief should be localized`)
  }
})

test("brevityDirective falls back by base, then English", () => {
  // unknown variant resolves to its base
  assert.equal(brevityDirective("pt-XX", false), BREVITY.pt?.brief ?? BREVITY.en.brief)
  // wholly unknown → English
  assert.equal(brevityDirective("zz", true), BREVITY.en.beginner)
})
