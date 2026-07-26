// The native configuration is a set of one-way doors. The bundle identifier is
// locked by the first store upload, the Play package name cannot be changed
// without Google support (X-03), and a shipped app cannot narrow its
// permissions without breaking installed clients. None of it is exercised by
// `vite build`, so nothing else in CI would notice a regression here.
//
// Covers X-05 (minSdk), X-06 (iOS 16), X-07 (non-null CSP, per-command grants).

import { test } from "node:test"
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

import { NATIVE_CALLS } from "./permissions.ts"

const here = path.dirname(fileURLToPath(import.meta.url))
const srcRoot = path.resolve(here, "..")
const tauriRoot = path.resolve(here, "../../src-tauri")

const readJson = (file: string): Record<string, unknown> =>
  JSON.parse(fs.readFileSync(path.join(tauriRoot, file), "utf8")) as Record<string, unknown>

const config = readJson("tauri.conf.json")
const capability = readJson("capabilities/default.json")

const permissions = capability["permissions"] as string[]
const app = config["app"] as { windows: { label: string }[]; security: { csp: unknown } }
const bundle = config["bundle"] as {
  iOS?: { minimumSystemVersion?: string }
  android?: { minSdkVersion?: number }
}

test("the bundle identifier is the one the stores will lock", () => {
  // Founder decision #6. Changing it after the first upload is a support
  // ticket with Google and a new app record with Apple.
  assert.equal(config["identifier"], "inc.corpora.dynawalla")
})

test("the CSP is non-null and closed by default", () => {
  const csp = app.security.csp
  assert.equal(typeof csp, "string", "csp is null — X-07 requires a real policy")
  const policy = csp as string

  assert.match(policy, /default-src 'self'/)
  assert.doesNotMatch(policy, /'unsafe-eval'/)
  assert.doesNotMatch(policy, /\*/, "a wildcard source defeats the policy")

  // The app is offline by design (ADR-0003, ADR-0004): no remote origin should
  // ever appear here. `ipc:`/`http://ipc.localhost` are Tauri's own bridge.
  for (const source of policy.matchAll(/https?:\/\/[^\s;]+/g)) {
    assert.equal(source[0], "http://ipc.localhost", `remote origin in CSP: ${source[0]}`)
  }

  // script-src must not admit inline script: the whole point of the policy.
  assert.match(policy, /script-src 'self'\s*;/)
})

test("no grant is a whole plugin", () => {
  // ADR-0005 point 4. Corpán's capability file is the precedent NOT followed:
  // 11 of its 14 grants are `<plugin>:default`.
  for (const permission of permissions) {
    assert.doesNotMatch(permission, /:default$/, `${permission} grants a whole plugin`)
    assert.match(
      permission,
      /^[a-z-]+:(?:[a-z-]+:)?allow-[a-z-]+$/,
      `${permission} is not a command grant`,
    )
  }
})

test("grants and native calls are the same set, in both directions", () => {
  const granted = [...permissions].sort()
  const required = [...new Set(NATIVE_CALLS.map((call) => call.permission))].sort()
  assert.deepEqual(granted, required)
})

test("no source file reaches native without declaring the call", () => {
  const declared = new Set(NATIVE_CALLS.map((call) => call.module))
  const found = new Set<string>()

  const walk = (dir: string) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name)
      if (entry.isDirectory()) {
        walk(full)
        continue
      }
      if (!/\.(ts|tsx)$/.test(entry.name)) continue
      if (entry.name.endsWith(".test.ts")) continue
      const text = fs.readFileSync(full, "utf8")
      for (const m of text.matchAll(/from\s+"(@tauri-apps\/api[^"]*)"/g)) {
        found.add(m[1]!)
      }
    }
  }
  walk(srcRoot)

  for (const module of found) {
    assert.ok(declared.has(module), `${module} is imported but not declared in permissions.ts`)
  }
  // And the declaration is not stale.
  for (const module of declared) {
    assert.ok(found.has(module), `${module} is declared but no longer used`)
  }
})

test("the capability is scoped to the window that exists", () => {
  const labels = app.windows.map((w) => w.label)
  assert.deepEqual(labels, ["main"])
  assert.deepEqual(capability["windows"], ["main"])
})

test("the mobile floors are the ones the stores require", () => {
  // X-06: iOS 16.0. X-05: minSdk 26 — compileSdk/targetSdk 36 live in the
  // generated Gradle config and land with the Android target in PR-1.3.
  assert.equal(bundle.iOS?.minimumSystemVersion, "16.0")
  assert.equal(bundle.android?.minSdkVersion, 26)
})

test("no Cargo workspace section captures a sibling app", () => {
  // ADR-0011: a `[workspace]` here, or a `[patch]` moved out of this manifest,
  // silently reverts Corpán to an ndk-context that aborts on Android Activity
  // recreation — compiling, testing and clippying clean the whole way.
  const manifest = fs.readFileSync(path.join(tauriRoot, "Cargo.toml"), "utf8")
  assert.doesNotMatch(manifest, /^\s*\[workspace\]/m)
  assert.doesNotMatch(manifest, /^\s*\[workspace\./m)
})
