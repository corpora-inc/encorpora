// Tests for CatalogV3Entry.activities: verbatim parse + untouched forwarding
// through filterCatalogForApp (activity-contract.md §4.3, owned by W6).
// Run with: `npm test`.

import { test, before } from "node:test"
import assert from "node:assert/strict"
import { fileURLToPath } from "node:url"
import path from "node:path"

type CatalogGame = { id: string; activities?: unknown[] }
type CatalogV3 = { version: 3; generatedAt: string; packs: unknown[] }

let parseCatalogV3: (data: unknown) => CatalogV3 | null
let filterCatalogForApp: (
  v3: CatalogV3,
  appVersion: string,
  devMode: boolean,
  host?: { platform?: string; osVersion?: string },
) => CatalogGame[]

before(async () => {
  const { build } = await import("esbuild")
  const here = path.dirname(fileURLToPath(import.meta.url))
  const res = await build({
    entryPoints: [path.join(here, "catalog.ts")],
    bundle: true,
    format: "esm",
    write: false,
    platform: "neutral",
    define: { "import.meta.env.DEV": "false" },
    tsconfig: path.join(here, "../../tsconfig.json"),
  })
  const code = res.outputFiles[0].text
  const mod = await import(
    "data:text/javascript;base64," + Buffer.from(code).toString("base64")
  )
  parseCatalogV3 = mod.parseCatalogV3
  filterCatalogForApp = mod.filterCatalogForApp
})

const DECLS = [
  {
    activityType: "corpan_city:build-sentence",
    itemKinds: ["phrase"],
    strands: ["lfl"],
    typicalDurationSec: 60,
    requiredHostApis: ["journey"],
  },
  {
    activityType: "corpan_city:read-aloud",
    itemKinds: ["phrase"],
    strands: ["mfo"],
    modelNeeds: ["stt"],
    typicalDurationSec: 75,
    requiredHostApis: ["journey", "stt"],
  },
]

const v3 = (packs: unknown[]): unknown => ({
  version: 3,
  generatedAt: "2026-07-03T00:00:00Z",
  packs,
})

const pack = (over: Record<string, unknown> = {}): Record<string, unknown> => ({
  id: "corpan_city",
  name: "Corpan City",
  version: "0.2.0",
  minAppVersion: "0.1.0",
  channel: "stable",
  zipUrl: "https://cdn.example/corpan-city.zip",
  ...over,
})

test("parseCatalogV3 carries `activities` verbatim", () => {
  const c = parseCatalogV3(v3([pack({ activities: DECLS })]))
  assert.ok(c)
  const entry = (c.packs as CatalogGame[])[0]
  assert.deepEqual(entry.activities, DECLS)
})

test("non-array / empty / garbage `activities` are dropped, not invented", () => {
  const c = parseCatalogV3(
    v3([
      pack({ id: "a", activities: "nope" }),
      pack({ id: "b", activities: [] }),
      pack({ id: "c" }),
      pack({ id: "d", activities: [null, "x", DECLS[0]] }),
    ]),
  )
  assert.ok(c)
  const byId = new Map((c.packs as CatalogGame[]).map((p) => [p.id, p]))
  assert.equal(byId.get("a")?.activities, undefined)
  assert.equal(byId.get("b")?.activities, undefined)
  assert.equal(byId.get("c")?.activities, undefined)
  // per-entry lazy validation happens at scheduler read time; the parser only
  // keeps object entries
  assert.deepEqual(byId.get("d")?.activities, [DECLS[0]])
})

test("filterCatalogForApp forwards `activities` untouched onto the filtered entry", () => {
  const c = parseCatalogV3(v3([pack({ activities: DECLS })]))
  assert.ok(c)
  const filtered = filterCatalogForApp(c, "1.0.0", false)
  assert.equal(filtered.length, 1)
  assert.deepEqual(filtered[0].activities, DECLS)
})

test("entries without activities filter through with the field absent", () => {
  const c = parseCatalogV3(v3([pack()]))
  assert.ok(c)
  const filtered = filterCatalogForApp(c, "1.0.0", false)
  assert.equal(filtered.length, 1)
  assert.equal(filtered[0].activities, undefined)
})
