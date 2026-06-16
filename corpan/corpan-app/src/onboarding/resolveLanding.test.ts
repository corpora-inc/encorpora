// Tests for `resolveLanding` — the deterministic onboarding landing map.
// Run with the repo's native runner: `npm test` →
//   node --experimental-strip-types --test src/**/*.test.ts
//
// resolveLanding pulls in bestFit → experiences/registry via "@/" path aliases
// (type-only into the stores, so no zustand at runtime). The bare Node
// strip-types loader can't resolve those aliases, so we bundle through esbuild
// (a dev dep) with the app tsconfig's path mapping and exercise the real export.

import { test, before } from "node:test"
import assert from "node:assert/strict"
import { fileURLToPath } from "node:url"
import path from "node:path"

type LandingResolution = {
  intent: { kind: string; packId?: string; tab?: string; razzle?: boolean }
  chosenId: string
  installPackId: string | null
}
type ResolveLanding = (input: {
  choice: string
  languages: string[]
  catalogIds: string[]
  installedIds: string[]
  rng?: () => number
}) => LandingResolution

let resolveLanding: ResolveLanding

before(async () => {
  const { build } = await import("esbuild")
  const here = path.dirname(fileURLToPath(import.meta.url))
  const res = await build({
    entryPoints: [path.join(here, "resolveLanding.ts")],
    bundle: true,
    format: "esm",
    write: false,
    platform: "neutral",
    tsconfig: path.join(here, "../../tsconfig.json"),
  })
  const code = res.outputFiles[0].text
  const mod = await import(
    "data:text/javascript;base64," + Buffer.from(code).toString("base64")
  )
  resolveLanding = mod.resolveLanding
})

const ALL_CATALOG = [
  "earthgate_reader",
  "stargate_reader",
  "beatlounge",
  "juice_squeeze",
  "hover_runner",
  "hanzipan",
  "pronunciation_coach",
]

test("read → Earthgate Reader (install needed)", () => {
  const r = resolveLanding({ choice: "read", languages: ["en", "es"], catalogIds: ALL_CATALOG, installedIds: [] })
  assert.equal(r.intent.kind, "experience")
  assert.equal(r.intent.packId, "earthgate_reader")
  assert.equal(r.intent.razzle, true)
  assert.equal(r.chosenId, "earthgate_reader")
  assert.equal(r.installPackId, "earthgate_reader")
})

test("read → Stargate Reader when Earthgate absent, else Phrase Flip", () => {
  assert.equal(resolveLanding({ choice: "read", languages: ["en"], catalogIds: ["stargate_reader"], installedIds: [] }).intent.packId, "stargate_reader")
  assert.equal(resolveLanding({ choice: "read", languages: ["en"], catalogIds: [], installedIds: [] }).intent.packId, "phrase_main")
})

test("study (non-Chinese) → Phrase Flip", () => {
  const r = resolveLanding({ choice: "study", languages: ["en", "es"], catalogIds: ALL_CATALOG, installedIds: [] })
  assert.equal(r.intent.kind, "experience")
  assert.equal(r.intent.packId, "phrase_main")
  assert.equal(r.installPackId, null) // native, never installs
})

test("study + Chinese target (hanzipan available) → Hanzipan", () => {
  const r = resolveLanding({ choice: "study", languages: ["en", "zh-Hans"], catalogIds: ALL_CATALOG, installedIds: [] })
  assert.equal(r.intent.packId, "hanzipan")
  assert.equal(r.chosenId, "hanzipan")
  assert.equal(r.installPackId, "hanzipan") // needs install (not in installedIds)
})

test("study + Chinese but hanzipan NOT in catalog → Phrase Flip fallback", () => {
  const r = resolveLanding({ choice: "study", languages: ["zh-Hant"], catalogIds: ["beatlounge"], installedIds: [] })
  assert.equal(r.intent.packId, "phrase_main")
})

test("playMusic → beatlounge (install needed)", () => {
  const r = resolveLanding({ choice: "playMusic", languages: ["en"], catalogIds: ALL_CATALOG, installedIds: [] })
  assert.equal(r.intent.packId, "beatlounge")
  assert.equal(r.installPackId, "beatlounge")
})

test("playMusic → already installed beatlounge needs no install", () => {
  const r = resolveLanding({ choice: "playMusic", languages: ["en"], catalogIds: ALL_CATALOG, installedIds: ["beatlounge"] })
  assert.equal(r.intent.packId, "beatlounge")
  assert.equal(r.installPackId, null)
})

test("playMusic with no beatlounge → Phrase Flip", () => {
  const r = resolveLanding({ choice: "playMusic", languages: ["en"], catalogIds: ["juice_squeeze"], installedIds: [] })
  assert.equal(r.intent.packId, "phrase_main")
})

test("playGames → juice_squeeze, else hover_runner, else phrase", () => {
  assert.equal(resolveLanding({ choice: "playGames", languages: ["en"], catalogIds: ["juice_squeeze", "hover_runner"], installedIds: [] }).intent.packId, "juice_squeeze")
  assert.equal(resolveLanding({ choice: "playGames", languages: ["en"], catalogIds: ["hover_runner"], installedIds: [] }).intent.packId, "hover_runner")
  assert.equal(resolveLanding({ choice: "playGames", languages: ["en"], catalogIds: [], installedIds: [] }).intent.packId, "phrase_main")
})

test("surprise picks from the launchable pool (rng-controlled, always reachable)", () => {
  // rng=0 → first pool slot = "phrase"
  assert.equal(resolveLanding({ choice: "surprise", languages: ["en"], catalogIds: ALL_CATALOG, installedIds: [], rng: () => 0 }).intent.packId, "phrase_main")
  // rng≈1 → last pool slot; with this catalog the last is a real pack, never blocked/preview
  const last = resolveLanding({ choice: "surprise", languages: ["en"], catalogIds: ALL_CATALOG, installedIds: [], rng: () => 0.999 })
  assert.ok(["experience", "home"].includes(last.intent.kind))
  // surprise never routes to a preview/blocked pack
  assert.notEqual(last.intent.packId, "corpan_city")
  assert.notEqual(last.intent.packId, "teletron")
})

test("surprise always carries razzle: true", () => {
  for (const rng of [() => 0, () => 0.3, () => 0.7, () => 0.99]) {
    const r = resolveLanding({ choice: "surprise", languages: ["en", "zh-Hans"], catalogIds: ALL_CATALOG, installedIds: [], rng })
    assert.equal(r.intent.razzle, true)
  }
})
