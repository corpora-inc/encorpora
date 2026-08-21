// THE AUDIO GRAPH, DRIVEN THROUGH A FAKE CONTEXT.
//
// Web Audio has one trap that this pack has already been bitten by elsewhere in the
// fleet and that no amount of listening finds reliably:
//
//   **`GainNode.gain` defaults to 1.**
//
// A gain node created and connected but never set is not "neutral" — it is unity,
// which at the point in this graph where the octave joins the fundamental is the
// whole of the fundamental's level again, as a bare octave, on every strike. It
// does not throw, it does not warn, and on a laptop speaker it sounds like the
// timbre simply got harsher. On a child's headphones it is a different instrument.
//
// So this file plays every voice into a recording context and asserts that no gain
// node is ever left at its default. Found by mutation: deleting the
// `overtoneGain.gain.setValueAtTime(...)` line left the entire suite green.

import assert from "node:assert/strict"
import { test } from "node:test"

import { Audio, VOICE_POOL, voiceCount, voiceFor } from "./audio.ts"
import { OUTCOMES } from "../game/response.ts"

type Recorded = { set: boolean; ramps: number[] }

function fakeAudio(): { ctx: unknown; gains: Recorded[]; count: () => number } {
  const gains: Recorded[] = []
  let oscillators = 0
  const node = () => ({ connect: (next: unknown) => next })
  const ctx = {
    currentTime: 0,
    state: "running",
    createGain: () => {
      const rec: Recorded = { set: false, ramps: [] }
      gains.push(rec)
      const schedule = (v: number): void => {
        rec.set = true
        rec.ramps.push(v)
      }
      return {
        gain: {
          value: 1,
          setValueAtTime: schedule,
          exponentialRampToValueAtTime: schedule,
          linearRampToValueAtTime: schedule,
          cancelScheduledValues: () => undefined,
        },
        ...node(),
      }
    },
    createOscillator: () => {
      oscillators += 1
      return {
        type: "sine",
        frequency: { setValueAtTime: () => undefined, exponentialRampToValueAtTime: () => undefined },
        start: () => undefined,
        stop: () => undefined,
        ...node(),
      }
    },
    createDynamicsCompressor: () => ({
      threshold: { value: 0 },
      knee: { value: 0 },
      ratio: { value: 1 },
      attack: { value: 0 },
      release: { value: 0 },
      ...node(),
    }),
    createWaveShaper: () => ({ curve: null, oversample: "none", ...node() }),
    createBiquadFilter: () => ({
      type: "peaking",
      frequency: { value: 0 },
      Q: { value: 0 },
      gain: { value: 0 },
      ...node(),
    }),
    destination: {},
    resume: () => Promise.resolve(),
    close: () => Promise.resolve(),
  }
  // A closure, not a snapshot: `oscillators` is a number, and returning it by
  // value hands the caller the count as it was BEFORE anything played — which is
  // always zero, and which makes every assertion built on it vacuous.
  return { ctx, gains, count: () => oscillators }
}

/**
 * Play something into a recording context and report only what THAT made.
 *
 * The master bus and the shared safety bus are built first and are excluded by
 * baseline rather than by index: several of their gains are pass-throughs at
 * unity by design, and a test that could not tell those from a voice envelope
 * would be asserting the shared module's business, not this file's.
 */
function play(fn: (audio: Audio) => void): { gains: Recorded[]; oscillators: number } {
  const fake = fakeAudio()
  const previous = globalThis.AudioContext
  ;(globalThis as unknown as { AudioContext: unknown }).AudioContext = function Ctor() {
    return fake.ctx
  }
  try {
    const audio = new Audio()
    // Builds the context and the safety bus, so everything after this is ours.
    audio.resume()
    const baseline = fake.gains.length
    fn(audio)
    return { gains: fake.gains.slice(baseline), oscillators: fake.count() }
  } finally {
    ;(globalThis as unknown as { AudioContext: unknown }).AudioContext = previous
  }
}

test("NO GAIN NODE IS EVER LEFT AT ITS DEFAULT OF 1", () => {
  // The trap in one line. An unset gain is not neutral, it is unity — and at the
  // point where the octave joins the fundamental, unity is the whole fundamental
  // again as a bare octave, on every strike, in every voice.
  for (const outcome of OUTCOMES) {
    // `lapse` builds no graph at all and must not: a tone at the end of a window a
    // child was still thinking through is a buzzer aimed at slowness.
    for (let voice = 0; voice < voiceCount(outcome); voice++) {
      const { gains } = play((audio) => {
        audio.outcome(outcome, voice)
      })
      assert.ok(gains.length > 0, `${outcome} voice ${String(voice)} built no graph at all`)
      for (const [i, gain] of gains.entries()) {
        assert.ok(
          gain.set,
          `${outcome} voice ${String(voice)}: gain node ${String(i)} was never set — it is playing at unity`,
        )
      }
    }
  }
  for (const fn of [(a: Audio) => a.cue(), (a: Audio) => a.over()] as const) {
    const { gains } = play(fn)
    assert.ok(gains.length > 0)
    for (const [i, gain] of gains.entries()) {
      assert.ok(gain.set, `gain node ${String(i)} was never set`)
    }
  }
})

test("the overtone is a quiet colour, never a second fundamental", () => {
  // The same trap, from the other side: every voice's `bright` must be well under
  // unity, or the "quieter triangle octave" in the docblock is a lie.
  for (const pool of Object.values(VOICE_POOL)) {
    for (const voice of pool) {
      assert.ok(voice.bright > 0, `a silent overtone is not a mallet: ${voice.degrees.join(",")}`)
      assert.ok(voice.bright < 0.5, `an overtone at ${String(voice.bright)} is a second fundamental`)
    }
  }
})

test("every voice actually strikes, and a silent outcome touches nothing", () => {
  for (const outcome of OUTCOMES) {
    const voices = voiceCount(outcome)
    if (voices === 0) {
      const { oscillators } = play((audio) => {
        audio.outcome(outcome, 0)
      })
      assert.equal(oscillators, 0, `${outcome} made a sound and must not`)
      continue
    }
    for (let v = 0; v < voices; v++) {
      const voice = voiceFor(outcome, v)
      assert.ok(voice)
      const { oscillators } = play((audio) => {
        audio.outcome(outcome, v)
      })
      // Two oscillators per strike: the sine body and its triangle octave.
      assert.equal(
        oscillators,
        voice.degrees.length * 2,
        `${outcome} voice ${String(v)} struck ${String(oscillators / 2)} of ${String(voice.degrees.length)} notes`,
      )
    }
  }
})

test("a voice index out of range wraps rather than going silent", () => {
  // `flourish.ts` draws the index and `audio.ts` is handed it. A future change to
  // either pool size must not be able to produce a silent celebration.
  for (const outcome of OUTCOMES) {
    if (voiceCount(outcome) === 0) continue
    for (const index of [-3, -1, 0, 1, 99]) {
      assert.ok(voiceFor(outcome, index), `${outcome} went silent at index ${String(index)}`)
    }
  }
})
