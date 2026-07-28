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

  // The app's own document is offline: no remote origin appears here. The two
  // permitted sources are both local schemes Tauri serves itself —
  // `http://ipc.localhost` is its bridge, and `http://dynawalla-pack.localhost`
  // is the pack scheme in the form Android and Windows serve it under (it is
  // `dynawalla-pack:` everywhere else, which is not an http source at all).
  // Content packs are downloaded and verified in Rust, never fetched here.
  const LOCAL_SCHEME_HOSTS = new Set(["http://ipc.localhost", "http://dynawalla-pack.localhost"])
  for (const source of policy.matchAll(/https?:\/\/[^\s;]+/g)) {
    assert.ok(LOCAL_SCHEME_HOSTS.has(source[0]), `remote origin in CSP: ${source[0]}`)
  }

  // A pack is framed, and the only thing that may be framed is a pack.
  const frameSrc = /frame-src ([^;]+)/.exec(policy)?.[1] ?? ""
  assert.match(frameSrc, /dynawalla-pack:/, "the pack scheme cannot be framed")
  assert.doesNotMatch(frameSrc, /'self'|https:|data:|blob:/, `frame-src admits ${frameSrc}`)

  // script-src must not admit inline script: the whole point of the policy.
  assert.match(policy, /script-src 'self'\s*;/)
})

test("nothing sets a style attribute the CSP would refuse to apply", () => {
  // `style-src` admits no inline style, so a `style={{ ... }}` anywhere would
  // be dropped by the WebView on the shipped protocol and applied everywhere
  // else — a layout that is correct in `vite preview` and wrong on device.
  // The two must move together, so this test refuses to let them drift.
  const styleSrc = /style-src ([^;]+)/.exec(app.security.csp as string)?.[1] ?? ""
  if (styleSrc.includes("'unsafe-inline'")) return

  const appRoot = path.resolve(srcRoot, "..")
  const offenders: string[] = []
  const check = (full: string) => {
    if (/(?:^|[\s{])style=/m.test(fs.readFileSync(full, "utf8"))) {
      offenders.push(path.relative(appRoot, full))
    }
  }
  const walk = (dir: string) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name)
      if (entry.isDirectory()) walk(full)
      else if (/\.tsx$/.test(entry.name)) check(full)
    }
  }
  walk(srcRoot)
  check(path.join(appRoot, "index.html"))

  assert.deepEqual(offenders, [], "inline style with a CSP that forbids it")
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
  // `null` is an application command, which the ACL does not gate and a
  // capability file cannot name. Those rows are held to a different check —
  // `packs/native.test.ts` asserts each one is actually registered in Rust —
  // and a row with neither a permission nor a command is declared by nobody.
  for (const call of NATIVE_CALLS) {
    if (call.permission === null) {
      assert.ok(call.command, `${call.module}.${call.fn} has no permission and no command`)
    } else {
      assert.equal(call.command, undefined, `${call.permission} is a plugin grant, not a command`)
    }
  }
  const granted = [...permissions].sort()
  const required = [
    ...new Set(NATIVE_CALLS.map((call) => call.permission).filter((p) => p !== null)),
  ].sort()
  assert.deepEqual(granted, required)
})

/**
 * Every specifier in `text` that reaches the native bridge.
 *
 * The org scope, not just `@tauri-apps/api`: the declared V1 surface beyond
 * this shell is haptics and text-to-speech, which ship as `@tauri-apps/plugin-*`
 * packages. And every import form, not just a static double-quoted one — a
 * plugin pulled in by `await import(...)` or by a side-effect import reaches
 * exactly the same IPC.
 */
export function nativeImports(text: string): string[] {
  const pattern = /(?:\bfrom|\bimport|\brequire)\s*\(?\s*["'](@tauri-apps\/[^"']+)["']/g
  return [...text.matchAll(pattern)].map((m) => m[1]!)
}

test("the import scan sees every form an import can take", () => {
  // A guard that silently does not fire is worse than no guard: the README
  // and the capability table are written as though this one does. These are
  // the forms a real file can use, each one checked rather than assumed.
  const seen = (source: string) => nativeImports(source)

  assert.deepEqual(seen(`import { getVersion } from "@tauri-apps/api/app"`), [
    "@tauri-apps/api/app",
  ])
  assert.deepEqual(seen(`import { vibrate } from "@tauri-apps/plugin-haptics"`), [
    "@tauri-apps/plugin-haptics",
  ])
  assert.deepEqual(seen(`import { speak } from '@tauri-apps/plugin-tts'`), [
    "@tauri-apps/plugin-tts",
  ])
  assert.deepEqual(seen(`const w = await import("@tauri-apps/api/window")`), [
    "@tauri-apps/api/window",
  ])
  assert.deepEqual(seen(`import "@tauri-apps/plugin-haptics"`), ["@tauri-apps/plugin-haptics"])
  assert.deepEqual(seen(`export { invoke } from "@tauri-apps/api/core"`), [
    "@tauri-apps/api/core",
  ])

  // And it does not fire on things that are not imports.
  assert.deepEqual(seen(`// see the @tauri-apps/api docs`), [])
  assert.deepEqual(seen(`import { useId } from "react"`), [])
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
      for (const module of nativeImports(fs.readFileSync(full, "utf8"))) {
        found.add(module)
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

test("the app icon is the format the build macro accepts", () => {
  // `tauri::generate_context!` decodes this file and panics "icon ... is not
  // RGBA" on any other colour type — two minutes into a cargo build that no CI
  // job here runs. Stripping the all-opaque alpha channel is the obvious
  // improvement (Apple rejects an icon that carries one into the AppIcon
  // asset, ITMS-90717) and it does not compile, so the constraint is asserted
  // in a place that answers in milliseconds. The iOS flattening belongs with
  // the iOS target, not with this source file.
  const png = fs.readFileSync(path.join(tauriRoot, "icons/icon.png"))
  // `*.png` is Git LFS repo-wide, so a checkout without the object leaves a
  // pointer here — which is also what `generate_context!` would try to decode.
  // Say so, rather than reporting a byte mismatch nobody can read.
  assert.ok(
    !png.subarray(0, 40).toString("latin1").startsWith("version https://git-lfs"),
    "icon.png is a Git LFS pointer, not an image — the LFS object was not fetched",
  )
  assert.equal(png.subarray(0, 8).toString("latin1"), "\x89PNG\r\n\x1a\n")
  assert.equal(png.subarray(12, 16).toString("latin1"), "IHDR")
  // Square, and at least 1024 — a floor rather than an equality, and 1024
  // rather than 512.
  //
  // 1024 because the App Store marketing icon is 1024 and the Tauri CLI renders
  // every iOS and Android density DOWN from this one file: a 512 source does
  // not fail, it upscales, and ships a soft icon nobody notices until review.
  //
  // A floor because the exact number is not the constraint. Pinning 512 made a
  // brand change fail a capabilities test that has no opinion about branding —
  // noise in the one place that should only fire for a real build break.
  const width = png.readUInt32BE(16)
  const height = png.readUInt32BE(20)
  assert.equal(width, height, "icon must be square")
  assert.ok(width >= 1024, `icon is ${width}px; the App Store marketing icon is 1024 and is rendered down from this`)
  assert.equal(png[25], 6, "PNG colour type must be 6 (RGBA) or the Rust build panics")
})

test("no Cargo workspace section captures a sibling app", () => {
  // ADR-0011: a `[workspace]` here, or a `[patch]` moved out of this manifest,
  // silently reverts Corpán to an ndk-context that aborts on Android Activity
  // recreation — compiling, testing and clippying clean the whole way.
  const manifest = fs.readFileSync(path.join(tauriRoot, "Cargo.toml"), "utf8")
  assert.doesNotMatch(manifest, /^\s*\[workspace\]/m)
  assert.doesNotMatch(manifest, /^\s*\[workspace\./m)
})
