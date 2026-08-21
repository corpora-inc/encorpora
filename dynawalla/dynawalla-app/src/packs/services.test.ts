// The settings gate, attacked.
//
// `settings.haptics` is a switch a parent can reach, and a switch that only
// silences one of two platforms is not a switch. There is exactly one line
// enforcing it — `if (current.haptics)` in `services.ts` — so these tests are
// the only thing that keeps it there, and they check both back-ends
// independently: a gate that stops the plugin but not the vibrator would be
// silent on iOS and buzzing on Android, which is precisely the class of split
// this change exists to end.

import { test } from "node:test"
import assert from "node:assert/strict"

import { createServices } from "./services.ts"
import type { HapticPorts, HapticStyle } from "./haptics.ts"
import type { OrientationSource } from "./orientation.ts"
import type { HapticCue, Settings } from "../../../packs/sdk/src/index.ts"

const CUES: readonly HapticCue[] = ["tick", "seat", "settle", "refuse"]

/** Which pack asked. Carried by every host call; irrelevant to the gate. */
const PACK = "dw.test"

/** A device with no sensor. `orientation.test.ts` is where the real one is driven. */
const NO_SENSOR: OrientationSource = { available: false, start: async () => null }

const SETTINGS = (haptics: boolean): Settings => ({
  locale: "en",
  reducedMotion: false,
  quality: "high",
  textScale: 1,
  colorScheme: "light",
  sound: true,
  haptics,
  safeArea: { top: 0, right: 0, bottom: 0, left: 0 },
})

function recorder(): { ports: HapticPorts; fired: (HapticStyle | number | number[])[] } {
  const fired: (HapticStyle | number | number[])[] = []
  return {
    fired,
    ports: {
      native: (style) => {
        fired.push(style)
        return Promise.resolve()
      },
      web: (pattern) => {
        fired.push(pattern)
        return true
      },
    },
  }
}

/** A fresh session. `profileId` is unique per test so no storage is shared. */
function session(profileId: string, haptics: boolean) {
  const { ports, fired } = recorder()
  const launch = createServices({ profileId, settings: SETTINGS(haptics), haptics: ports, orientation: NO_SENSOR })
  return { launch, fired }
}

test("haptics on: every cue reaches a back-end", async () => {
  const { launch, fired } = session("p-on", true)
  for (const cue of CUES) await launch.services.haptic({ packId: PACK, cue })
  assert.deepEqual(fired, ["selection", "medium", "success", "error"])
})

test("haptics off: no cue reaches either back-end", async () => {
  const { launch, fired } = session("p-off", false)
  for (const cue of CUES) await launch.services.haptic({ packId: PACK, cue })
  assert.deepEqual(fired, [], "the settings toggle did not silence the haptics")
})

test("the toggle silences a pack that is already running", async () => {
  // `push` replaces the settings of a mounted pack without remounting it. A
  // gate reading the launch-time settings would keep buzzing until the child
  // quit the game — which is what a parent turning it off is trying to stop.
  const { launch, fired } = session("p-mid", true)
  await launch.services.haptic({ packId: PACK, cue: "tick" })
  assert.deepEqual(fired, ["selection"])

  launch.push(SETTINGS(false))
  for (const cue of CUES) await launch.services.haptic({ packId: PACK, cue })
  assert.deepEqual(fired, ["selection"], "a cue fired after haptics were turned off")
})

test("the toggle turns them back on without a remount", async () => {
  const { launch, fired } = session("p-back", false)
  await launch.services.haptic({ packId: PACK, cue: "refuse" })
  assert.deepEqual(fired, [])

  launch.push(SETTINGS(true))
  await launch.services.haptic({ packId: PACK, cue: "refuse" })
  assert.deepEqual(fired, ["error"])
})

test("haptics off silences the vibrator too, not just the plugin", async () => {
  // The gate has to sit above the choice of back-end. One that sat below it
  // would silence iOS and leave Android buzzing.
  const fired: (number | number[])[] = []
  const ports: HapticPorts = {
    native: null,
    web: (pattern) => {
      fired.push(pattern)
      return true
    },
  }
  const launch = createServices({
    profileId: "p-web",
    settings: SETTINGS(false),
    haptics: ports,
    orientation: NO_SENSOR,
  })
  for (const cue of CUES) await launch.services.haptic({ packId: PACK, cue })
  assert.deepEqual(fired, [])

  launch.push(SETTINGS(true))
  await launch.services.haptic({ packId: PACK, cue: "seat" })
  assert.deepEqual(fired, [18])
})

test("the settings a pack is told about report the toggle honestly", async () => {
  // A pack may draw its own affordance from `settings.haptics`. If the host
  // silenced cues but still reported `true`, the pack would show a control
  // that does nothing.
  const { launch } = session("p-report", false)
  assert.equal((await launch.services.settings()).haptics, false)
  launch.push(SETTINGS(true))
  assert.equal((await launch.services.settings()).haptics, true)
})
