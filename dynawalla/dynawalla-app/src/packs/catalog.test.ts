import { test } from "node:test"
import assert from "node:assert/strict"

import { parseCatalog } from "./catalog.ts"
import { SDK_VERSION } from "../../../packs/sdk/src/index.ts"

const entry = (overrides: Record<string, unknown> = {}) => ({
  schema: 1,
  id: "abacus.tower",
  version: "1.2.0",
  name: "Abacus Tower",
  description: "Carry beads up the tower.",
  sdk: SDK_VERSION,
  host: { min: "0.3.0" },
  entry: "index.html",
  capabilities: ["items"],
  covers: { skills: ["add.2digit.regroup"], grades: [1, 3] },
  locales: ["en"],
  assets: { files: 12, bytes: 400_000 },
  download: {
    url: "https://encorpora.io/dynawalla/packs/a.zip",
    bytes: 90_000,
    sha256: "a".repeat(64),
  },
  ...overrides,
})

const catalog = (packs: unknown[], schema = 1) => JSON.stringify({ schema, packs })

test("a catalogue of manifests parses into manifests", () => {
  const result = parseCatalog(catalog([entry(), entry({ id: "other.pack" })]))
  assert.equal(result.ok, true)
  if (!result.ok) return
  assert.deepEqual(
    result.packs.map((pack) => pack.id),
    ["abacus.tower", "other.pack"],
  )
  assert.deepEqual(result.rejected, [])
})

test("one bad entry does not hide the good ones", () => {
  // A malformed pack must not take forty others off a child's shelf.
  const result = parseCatalog(catalog([entry(), { schema: 1, id: "junk" }, entry({ id: "third.pack" })]))
  assert.equal(result.ok, true)
  if (!result.ok) return
  assert.deepEqual(
    result.packs.map((pack) => pack.id),
    ["abacus.tower", "third.pack"],
  )
  assert.equal(result.rejected.length, 1)
  assert.equal(result.rejected[0]?.index, 1)
  assert.ok((result.rejected[0]?.problems ?? []).length > 0)
})

test("a duplicated id is rejected, because an id has one artefact", () => {
  const result = parseCatalog(catalog([entry(), entry({ version: "1.3.0" })]))
  assert.equal(result.ok, true)
  if (!result.ok) return
  assert.equal(result.packs.length, 1)
  assert.match(result.rejected[0]?.problems[0] ?? "", /duplicate/)
})

test("a catalogue that is not a catalogue fails as a whole", () => {
  for (const text of ["", "not json", "[]", "null", '"a string"', "7"]) {
    assert.equal(parseCatalog(text).ok, false, `${text} parsed`)
  }
  const wrongSchema = parseCatalog(catalog([entry()], 2))
  assert.equal(wrongSchema.ok, false)
  if (!wrongSchema.ok) assert.match(wrongSchema.problem, /schema/)

  const noPacks = parseCatalog(JSON.stringify({ schema: 1 }))
  assert.equal(noPacks.ok, false)
})

test("an empty catalogue is a catalogue", () => {
  const result = parseCatalog(catalog([]))
  assert.equal(result.ok, true)
  if (result.ok) assert.deepEqual(result.packs, [])
})
