// Asset-free Web Audio. No files, no decode, nothing on the answer path.
//
// The one voice that matters is the **bowed drone**: a sawtooth through a
// narrow band-pass, the note a heavy steel bar makes when it is under load.
// Its pitch tracks the tilt of the beam — flat and low at dead level, rising as
// your side goes down. So the beam is audible as well as visible, which is what
// lets a child find the tipping point with their eyes on the rack.
//
// It is deliberately quiet and deliberately narrow in range. A drone that swept
// an octave would be a siren; this one moves about a major third across the
// whole of the beam's travel, which is enough to hear and not enough to nag.
//
// The strikes are pitched **by place**: the ones plate is a small bright tick
// and the thousands plate is a low, heavy clang. Place value is a thing you can
// hear here, and a child working the rack learns the four voices before they
// could tell you why.
//
// ── The soundscape ───────────────────────────────────────────────────────────
//
// All of the above was true and still boring, and the founder said so: *"right
// now [we] have the same sound for every +1/−1 … it would be way cooler if it
// randomly played a melody based on the randomly chosen soundscape for any
// given moment."* He is right, and the reason is not the timbre. It is that
// `PLACE_HZ` is a fixed table, so the tenth blow on the ones plate is bit-for-
// bit the first one. Nothing that happens changes what the next sound is.
//
// So when the app publishes a soundscape — a mode, a root and a seed — this
// class stops reading `PLACE_HZ` and starts asking `packs/shared/game-soundscape`
// what the next note is. Hanging brass walks the mode up, taking it off walks
// it down, place buys register instead of a fixed frequency, and a run of blows
// arcs and comes to rest like a phrase. The drone becomes the soundscape's own
// root, so the melody cannot be out of tune with it: both are the same number.
//
// **Dynawalla's app publishes one**, so inside it the plates play a phrase. Two
// other callers do not, and both are ordinary rather than exceptional: a host
// older than the field, and a parent who has turned the app's Music switch off.
// For them `currentSoundscape()` is `null`, none of the above happens, and the
// four fixed pitches below are the sound — "keep your own sounds", never "go
// quiet". The dev harness (`main.ts`) publishes its own, which is where a
// specific mode and root can be pinned and heard on demand.

import { type Place, type Strike } from "./game/places.ts"
import { createSafetyBus, safeAttack } from "../../../packs/shared/game-audio/index.ts"
import {
  Melody,
  currentSoundscape,
  onSoundscape,
  type Gesture,
  type Voice,
} from "../../../packs/shared/game-soundscape/index.ts"
import { gestureForStrike } from "./tune.ts"

type Ctor = new () => AudioContext

/** Where the drone sits at dead level, and how far the tilt moves it. */
const DRONE_HZ = 116
const DRONE_SPAN = 0.28

const PLACE_HZ: Record<Place, number> = { 1: 1180, 10: 830, 100: 520, 1000: 288 }

/**
 * How far the beam's bow may bend the drone when a soundscape is live, in cents.
 *
 * Thirty-five, which is a third of a semitone: audible as a bowed string
 * leaning under pressure, and far too small to be heard as a different note.
 * The old behaviour moved the drone a major third across the beam's travel,
 * which is fine when the drone is the only pitched thing in the game and
 * ruinous when it is the tonic the melody is being derived from — a tonic that
 * slides is a melody that goes out of tune with itself.
 */
const BOW_BEND_CENTS = 35

export class Audio {
  private ctx: AudioContext | null = null
  private master: GainNode | null = null
  private droneOsc: OscillatorNode | null = null
  private droneBand: BiquadFilterNode | null = null
  private droneGain: GainNode | null = null
  private failed = false
  /**
   * The soundscape's melody walker, or `null` when no host has published one.
   *
   * `null` means every method below takes the path this game always took: the
   * four fixed pitches in `PLACE_HZ` and a drone that transposes. That is what
   * a dev harness with no host, a host older than the field, and a parent who
   * has turned the app's Music switch off all get. Dynawalla's app publishes
   * one, so inside it this is a `Melody` and the plates play a phrase.
   */
  private melody: Melody | null = null
  /** The drone's fixed anchor voices — the sub-octave and, if the mode has one, the fifth. */
  private anchors: OscillatorNode[] = []
  private readonly unfollow: () => void

  constructor() {
    const scape = currentSoundscape()
    this.melody = scape ? new Melody(scape) : null
    // Following, not reading once: the host re-publishes on every settings
    // change, and a game that only looked at launch would be in last hour's key.
    this.unfollow = onSoundscape((next) => {
      if (!next) this.melody = null
      else if (this.melody) this.melody.retune(next)
      else this.melody = new Melody(next)
      // A live drone has to move to the new root, or the melody is in one key
      // and the thing under it is in another. Rebuilt rather than ramped: the
      // bow is a half-second fade either way and a key change is not a slide.
      //
      // **Losing the soundscape rebuilds it too**, and that is not symmetry for
      // its own sake. The anchors this.bow() adds — the sub-octave and the
      // mode's fifth — only exist when there is a melody, and nothing else ever
      // stops them: a parent turning the app's Music switch off mid-round would
      // otherwise leave two sines ringing at the old root while `track()` walks
      // the bowed voice back to the fixed DRONE_HZ and the plates go back to
      // their fixed pitches over the top. That is a semitone-off cluster for
      // the rest of the round, produced by a switch whose whole job is to make
      // the game sound like it did before.
      if (this.droneOsc) {
        this.release()
        this.bow()
      }
    })
  }

  private context(): AudioContext | null {
    if (this.ctx || this.failed) return this.ctx
    const g = globalThis as unknown as { AudioContext?: Ctor; webkitAudioContext?: Ctor }
    const Ctx = g.AudioContext ?? g.webkitAudioContext
    if (!Ctx) {
      this.failed = true
      return null
    }
    try {
      const ctx = new Ctx()
      const master = ctx.createGain()
      master.gain.value = 0.5
      // The last thing between this game and a child's ears. Everything the
      // pack makes now passes a limiter and a hard -1 dBFS ceiling instead of
      // going straight to the output. See packs/shared/game-audio/.
      const safety = createSafetyBus(ctx)
      master.connect(safety.input)
      this.ctx = ctx
      this.master = master
      return ctx
    } catch (error) {
      // Loud, never silent. A yard with no sound is playable; a yard that threw
      // on the first tap and swallowed it is a bug nobody finds.
      console.warn("[counterweight] no audio context", error)
      this.failed = true
      return null
    }
  }

  /** Web Audio needs a gesture. The first strike is the first gesture there is. */
  resume(): void {
    const ctx = this.context()
    if (!ctx) return
    if (ctx.state !== "suspended") return
    void ctx.resume().catch((error: unknown) => {
      // Loud, never silent. This runs at most once a session — after the first
      // gesture the context is running — so a warning here is a real signal that
      // the yard is about to be played in silence, not noise.
      console.warn("[counterweight] the audio context would not resume", error)
    })
  }

  /** The pitch the bowed drone sits on: the soundscape's tonic, or the old fixed note. */
  private droneHz(): number {
    return this.melody?.soundscape.rootHz ?? DRONE_HZ
  }

  /** Bring the drone up. Called when a round opens. */
  bow(): void {
    const ctx = this.context()
    if (!ctx || !this.master || this.droneOsc) return
    const root = this.droneHz()
    const osc = ctx.createOscillator()
    osc.type = "sawtooth"
    osc.frequency.value = root
    const band = ctx.createBiquadFilter()
    band.type = "bandpass"
    band.frequency.value = root * 3
    band.Q.value = 5.5
    const gain = ctx.createGain()
    gain.gain.value = 0
    gain.gain.linearRampToValueAtTime(0.075, ctx.currentTime + 0.5)
    osc.connect(band)
    band.connect(gain)
    gain.connect(this.master)
    osc.start()
    this.droneOsc = osc
    this.droneBand = band
    this.droneGain = gain

    // The anchor. The bowed voice above bends with the beam; these do not, and
    // that is what the melody is actually in tune with. Sines, well under the
    // bow, because a drone you notice is a drone that is too loud.
    if (!this.melody) return
    const pitches = this.melody.drone()
    for (let i = 0; i < pitches.length; i++) {
      const f = pitches[i]
      // Skip the tonic itself: the bowed voice is already there and doubling it
      // exactly would only make it louder.
      if (f === undefined || Math.abs(f - root) < 0.01) continue
      const anchor = ctx.createOscillator()
      anchor.type = "sine"
      anchor.frequency.value = f
      const level = ctx.createGain()
      level.gain.value = 0
      level.gain.linearRampToValueAtTime(f < root ? 0.05 : 0.028, ctx.currentTime + 1.2)
      anchor.connect(level)
      level.connect(gain)
      anchor.start()
      this.anchors.push(anchor)
    }
  }

  /**
   * The drone follows the beam.
   *
   * `tilt` is −1..1 and `ring` is 0..1: a beam still travelling opens the filter
   * so the note goes bright and unsettled, and a beam that has come to rest
   * closes it back down. That is the settle cue, and it arrives before the eye
   * gets there.
   */
  track(tilt: number, ring: number): void {
    const ctx = this.ctx
    if (!ctx || !this.droneOsc || !this.droneBand || !this.droneGain) return
    const t = ctx.currentTime
    const clamped = Math.max(-1, Math.min(1, tilt))
    const root = this.droneHz()
    // With a soundscape live the bow BENDS rather than transposes: the tonic is
    // what the melody is derived from, and a tonic that slides a major third is
    // a melody that is out of tune with the game it is in. A third of a
    // semitone still reads as the steel leaning under load, which is all the
    // cue was ever for.
    const hz = this.melody
      ? root * Math.pow(2, (clamped * BOW_BEND_CENTS) / 1200)
      : root * (1 + clamped * DRONE_SPAN)
    this.droneOsc.frequency.setTargetAtTime(hz, t, 0.06)
    this.droneBand.frequency.setTargetAtTime(hz * (2.4 + ring * 4.5), t, 0.05)
    this.droneGain.gain.setTargetAtTime(0.06 + ring * 0.045, t, 0.08)
  }

  /** Stop bowing. */
  release(): void {
    const ctx = this.ctx
    const osc = this.droneOsc
    const gain = this.droneGain
    if (!ctx || !osc || !gain) return
    this.droneOsc = null
    this.droneBand = null
    this.droneGain = null
    const t = ctx.currentTime
    gain.gain.cancelScheduledValues(t)
    gain.gain.setTargetAtTime(0, t, 0.09)
    const anchors = this.anchors
    this.anchors = []
    for (const anchor of [osc, ...anchors]) {
      try {
        anchor.stop(t + 0.5)
      } catch {
        // Loud, never silent: an oscillator that refuses to stop is a drone that
        // outlives the round it belongs to, and two of them is the game in two
        // keys at once.
        console.warn("[counterweight] the drone would not stop")
      }
    }
  }

  /** A plate lands. Pitched by place; harder blows bite harder. */
  clang(strike: Strike, impulse: number): void {
    const ctx = this.context()
    if (!ctx || !this.master) return
    const t = ctx.currentTime
    const bite = Math.max(0, Math.min(1, (impulse - 2) / 9))

    // With a soundscape live the plate is a note in a phrase rather than a
    // fixed pitch. The metallic edge below still fires and still scales with
    // the blow, so a mashed rack still sounds like a mashed rack — the strain
    // feedback the game depends on is untouched. Only the pitch became music.
    if (this.melody) {
      let top = this.melody.soundscape.rootHz * 4
      for (const voice of this.melody.emit(gestureForStrike(strike))) {
        this.play(voice, 1 + bite * 0.3)
        top = voice.hz
      }
      // The edge rides the note the soundscape chose, not a fixed frequency, so
      // the bite belongs to the plate that was struck instead of sitting on top
      // of the music at a pitch nothing else in the game is at.
      this.edge(top, bite, t)
      return
    }

    const hz = PLACE_HZ[strike.place]

    const osc = ctx.createOscillator()
    osc.type = "triangle"
    osc.frequency.setValueAtTime(hz * (1.3 + bite * 0.4), t)
    osc.frequency.exponentialRampToValueAtTime(hz, t + 0.05)
    const gain = ctx.createGain()
    gain.gain.setValueAtTime(0.0001, t)
    gain.gain.exponentialRampToValueAtTime(0.16 + bite * 0.12, t + 0.006)
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.22 + bite * 0.2)
    osc.connect(gain)
    gain.connect(this.master)
    osc.start(t)
    osc.stop(t + 0.5)

    this.edge(hz, bite, t)
  }

  /**
   * The metallic edge: a short burst through a high band-pass. A resonant blow
   * gets more of it, so mashing sounds like what it is.
   *
   * Lifted out of `clang` so the soundscape path keeps it. This is the part of
   * the cue that reports on the child's *hands* rather than on the maths, and
   * losing it would have made a mashed rack sound the same as a considered one.
   */
  private edge(hz: number, bite: number, t: number): void {
    const ctx = this.ctx
    if (!ctx || !this.master) return
    const noise = ctx.createOscillator()
    noise.type = "square"
    noise.frequency.setValueAtTime(hz * 3.7, t)
    const band = ctx.createBiquadFilter()
    band.type = "bandpass"
    band.frequency.value = hz * 3.4
    band.Q.value = 2.2
    const edge = ctx.createGain()
    edge.gain.setValueAtTime(0.0001, t)
    edge.gain.exponentialRampToValueAtTime(0.02 + bite * 0.07, t + 0.004)
    edge.gain.exponentialRampToValueAtTime(0.0001, t + 0.09)
    noise.connect(band)
    band.connect(edge)
    edge.connect(this.master)
    noise.start(t)
    noise.stop(t + 0.15)
  }

  /** A refused strike: the plate is still swinging. A dead, unmusical thud. */
  refuse(): void {
    if (this.speak({ kind: "refuse" })) return
    const ctx = this.context()
    if (!ctx || !this.master) return
    const t = ctx.currentTime
    const osc = ctx.createOscillator()
    osc.type = "sine"
    osc.frequency.setValueAtTime(88, t)
    const gain = ctx.createGain()
    gain.gain.setValueAtTime(0.0001, t)
    gain.gain.exponentialRampToValueAtTime(0.05, t + 0.005)
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.07)
    osc.connect(gain)
    gain.connect(this.master)
    osc.start(t)
    osc.stop(t + 0.12)
  }

  /**
   * Brass sliding on the pan: the weigh-master laying out a fresh set, or a lot
   * going back on the barrow. A tiny descending tick, and never a buzzer.
   *
   * Was `sag()`, for a pan that drained under a child who stopped to think. That
   * behaviour is gone; the sound was worth keeping.
   */
  slide(): void {
    if (this.speak({ kind: "arrive" })) return
    const ctx = this.context()
    if (!ctx || !this.master) return
    const t = ctx.currentTime
    const osc = ctx.createOscillator()
    osc.type = "sine"
    osc.frequency.setValueAtTime(420, t)
    osc.frequency.exponentialRampToValueAtTime(300, t + 0.1)
    const gain = ctx.createGain()
    gain.gain.setValueAtTime(0.0001, t)
    gain.gain.exponentialRampToValueAtTime(0.035, t + 0.01)
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.14)
    osc.connect(gain)
    gain.connect(this.master)
    osc.start(t)
    osc.stop(t + 0.2)
  }

  /** A good weight: a cold, clean fifth. The best sound in the game. */
  held(): void {
    if (this.speak({ kind: "success" })) return
    this.chord([784, 1176], 0.1, 0.5)
  }

  /** The docket is refused. Low, short, not cruel. */
  lost(): void {
    if (this.speak({ kind: "failure" })) return
    this.chord([196, 233], 0.085, 0.32)
  }

  /** The steel lets go. */
  shear(): void {
    const ctx = this.context()
    if (!ctx || !this.master) return
    const t = ctx.currentTime
    const osc = ctx.createOscillator()
    osc.type = "sawtooth"
    osc.frequency.setValueAtTime(760, t)
    osc.frequency.exponentialRampToValueAtTime(74, t + 0.42)
    const gain = ctx.createGain()
    gain.gain.setValueAtTime(0.0001, t)
    gain.gain.exponentialRampToValueAtTime(0.19, t + 0.008)
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.6)
    osc.connect(gain)
    gain.connect(this.master)
    osc.start(t)
    osc.stop(t + 0.7)
  }

  /** A scale is cleared. */
  fanfare(): void {
    if (this.speak({ kind: "levelComplete" })) return
    this.chord([523, 659, 784], 0.09, 0.85)
    const ctx = this.ctx
    if (!ctx) return
    globalThis.setTimeout(() => this.chord([659, 784, 1046], 0.085, 0.9), 190)
  }

  /**
   * Say something to the soundscape, and report whether it answered.
   *
   * `false` when no host has published one, which is every call in production
   * today — and is exactly what makes each caller above a two-line change with
   * the old cue still underneath it.
   */
  private speak(gesture: Gesture): boolean {
    if (!this.melody) return false
    if (!this.context()) return false
    for (const voice of this.melody.emit(gesture)) this.play(voice, 1)
    return true
  }

  /**
   * One voice from the soundscape, made audible.
   *
   * This is the whole of what the pack owns: the module decided *which* pitch
   * and *how loud*, and this decides what it is made of. Four timbres, all
   * warm-ended, none of them white noise.
   *
   * Every envelope goes through `safeAttack`, so nothing here can be the 1 ms
   * step that a child hears as "too loud" however short the module asked for.
   */
  private play(voice: Voice, scale: number): void {
    const ctx = this.ctx
    if (!ctx || !this.master) return
    if (voice.timbre === "rubble") {
      this.rubble(voice)
      return
    }
    const t = ctx.currentTime + Math.max(0, voice.at)
    const peak = Math.max(0.0002, voice.gain * scale)
    // Attacks, by timbre. Bloom is bowed and must never be a transient; bell
    // and pluck are struck and are still four times slower than the 1 ms step
    // this fleet used to write.
    const attack = safeAttack(voice.timbre === "bloom" ? 0.18 : voice.timbre === "pluck" ? 0.01 : 0.014)

    // A fundamental plus one partial. The partial is what makes it a struck
    // object rather than a test tone, and it is an octave rather than an
    // inharmonic ratio because inharmonic is the sound the founder is calling
    // abrasive.
    const partials: readonly { ratio: number; level: number; type: OscillatorType }[] =
      voice.timbre === "bloom"
        ? [
            { ratio: 1, level: 0.62, type: "sine" },
            { ratio: 2.001, level: 0.2, type: "sine" },
          ]
        : voice.timbre === "pluck"
          ? [
              { ratio: 1, level: 0.7, type: "triangle" },
              { ratio: 3, level: 0.12, type: "sine" },
            ]
          : [
              { ratio: 1, level: 0.68, type: "triangle" },
              { ratio: 2, level: 0.22, type: "sine" },
              { ratio: 4, level: 0.06, type: "sine" },
            ]

    // One low-pass over the whole voice, so the top of the register is not the
    // brightest thing in the game. 2.4 kHz is under the band the ear is most
    // sensitive in, which is the band "abrasive" lives in.
    const tone = ctx.createBiquadFilter()
    tone.type = "lowpass"
    tone.frequency.value = Math.min(2400, voice.hz * 6)
    tone.Q.value = 0.7
    tone.connect(this.master)

    for (const partial of partials) {
      const osc = ctx.createOscillator()
      osc.type = partial.type
      osc.frequency.value = voice.hz * partial.ratio
      const gain = ctx.createGain()
      gain.gain.setValueAtTime(0.0001, t)
      gain.gain.exponentialRampToValueAtTime(peak * partial.level, t + attack)
      gain.gain.exponentialRampToValueAtTime(0.0001, t + voice.seconds)
      osc.connect(gain)
      gain.connect(tone)
      osc.start(t)
      osc.stop(t + voice.seconds + 0.1)
    }
  }

  /**
   * A shelf of brass going over — the founder's "building crumbling here
   * instead of white noise".
   *
   * A noise burst is one event with no size to it, which is why it reads as a
   * hiss rather than as a thing. Rubble is *many* small impacts whose sizes
   * follow a power law: a few big low ones, a lot of small high ones, scattered
   * unevenly over a third of a second. That distribution is the difference
   * between "static" and "masonry", and it costs sixteen short oscillators.
   *
   * Every grain is band-passed and none of them is above 1.4 kHz, so the whole
   * event sits below the band that hurts.
   */
  private rubble(voice: Voice): void {
    const ctx = this.ctx
    if (!ctx || !this.master) return
    const t0 = ctx.currentTime + Math.max(0, voice.at)
    const grains = 16
    const shelf = ctx.createBiquadFilter()
    shelf.type = "lowpass"
    shelf.frequency.value = 1400
    shelf.Q.value = 0.6
    shelf.connect(this.master)
    for (let i = 0; i < grains; i++) {
      // Size, 1 down to about 1/16. Amplitude goes with size and pitch goes
      // inversely with it — a small stone is quiet and high, a big one is loud
      // and low, which is the whole of why this sounds like rubble.
      const size = 1 / (1 + i)
      const at = t0 + (i / grains) * voice.seconds * (0.5 + ((i * 7919) % 100) / 200)
      const osc = ctx.createOscillator()
      osc.type = "triangle"
      osc.frequency.setValueAtTime(voice.hz * (0.7 + 1 / Math.max(0.12, size) / 6), at)
      osc.frequency.exponentialRampToValueAtTime(voice.hz * 0.6, at + 0.05)
      const gain = ctx.createGain()
      const peak = Math.max(0.0002, voice.gain * size * 0.9)
      gain.gain.setValueAtTime(0.0001, at)
      gain.gain.exponentialRampToValueAtTime(peak, at + safeAttack(0.004))
      gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.04 + size * 0.12)
      osc.connect(gain)
      gain.connect(shelf)
      osc.start(at)
      osc.stop(at + 0.25)
    }
  }

  private chord(hz: readonly number[], peak: number, seconds: number): void {
    const ctx = this.context()
    if (!ctx || !this.master) return
    const t = ctx.currentTime
    for (const f of hz) {
      const osc = ctx.createOscillator()
      osc.type = "sine"
      osc.frequency.value = f
      const gain = ctx.createGain()
      gain.gain.setValueAtTime(0.0001, t)
      gain.gain.exponentialRampToValueAtTime(peak / hz.length + 0.001, t + 0.012)
      gain.gain.exponentialRampToValueAtTime(0.0001, t + seconds)
      osc.connect(gain)
      gain.connect(this.master)
      osc.start(t)
      osc.stop(t + seconds + 0.1)
    }
  }

  dispose(): void {
    // Before anything else: a closure that retunes a torn-down graph outlives
    // the game otherwise, and the next mount would have two of them.
    this.unfollow()
    this.release()
    const ctx = this.ctx
    this.ctx = null
    this.master = null
    if (!ctx) return
    void ctx.close().catch(() => {
      console.warn("[counterweight] the audio context would not close")
    })
  }
}
