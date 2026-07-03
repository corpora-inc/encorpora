// Tests for the journey-pack index parser, visibility gating (incl. the
// schemaVersion pre-download gate), and the target-language resolver.
// Run with: `npm test`.
//
// `journeyPackCatalog.ts` reads `import.meta.env` for the URL override, which
// the bare node strip-types loader can't handle — so we bundle through
// esbuild (same approach as `wordPackCatalog.test.ts`) and exercise the REAL
// exports. The parser / gating / resolver are pure and never fetch.

import { test, before } from "node:test"
import assert from "node:assert/strict"
import { fileURLToPath } from "node:url"
import path from "node:path"

type Entry = {
  id: string
  kind: string
  targetLang: string
  name: string
  version: string
  schemaVersion: number
  zipUrl: string
  sizeMb: number
  channel?: string
  minAppVersion?: string
}
type Catalog = { version: number; generatedAt: string; packs: Entry[] }

let parseJourneyPackCatalog: (data: unknown) => Catalog | null
let visibleJourneyPacks: (c: Catalog, appVersion: string, devMode: boolean) => Entry[]
let findJourneyPackForTarget: (
  packs: Entry[],
  targetLang: string,
) => Entry | undefined
let DEFAULT_JOURNEY_PACK_CATALOG_URL: string
let SUPPORTED_JOURNEY_SCHEMA_VERSIONS: Set<number>

before(async () => {
  const { build } = await import("esbuild")
  const here = path.dirname(fileURLToPath(import.meta.url))
  const res = await build({
    entryPoints: [path.join(here, "journeyPackCatalog.ts")],
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
  parseJourneyPackCatalog = mod.parseJourneyPackCatalog
  visibleJourneyPacks = mod.visibleJourneyPacks
  findJourneyPackForTarget = mod.findJourneyPackForTarget
  DEFAULT_JOURNEY_PACK_CATALOG_URL = mod.DEFAULT_JOURNEY_PACK_CATALOG_URL
  SUPPORTED_JOURNEY_SCHEMA_VERSIONS = mod.SUPPORTED_JOURNEY_SCHEMA_VERSIONS
})

const entry = (over: Partial<Entry> = {}): Record<string, unknown> => ({
  id: "journey_en",
  kind: "journey-course",
  targetLang: "en",
  name: "Journey: English",
  version: "0.1.0",
  schemaVersion: 1,
  zipUrl: "https://cdn.example/journey_en-0.1.0.zip",
  sizeMb: 2.8,
  channel: "preview",
  ...over,
})

const catalog = (packs: unknown[]): unknown => ({
  version: 1,
  generatedAt: "2026-07-03T00:00:00Z",
  packs,
})

test("parses a well-formed index", () => {
  const c = parseJourneyPackCatalog(catalog([entry()]))
  assert.ok(c)
  assert.equal(c.packs.length, 1)
  assert.equal(c.packs[0].id, "journey_en")
  assert.equal(c.packs[0].schemaVersion, 1)
})

test("rejects wrong wire-format version and non-object shapes", () => {
  assert.equal(parseJourneyPackCatalog({ version: 2, packs: [] }), null)
  assert.equal(parseJourneyPackCatalog(null), null)
  assert.equal(parseJourneyPackCatalog([]), null)
  assert.equal(parseJourneyPackCatalog({ version: 1 }), null)
})

test("drops entries missing hard requirements", () => {
  const c = parseJourneyPackCatalog(
    catalog([
      entry(),
      entry({ id: "" }),
      entry({ kind: "word-explanation" }),
      entry({ targetLang: "" }),
      entry({ version: "" }),
      entry({ zipUrl: "" }),
      { ...entry(), schemaVersion: "1" }, // non-integer schemaVersion
      { ...entry(), schemaVersion: 1.5 },
      "garbage",
    ]),
  )
  assert.ok(c)
  assert.equal(c.packs.length, 1)
})

test("visibleJourneyPacks gates channel, minAppVersion, and schemaVersion", () => {
  const c = parseJourneyPackCatalog(
    catalog([
      entry({ id: "journey_en" }),
      entry({ id: "journey_es", targetLang: "es", channel: "stable" }),
      entry({ id: "journey_fr", targetLang: "fr", channel: "stable", minAppVersion: "99.0.0" }),
      entry({ id: "journey_de", targetLang: "de", channel: "stable", schemaVersion: 999 }),
    ]),
  )
  assert.ok(c)
  // non-dev: preview hidden, future minAppVersion hidden, unsupported schema hidden
  const visible = visibleJourneyPacks(c, "1.0.0", false)
  assert.deepEqual(visible.map((p) => p.id), ["journey_es"])
  // dev: preview shows, but schema/minAppVersion gates still hold —
  // an old app NEVER sees a course it cannot read
  const dev = visibleJourneyPacks(c, "1.0.0", true)
  assert.deepEqual(dev.map((p) => p.id).sort(), ["journey_en", "journey_es"])
})

test("findJourneyPackForTarget: exact match first, then base subtag", () => {
  const c = parseJourneyPackCatalog(
    catalog([
      entry({ id: "journey_pt", targetLang: "pt", channel: "stable" }),
      entry({ id: "journey_pt_br", targetLang: "pt-BR", channel: "stable" }),
    ]),
  )
  assert.ok(c)
  const packs = visibleJourneyPacks(c, "1.0.0", false)
  assert.equal(findJourneyPackForTarget(packs, "pt-BR")?.id, "journey_pt_br")
  assert.equal(findJourneyPackForTarget(packs, "pt")?.id, "journey_pt")
  // base-subtag fallback when no exact entry exists
  assert.equal(findJourneyPackForTarget(packs, "pt-PT")?.id, "journey_pt")
  assert.equal(findJourneyPackForTarget(packs, "zh-Hans"), undefined)
})

test("constants line up with the publisher", () => {
  assert.match(DEFAULT_JOURNEY_PACK_CATALOG_URL, /journey-packs\/index\.json$/)
  assert.ok(SUPPORTED_JOURNEY_SCHEMA_VERSIONS.has(1))
})
