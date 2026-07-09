// Tests for `matchImagePackOffer` — the pure availability resolver behind the
// Journey inline picture-pack offer (ImagePackOfferBanner). Run: `npm test`.
//
// `imagePackProvision.ts` pulls in `contentPacks/imagePackCatalog.ts`, which
// reads `import.meta.env`; we bundle through esbuild (same approach the sibling
// catalog + wordpan-provision tests use) and exercise the REAL export. It never
// fetches or installs.

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

let matchImagePackOffer: (
  catalog: Catalog | null | undefined,
  appVersion: string,
  devMode: boolean,
) => Entry | null

before(async () => {
  const { build } = await import("esbuild")
  const here = path.dirname(fileURLToPath(import.meta.url))
  const res = await build({
    entryPoints: [path.join(here, "imagePackProvision.ts")],
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
  matchImagePackOffer = mod.matchImagePackOffer
})

const entry = (over: Partial<Entry> = {}): Entry => ({
  id: "imagepan",
  kind: "image-pack",
  name: "Picture concepts",
  version: "0.1.0",
  zipUrl: "https://cdn.example/imagepan-0.1.0.zip",
  sizeMb: 1.4,
  conceptCount: 95,
  channel: "stable",
  ...over,
})

const catalog = (packs: Entry[]): Catalog => ({
  version: 1,
  generatedAt: "2026-07-08T00:00:00Z",
  packs,
})

test("offers a compatible entry, carrying the dynamic size", () => {
  const e = matchImagePackOffer(catalog([entry()]), "1.0.0", false)
  assert.ok(e)
  assert.equal(e.id, "imagepan")
  assert.equal(e.sizeMb, 1.4)
  assert.equal(e.conceptCount, 95)
})

test("no catalog ⇒ no offer (graceful degrade)", () => {
  assert.equal(matchImagePackOffer(null, "1.0.0", false), null)
  assert.equal(matchImagePackOffer(undefined, "1.0.0", false), null)
})

test("empty catalog ⇒ no offer", () => {
  assert.equal(matchImagePackOffer(catalog([]), "1.0.0", false), null)
})

test("preview-only entry is hidden from a non-dev build, shown in dev", () => {
  const c = catalog([entry({ channel: "preview" })])
  assert.equal(matchImagePackOffer(c, "1.0.0", false), null)
  assert.equal(matchImagePackOffer(c, "1.0.0", true)?.id, "imagepan")
})

test("an entry requiring a newer app is not offered", () => {
  const c = catalog([entry({ minAppVersion: "99.0.0" })])
  assert.equal(matchImagePackOffer(c, "1.0.0", false), null)
})
