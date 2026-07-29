// The cue table, checked against the native code that has to answer it.
//
// This exists because of a specific, shipped bug: the app asked for haptics
// with `navigator.vibrate`, which is `undefined` in iOS WKWebView, so every cue
// on every iPhone and iPad was a silent no-op — no error, no log, nothing to
// notice except that the app felt dead. A haptic has no return value anyone
// checks, so there is no runtime signal at all. The only things that can catch
// a regression here are the two below: read the native sources and prove the
// styles exist, and read the wiring and prove the grant, the registration and
// the dependency all agree.

import { test } from "node:test"
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

import { fireHaptic, HAPTIC_PATTERN, HAPTIC_STYLE, type HapticPorts, type HapticStyle } from "./haptics.ts"
import type { HapticCue } from "../../../packs/sdk/src/index.ts"

const here = path.dirname(fileURLToPath(import.meta.url))
const tauriRoot = path.resolve(here, "../../src-tauri")
const plugin = path.resolve(here, "../../../../corpan/plugins/tauri-plugin-haptics")

const CUES: readonly HapticCue[] = ["tick", "seat", "settle", "refuse"]

/** A recorder standing in for the two device back-ends. */
function ports(
  overrides: { native?: HapticPorts["native"]; web?: HapticPorts["web"] } = {},
): { ports: HapticPorts; styles: HapticStyle[]; patterns: (number | number[])[] } {
  const styles: HapticStyle[] = []
  const patterns: (number | number[])[] = []
  return {
    styles,
    patterns,
    ports: {
      native:
        overrides.native === undefined
          ? (style) => {
              styles.push(style)
              return Promise.resolve()
            }
          : overrides.native,
      web:
        overrides.web === undefined
          ? (pattern) => {
              patterns.push(pattern)
              return true
            }
          : overrides.web,
    },
  }
}

test("every cue has a style and a fallback pattern", () => {
  for (const cue of CUES) {
    assert.ok(HAPTIC_STYLE[cue], `${cue} has no native style`)
    assert.ok(HAPTIC_PATTERN[cue] !== undefined, `${cue} has no fallback pattern`)
  }
  assert.deepEqual(Object.keys(HAPTIC_STYLE).sort(), [...CUES].sort())
})

test("the mapping is the one that was reasoned about", () => {
  // Pinned, because every one of these is a judgement that can be quietly
  // undone by someone who reads "duration" and reaches for the nearest impact.
  assert.equal(HAPTIC_STYLE.tick, "selection")
  assert.equal(HAPTIC_STYLE.seat, "medium")
  assert.equal(HAPTIC_STYLE.settle, "success")
  assert.equal(HAPTIC_STYLE.refuse, "error")

  // A refusal is not a caution, and a placement is not a refusal. Distinctness
  // is the property that survives someone retuning the individual choices.
  assert.equal(new Set(Object.values(HAPTIC_STYLE)).size, CUES.length)
})

test("every style is an explicit case in the iOS plugin", () => {
  // THE trap. `HapticsPlugin.swift` ends its switch with `default:` → medium
  // impact, on purpose, so a pack cannot crash the app by asking for a feel
  // that does not exist. The cost is that a style this app sends and the
  // plugin does not implement is INDISTINGUISHABLE at runtime from one that
  // works: a `tick` would silently feel like a medium thump forever. Nothing
  // else in this repository compiles Swift, so this reads it.
  const swift = fs.readFileSync(path.join(plugin, "ios/Sources/HapticsPlugin.swift"), "utf8")
  for (const style of new Set(Object.values(HAPTIC_STYLE))) {
    assert.match(
      swift,
      new RegExp(`case "${style}":`),
      `iOS falls through to a medium impact for "${style}" — it has no case`,
    )
  }
  // And the generators are the ones the mapping claims, not three impacts.
  assert.match(swift, /UISelectionFeedbackGenerator\(\)[\s\S]*selectionChanged\(\)/)
  assert.match(swift, /notificationOccurred\(\.error\)/)
  assert.match(swift, /notificationOccurred\(\.success\)/)
})

test("every style is an explicit branch in the Android plugin", () => {
  // Same trap, other platform: Kotlin's `when` has an `else ->` that means
  // medium. Android is where these cues did work, so a silent downgrade here
  // is a regression rather than a gap.
  const kotlin = fs.readFileSync(
    path.join(plugin, "android/src/main/java/com/corpora/haptics/HapticsPlugin.kt"),
    "utf8",
  )
  for (const style of new Set(Object.values(HAPTIC_STYLE))) {
    if (style === "medium") continue // Android's `else ->` branch IS medium, by name.
    assert.match(
      kotlin,
      new RegExp(`"${style}" ->`),
      `Android falls through to medium for "${style}" — it has no branch`,
    )
  }
})

test("a cue reaches the native plugin, not the vibrator, when both exist", () => {
  // Android has both. The plugin is the better path there — it reaches
  // amplitude-controlled effects `navigator.vibrate` cannot express — and it
  // is the ONLY path on iOS, so "native wins" has to hold unconditionally.
  const { ports: p, styles, patterns } = ports()
  for (const cue of CUES) fireHaptic(cue, p)
  assert.deepEqual(styles, ["selection", "medium", "success", "error"])
  assert.deepEqual(patterns, [], "the web fallback fired as well as the plugin")
})

test("without a native bridge the cue falls back to the vibrator", () => {
  // `npm run dev` in a browser, and the pack SDK's standalone harness.
  const { ports: p, patterns } = ports({ native: null })
  for (const cue of CUES) fireHaptic(cue, p)
  assert.deepEqual(patterns, [8, 18, [12, 40, 12], [40, 30, 60]])
})

test("a rejected invoke falls back rather than disappearing", async () => {
  // The shape of a missing capability grant: `invoke` rejects. A cue that ends
  // in an unhandled rejection is both a lost haptic and console noise on the
  // answer path.
  const { ports: p, patterns } = ports({ native: () => Promise.reject(new Error("denied")) })
  fireHaptic("refuse", p)
  await new Promise((resolve) => setImmediate(resolve))
  assert.deepEqual(patterns, [[40, 30, 60]])
})

test("a synchronously throwing bridge falls back too", () => {
  // `invoke` throws rather than rejecting when Tauri's internals are absent.
  const { ports: p, patterns } = ports({
    native: () => {
      throw new TypeError("__TAURI_INTERNALS__ is undefined")
    },
  })
  fireHaptic("tick", p)
  assert.deepEqual(patterns, [8])
})

test("a device with neither back-end is silent, not broken", () => {
  // Desktop. A missing motor is not an error a child should hear about.
  const p: HapticPorts = { native: null, web: null }
  for (const cue of CUES) assert.doesNotThrow(() => fireHaptic(cue, p))
})

test("a throwing vibrator does not reach the pack", () => {
  const { ports: p } = ports({
    native: null,
    web: () => {
      throw new Error("blocked before a gesture")
    },
  })
  assert.doesNotThrow(() => fireHaptic("tick", p))
})

test("the grant, the plugin registration and the dependency all agree", () => {
  // Three files, and any two of them agreeing is not enough:
  //   - registered in Rust but ungranted → the ACL denies the invoke at
  //     runtime, and the fallback hides it (silently, on iOS, forever);
  //   - granted but not registered → the command does not exist;
  //   - either, without the Cargo dependency → it does not compile.
  // Nothing in CI compiles this crate, so this is the check that runs.
  const capability = JSON.parse(
    fs.readFileSync(path.join(tauriRoot, "capabilities/default.json"), "utf8"),
  ) as { permissions: string[] }
  const libRs = fs.readFileSync(path.join(tauriRoot, "src/lib.rs"), "utf8")
  const cargo = fs.readFileSync(path.join(tauriRoot, "Cargo.toml"), "utf8")

  assert.ok(
    capability.permissions.includes("haptics:allow-impact"),
    "capabilities/default.json does not grant haptics:allow-impact",
  )
  assert.match(libRs, /\.plugin\(tauri_plugin_haptics::init\(\)\)/)
  assert.match(cargo, /^tauri-plugin-haptics = \{ path = "(.+)" \}$/m)

  // And the path resolves to the crate, rather than to a directory that used
  // to hold it. A relocation would fail the Rust build — which no CI job runs.
  const dep = /^tauri-plugin-haptics = \{ path = "(.+)" \}$/m.exec(cargo)?.[1] ?? ""
  assert.ok(
    fs.existsSync(path.resolve(tauriRoot, dep, "Cargo.toml")),
    `the plugin path dependency "${dep}" does not point at a crate`,
  )
})
