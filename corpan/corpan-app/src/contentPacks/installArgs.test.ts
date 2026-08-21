// Tests for `buildCatalogInstallArgs` — the sha256 (and version) passthrough
// from a catalog entry to `installPack()`. Extracted from
// `InstallContext.tsx`'s `installPackBatch` (the phrase-pack "Install all" /
// batch-drawer path), which forwarded `expectedVersion` but silently dropped
// `sha256` before this fix — meaning a batch-installed phrase pack skipped
// the native sha256 hard-fail-on-mismatch check that a single-pack install
// already got via `expectedHash`. Journey packs already thread
// `entry.sha256` through by hand (runtimeWiring.ts); this gives every
// catalog-ish caller the same guarantee for free.
//
// Run with: `npm test`. Pure, no bundling needed.

import { test } from "node:test"
import assert from "node:assert/strict"
import { buildCatalogInstallArgs } from "./installArgs.ts"

test("forwards sha256 as expectedHash when the catalog entry carries one", () => {
  const args = buildCatalogInstallArgs({
    zipUrl: "https://cdn/phrase-botany-basics-0.1.0.zip",
    version: "0.1.0",
    sha256: "fc79306ffbf4e345a3ec8c860c4755e7fffb3e76f5c65804304f27e860e4ae0e",
  })
  assert.ok(args)
  assert.equal(args!.expectedHash, "fc79306ffbf4e345a3ec8c860c4755e7fffb3e76f5c65804304f27e860e4ae0e")
  assert.equal(args!.expectedVersion, "0.1.0")
  assert.equal(args!.manifestUrl, "https://cdn/phrase-botany-basics-0.1.0.zip")
})

test("expectedHash is undefined (not a crash, not a fabricated value) when the catalog entry has no sha256", () => {
  // The documented pipeline gap: catalog-v3 game/reader packs (`CatalogGame`)
  // have no sha256 field at all today (contentPacks/catalog.ts,
  // web/pages/build.js never emit one) — this must degrade to "no hash
  // enforcement", not throw or invent a value.
  const args = buildCatalogInstallArgs({
    zipUrl: "https://cdn/beatlounge-0.2.1.zip",
    version: "0.2.1",
  })
  assert.ok(args)
  assert.equal(args!.expectedHash, undefined)
  assert.equal(args!.expectedVersion, "0.2.1")
})

test("prefers zipUrl over manifestUrl when both are present", () => {
  const args = buildCatalogInstallArgs({
    zipUrl: "https://cdn/pack.zip",
    manifestUrl: "https://cdn/pack/manifest.json",
    version: "1.0.0",
  })
  assert.equal(args!.manifestUrl, "https://cdn/pack.zip")
})

test("falls back to manifestUrl when there's no zipUrl", () => {
  const args = buildCatalogInstallArgs({
    manifestUrl: "https://cdn/pack/manifest.json",
    version: "1.0.0",
  })
  assert.equal(args!.manifestUrl, "https://cdn/pack/manifest.json")
})

test("returns null when the entry has neither zipUrl nor manifestUrl", () => {
  assert.equal(buildCatalogInstallArgs({ version: "1.0.0" }), null)
})
