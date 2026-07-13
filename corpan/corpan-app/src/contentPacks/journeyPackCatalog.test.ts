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
let resolveJourneyPackForTarget: (
  catalog: Catalog,
  targetLang: string,
  appVersion: string,
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
  resolveJourneyPackForTarget = mod.resolveJourneyPackForTarget
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

test("resolveJourneyPackForTarget: prefers stable when both channels exist", () => {
  const c = parseJourneyPackCatalog(
    catalog([
      entry({ id: "journey_en_preview", targetLang: "en", channel: "preview" }),
      entry({ id: "journey_en_stable", targetLang: "en", channel: "stable" }),
    ]),
  )
  assert.ok(c)
  assert.equal(resolveJourneyPackForTarget(c, "en", "1.0.0")?.id, "journey_en_stable")
})

test("resolveJourneyPackForTarget: falls back to preview when no stable exists", () => {
  const c = parseJourneyPackCatalog(
    catalog([entry({ id: "journey_en", targetLang: "en", channel: "preview" })]),
  )
  assert.ok(c)
  // The exact production repro: EN target, only a preview-channel pack.
  assert.equal(resolveJourneyPackForTarget(c, "en", "1.0.0")?.id, "journey_en")
})

test("resolveJourneyPackForTarget: an unset channel counts as stable", () => {
  const c = parseJourneyPackCatalog(
    catalog([
      { ...entry({ id: "journey_en_default", targetLang: "en" }), channel: undefined },
      entry({ id: "journey_en_preview", targetLang: "en", channel: "preview" }),
    ]),
  )
  assert.ok(c)
  assert.equal(resolveJourneyPackForTarget(c, "en", "1.0.0")?.id, "journey_en_default")
})

test("resolveJourneyPackForTarget: compat gates hold for BOTH channels", () => {
  // A preview pack that fails minAppVersion / schemaVersion must NOT be offered
  // as a fallback — an app never downloads a course it cannot run.
  const tooNew = parseJourneyPackCatalog(
    catalog([entry({ id: "journey_en", targetLang: "en", channel: "preview", minAppVersion: "99.0.0" })]),
  )
  assert.ok(tooNew)
  assert.equal(resolveJourneyPackForTarget(tooNew, "en", "1.0.0"), undefined)

  const badSchema = parseJourneyPackCatalog(
    catalog([{ ...entry({ id: "journey_en", targetLang: "en", channel: "preview" }), schemaVersion: 999 }]),
  )
  assert.ok(badSchema)
  assert.equal(resolveJourneyPackForTarget(badSchema, "en", "1.0.0"), undefined)
})

test("resolveJourneyPackForTarget: base-subtag fallback + preview honored together", () => {
  const c = parseJourneyPackCatalog(
    catalog([entry({ id: "journey_pt", targetLang: "pt", channel: "preview" })]),
  )
  assert.ok(c)
  assert.equal(resolveJourneyPackForTarget(c, "pt-BR", "1.0.0")?.id, "journey_pt")
})

test("onboarding availability decision: undefined ⇒ no guided offer", () => {
  // The onboarding guided opt-in is gated on `!!resolveJourneyPackForTarget`.
  // No pack for the target (only an incompatible one) ⇒ decision is "unavailable".
  const c = parseJourneyPackCatalog(
    catalog([entry({ id: "journey_fr", targetLang: "fr", channel: "stable" })]),
  )
  assert.ok(c)
  assert.equal(!!resolveJourneyPackForTarget(c, "en", "1.0.0"), false)
  // ...but a published preview pack for the target ⇒ "available".
  const c2 = parseJourneyPackCatalog(
    catalog([entry({ id: "journey_en", targetLang: "en", channel: "preview" })]),
  )
  assert.ok(c2)
  assert.equal(!!resolveJourneyPackForTarget(c2, "en", "1.0.0"), true)
})

test("constants line up with the publisher", () => {
  assert.match(DEFAULT_JOURNEY_PACK_CATALOG_URL, /journey-packs\/index\.json$/)
  assert.ok(SUPPORTED_JOURNEY_SCHEMA_VERSIONS.has(1))
})
