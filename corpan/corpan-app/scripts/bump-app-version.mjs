#!/usr/bin/env node
// Bump the Corpán app version in lockstep across the three files that must
// agree, then commit. A version change to src-tauri/tauri.conf.json on `main`
// is what triggers the mobile release pipeline (.github/workflows/release-mobile.yml).
//
//   node scripts/bump-app-version.mjs patch     # 0.19.2 -> 0.19.3
//   node scripts/bump-app-version.mjs minor     # 0.19.2 -> 0.20.0
//   node scripts/bump-app-version.mjs 0.20.0    # explicit
//
// Run from corpan/corpan-app. Does NOT push — review the commit, then push /
// open a PR. The human-readable version is what testers see in TestFlight /
// Play; the CI run number supplies the unique, monotonic BUILD number.

import { readFileSync, writeFileSync } from "node:fs"

const arg = process.argv[2]
if (!arg) {
  console.error("usage: bump-app-version.mjs <patch|minor|major|X.Y.Z>")
  process.exit(1)
}

const pkgPath = "package.json"
const tauriPath = "src-tauri/tauri.conf.json"
const cargoPath = "src-tauri/Cargo.toml"

const pkg = JSON.parse(readFileSync(pkgPath, "utf8"))
const current = pkg.version
const [maj, min, pat] = current.split(".").map(Number)

const next =
  arg === "patch" ? `${maj}.${min}.${pat + 1}` :
  arg === "minor" ? `${maj}.${min + 1}.0` :
  arg === "major" ? `${maj + 1}.0.0` :
  arg

if (!/^\d+\.\d+\.\d+$/.test(next)) {
  console.error(`not a semver: ${next}`)
  process.exit(1)
}
if (next === current) {
  console.error(`version already ${current} — nothing to bump`)
  process.exit(1)
}

// Compute `path`'s new content (which must contain exactly one capture
// group for the text preceding the version) by replacing whatever semver is
// currently there with `next`. Structural — matches on shape, not on the
// exact `current` string — so a file that's already drifted from
// package.json's version still gets updated instead of silently left alone
// (the previous exact-string-match approach is what caused Cargo.toml to
// desync from package.json/tauri.conf.json without any error). Exits
// nonzero if the pattern isn't found or the content doesn't actually
// change, so drift can never again pass silently.
function bumped(path, pattern, label) {
  const before = readFileSync(path, "utf8")
  if (!pattern.test(before)) {
    console.error(`bump-app-version: could not find a ${label} version line in ${path}`)
    process.exit(1)
  }
  const after = before.replace(pattern, `$1"${next}"`)
  if (after === before) {
    console.error(`bump-app-version: ${path} version line unchanged after replace (already ${next}?) — refusing to silently no-op`)
    process.exit(1)
  }
  return after
}

// Compute all three replacements before writing anything, so a bad file
// (missing/malformed version line) fails loudly with zero side effects
// instead of leaving the three files bumped out of lockstep.
const pkgNext = bumped(pkgPath, /("version"\s*:\s*)"\d+\.\d+\.\d+"/, "package.json")
// tauri.conf.json — the top-level "version" (drives iOS/Android bundle version).
const tauriNext = bumped(tauriPath, /("version"\s*:\s*)"\d+\.\d+\.\d+"/, "tauri.conf.json")
// src-tauri/Cargo.toml — the first `version = "..."` under [package] (the
// package version). Anchored to line start so it can't match a dependency's
// `version = "..."` further down the file.
const cargoNext = bumped(cargoPath, /(^version\s*=\s*)"\d+\.\d+\.\d+"/m, "Cargo.toml")

writeFileSync(pkgPath, pkgNext)
writeFileSync(tauriPath, tauriNext)
writeFileSync(cargoPath, cargoNext)

console.log(`bumped -> ${next} in package.json, tauri.conf.json, Cargo.toml`)
console.log("next: commit, then push / open a PR. Merging to main triggers the release build.")
