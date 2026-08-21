// The soundscape, as THE STEELYARD hears it.
//
// The claim being settled here is the founder's: that a run of `+1`s should be
// a little song rather than the same ding ten times. It is settled by playing
// the strikes a *correct* player actually makes — `planStrikes` is this game's
// optimal player — through the shared soundscape and looking at what comes out.
// No `AudioContext` is involved: `tune.ts` and `game-soundscape` are pure, which
// is the whole reason they are separate files from `audio.ts`.

import assert from "node:assert/strict"
import { readFileSync, readdirSync, statSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { test } from "node:test"

import {
  MELODY_MAX_HZ,
  MELODY_MIN_HZ,
  Melody,
  currentSoundscape,
  modeOf,
  pickSoundscape,
  centsBetween,
} from "../../../../packs/shared/game-soundscape/index.ts"
import { PLACES, planStrikes, type Strike } from "../game/places.ts"
import { PLACE_WEIGHT, gestureForStrike } from "../tune.ts"

const SRC = fileURLToPath(new URL("..", import.meta.url))

test("the rack is weighted from lightest to heaviest, with nothing missed", () => {
  const weights = PLACES.map((p) => PLACE_WEIGHT[p])
  assert.equal(weights.length, PLACES.length)
  assert.equal(new Set(weights).size, PLACES.length, "two pillars share a register")
  assert.equal(PLACE_WEIGHT[1], 0, "the ones plate should be the brightest")
  assert.equal(PLACE_WEIGHT[1000], 1, "the thousands plate should be the heaviest")
  for (const w of weights) assert.ok(w >= 0 && w <= 1)
})

test("a blow carries its direction and its heaviness and nothing else", () => {
  const on = gestureForStrike({ place: 10, dir: 1 })
  assert.deepEqual(on, { kind: "step", direction: 1, weight: PLACE_WEIGHT[10] })
  const off = gestureForStrike({ place: 1000, dir: -1 })
  assert.deepEqual(off, { kind: "step", direction: -1, weight: 1 })
  // The thing that must never appear in a gesture: a frequency.
  assert.ok(!Object.keys(on).includes("hz"))
})

test("doing the arithmetic right sounds like a phrase, not like one note ten times", () => {
  // 142 is the delta from the README's worked example — a pan on 500 and a lot
  // that needs 642. `planStrikes` is the balanced-base-ten path a child who has
  // worked it out actually takes: one hundred, four tens, two ones.
  const strikes = planStrikes(142)
  assert.ok(strikes.length >= 7, `the worked example is only ${strikes.length} blows`)
  for (let seed = 0; seed < 40; seed++) {
    const scape = pickSoundscape(seed)
    const melody = new Melody(scape)
    const heard: number[] = []
    for (const strike of strikes) {
      for (const v of melody.emit(gestureForStrike(strike))) heard.push(v.hz)
    }
    assert.equal(heard.length, strikes.length, "a blow did not make a sound")
    assert.ok(
      new Set(heard.map((f) => Math.round(f * 100))).size >= 4,
      `seed ${seed}: the whole plan produced ${new Set(heard).size} distinct pitches`,
    )
    // And it is a phrase in the mode, not just a set of different numbers.
    const degrees = new Set(modeOf(scape).degrees.map((c) => Math.round(c * 1000)))
    for (const f of heard) {
      const within = Math.round(((((centsBetween(scape.rootHz, f) % 1200) + 1200) % 1200) * 1000))
      assert.ok(degrees.has(within), `${f.toFixed(2)} Hz is not in ${scape.modeId}`)
    }
  }
})

test("the ten-less-two shortcut sounds like a turn, not like more of the same", () => {
  // Going from 613 to 621: one on the tens and two OFF the ones. The two
  // take-offs must descend the mode, because that is what makes trimming a pan
  // audibly different from loading it — the property the fixed table could not
  // express at all, since it played the identical tick either way.
  const strikes = planStrikes(8)
  assert.deepEqual(
    strikes.map((s) => [s.place, s.dir]),
    [
      [10, 1],
      [1, -1],
      [1, -1],
    ],
  )
  let turns = 0
  for (let seed = 0; seed < 60; seed++) {
    const melody = new Melody(pickSoundscape(seed))
    const positions: number[] = []
    for (const strike of strikes) {
      melody.emit(gestureForStrike(strike))
      positions.push(melody.position)
    }
    const [a, b, c] = positions
    assert.ok(a !== undefined && b !== undefined && c !== undefined)
    if (b < a && c < b) turns++
  }
  assert.ok(turns >= 55, `the trim descended in only ${turns} of 60 soundscapes`)
})

test("place value is still a thing you can hear", () => {
  // The property the game already had and must not lose: the ones plate is a
  // bright tick and the thousands plate is a low clang. It is now register
  // rather than a fixed frequency, so it survives every mode and every root.
  let ordered = 0
  for (let seed = 0; seed < 100; seed++) {
    const scape = pickSoundscape(seed)
    const pitches = PLACES.map((place) => {
      const melody = new Melody(scape)
      const strike: Strike = { place, dir: 1 }
      return melody.emit(gestureForStrike(strike))[0]?.hz ?? 0
    })
    // PLACES is heaviest-first, so this should be ascending.
    let rising = true
    for (let i = 1; i < pitches.length; i++) {
      if ((pitches[i] ?? 0) <= (pitches[i - 1] ?? 0)) rising = false
    }
    if (rising) ordered++
    for (const f of pitches) assert.ok(f >= MELODY_MIN_HZ && f <= MELODY_MAX_HZ)
  }
  assert.ok(ordered >= 95, `the rack was in register order in only ${ordered} of 100 soundscapes`)
})

test("nothing in the shipped pack turns the soundscape on", () => {
  // The ship gate, asserted rather than intended. `currentSoundscape()` is
  // `null` until something publishes one; the dev harness (`main.ts`, which
  // `pack.html` does not load) is the only file allowed to. If a second one
  // appears, this pack has started shipping a behaviour change that nobody
  // decided to make.
  assert.equal(currentSoundscape(), null, "something in this suite left a soundscape published")
  const offenders: string[] = []
  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir)) {
      const full = path.join(dir, entry)
      if (statSync(full).isDirectory()) {
        if (entry !== "test") walk(full)
        continue
      }
      if (!entry.endsWith(".ts")) continue
      if (full === path.join(SRC, "main.ts")) continue
      if (readFileSync(full, "utf8").includes("setHostSoundscape")) offenders.push(full)
    }
  }
  walk(SRC)
  assert.deepEqual(offenders, [], "these files publish a soundscape into the shipped pack")
})
