// The app's key, attacked.
//
// Two failures are being kept out, and they pull in opposite directions:
//
//   *the bazaar changes key at every doorway* — every pack, or every mount, or
//   every settings push drawing its own soundscape. That is not a soundscape,
//   it is twenty-eight ringtones, and it is the failure the whole design exists
//   to prevent.
//
//   *the bazaar never changes key* — one mode for the life of the app, which is
//   the founder's "we don't want it stale and repetitive" arriving by a
//   different road.
//
// So nearly everything here is about *when* the key is allowed to move, and the
// assertions are made against the value a pack would actually receive — through
// `packSettings`, and then through the same validator the pack side runs — so a
// key that is chosen correctly and then dropped on the way to the wire fails.

import { test } from "node:test"
import assert from "node:assert/strict"

import {
  ROTATION_MS,
  claimSoundscape,
  epochSeed,
  releaseSoundscape,
  resetAppSoundscape,
  soundscapeForPack,
  type Soundscape,
} from "./soundscape.ts"
import { packSettings, type SettingsInput } from "../packs/services.ts"
import { DEFAULT_SETTINGS, type Settings as HostSettings } from "../settings/store.ts"
import {
  CALM,
  MODE_IDS,
  ROOT_MAX_HZ,
  ROOT_MIN_HZ,
  parseSoundscape,
} from "../../../packs/shared/game-soundscape/index.ts"

/** A doorway: one named pack, mounted at a wall-clock instant. */
function doorway(at: number, packId = "dw.a"): Soundscape {
  return soundscapeForPack(packId, at)
}

/** A pack mounted and then left again, which is what lets the next one rotate. */
function visit(at: number, packId: string): Soundscape {
  const scape = soundscapeForPack(packId, at)
  claimSoundscape(packId)
  releaseSoundscape(packId)
  return scape
}

/** What `Stage` hands `packSettings`, with everything but the settings pinned. */
function input(settings: Partial<HostSettings>, soundscape: Soundscape): SettingsInput {
  return {
    settings: { ...DEFAULT_SETTINGS, ...settings },
    theme: "light",
    systemPrefersDark: false,
    safeArea: { top: 0, right: 0, bottom: 0, left: 0 },
    soundscape,
  }
}

const T0 = 1_700_000_000_000

test("the app publishes a key, and it is one the pack side accepts", () => {
  resetAppSoundscape(4242)
  const chosen = doorway(T0)
  const wire = packSettings(input({}, chosen)).soundscape

  // Not merely present: run it through the *pack's* validator, which is what
  // actually decides whether a game hears music or falls back. A rootHz outside
  // the band, an unknown mode id or a non-finite seed all parse to `null`, and
  // the pack would go quiet-ish with nothing in any log to say why.
  const parsed = parseSoundscape(wire)
  assert.notEqual(parsed, null, "the host published something the pack refuses")
  assert.deepEqual(parsed, chosen, "what the pack parsed is not what the app chose")

  assert.ok(MODE_IDS.includes(chosen.modeId), `${chosen.modeId} is not in the corpus`)
  // The root band is what puts the ceiling on the music: the melody's brightest
  // register is root x 8, so a root outside this is an abrasive top end.
  assert.ok(
    chosen.rootHz >= ROOT_MIN_HZ / 2 && chosen.rootHz <= ROOT_MAX_HZ * 2,
    `root ${chosen.rootHz} Hz is outside the band the pack will accept`,
  )
})

test("it starts chill, because that is what was asked for", () => {
  resetAppSoundscape(11)
  assert.equal(doorway(T0).tension, CALM)
})

test("two doorways inside the window are the same key — the bazaar does not change at a door", () => {
  resetAppSoundscape(7)
  const first = visit(T0, "dw.steelyard")
  // A child leaves THE STEELYARD and opens THE LATTICE a minute later. Two
  // different packs, two different mounts of `Stage`, one key.
  const second = visit(T0 + 60_000, "dw.lattice")
  const third = visit(T0 + ROTATION_MS - 1, "dw.colossus")
  assert.deepEqual(second, first, "the second pack opened in a different key")
  assert.deepEqual(third, first, "the key moved before the window was up")

  // And the thing a pack is actually handed is the same object of numbers, so
  // the drone does not retune on the way through the wire either.
  assert.deepEqual(
    packSettings(input({}, third)).soundscape,
    packSettings(input({}, first)).soundscape,
  )
})

test("mounting the same pack twice does not change the key", () => {
  // React's `useState` initialiser is invoked twice under StrictMode, and a
  // remount after a failed entry fetch is a second real doorway. Neither may
  // move the app.
  resetAppSoundscape(99)
  const once = doorway(T0, "dw.steelyard")
  assert.deepEqual(doorway(T0, "dw.steelyard"), once)
  assert.deepEqual(doorway(T0, "dw.steelyard"), once)
})

test("the key CANNOT move under a child, whatever the clock says", () => {
  // The failure this is the guard for, and the reason the guard is in the module
  // rather than in `Stage`: `packSettings` re-runs on every settings push — a
  // parent moving the text size slider while a child plays — and the host used
  // to be protected only by having remembered to pin the value in `useState`.
  // A refactor that inlined the draw back into the memo would rotate the key
  // mid-question, under a playing child, with the drone sliding under the plate
  // they are holding, and no test in this repository renders `Stage` to notice.
  //
  // So the invariant belongs to `soundscapeForPack`: the pack that owns the key
  // gets it back, however many times it asks and however long it has been.
  resetAppSoundscape(5)
  const STEELYARD = "dw.counterweight"
  const opened = soundscapeForPack(STEELYARD, T0)
  claimSoundscape(STEELYARD)

  // Ten rotation windows of play, and a settings push at each one asking again.
  for (let window = 1; window <= 10; window++) {
    const asked = soundscapeForPack(STEELYARD, T0 + window * ROTATION_MS)
    assert.deepEqual(asked, opened, `the key rotated ${window} windows into a session`)
    assert.deepEqual(
      packSettings(input({ textSize: window % 2 ? "largest" : "normal" }, asked)).soundscape,
      opened,
      "the pack was handed a different key mid-session",
    )
  }

  // Leaving is what lets it move. Without this the guard would be a freeze.
  releaseSoundscape(STEELYARD)
  assert.notDeepEqual(
    soundscapeForPack("dw.lattice", T0 + 11 * ROTATION_MS),
    opened,
    "the key never moved again after one pack had held it",
  )
})

test("replaying one game is still a doorway, once you have left it", () => {
  // The other side of the ownership guard, and the failure it would otherwise
  // be: a child who plays THE STEELYARD, leaves, and opens it again is at a
  // doorway like any other. If leaving did not give the key back, the pack id
  // would still match on the way in and that child would hear one mode for the
  // rest of the day — the guard turned into a freeze.
  resetAppSoundscape(21)
  const STEELYARD = "dw.counterweight"
  const first = soundscapeForPack(STEELYARD, T0)
  claimSoundscape(STEELYARD)
  assert.deepEqual(
    soundscapeForPack(STEELYARD, T0 + 2 * ROTATION_MS),
    first,
    "the key moved while the game was still open",
  )
  releaseSoundscape(STEELYARD)
  assert.notDeepEqual(
    soundscapeForPack(STEELYARD, T0 + 2 * ROTATION_MS),
    first,
    "a child replaying one game heard the same key forever",
  )
})

test("packSettings is a pure function of what it is handed — it reads no clock", () => {
  // The other half of the same guarantee, and the cheapest way to measure it:
  // take the clock away. Anything on this path that reads one throws.
  resetAppSoundscape(5)
  const pinned = doorway(T0)
  const real = Date.now
  Date.now = () => {
    throw new Error("packSettings read the wall clock")
  }
  try {
    assert.deepEqual(packSettings(input({ textSize: "normal" }, pinned)).soundscape, pinned)
    assert.deepEqual(packSettings(input({ textSize: "largest" }, pinned)).soundscape, pinned)
  } finally {
    Date.now = real
  }
})

test("a clock that is not a number does not move the key", () => {
  // A guard that pinned `since` at zero would read as protection and would in
  // fact rotate the key at every doorway from then on, forever.
  resetAppSoundscape(77)
  const first = visit(T0, "dw.a")
  assert.deepEqual(visit(Number.NaN, "dw.b"), first, "a NaN clock rotated the key")
  assert.deepEqual(visit(T0 + 1000, "dw.c"), first, "a NaN clock poisoned the window")
})

test("a doorway after the window is a new key, and never the same mode twice running", () => {
  resetAppSoundscape(123)
  const heard: Soundscape[] = []
  let at = T0
  for (let i = 0; i < 200; i++) {
    heard.push(visit(at, `dw.${i}`))
    at += ROTATION_MS
  }
  assert.equal(heard.length, 200)
  for (let i = 1; i < heard.length; i++) {
    const before = heard[i - 1]
    const now = heard[i]
    assert.ok(before && now)
    assert.notEqual(
      now.modeId,
      before.modeId,
      `rotation ${i} repeated ${before.modeId} — a repeat is exactly the "stale and repetitive"`,
    )
  }
})

test("the variety is real: many modes, and every family the corpus has", () => {
  resetAppSoundscape(31337)
  const modes = new Set<string>()
  const roots = new Set<number>()
  let at = T0
  for (let i = 0; i < 200; i++) {
    const scape = visit(at, `dw.${i}`)
    modes.add(scape.modeId)
    roots.add(Math.round(scape.rootHz * 100))
    at += ROTATION_MS
  }
  // 38 modes, 200 draws with no immediate repeats. Anything much under this is
  // a mixing function handing back a handful of keys forever.
  assert.ok(modes.size >= 30, `only ${modes.size} distinct modes in 200 rotations`)
  assert.ok(roots.size >= 20, `only ${roots.size} distinct roots in 200 rotations`)
  const families = new Set([...modes].map((id) => id.split(".")[0]))
  assert.deepEqual(
    [...families].sort(),
    ["maqam", "thaat", "western"],
    "a whole family of the corpus is unreachable",
  )
})

test("every launch starts somewhere else", () => {
  // The least-engaged child plays for ninety seconds and closes the app. If the
  // key were a function of the epoch alone, that child would hear one mode for
  // the life of the tablet.
  const first: Soundscape[] = []
  for (let seed = 0; seed < 40; seed++) {
    resetAppSoundscape(seed)
    first.push(doorway(T0))
  }
  const distinct = new Set(first.map((s) => `${s.modeId}@${Math.round(s.rootHz * 100)}`))
  assert.ok(distinct.size >= 30, `40 launches produced only ${distinct.size} distinct keys`)

  // And the mixing is the reason, not luck: the seed a launch derives for its
  // first key must depend on the launch.
  assert.notEqual(epochSeed(1, 0), epochSeed(2, 0))
  assert.notEqual(epochSeed(1, 0), epochSeed(1, 1), "two epochs of one launch share a seed")
  assert.notEqual(epochSeed(1, 0, 0), epochSeed(1, 0, 1), "a re-draw would draw the same key")
})

test("a clock that jumps backwards rotates once and then settles", () => {
  // A device whose time was corrected, or a WebView restored from a snapshot.
  // The failure to avoid is pinning the app in one key until the wall clock
  // catches up, which for a year-wrong clock is forever.
  resetAppSoundscape(64)
  const back = T0 - 90 * 24 * 60 * 60 * 1000
  const before = visit(T0, "dw.a")
  const after = visit(back, "dw.b")
  assert.notDeepEqual(after, before, "a backwards clock froze the key")
  assert.deepEqual(visit(back + 1000, "dw.c"), after, "the key kept moving after the clock settled")
})

test("music off keeps a pack's own sounds — it does not silence the pack", () => {
  resetAppSoundscape(8)
  const chosen = doorway(T0)
  const off = packSettings(input({ music: false }, chosen))

  // Absent, not `undefined`-valued: absent is what a host too old to know about
  // soundscapes sends, and the pack side already reads that as "keep your own
  // sounds". A new spelling of "off" would be a second code path.
  assert.equal("soundscape" in off, false, "music off still put a key on the wire")
  assert.equal(parseSoundscape(off.soundscape), null)

  // The part that makes it "keep your own sounds" rather than "go quiet": the
  // pack is still allowed to make noise, and its own fixed cues are what it
  // falls back to.
  assert.equal(off.sound, true, "turning music off silenced the pack")

  // And it is reversible without a remount — the same channel re-fires.
  const on = packSettings(input({ music: true }, chosen))
  assert.deepEqual(parseSoundscape(on.soundscape), chosen)
})

test("sound off publishes no key at all", () => {
  resetAppSoundscape(9)
  const chosen = doorway(T0)
  const settings = packSettings(input({ sound: false }, chosen))
  assert.equal(settings.sound, false)
  assert.equal("soundscape" in settings, false, "a silent tablet was still told a key")
})
