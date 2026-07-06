// Tests for `matchWordPackOffer` — the pure (native→target) availability
// resolver behind the Journey inline word-explanation offer. Run: `npm test`.
//
// `wordPackProvision.ts` pulls in `contentPacks/wordPackCatalog.ts`, which reads
// `import.meta.env`; we bundle through esbuild (the same approach the sibling
// catalog tests use) and exercise the REAL export. It never fetches or installs.

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

let matchWordPackOffer: (
  catalog: Catalog | null | undefined,
  appVersion: string,
  nativeLang: string,
  targetLang: string,
) => Entry | null

before(async () => {
  const { build } = await import("esbuild")
  const here = path.dirname(fileURLToPath(import.meta.url))
  const res = await build({
    entryPoints: [path.join(here, "wordPackProvision.ts")],
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
  matchWordPackOffer = mod.matchWordPackOffer
})

function entry(over: Partial<Entry>): Entry {
  return {
    id: "wordpan_es_en",
    kind: "word-explanation",
    nativeLang: "es",
    targetLang: "en",
    name: "n",
    version: "0.1.0",
    zipUrl: "https://cdn/x.zip",
    sizeMb: 3,
    channel: "preview",
    ...over,
  }
}

function catalog(packs: Entry[]): Catalog {
  return { version: 1, generatedAt: "2026-06-24T00:00:00Z", packs }
}

test("offers the matching pair even though the pack ships as `preview`", () => {
  // The 53 live packs are all channel:preview; the offer must bypass the
  // preview DISCOVERY gate (unlike Settings) so a real user is offered one.
  const c = catalog([entry({})])
  const m = matchWordPackOffer(c, "1.0.0", "es", "en")
  assert.equal(m?.id, "wordpan_es_en")
})

test("resolves a base-subtag native to the base pack (es-MX → es)", () => {
  const c = catalog([entry({})])
  assert.equal(matchWordPackOffer(c, "1.0.0", "es-MX", "en")?.id, "wordpan_es_en")
})

test("GENERIC over target: a non-en-target entry matches its pair", () => {
  // Proves nothing hardcodes target=en. A hypothetical en→fr pack is offered
  // to an English-native / French-target stack.
  const c = catalog([
    entry({ id: "wordpan_en_fr", nativeLang: "en", targetLang: "fr" }),
  ])
  assert.equal(matchWordPackOffer(c, "1.0.0", "en", "fr")?.id, "wordpan_en_fr")
  // ...and it is NOT offered to an unrelated pair.
  assert.equal(matchWordPackOffer(c, "1.0.0", "es", "en"), null)
})

test("honors minAppVersion (never offers a pack a stale app can't render)", () => {
  const c = catalog([entry({ minAppVersion: "9.9.9" })])
  assert.equal(matchWordPackOffer(c, "1.0.0", "es", "en"), null)
  assert.equal(matchWordPackOffer(c, "9.9.9", "es", "en")?.id, "wordpan_es_en")
})

test("null when catalog missing, pair degenerate, or unpublished", () => {
  const c = catalog([entry({})])
  assert.equal(matchWordPackOffer(null, "1.0.0", "es", "en"), null)
  assert.equal(matchWordPackOffer(undefined, "1.0.0", "es", "en"), null)
  // Same-language pair (a language doesn't explain itself).
  assert.equal(matchWordPackOffer(c, "1.0.0", "es", "es-MX"), null)
  // Empty sides.
  assert.equal(matchWordPackOffer(c, "1.0.0", "", "en"), null)
  // Native with no published pair.
  assert.equal(matchWordPackOffer(c, "1.0.0", "de", "en"), null)
})