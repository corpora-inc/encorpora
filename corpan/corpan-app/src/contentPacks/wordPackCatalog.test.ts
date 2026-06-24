// Tests for the word-pack index parser, visibility gating, and the
// (native→target) pair resolver. Run with: `npm test`.
//
// `wordPackCatalog.ts` reads `import.meta.env` for the URL override, which the
// bare node strip-types loader can't handle — so we bundle through esbuild
// (the same approach `util/wordPack.test.ts` uses) and exercise the REAL
// exports. The parser / gating / resolver are pure and never fetch.

import { test, before } from "node:test"
import assert from "node:assert/strict"
import { fileURLToPath } from "node:url"
import path from "node:path"

type Entry = {
  id: string
  kind: string
  nativeLang: string
  targetLang: string
  name: string
  version: string
  zipUrl: string
  sizeMb: number
  channel?: string
  minAppVersion?: string
}
type Catalog = { version: number; generatedAt: string; packs: Entry[] }

let parseWordPackCatalog: (data: unknown) => Catalog | null
let visibleWordPacks: (c: Catalog, appVersion: string, devMode: boolean) => Entry[]
let findWordPackForPair: (
  packs: Entry[],
  nativeLang: string,
  targetLang: string,
) => Entry | undefined
let DEFAULT_WORD_PACK_CATALOG_URL: string

before(async () => {
  const { build } = await import("esbuild")
  const here = path.dirname(fileURLToPath(import.meta.url))
  const res = await build({
    entryPoints: [path.join(here, "wordPackCatalog.ts")],
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
  parseWordPackCatalog = mod.parseWordPackCatalog
  visibleWordPacks = mod.visibleWordPacks
  findWordPackForPair = mod.findWordPackForPair
  DEFAULT_WORD_PACK_CATALOG_URL = mod.DEFAULT_WORD_PACK_CATALOG_URL
})

const liveShape = {
  version: 1,
  generatedAt: "2026-06-22T00:00:00Z",
  packs: [
    {
      id: "wordpan_es_en",
      kind: "word-explanation",
      nativeLang: "es",
      targetLang: "en",
      name: "Spanish explanations for English",
      nameLocalized: { es: "Explicaciones en español" },
      description: "Long-press any English word…",
      version: "0.1.0",
      zipUrl:
        "https://d38iwc9748jekz.cloudfront.net/corpan/word-packs/wordpan-es-en-0.1.0.zip",
      sha256: "fc79306ffbf4e345a3ec8c860c4755e7fffb3e76f5c65804304f27e860e4ae0e",
      sizeMb: 3.06,
      wordCount: 11757,
      languageCount: 2,
      channel: "preview",
    },
  ],
}

test("default catalog URL points at the S3 word-pack index", () => {
  assert.equal(
    DEFAULT_WORD_PACK_CATALOG_URL,
    "https://d38iwc9748jekz.cloudfront.net/corpan/word-packs/index.json",
  )
})

test("parses the live index shape", () => {
  const c = parseWordPackCatalog(liveShape)
  assert.ok(c)
  assert.equal(c!.packs.length, 1)
  const p = c!.packs[0]
  assert.equal(p.id, "wordpan_es_en")
  assert.equal(p.nativeLang, "es")
  assert.equal(p.targetLang, "en")
  assert.equal(p.zipUrl, liveShape.packs[0].zipUrl)
  assert.equal(p.sizeMb, 3.06)
})

test("rejects a wrong wire version", () => {
  assert.equal(parseWordPackCatalog({ ...liveShape, version: 2 }), null)
})

test("rejects non-object / array payloads", () => {
  assert.equal(parseWordPackCatalog(null), null)
  assert.equal(parseWordPackCatalog([]), null)
  assert.equal(parseWordPackCatalog("nope"), null)
})

test("drops entries that aren't kind=word-explanation or miss a field", () => {
  const c = parseWordPackCatalog({
    version: 1,
    generatedAt: "x",
    packs: [
      { ...liveShape.packs[0], kind: "phrase" }, // wrong kind
      { ...liveShape.packs[0], id: "" }, // missing id
      { ...liveShape.packs[0], zipUrl: "" }, // missing zipUrl
      { ...liveShape.packs[0], targetLang: "" }, // missing pair half
      liveShape.packs[0], // the one good entry
    ],
  })
  assert.ok(c)
  assert.equal(c!.packs.length, 1)
  assert.equal(c!.packs[0].id, "wordpan_es_en")
})

test("visibleWordPacks hides preview packs from non-dev users", () => {
  const c = parseWordPackCatalog(liveShape)!
  assert.equal(visibleWordPacks(c, "0.9.0", false).length, 0)
  assert.equal(visibleWordPacks(c, "0.9.0", true).length, 1)
})

test("visibleWordPacks honors minAppVersion", () => {
  const c = parseWordPackCatalog({
    version: 1,
    generatedAt: "x",
    packs: [
      { ...liveShape.packs[0], channel: "stable", minAppVersion: "9.9.9" },
    ],
  })!
  assert.equal(visibleWordPacks(c, "0.9.0", true).length, 0)
  assert.equal(visibleWordPacks(c, "9.9.9", true).length, 1)
})

test("findWordPackForPair matches on base language subtags", () => {
  const c = parseWordPackCatalog(liveShape)!
  const found = findWordPackForPair(c.packs, "es-MX", "en")
  assert.ok(found)
  assert.equal(found!.id, "wordpan_es_en")
  assert.equal(findWordPackForPair(c.packs, "fr", "en"), undefined)
  assert.equal(findWordPackForPair(c.packs, "es", "de"), undefined)
})
