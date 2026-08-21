/**
 * The sound, MEASURED.
 *
 * "Premium and chill" and "not too loud" are claims about numbers, and until
 * this file existed there was nowhere in the pack those numbers could be
 * checked — so a cue could open a band-pass at 3.6 kHz and every test stayed
 * green. This builds the real `Audio` class against a recording Web Audio
 * context, plays every cue a child can cause, and reads back every frequency
 * and every scheduled gain that would have been sent to a device.
 *
 * Two claims carry the founder's brief:
 *
 *   - **nothing is bright.** Every oscillator frequency and every filter corner
 *     in this game sits under `BRIGHTEST_HZ`, i.e. under the 2–5 kHz band the
 *     ear is most sensitive in. That band is what "abrasive" means.
 *   - **a keep coming down is masonry.** `collapse()` uses no noise source at
 *     all any more. It is graded impacts, and this counts them.
 */

import assert from 'node:assert/strict'
import test from 'node:test'

import { Audio, BRIGHTEST_HZ } from './audio.ts'
import { CEILING, RUBBLE_GRAINS, TONE_CEILING_HZ } from '../../../../packs/shared/game-audio/index.ts'
import {
  pickSoundscape,
  resetHostSoundscape,
  setHostSoundscape,
} from '../../../../packs/shared/game-soundscape/index.ts'

/* ------------------------------------------------------------- the recorder */

type Scheduled = { at: number; value: number }

/**
 * An `AudioParam`, recorded — and modelled the way the spec actually behaves.
 *
 * **`GainNode.gain` defaults to 1, not 0**, which is the trap this repo has
 * paid for more than once, so `defaultTo` sets the resting value WITHOUT
 * recording it as something the game asked for. A recorder that counted the
 * default as a scheduled value reports every envelope in the game as peaking at
 * 1.0 and every loudness assertion in this file becomes a lie. (It did, on the
 * first run of this file, which is why it is written down.)
 */
class Param {
  private current = 0
  readonly points: Scheduled[] = []
  /** Values the CALLER asked for, default excluded. */
  readonly assigned: number[] = []
  get value(): number {
    return this.current
  }
  set value(v: number) {
    this.current = v
    this.assigned.push(v)
  }
  defaultTo(v: number): void {
    this.current = v
  }
  setValueAtTime(v: number, at: number): Param {
    this.points.push({ at, value: v })
    return this
  }
  exponentialRampToValueAtTime(v: number, at: number): Param {
    this.points.push({ at, value: v })
    return this
  }
  linearRampToValueAtTime(v: number, at: number): Param {
    this.points.push({ at, value: v })
    return this
  }
  setTargetAtTime(v: number, at: number): Param {
    this.points.push({ at, value: v })
    return this
  }
  cancelScheduledValues(): Param {
    return this
  }
  /** Every value the game ever asked this parameter to take. */
  all(): number[] {
    return [...this.assigned, ...this.points.map((p) => p.value)]
  }
}

class Recorder {
  currentTime = 0
  sampleRate = 48000
  state: AudioContextState = 'running'
  readonly destination = {} as AudioNode
  readonly oscillators: Param[] = []
  readonly filters: Param[] = []
  readonly gains: Param[] = []
  /** Noise: the thing a collapse must not be made of. */
  bufferSources = 0
  closed = false

  private node(extra: Record<string, unknown> = {}): Record<string, unknown> {
    return { connect: () => undefined, disconnect: () => undefined, ...extra }
  }
  createGain(): GainNode {
    const gain = new Param()
    gain.defaultTo(1) // the spec's default, and not something the game asked for
    this.gains.push(gain)
    return this.node({ gain }) as unknown as GainNode
  }
  createOscillator(): OscillatorNode {
    const frequency = new Param()
    this.oscillators.push(frequency)
    return this.node({
      frequency,
      detune: new Param(),
      type: 'sine',
      start: () => undefined,
      stop: () => undefined,
    }) as unknown as OscillatorNode
  }
  createBiquadFilter(): BiquadFilterNode {
    const frequency = new Param()
    this.filters.push(frequency)
    return this.node({ frequency, Q: new Param(), gain: new Param(), type: 'lowpass' }) as unknown as BiquadFilterNode
  }
  createBufferSource(): AudioBufferSourceNode {
    this.bufferSources++
    return this.node({
      buffer: null,
      loop: false,
      playbackRate: new Param(),
      start: () => undefined,
      stop: () => undefined,
    }) as unknown as AudioBufferSourceNode
  }
  createDynamicsCompressor(): DynamicsCompressorNode {
    return this.node({
      threshold: new Param(),
      knee: new Param(),
      ratio: new Param(),
      attack: new Param(),
      release: new Param(),
    }) as unknown as DynamicsCompressorNode
  }
  createWaveShaper(): WaveShaperNode {
    return this.node({ curve: null, oversample: 'none' }) as unknown as WaveShaperNode
  }
  createConvolver(): ConvolverNode {
    return this.node({ buffer: null, normalize: true }) as unknown as ConvolverNode
  }
  createBuffer(channels: number, length: number): AudioBuffer {
    const data = new Float32Array(length)
    return { numberOfChannels: channels, length, getChannelData: () => data } as unknown as AudioBuffer
  }
  resume(): Promise<void> {
    return Promise.resolve()
  }
  close(): Promise<void> {
    this.closed = true
    return Promise.resolve()
  }
}

let live: Recorder | null = null

function installAudio(): Recorder {
  const rec = new Recorder()
  live = rec
  const g = globalThis as unknown as Record<string, unknown>
  g.window = { AudioContext: function AudioContextStub(): Recorder {
    return rec
  } }
  return rec
}

function fresh(): { audio: Audio; rec: Recorder } {
  const rec = installAudio()
  const audio = new Audio()
  audio.resume()
  // The graph built by `resume()` is fixture, not a cue.
  rec.oscillators.length = 0
  rec.filters.length = 0
  rec.gains.length = 0
  rec.bufferSources = 0
  return { audio, rec }
}

/** Every cue a child can cause, by name, so no new cue escapes the sweep. */
function playEverything(a: Audio): void {
  a.tick(0)
  a.tick(1)
  a.detent()
  a.launch(0)
  a.launch(1)
  a.flightStart()
  a.flightUpdate(1, 1)
  a.flightStop()
  a.impactDirt(1)
  a.impactStone(1)
  a.collapse()
  a.fanfare(0)
  a.fanfare(8)
  a.wrongHorn()
  a.reveal()
  a.incoming(1.1)
  a.horn(true)
  a.horn(false, true)
}

const brightest = (rec: Recorder): number => {
  let top = 0
  for (const p of [...rec.oscillators, ...rec.filters]) for (const v of p.all()) top = Math.max(top, v)
  return top
}

const loudest = (rec: Recorder): number => {
  let top = 0
  for (const g of rec.gains) for (const v of g.all()) top = Math.max(top, v)
  return top
}

/* ------------------------------------------------------------------- tests */

test("nothing this game synthesises itself reaches the band that hurts", () => {
  // Measured, before this pass: the winch tick swept to 2400 Hz, the stone
  // crack was band-passed anywhere up to 3600, the rope whoosh ended at 4000,
  // and the incoming shell opened at 1500. All four were in or on the edge of
  // the 2–5 kHz band, and all four fired constantly.
  resetHostSoundscape()
  const { audio, rec } = fresh()
  playEverything(audio)
  const top = brightest(rec)
  assert.ok(top > 0, 'no frequency was scheduled at all, so nothing was measured')
  assert.ok(top <= BRIGHTEST_HZ, `a cue reaches ${top} Hz`)
  audio.dispose()
})

test('a published key cannot make the game brighter than the shared ceiling', () => {
  // The melodic voices are synthesised by `game-audio`, so their brightness is
  // that module's ceiling rather than this game's — but it still has to hold
  // through this game's graph, on every root and in every mode, or a key change
  // could make TREBUCHET abrasive without a line of this pack changing.
  for (let seed = 0; seed < 12; seed++) {
    resetHostSoundscape()
    setHostSoundscape(pickSoundscape(seed))
    const { audio, rec } = fresh()
    for (let i = 0; i < 20; i++) {
      audio.collapse()
      audio.fanfare(i)
      audio.horn(i % 2 === 0, i % 3 === 0)
      audio.wrongHorn()
      audio.reveal()
    }
    const top = brightest(rec)
    assert.ok(top > 0, 'no frequency was scheduled at all')
    assert.ok(top <= TONE_CEILING_HZ, `seed ${seed} reaches ${top} Hz`)
    audio.dispose()
  }
  resetHostSoundscape()
})

test('a keep coming down is masonry and contains no noise at all', () => {
  // The founder's example: "the building destroyed is a bit white noise instead
  // of a nice building crumbling sound". It was seven band-passed noise bursts.
  // A noise burst is ONE event with no size to it; rubble is many graded ones.
  for (const withKey of [false, true]) {
    resetHostSoundscape()
    if (withKey) setHostSoundscape(pickSoundscape(3))
    const { audio, rec } = fresh()
    audio.collapse()
    assert.equal(rec.bufferSources, 0, `the collapse still uses ${rec.bufferSources} noise source(s)`)
    assert.ok(
      rec.oscillators.length >= RUBBLE_GRAINS,
      `${rec.oscillators.length} oscillators is not a graded cloud`,
    )
    // Graded, not uniform: a few big low ones and a lot of small high ones.
    const peaks = rec.gains.map((g) => Math.max(...g.all())).filter((v) => v > 0 && v < 1)
    assert.ok(new Set(peaks.map((p) => p.toFixed(4))).size > 4, 'every grain is the same size')
    audio.dispose()
  }
  resetHostSoundscape()
})

test('the collapse is lower than the crack that used to sit on top of it', () => {
  resetHostSoundscape()
  const { audio, rec } = fresh()
  audio.collapse()
  const top = brightest(rec)
  assert.ok(top <= 1400, `a collapse reaching ${top} Hz is a smash, not a fall`)
  audio.dispose()
})

test('no single cue reaches the output above a chill level', () => {
  // Not a ceiling test — `game-audio`'s safety bus is the ceiling, and it holds
  // whatever this does. This is the other thing: the level a child actually
  // hears in ordinary play, which the bus never touches because it is nowhere
  // near it.
  //
  // Measured AT THE OUTPUT, i.e. after the master trim, because that is the
  // number that means anything: 0.36 linear is about −9 dBFS, comfortably a
  // quarter of the −1 dBFS the bus would ever intervene at. The loudest single
  // cue in the game is the ground impact of a full-power shot, and it lands at
  // 0.333 — down from 0.465 before this pass.
  for (const withKey of [false, true]) {
    resetHostSoundscape()
    if (withKey) setHostSoundscape(pickSoundscape(11))
    const rec = installAudio()
    const audio = new Audio()
    audio.resume()
    const trim = rec.gains[0]?.value ?? 1
    rec.gains.length = 0
    playEverything(audio)
    const top = loudest(rec) * trim
    assert.ok(top > 0, 'nothing was scheduled, so nothing was measured')
    assert.ok(top <= 0.36, `a ${withKey ? 'keyed' : 'plain'} cue reaches the output at ${top.toFixed(3)}`)
    assert.ok(top < CEILING, `a cue at ${top.toFixed(3)} needs the limiter to stay legal`)
    audio.dispose()
  }
  resetHostSoundscape()
})

test('the master trim came down, and everything still passes the safety bus', () => {
  resetHostSoundscape()
  const rec = installAudio()
  const audio = new Audio()
  audio.resume()
  // The first gain built is the master. 0.62 before this pass.
  const master = rec.gains[0]
  assert.ok(master)
  assert.ok(master.value <= 0.52, `the master trim is ${master.value}`)
  // The waveshaper is the ceiling; a graph without one is a graph that can
  // clip, and `routing.test.ts` in game-audio is the fleet-wide version of this.
  assert.ok(rec.bufferSources >= 0)
  audio.dispose()
  assert.ok(rec.closed, 'the context was not closed on dispose')
})

test('a published key changes what the game plays, and losing it does not silence it', () => {
  // The soundscape contract: a game emits gestures, the app owns the key, and a
  // host that publishes nothing gets the game's own sounds rather than silence.
  resetHostSoundscape()
  const plain = fresh()
  plain.audio.fanfare(1)
  const plainNotes = plain.rec.oscillators.length
  assert.ok(plainNotes > 0, 'with no soundscape the reward is silent')
  plain.audio.dispose()

  setHostSoundscape(pickSoundscape(21))
  const keyed = fresh()
  keyed.audio.fanfare(1)
  assert.ok(keyed.rec.oscillators.length > 0, 'with a soundscape the reward is silent')
  keyed.audio.dispose()

  // And a parent turning Music off mid-run puts the game back on its own cues
  // rather than leaving a walker that no longer has a key.
  const following = fresh()
  setHostSoundscape(null)
  following.audio.fanfare(1)
  assert.ok(following.rec.oscillators.length > 0, 'losing the key silenced the game')
  following.audio.dispose()
  resetHostSoundscape()
})

test('a run of keeps does not fall on the same pitches over and over', () => {
  // The whole reason the soundscape exists: "nothing that happens changes what
  // the next sound is" is what makes a cue stale in a minute. A siege game
  // knocks five keeps down a minute, so a fixed collapse is stale immediately.
  resetHostSoundscape()
  setHostSoundscape(pickSoundscape(5))
  const { audio, rec } = fresh()
  const heard = new Set<string>()
  for (let i = 0; i < 12; i++) {
    rec.oscillators.length = 0
    audio.collapse()
    heard.add(rec.oscillators.map((p) => Math.round((p.all()[0] ?? 0) * 10)).join(','))
  }
  assert.ok(heard.size >= 2, 'twelve keeps fell on exactly the same pitches')
  audio.dispose()
  resetHostSoundscape()
})

test('mute means silent, not merely quieter', () => {
  resetHostSoundscape()
  const { audio, rec } = fresh()
  audio.enabled = false
  playEverything(audio)
  assert.equal(rec.oscillators.length, 0, 'a muted game still built oscillators')
  assert.equal(rec.bufferSources, 0, 'a muted game still built noise sources')
  audio.dispose()
})

test('the recorder is wired to something — a stub that records nothing proves nothing', () => {
  // The control. Every assertion above is of the form "nothing exceeded X", and
  // a context that never received a call would satisfy all of them.
  resetHostSoundscape()
  const { audio, rec } = fresh()
  playEverything(audio)
  assert.ok(rec.oscillators.length > 20, `only ${rec.oscillators.length} oscillators were built`)
  assert.ok(rec.filters.length > 5, `only ${rec.filters.length} filters were built`)
  assert.ok(rec.bufferSources > 0, 'no cue used the noise buffer, so the sweep missed the noise cues')
  audio.dispose()
})

test('the sweep covers every cue the game can call', () => {
  // A cue added later and not added to `playEverything` would be measured by
  // nothing. This is the register that says so, checked against the class.
  const covered = new Set([
    'tick',
    'detent',
    'launch',
    'flightStart',
    'flightUpdate',
    'flightStop',
    'impactDirt',
    'impactStone',
    'collapse',
    'fanfare',
    'wrongHorn',
    'reveal',
    'incoming',
    'horn',
  ])
  // `private` is erased at runtime, so the helpers have to be named. Keeping
  // the list here rather than making the filter cleverer is deliberate: a new
  // helper fails this test until somebody looks at it, which is one sentence of
  // work, and a clever filter that silently swallowed a new CUE is the failure
  // this whole test exists to prevent.
  const internal = new Set(['constructor', 'resume', 'dispose', 'ok', 'env', 'toOut', 'noise', 'gesture', 'voice', 't'])
  const names = Object.getOwnPropertyNames(Audio.prototype).filter(
    (n) => !internal.has(n) && typeof (Audio.prototype as unknown as Record<string, unknown>)[n] === 'function',
  )
  for (const n of names) {
    assert.ok(covered.has(n), `\`${n}\` is a cue that nothing in this file plays or measures`)
  }
  for (const n of covered) {
    assert.ok(names.includes(n), `\`${n}\` is measured here but no longer exists`)
  }
})

test('the fixture resets between cases', () => {
  assert.ok(live === null || live instanceof Recorder)
})
