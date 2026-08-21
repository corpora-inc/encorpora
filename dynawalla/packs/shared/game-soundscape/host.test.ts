import assert from "node:assert/strict"
import { test } from "node:test"

import {
  currentSoundscape,
  onSoundscape,
  resetHostSoundscape,
  setHostSoundscape,
} from "./host.ts"
import { CALM, ROOT_MAX_HZ, ROOT_MIN_HZ, parseSoundscape, pickSoundscape } from "./soundscape.ts"

test("nobody has published one, so a game keeps its own sounds", () => {
  resetHostSoundscape()
  assert.equal(currentSoundscape(), null)
})

test("a published soundscape reaches every listener", () => {
  resetHostSoundscape()
  const seen: (string | null)[] = []
  const off = onSoundscape((s) => seen.push(s?.modeId ?? null))
  const scape = pickSoundscape(17)
  setHostSoundscape(scape)
  assert.deepEqual(currentSoundscape(), scape)
  setHostSoundscape(undefined)
  assert.equal(currentSoundscape(), null)
  off()
  setHostSoundscape(pickSoundscape(18))
  assert.deepEqual(seen, [scape.modeId, null])
  resetHostSoundscape()
})

test("republishing the same soundscape does not retune anybody", () => {
  // The host re-sends `settings` on every change to anything in it, including
  // the ones this module does not care about. Retuning a live drone on a text
  // size change would be audible for no reason.
  resetHostSoundscape()
  let calls = 0
  onSoundscape(() => {
    calls++
  })
  const scape = pickSoundscape(5)
  setHostSoundscape(scape)
  setHostSoundscape({ ...scape })
  assert.equal(calls, 1)
  resetHostSoundscape()
})

test("a listener that throws is loud and does not stop the others", () => {
  resetHostSoundscape()
  const errors: unknown[][] = []
  const original = console.error
  console.error = (...args: unknown[]): void => {
    errors.push(args)
  }
  let reached = false
  try {
    onSoundscape(() => {
      throw new Error("no")
    })
    onSoundscape(() => {
      reached = true
    })
    setHostSoundscape(pickSoundscape(1))
  } finally {
    console.error = original
  }
  assert.ok(reached, "a throwing listener stopped the next one")
  assert.equal(errors.length, 1)
  resetHostSoundscape()
})

test("unsubscribing from inside a callback does not skip the listeners after it", () => {
  // Deleting yourself mid-iteration is safe on a JS Set, so a test that only
  // does that passes against an implementation with no copy at all. The case
  // that is NOT safe is a listener that tears down a sibling — the sibling is
  // still ahead in the iteration and silently never runs, which is a drone left
  // in the old key with nothing in the log.
  resetHostSoundscape()
  let self = 0
  let sibling = 0
  const off = onSoundscape(() => {
    self++
    offSibling()
  })
  const offSibling = onSoundscape(() => {
    sibling++
  })
  setHostSoundscape(pickSoundscape(2))
  assert.equal(self, 1)
  assert.equal(sibling, 1, "a listener was skipped because a sibling unsubscribed mid-publish")
  setHostSoundscape(pickSoundscape(3))
  assert.equal(self, 2)
  assert.equal(sibling, 1)
  off()
  resetHostSoundscape()
})

test("nothing malformed can become a NaN frequency", () => {
  // The failure mode this guard exists for: an oscillator handed NaN throws on
  // start, and the game is silent with nothing in the log.
  assert.equal(parseSoundscape(undefined), null)
  assert.equal(parseSoundscape(null), null)
  assert.equal(parseSoundscape("western.dorian"), null)
  assert.equal(parseSoundscape([]), null)
  assert.equal(parseSoundscape({ modeId: "western.dorian", rootHz: 130, seed: 1 })?.tension, CALM)
  assert.equal(parseSoundscape({ modeId: "nope", rootHz: 130, seed: 1 }), null)
  assert.equal(parseSoundscape({ modeId: "western.dorian", rootHz: Number.NaN, seed: 1 }), null)
  assert.equal(parseSoundscape({ modeId: "western.dorian", rootHz: "130", seed: 1 }), null)
  assert.equal(parseSoundscape({ modeId: "western.dorian", rootHz: 130, seed: Number.NaN }), null)
  // A root far outside the band is a bug or an attack, not a low note.
  assert.equal(parseSoundscape({ modeId: "western.dorian", rootHz: 20000, seed: 1 }), null)
  assert.equal(parseSoundscape({ modeId: "western.dorian", rootHz: 1, seed: 1 }), null)
})

test("a chosen soundscape is inside the chill band and replays exactly", () => {
  for (let seed = 0; seed < 200; seed++) {
    const a = pickSoundscape(seed)
    const b = pickSoundscape(seed)
    assert.deepEqual(a, b)
    assert.ok(
      a.rootHz >= ROOT_MIN_HZ * 0.99 && a.rootHz <= ROOT_MAX_HZ * 1.01,
      `seed ${seed} chose a root at ${a.rootHz} Hz`,
    )
    assert.ok(parseSoundscape(a) !== null, `seed ${seed} chose something the wire would refuse`)
  }
})

test("the roll spreads over the corpus rather than favouring one mode", () => {
  const seen = new Set<string>()
  for (let seed = 0; seed < 400; seed++) seen.add(pickSoundscape(seed).modeId)
  assert.ok(seen.size >= 30, `400 rolls found only ${seen.size} modes`)
})
