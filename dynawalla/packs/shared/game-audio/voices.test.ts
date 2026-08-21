/**
 * The synthesiser, measured rather than described.
 *
 * "Premium and chill" is a claim about numbers — how bright, how loud, how many
 * events — and every one of them is a property of `voiceGrains`, which is pure.
 * So this measures the real frequencies and the real summed peaks a device would
 * produce, with no `AudioContext` anywhere.
 */
import assert from "node:assert/strict"
import test from "node:test"

import { CEILING, MIN_ATTACK } from "./ceiling.ts"
import {
  RUBBLE_CEILING_HZ,
  RUBBLE_GRAINS,
  TONE_CEILING_HZ,
  playVoice,
  voiceBrightestHz,
  voiceGrains,
  voicePeak,
  type PlayableVoice,
  type VoiceTimbre,
} from "./voices.ts"

const TIMBRES: VoiceTimbre[] = ["bell", "pluck", "bloom", "rubble"]

const voice = (timbre: VoiceTimbre, hz = 220, gain = 0.12, seconds = 0.6): PlayableVoice => ({
  hz,
  at: 0,
  seconds,
  gain,
  timbre,
})

test("every timbre costs at least one oscillator and never a silent graph", () => {
  for (const timbre of TIMBRES) {
    const grains = voiceGrains(voice(timbre))
    assert.ok(grains.length >= 1, `${timbre} produced no grains`)
    for (const g of grains) {
      assert.ok(g.peak > 0, `${timbre} scheduled a silent grain`)
      assert.ok(g.hz > 0 && Number.isFinite(g.hz), `${timbre} scheduled ${g.hz} Hz`)
      assert.ok(g.attack >= MIN_ATTACK, `${timbre} onset ${g.attack}s is a step function`)
      assert.ok(g.decay > 0, `${timbre} grain never ends`)
      assert.ok(g.at >= 0, `${timbre} grain starts before the voice does`)
    }
  }
})

test("nothing pitched ever reaches the band the ear is most sensitive in", () => {
  // The whole of what "abrasive" means, and it is a claim about OSCILLATORS:
  // a one-pole low-pass attenuates what is above it rather than removing it, so
  // a bell whose fourth partial sits at 5 kHz is a bright cue however the tone
  // filter is set. The soundscape's own register tops out at 1250 Hz.
  for (const timbre of TIMBRES) {
    for (const hz of [58, 110, 220, 440, 880, 1250]) {
      const top = voiceBrightestHz(voice(timbre, hz))
      assert.ok(top <= TONE_CEILING_HZ, `${timbre} at ${hz} Hz reaches ${top} Hz`)
    }
  }
})

test("a voice too high for its own partials keeps its fundamental", () => {
  // Dropping partials must never drop the note. A voice that made no sound at
  // all would satisfy every "nothing is brighter than" assertion in this file.
  for (const timbre of TIMBRES) {
    const grains = voiceGrains(voice(timbre, 4000))
    assert.ok(grains.length >= 1, `${timbre} at 4 kHz was silenced entirely`)
    assert.ok(grains.some((g) => g.peak > 0), `${timbre} at 4 kHz is silent`)
  }
})

test("a collapse is masonry: many graded impacts, staggered, and low", () => {
  // The founder's complaint, as a measurement. A noise burst is ONE event with
  // no size to it; this is sixteen with a power-law size distribution.
  const grains = voiceGrains(voice("rubble", 70, 0.13, 1.2))
  assert.equal(grains.length, RUBBLE_GRAINS)
  const onsets = new Set(grains.map((g) => Math.round(g.at * 1000)))
  assert.ok(onsets.size >= RUBBLE_GRAINS - 1, "the whole building landed in one instant")
  for (let i = 1; i < grains.length; i++) {
    const prev = grains[i - 1]
    const cur = grains[i]
    assert.ok(prev && cur)
    assert.ok(cur.peak < prev.peak, `grain ${i} is not smaller than grain ${i - 1}`)
    assert.ok(cur.hz >= prev.hz, `grain ${i} is not higher than grain ${i - 1}`)
  }
  for (const g of grains) {
    assert.ok(g.hz <= RUBBLE_CEILING_HZ, `a grain at ${g.hz} Hz is above the rubble ceiling`)
    assert.ok(g.glideTo < g.hz, "a grain that does not fall is a tone, not a stone")
  }
})

test("a rubble cloud stays low however high it is asked for", () => {
  // The cap matters: the pitch comes from the walker, and a walker in the top
  // band would otherwise put sixteen grains at 8 kHz.
  for (const hz of [58, 130, 400, 1250]) {
    for (const g of voiceGrains(voice("rubble", hz))) {
      assert.ok(g.hz <= RUBBLE_CEILING_HZ, `${hz} Hz produced a grain at ${g.hz} Hz`)
    }
  }
})

test("no voice can peak above the fleet's output ceiling", () => {
  // The summed instantaneous peak, not the gain that was asked for: a pitched
  // voice's partials all start together and their sum is what is heard.
  for (const timbre of TIMBRES) {
    const peak = voicePeak(voice(timbre, 220, 0.14))
    assert.ok(peak > 0, `${timbre} is silent`)
    assert.ok(peak < CEILING, `${timbre} peaks at ${peak.toFixed(3)}, above the ceiling ${CEILING}`)
    // And it is genuinely quiet, not merely legal: a single cue an order of
    // magnitude under full scale is what "not too loud" means.
    assert.ok(peak <= 0.2, `${timbre} peaks at ${peak.toFixed(3)}, which is not chill`)
  }
})

test("a staggered collapse is quieter than the sum of its grains", () => {
  // Why `voicePeak` integrates rather than adding: sixteen grains summing
  // naively to 0.4 actually peak far lower, because they do not overlap.
  const v = voice("rubble", 70, 0.13, 1.2)
  const naive = voiceGrains(v).reduce((a, g) => a + g.peak, 0)
  const real = voicePeak(v)
  assert.ok(real < naive * 0.75, `${real.toFixed(3)} vs a naive ${naive.toFixed(3)}`)
})

test("the voice budget's scale is honoured, and zero builds nothing", () => {
  const v = voice("bell")
  assert.ok(voicePeak(v, 0.5) < voicePeak(v, 1), "halving the scale did not halve the voice")
  const ctx = recordingContext()
  playVoice(ctx, ctx.destination, v, 0)
  assert.equal(ctx.oscillators.length, 0, "a spent budget still built oscillators")
})

test("playVoice routes every oscillator to the destination it was given", () => {
  const ctx = recordingContext()
  playVoice(ctx, ctx.destination, voice("bell"))
  assert.ok(ctx.oscillators.length >= 2, "a bell with one partial is a test tone")
  assert.ok(ctx.filters.length === 1, "each voice gets exactly one tone filter")
  assert.ok(ctx.filters[0]?.reaches(ctx.destination), "the voice does not reach the destination")
  for (const o of ctx.oscillators) {
    assert.ok(o.started, "an oscillator was built and never started")
    assert.ok(o.stopped, "an oscillator was built and never stopped")
  }
})

test("playVoice schedules a whole collapse from one clock read", () => {
  const ctx = recordingContext()
  ctx.currentTime = 12.5
  playVoice(ctx, ctx.destination, voice("rubble", 70, 0.13, 1.2))
  assert.equal(ctx.oscillators.length, RUBBLE_GRAINS)
  for (const o of ctx.oscillators) assert.ok(o.startAt >= 12.5, "a grain was scheduled in the past")
})

/* ------------------------------------------------------------------ doubles */

type FakeOsc = { started: boolean; stopped: boolean; startAt: number }

function recordingContext(): {
  currentTime: number
  destination: AudioNode
  oscillators: FakeOsc[]
  filters: Array<{ reaches: (n: unknown) => boolean }>
  createGain(): GainNode
  createOscillator(): OscillatorNode
  createBiquadFilter(): BiquadFilterNode
} {
  const oscillators: FakeOsc[] = []
  const filters: Array<{ reaches: (n: unknown) => boolean }> = []
  const dest = {} as AudioNode
  const param = (): AudioParam =>
    ({
      value: 0,
      setValueAtTime: () => undefined,
      exponentialRampToValueAtTime: () => undefined,
      linearRampToValueAtTime: () => undefined,
    }) as unknown as AudioParam
  return {
    currentTime: 0,
    destination: dest,
    oscillators,
    filters,
    createGain: () =>
      ({ gain: param(), connect: () => undefined }) as unknown as GainNode,
    createOscillator: () => {
      const rec: FakeOsc = { started: false, stopped: false, startAt: 0 }
      oscillators.push(rec)
      return {
        type: "sine",
        frequency: param(),
        connect: () => undefined,
        start: (t: number) => {
          rec.started = true
          rec.startAt = t
        },
        stop: () => {
          rec.stopped = true
        },
      } as unknown as OscillatorNode
    },
    createBiquadFilter: () => {
      const outs: unknown[] = []
      filters.push({ reaches: (n) => outs.includes(n) })
      return {
        type: "lowpass",
        frequency: { value: 0 },
        Q: { value: 0 },
        connect: (n: unknown) => {
          outs.push(n)
        },
      } as unknown as BiquadFilterNode
    },
  }
}
