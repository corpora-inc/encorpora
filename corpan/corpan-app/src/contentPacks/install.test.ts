// Tests for the version-mismatch guard in `install.ts` — the fix for the
// CTO-reported bug: the catalog advertised drift 0.3.0 but its
// manifestUrl/zipUrl pointed at a stale origin serving 0.1.0. `installPack()`
// recorded whatever version the DOWNLOADED manifest declared (the
// `expectedVersion` was only ever used as a fallback, never validated), so
// the install "succeeded" — green checkmark — while the installed version
// silently stayed 0.1.0 forever.
//
// `assertVersionMatches` is the guard now wired into BOTH `installPack`
// branches (the manifest.json path, right before it would otherwise return a
// success result; and the .zip/native-download path, right after
// `installPackFromDownload` resolves and before phrase-pack registration).
// Exported directly from install.ts so it's testable without the
// `window`/`fetch`/Tauri dependencies the rest of the module carries (see the
// module doc comment there) — those branches are exercised implicitly by
// construction: both literally call this function and propagate its throw,
// so "assertVersionMatches throws" IS "installPack fails the install /
// records no success" for a catalog-driven call.
//
// Run with: `npm test` (node --experimental-strip-types --test). Pure logic,
// no bundling needed — this module never touches window/fetch/crypto at
// import time, only inside functions this file doesn't call.

import { test } from "node:test"
import assert from "node:assert/strict"
import { assertVersionMatches, PackVersionMismatchError } from "./install.ts"

test("no-op when there's no expectedVersion (manual/dev installs aren't catalog-driven)", () => {
  assert.doesNotThrow(() => assertVersionMatches("drift", undefined, "0.1.0"))
})

test("no-op when the manifest didn't declare a version at all (legacy fallback preserved)", () => {
  assert.doesNotThrow(() => assertVersionMatches("drift", "0.3.0", undefined))
})

test("no-op when the downloaded version matches what the catalog promised", () => {
  assert.doesNotThrow(() => assertVersionMatches("drift", "0.3.0", "0.3.0"))
})

test("THE BUG: throws PackVersionMismatchError when the catalog and the download disagree", () => {
  assert.throws(
    () => assertVersionMatches("drift", "0.3.0", "0.1.0"),
    (err: unknown) => {
      assert.ok(err instanceof PackVersionMismatchError)
      assert.equal(err.name, "PackVersionMismatchError")
      assert.equal(err.code, "version_mismatch")
      assert.equal(err.packId, "drift")
      assert.equal(err.expectedVersion, "0.3.0")
      assert.equal(err.actualVersion, "0.1.0")
      // The message carries both versions — this is what ends up logged
      // (console.error, right before the throw) and, via InstallContext,
      // what a caller can report — never silently absorbed into "success".
      assert.match(err.message, /0\.3\.0/)
      assert.match(err.message, /0\.1\.0/)
      return true
    },
  )
})

test("a downgrade (download OLDER than expected) is also a mismatch, not just a wrong-direction bump", () => {
  // The bug wasn't specifically "older" or "newer" — it was "doesn't match
  // what the catalog promised". Any drift must fail, in either direction.
  assert.throws(() => assertVersionMatches("drift", "0.1.0", "0.3.0"), PackVersionMismatchError)
})
