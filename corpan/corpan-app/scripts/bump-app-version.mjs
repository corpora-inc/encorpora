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

// package.json — surgical (preserve formatting via a targeted replace).
writeFileSync(pkgPath, readFileSync(pkgPath, "utf8").replace(
  new RegExp(`("version"\\s*:\\s*)"${current.replace(/\./g, "\\.")}"`),
  `$1"${next}"`,
))

// tauri.conf.json — the top-level "version" (drives iOS/Android bundle version).
writeFileSync(tauriPath, readFileSync(tauriPath, "utf8").replace(
  new RegExp(`("version"\\s*:\\s*)"${current.replace(/\./g, "\\.")}"`),
  `$1"${next}"`,
))

// src-tauri/Cargo.toml — the first `version = "..."` (the package version).
writeFileSync(cargoPath, readFileSync(cargoPath, "utf8").replace(
  new RegExp(`(^version\\s*=\\s*)"${current.replace(/\./g, "\\.")}"`, "m"),
  `$1"${next}"`,
))

console.log(`bumped ${current} -> ${next} in package.json, tauri.conf.json, Cargo.toml`)
console.log("next: commit, then push / open a PR. Merging to main triggers the release build.")
