import { test } from "node:test"
import assert from "node:assert/strict"

import { compareVersions, isSemver, parseSemver, satisfies, sdkCompatible } from "./semver.ts"

test("the case a string compare gets wrong", () => {
  // The one that will happen first, and the reason this module exists.
  assert.equal(compareVersions("0.10.0", "0.9.0"), 1)
  assert.equal(compareVersions("1.0.0", "1.0.10"), -1)
  assert.equal(compareVersions("2.0.0", "10.0.0"), -1)
})

test("versions parse or they do not", () => {
  assert.deepEqual(parseSemver("1.2.3"), { major: 1, minor: 2, patch: 3, prerelease: [] })
  assert.deepEqual(parseSemver("1.2.3+build.5"), {
    major: 1,
    minor: 2,
    patch: 3,
    prerelease: [],
  })
  assert.deepEqual(parseSemver("1.2.3-alpha.1"), {
    major: 1,
    minor: 2,
    patch: 3,
    prerelease: ["alpha", 1],
  })
  for (const bad of ["1.2", "1.2.3.4", "v1.2.3", "01.2.3", "1.2.3-", "", "latest", "1.2.-3"]) {
    assert.equal(parseSemver(bad), null, `${bad} parsed`)
    assert.equal(isSemver(bad), false)
  }
})

test("a prerelease sorts below its own release (SemVer §11)", () => {
  assert.equal(compareVersions("1.0.0-alpha", "1.0.0"), -1)
  assert.equal(compareVersions("1.0.0-alpha", "1.0.0-alpha.1"), -1)
  assert.equal(compareVersions("1.0.0-alpha.1", "1.0.0-alpha.beta"), -1)
  assert.equal(compareVersions("1.0.0-beta.2", "1.0.0-beta.11"), -1, "numeric, not lexical")
  assert.equal(compareVersions("1.0.0-rc.1", "1.0.0"), -1)
  assert.equal(compareVersions("1.0.0", "1.0.0"), 0)
})

test("unparseable input compares to null rather than to something", () => {
  assert.equal(compareVersions("nope", "1.0.0"), null)
  assert.equal(compareVersions("1.0.0", "nope"), null)
})

test("a range is min-inclusive and max-exclusive", () => {
  const range = { min: "0.3.0", max: "1.0.0" }
  assert.equal(satisfies("0.3.0", range), true, "min is inclusive")
  assert.equal(satisfies("0.9.9", range), true)
  assert.equal(satisfies("1.0.0", range), false, "max is exclusive")
  assert.equal(satisfies("0.2.9", range), false)
  assert.equal(satisfies("2.0.0", { min: "0.3.0" }), true, "no ceiling means no ceiling")
})

test("a pack that cannot say what it needs does not run", () => {
  assert.equal(satisfies("1.0.0", { min: "not-a-version" }), false)
  assert.equal(satisfies("also-not", { min: "1.0.0" }), false)
  assert.equal(satisfies("1.0.0", { min: "1.0.0", max: "garbage" }), false)
})

test("SDK compatibility is same-major and host-not-behind", () => {
  assert.equal(sdkCompatible("1.2.0", "1.4.0"), true, "additive minor: fine")
  assert.equal(sdkCompatible("1.4.0", "1.4.0"), true)
  assert.equal(sdkCompatible("1.5.0", "1.4.0"), false, "pack uses methods this host lacks")
  assert.equal(sdkCompatible("2.0.0", "1.9.0"), false)
  assert.equal(sdkCompatible("0.9.0", "1.0.0"), false, "major 0 is not a free-for-all")
  assert.equal(sdkCompatible("1.0.0", "nonsense"), false)
})
