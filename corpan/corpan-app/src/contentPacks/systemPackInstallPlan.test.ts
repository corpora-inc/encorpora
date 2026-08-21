// Tests for the pure decision logic behind `SystemPackInstaller` — the
// loop-guard fix for the "catalog advertises a version the origin doesn't
// actually serve" bug. `installPack()` (install.test.ts) stops the LYING (a
// mismatched download can no longer be recorded as a success); this module
// stops the LOOPING (a version that already failed this session doesn't get
// re-attempted on every catalog refresh). Run with: `npm test`.
//
// Pure, no `window`/fetch/React — run directly under the bare node
// --experimental-strip-types loader (no esbuild step needed).

import { test } from "node:test"
import assert from "node:assert/strict"
import {
  needsSystemPackInstall,
  shouldReplaceInstalledPack,
  systemPackFailKey,
} from "./systemPackInstallPlan.ts"

// `shouldReplaceInstalledPack` takes the comparator as a parameter rather
// than importing `catalog.ts`'s `compareVersions` itself — which also keeps
// this test file bare-node-importable (catalog.ts pulls in extensionless
// relative imports that need the esbuild bundling step other tests use; not
// needed here). Same dotted-semver semantics as the real one.
const compareVersions = (a: string, b: string): number => {
  const norm = (s: string) => s.split(".").map((p) => Number.parseInt(p, 10) || 0)
  const left = norm(a)
  const right = norm(b)
  const len = Math.max(left.length, right.length)
  for (let i = 0; i < len; i += 1) {
    const diff = (left[i] ?? 0) - (right[i] ?? 0)
    if (diff !== 0) return diff
  }
  return 0
}

const empty = new Set<string>()

test("systemPackFailKey combines packId and version so a new version isn't blocked by an old failure", () => {
  assert.equal(systemPackFailKey("drift", "0.1.0"), "drift@0.1.0")
  assert.notEqual(systemPackFailKey("drift", "0.1.0"), systemPackFailKey("drift", "0.3.0"))
})

test("needsSystemPackInstall: no-op when already installed at the catalog version", () => {
  const attempt = needsSystemPackInstall({
    installedVersion: "0.3.0",
    catalogVersion: "0.3.0",
    packId: "drift",
    failedKeys: empty,
    inFlightIds: empty,
  })
  assert.equal(attempt, false)
})

test("needsSystemPackInstall: attempts when missing or at a different version", () => {
  assert.equal(
    needsSystemPackInstall({
      installedVersion: undefined,
      catalogVersion: "0.3.0",
      packId: "drift",
      failedKeys: empty,
      inFlightIds: empty,
    }),
    true,
  )
  assert.equal(
    needsSystemPackInstall({
      installedVersion: "0.1.0",
      catalogVersion: "0.3.0",
      packId: "drift",
      failedKeys: empty,
      inFlightIds: empty,
    }),
    true,
  )
})

test("needsSystemPackInstall: THE LOOP GUARD — a version that already failed this session is not re-attempted", () => {
  // Reproduces the CTO's bug precisely: catalog says 0.3.0, installed is
  // 0.1.0, the previous attempt for 0.3.0 already failed (recorded via
  // systemPackFailKey). Without the guard this would return `true` again on
  // every catalog refresh forever.
  const failedKeys = new Set([systemPackFailKey("drift", "0.3.0")])
  const attempt = needsSystemPackInstall({
    installedVersion: "0.1.0",
    catalogVersion: "0.3.0",
    packId: "drift",
    failedKeys,
    inFlightIds: empty,
  })
  assert.equal(attempt, false)
})

test("needsSystemPackInstall: a NEW catalog version gets a fresh attempt despite a prior failure", () => {
  // The catalog origin gets fixed and now advertises 0.3.1 — the pack must
  // not stay wedged from the 0.3.0 failure forever. This is what keeps the
  // loop guard from becoming a permanent block.
  const failedKeys = new Set([systemPackFailKey("drift", "0.3.0")])
  const attempt = needsSystemPackInstall({
    installedVersion: "0.1.0",
    catalogVersion: "0.3.1",
    packId: "drift",
    failedKeys,
    inFlightIds: empty,
  })
  assert.equal(attempt, true)
})

test("needsSystemPackInstall: in-flight dedup — a second concurrent pass doesn't double-attempt", () => {
  const inFlightIds = new Set(["drift"])
  const attempt = needsSystemPackInstall({
    installedVersion: "0.1.0",
    catalogVersion: "0.3.0",
    packId: "drift",
    failedKeys: empty,
    inFlightIds,
  })
  assert.equal(attempt, false)
})

test("needsSystemPackInstall: a different pack's failure doesn't block this one", () => {
  const failedKeys = new Set([systemPackFailKey("wordfall", "0.3.0")])
  const attempt = needsSystemPackInstall({
    installedVersion: "0.1.0",
    catalogVersion: "0.3.0",
    packId: "drift",
    failedKeys,
    inFlightIds: empty,
  })
  assert.equal(attempt, true)
})

test("shouldReplaceInstalledPack: replaces when the download is strictly newer", () => {
  assert.equal(shouldReplaceInstalledPack("0.1.0", "0.3.0", compareVersions), true)
})

test("shouldReplaceInstalledPack: does NOT replace when the download is the same version", () => {
  assert.equal(shouldReplaceInstalledPack("0.3.0", "0.3.0", compareVersions), false)
})

test("shouldReplaceInstalledPack: does NOT replace when the download is OLDER (catalog regression guard)", () => {
  assert.equal(shouldReplaceInstalledPack("0.3.0", "0.1.0", compareVersions), false)
})

test("shouldReplaceInstalledPack: always replaces a fresh install (nothing installed yet)", () => {
  assert.equal(shouldReplaceInstalledPack(undefined, "0.1.0", compareVersions), true)
})
