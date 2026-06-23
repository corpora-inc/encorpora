// Tests for `filterCatalogForApp` — version/platform gating AND de-dup by id.
// Run with the repo's native runner (no extra deps): `npm test` →
//   node --experimental-strip-types --test src/contentPacks/*.test.ts
//
// `catalog.ts` uses extensionless (bundler-resolution) relative imports, which
// the bare Node strip-types loader can't resolve, so we bundle it through
// esbuild (already a dev dep — the same resolver Vite uses) and import the real
// exported function. This exercises production code, not a copy.
//
// The headline guarantee here is the one behind the "3 copies of the
// parlometron" bug: the catalog carries multiple entries with the SAME pack
// id (per-platform / per-version compatibility routing). When the host
// platform is unknown the platform gate is skipped, so the iOS + Android
// variants both pass — they MUST collapse to a single listing entry.

import { test, before } from "node:test"
import assert from "node:assert/strict"
import { fileURLToPath } from "node:url"
import path from "node:path"

type FilterFn = (
  v3: { version: 3; generatedAt: string; packs: unknown[] },
  appVersion: string,
  devMode: boolean,
  host?: { platform?: string; osVersion?: string },
) => Array<{ id: string; version: string }>

let filterCatalogForApp: FilterFn

before(async () => {
  const { build } = await import("esbuild")
  const here = path.dirname(fileURLToPath(import.meta.url))
  const res = await build({
    entryPoints: [path.join(here, "catalog.ts")],
    bundle: true,
    format: "esm",
    write: false,
    platform: "neutral",
  })
  const code = res.outputFiles[0].text
  const mod = await import(
    "data:text/javascript;base64," + Buffer.from(code).toString("base64")
  )
  filterCatalogForApp = mod.filterCatalogForApp
})

const entry = (over: Record<string, unknown>) => ({
  id: "pronunciation_coach",
  name: "Pronunciation Coach",
  version: "0.7.0",
  minAppVersion: "0.12.6",
  channel: "stable",
  ...over,
})

// The real pronunciation_coach routing: a legacy iOS build pinned to 0.12.5,
// a current iOS build, and a current Android build.
const coachCatalog = () => ({
  version: 3 as const,
  generatedAt: "2026-06-16T00:00:00.000Z",
  packs: [
    entry({ version: "0.3.5", minAppVersion: "0.12.5", maxAppVersion: "0.12.5", platforms: ["ios"] }),
    entry({ version: "0.7.0", minAppVersion: "0.12.6", platforms: ["ios"] }),
    entry({ version: "0.7.0", minAppVersion: "0.12.6", platforms: ["android"] }),
  ],
})

test("dedup: unknown host platform collapses iOS+Android variants to one", () => {
  // No host → the platform gate is skipped, so both 0.7.0 variants pass.
  // Without de-dup this returned TWO identical-id cards (the bug).
  const out = filterCatalogForApp(coachCatalog(), "0.18.0", false)
  const coach = out.filter((g) => g.id === "pronunciation_coach")
  assert.equal(coach.length, 1)
  assert.equal(coach[0]?.version, "0.7.0")
})

test("dedup: known iOS host keeps the iOS variant (single card)", () => {
  const out = filterCatalogForApp(coachCatalog(), "0.18.0", false, { platform: "ios" })
  assert.equal(out.filter((g) => g.id === "pronunciation_coach").length, 1)
})

test("dedup: known Android host keeps the Android variant (single card)", () => {
  const out = filterCatalogForApp(coachCatalog(), "0.18.0", false, { platform: "android" })
  assert.equal(out.filter((g) => g.id === "pronunciation_coach").length, 1)
})

test("dedup: at the legacy app version only the legacy entry passes", () => {
  // app 0.12.5: the 0.7.0 entries fail minAppVersion; only the 0.3.5 ios
  // entry is in-range. Still exactly one card, and it's the legacy one.
  const out = filterCatalogForApp(coachCatalog(), "0.12.5", false)
  const coach = out.filter((g) => g.id === "pronunciation_coach")
  assert.equal(coach.length, 1)
  assert.equal(coach[0]?.version, "0.3.5")
})

test("disjoint version-range variants of one id still collapse to one", () => {
  // world_radio-style routing: old host range vs new host range. For any
  // single app version only one passes; de-dup must never drop the survivor.
  const cat = {
    version: 3 as const,
    generatedAt: "2026-06-16T00:00:00.000Z",
    packs: [
      { id: "world_radio", name: "World Radio", version: "0.3.1", minAppVersion: "0.10.0", maxAppVersion: "0.11.99", channel: "stable" },
      { id: "world_radio", name: "World Radio", version: "0.6.3", minAppVersion: "0.12.0", channel: "stable" },
    ],
  }
  const newHost = filterCatalogForApp(cat, "0.18.0", false)
  assert.equal(newHost.filter((g) => g.id === "world_radio").length, 1)
  assert.equal(newHost.find((g) => g.id === "world_radio")?.version, "0.6.3")

  const oldHost = filterCatalogForApp(cat, "0.11.0", false)
  assert.equal(oldHost.filter((g) => g.id === "world_radio").length, 1)
  assert.equal(oldHost.find((g) => g.id === "world_radio")?.version, "0.3.1")
})

test("distinct ids are all preserved (no over-collapsing)", () => {
  const cat = {
    version: 3 as const,
    generatedAt: "2026-06-16T00:00:00.000Z",
    packs: [
      { id: "hover_runner", name: "Hover Runner", version: "0.1.0", minAppVersion: "0.9.0", channel: "stable" },
      { id: "hanzipan", name: "Hanzipan", version: "0.3.0", minAppVersion: "0.9.0", channel: "stable" },
    ],
  }
  const out = filterCatalogForApp(cat, "0.18.0", false)
  assert.equal(out.length, 2)
})
