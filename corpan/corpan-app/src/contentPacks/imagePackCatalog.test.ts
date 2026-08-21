// Tests for the image-pack (imagepan) index parser + visibility gating.
// Run with: `npm test`.
//
// `imagePackCatalog.ts` reads `import.meta.env` for the URL override, which the
// bare node strip-types loader can't handle — so we bundle through esbuild
// (same approach as journeyPackCatalog.test.ts) and exercise the REAL exports.
// The parser / gating are pure and never fetch.

import { test, before } from "node:test"
import assert from "node:assert/strict"
import { fileURLToPath } from "node:url"
import path from "node:path"

type Entry = {
  id: string
  kind: string
  name: string
  version: string
  zipUrl: string
  sizeMb: number
  conceptCount?: number
  channel?: string
  minAppVersion?: string
}
type Catalog = { version: number; generatedAt: string; packs: Entry[] }

let parseImagePackCatalog: (data: unknown) => Catalog | null
let visibleImagePacks: (c: Catalog, appVersion: string, devMode: boolean) => Entry[]
let findImagePack: (packs: Entry[], packId?: string) => Entry | undefined
let DEFAULT_IMAGE_PACK_CATALOG_URL: string

before(async () => {
  const { build } = await import("esbuild")
  const here = path.dirname(fileURLToPath(import.meta.url))
  const res = await build({
    entryPoints: [path.join(here, "imagePackCatalog.ts")],
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
  parseImagePackCatalog = mod.parseImagePackCatalog
  visibleImagePacks = mod.visibleImagePacks
  findImagePack = mod.findImagePack
  DEFAULT_IMAGE_PACK_CATALOG_URL = mod.DEFAULT_IMAGE_PACK_CATALOG_URL
})

const entry = (over: Partial<Entry> = {}): Record<string, unknown> => ({
  id: "imagepan",
  kind: "image-pack",
  name: "Picture concepts",
  version: "0.1.0",
  zipUrl: "https://cdn.example/imagepan-0.1.0.zip",
  sizeMb: 1.0,
  conceptCount: 95,
  channel: "preview",
  ...over,
})

const catalog = (packs: unknown[]): unknown => ({
  version: 1,
  generatedAt: "2026-07-08T00:00:00Z",
  packs,
})

test("parses a well-formed index", () => {
  const c = parseImagePackCatalog(catalog([entry()]))
  assert.ok(c)
  assert.equal(c.packs.length, 1)
  assert.equal(c.packs[0].id, "imagepan")
  assert.equal(c.packs[0].conceptCount, 95)
})

test("rejects wrong wire-format version and non-object shapes", () => {
  assert.equal(parseImagePackCatalog({ version: 2, packs: [] }), null)
  assert.equal(parseImagePackCatalog(null), null)
  assert.equal(parseImagePackCatalog([]), null)
  assert.equal(parseImagePackCatalog({ version: 1 }), null)
})

test("drops entries missing hard requirements", () => {
  const c = parseImagePackCatalog(
    catalog([
      entry(),
      entry({ id: "" }),
      entry({ kind: "journey-course" }),
      entry({ version: "" }),
      entry({ zipUrl: "" }),
      "garbage",
    ]),
  )
  assert.ok(c)
  assert.equal(c.packs.length, 1)
})

test("visibleImagePacks gates channel + minAppVersion", () => {
  const c = parseImagePackCatalog(
    catalog([
      entry({ id: "imagepan", channel: "preview" }),
      entry({ id: "imagepan_stable", channel: "stable" }),
      entry({ id: "imagepan_future", channel: "stable", minAppVersion: "99.0.0" }),
    ]),
  )
  assert.ok(c)
  // non-dev: preview hidden, future minAppVersion hidden
  assert.deepEqual(
    visibleImagePacks(c, "1.0.0", false).map((p) => p.id),
    ["imagepan_stable"],
  )
  // dev: preview shows, but the minAppVersion gate still holds
  assert.deepEqual(
    visibleImagePacks(c, "1.0.0", true).map((p) => p.id).sort(),
    ["imagepan", "imagepan_stable"],
  )
})

test("findImagePack returns the canonical id, undefined otherwise", () => {
  const c = parseImagePackCatalog(catalog([entry({ channel: "stable" })]))
  assert.ok(c)
  const packs = visibleImagePacks(c, "1.0.0", false)
  assert.equal(findImagePack(packs)?.id, "imagepan")
  assert.equal(findImagePack(packs, "nonesuch"), undefined)
})

test("default URL lines up with the publisher", () => {
  assert.match(DEFAULT_IMAGE_PACK_CATALOG_URL, /imagepan\/index\.json$/)
})
