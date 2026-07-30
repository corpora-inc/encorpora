/**
 * The part that makes a run of taps into a tune.
 *
 * **The defect this closes.** THE STEELYARD plays the same four pitches for
 * every strike — 1180 Hz for a one, 288 Hz for a thousand — forever. A child
 * hanging eight weights hears the same bright tick eight times. Every game in
 * the fleet is built the same way: one cue per event, a fixed frequency written
 * in the file. That is why the sound gets old in a minute, and turning it down
 * or making it prettier does not fix it, because the problem is not the timbre.
 * It is that **nothing that happens changes what the next sound is.**
 *
 * **The idea.** A soundscape is in a mode and on a root. A walker holds one
 * scale degree. Each gesture the game reports moves that degree — up for a
 * weight going on, down for one coming off — and the pitch that comes out is
 * wherever the walker now is. So eight weights in a row are eight *different*
 * notes that are all in the same mode, over the same drone, and they arc and
 * come to rest like a phrase, because the walker is pulled toward the mode's
 * resting degrees and cadences onto one when the phrase has run long enough.
 *
 * **Games do not pick pitches.** The whole vocabulary is in `Gesture`: a step
 * with a direction and a weight, and five named things that happened. A game
 * that could pass a frequency would eventually pass one that is not in the
 * mode, and then the drone is wrong and nobody can say why. Weight is not a
 * pitch — it is *how heavy the thing the child did was*, and this module spends
 * it on register.
 *
 * **In tune by construction.** Every frequency here is `rootHz` multiplied by
 * two to the power of some cents over twelve hundred. The drone is the same
 * `rootHz`. There is exactly one number, so there is nothing to drift.
 *
 * Pure but stateful, in the way `game-pacing` is not: the walker's whole point
 * is that where it is now depends on what has already happened. The state is
 * held in an object the game owns, the randomness comes from a seed, and there
 * are no timers and no Web Audio — so a test can play a hundred taps in a
 * microsecond and assert every pitch.
 */

import { foldIntoRange, hz } from "./pitch.ts"
import { modeOf, withTension, type Soundscape } from "./soundscape.ts"
import { Rng } from "./rng.ts"

/**
 * How a voice should be made to sound. Named rather than parameterised: the
 * pack owns the synthesis and this module owns the music, and a field called
 * `filterQ` here would be this module starting to own both.
 */
export type Timbre =
  /** Struck metal or glass. Short, bright-ish, the melodic default. */
  | "bell"
  /** Plucked. Softer onset, shorter tail. */
  | "pluck"
  /** Bowed or breathed in. Slow onset, long. Never a transient. */
  | "bloom"
  /**
   * Something falling apart — masonry, gravel, a shelf of brass going over.
   *
   * The founder's word for what a refusal should sound like, and it is a
   * *modelled* sound rather than a noise burst: many small impacts with a
   * power-law size distribution, low-centred. See `SOUNDSCAPE_DESIGN_2026-07.md`
   * for the recipe. It exists in this list so that no game reaches for white
   * noise, which is the sound this replaces everywhere.
   */
  | "rubble"

export type Voice = {
  /** Hertz. Always a pitch of the live mode. */
  readonly hz: number
  /** Seconds from the moment the gesture happened. Lets one gesture be a figure. */
  readonly at: number
  /** How long it rings. */
  readonly seconds: number
  /**
   * Peak amplitude, linear, before the game's own master trim.
   *
   * Inside the fleet's loudness budget already: nothing here exceeds
   * `MELODY_PEAK`, and the bed sits far under it. See the design note.
   */
  readonly gain: number
  readonly timbre: Timbre
}

/**
 * Everything a game is allowed to say.
 *
 * Six things that happened and two dials. Any game in the fleet can express
 * itself in this, and no game can express a pitch.
 */
export type Gesture =
  /**
   * The child moved something by one unit.
   *
   * `direction` is which way — and it matters musically, not just as a label:
   * up walks the mode ascending, down walks it descending, which is the closest
   * a scale gets to having a grammar.
   *
   * `weight` is 0..1, how heavy the unit was. THE STEELYARD's ones plate is 0
   * and its thousands plate is 1. It buys register and a little loudness, and
   * nothing else.
   */
  | { readonly kind: "step"; readonly direction: 1 | -1; readonly weight?: number }
  /** Something the child was trying to do worked. */
  | { readonly kind: "success" }
  /** It did not. Soft, low, short — never a buzzer. */
  | { readonly kind: "failure" }
  /** A level, a scale, a run finished. The only gesture that is allowed to be big. */
  | { readonly kind: "levelComplete" }
  /** An input was declined — too soon, not allowed, nothing there. */
  | { readonly kind: "refuse" }
  /** Something appeared, arrived, or was laid out. */
  | { readonly kind: "arrive" }
  /** Wind the soundscape up. Silent in itself; the bed and the melody change. */
  | { readonly kind: "moreTension" }
  /** Let it down. */
  | { readonly kind: "lessTension" }

/** The loudest a single melodic voice may be asked for. */
export const MELODY_PEAK = 0.14

/**
 * The register the melody is confined to, in Hz.
 *
 * Deliberately low. The fleet's cues today sit at 830 and 1180 Hz, which is the
 * band the ear is most sensitive in and the band the founder means by
 * "abrasive". Everything here lives under 1.1 kHz, and the heaviest gestures
 * live under 130 — where a low clang has a body rather than an edge.
 *
 * These are a backstop rather than a working limit, and the difference matters.
 * The bands below are one octave wide and the root band is narrow enough that
 * the topmost band's top (root x8, at most 1244 Hz) is under this ceiling — so
 * NOTHING is ever folded in normal play, and the four register bands never
 * overlap. If a fold does start happening it is a bug in that arithmetic, not a
 * note going quietly out of range, and `melody.test.ts` asserts it does not.
 */
export const MELODY_MIN_HZ = 55
export const MELODY_MAX_HZ = 1250

/**
 * The octave a weightless gesture sits in, above the root, and how many octaves
 * of register a full weight takes off it.
 *
 * Two and three, so a four-way rack lands on the bands root x4, x2, x1 and
 * root/2 — four octaves that do not overlap, because each band is exactly one
 * octave wide (see `pitch`). THE STEELYARD's "place value is a thing you can
 * hear" property is therefore kept *exactly* rather than approximately: the
 * ones plate is always above the tens plate, in every mode and on every root,
 * with no ordering left to chance.
 */
const TOP_OCTAVE = 2
const REGISTER_SPAN = 3

/** How much one `moreTension` or `lessTension` moves the dial. */
export const TENSION_STEP = 0.18

/** A phrase is this many steps, plus up to two more, plus tension. */
const PHRASE_MIN = 3
const PHRASE_SPREAD = 3

/** How near a perfect fifth a degree must be for the drone to double it. */
const FIFTH_CENTS = 702
const FIFTH_TOLERANCE = 25

export class Melody {
  private scape: Soundscape
  private rng: Rng
  /** Where the walker is, as a signed degree index. 0 is the tonic. */
  private degree = 0
  /** Steps taken since the last cadence. */
  private sinceRest = 0
  private phrase: number
  /** How many phrases have come to rest. */
  private resolutions = 0

  constructor(scape: Soundscape) {
    this.scape = scape
    this.rng = new Rng(scape.seed)
    this.phrase = this.nextPhraseLength()
  }

  /** The soundscape this melody is singing in. */
  get soundscape(): Soundscape {
    return this.scape
  }

  /** Where the walker is. For tests and for a debug read-out. */
  get position(): number {
    return this.degree
  }

  /**
   * How many phrases have come to rest since this walker was made.
   *
   * Exposed because "it cadences" is the claim that separates a phrase from a
   * scale exercise, and a claim that cannot be observed cannot be tested — a
   * walk that never resolves still wanders across resting degrees by accident
   * often enough that counting those proves nothing. A game may also want it:
   * a resolution is a natural moment to punctuate with something visual.
   */
  get resolved(): number {
    return this.resolutions
  }

  /**
   * Move to a different soundscape.
   *
   * The walker keeps its degree rather than resetting: a scale degree means the
   * same thing in the new mode, so the line carries across the change instead of
   * restarting, which is what makes a key change sound like a modulation rather
   * than like the music stopping and different music starting.
   */
  retune(scape: Soundscape): void {
    this.scape = scape
    this.rng = new Rng(scape.seed ^ 0x9e3779b1)
  }

  /**
   * The drone's pitches, in Hz, lowest first.
   *
   * The root and the octave below it always. The fifth only when the mode
   * actually has one within a comma or so of 702 cents — Saba does not, Locrian
   * does not, and droning a wrong fifth under them is the exact clash a fixed
   * "root plus fifth" drone would produce in every fifth soundscape.
   */
  drone(): readonly number[] {
    const root = this.scape.rootHz
    const out = [root / 2, root]
    const mode = modeOf(this.scape)
    for (const index of mode.rest) {
      const cents = mode.degrees[index]
      if (cents === undefined) continue
      if (Math.abs(cents - FIFTH_CENTS) <= FIFTH_TOLERANCE) {
        out.push(hz(root, cents))
        break
      }
    }
    return out
  }

  /**
   * What this gesture sounds like.
   *
   * Empty for the two tension gestures, and that is the answer rather than an
   * omission: winding a soundscape up is not a sound, it is a change in every
   * sound after it.
   */
  emit(gesture: Gesture): readonly Voice[] {
    switch (gesture.kind) {
      case "step":
        return this.step(gesture.direction, gesture.weight ?? 0)
      case "success":
        return this.cadence()
      case "failure":
        return this.sink()
      case "levelComplete":
        return this.flourish()
      case "refuse":
        return this.crumble()
      case "arrive":
        return this.bloom()
      case "moreTension":
        this.scape = withTension(this.scape, this.scape.tension + TENSION_STEP)
        return []
      case "lessTension":
        this.scape = withTension(this.scape, this.scape.tension - TENSION_STEP)
        return []
    }
  }

  // ── the walk ──────────────────────────────────────────────────────────────

  private step(direction: 1 | -1, weight: number): readonly Voice[] {
    const w = clamp01(weight)
    const t = this.scape.tension
    const mode = modeOf(this.scape)
    const size = mode.degrees.length

    this.sinceRest += 1
    if (this.sinceRest >= this.phrase) {
      this.degree = this.resolve(direction, mode.rest, size)
      this.resolutions += 1
      this.sinceRest = 0
      this.phrase = this.nextPhraseLength()
    } else {
      // Mostly a step, sometimes a skip, rarely a leap — and tension is what
      // buys the leaps. A calm soundscape is nearly all stepwise, which is what
      // "chill" sounds like; a wound-up one starts jumping.
      const interval = 1 + this.rng.weighted([0.66 - 0.34 * t, 0.24, 0.07 + 0.16 * t, 0.03 + 0.18 * t])
      this.degree += direction * interval
      // Keep the line from walking off into the next county. A phrase lives
      // within an octave either side of home; register is what the weight is
      // for, and it is applied separately below.
      if (this.degree > size) this.degree -= size
      if (this.degree < -size) this.degree += size
      // Under tension, lean on the degree that makes this mode itself.
      if (this.rng.next() < t * 0.35) {
        const towards = octaveOf(this.degree, size) * size + mode.colour
        if (Math.abs(towards - this.degree) <= 1) this.degree = towards
      }
    }

    const octave = TOP_OCTAVE - Math.round(w * REGISTER_SPAN)
    return [
      {
        hz: this.pitch(this.degree, octave),
        at: 0,
        seconds: 0.34 + (1 - w) * 0.16,
        gain: 0.085 + w * 0.045,
        timbre: "bell",
      },
    ]
  }

  /** Where a phrase comes to rest, given which way it was travelling. */
  private resolve(direction: 1 | -1, rest: readonly number[], size: number): number {
    const home = octaveOf(this.degree, size)
    // The tonic is the heaviest resting place, and the further down the list a
    // degree is the lighter it gets — so a phrase usually ends at home and
    // sometimes ends somewhere that leaves the door open.
    const weights = rest.map((_, i) => (i === 0 ? 3 : 1))
    const index = rest[this.rng.weighted(weights)] ?? 0
    // A descending phrase resolves in the octave it came down into; an
    // ascending one is allowed to land in the octave above, which is what makes
    // a long climb feel like it arrived somewhere.
    const oct = direction > 0 && index === 0 && this.degree > 0 ? home : Math.min(0, home)
    return oct * size + index
  }

  private nextPhraseLength(): number {
    return PHRASE_MIN + this.rng.int(PHRASE_SPREAD) + Math.round(this.scape.tension * 3)
  }

  // ── the named gestures ────────────────────────────────────────────────────

  /** Two notes that arrive. The walker goes home, because something finished. */
  private cadence(): readonly Voice[] {
    const mode = modeOf(this.scape)
    const middle = mode.rest[1] ?? 2
    this.degree = 0
    this.sinceRest = 0
    this.phrase = this.nextPhraseLength()
    // The second note is the tonic an octave up — reached through the REGISTER
    // argument rather than by asking for degree `size`, because a degree is
    // folded into its band and would come back as the same note.
    return [
      { hz: this.pitch(middle, TOP_OCTAVE - 1), at: 0, seconds: 0.42, gain: 0.1, timbre: "bell" },
      { hz: this.pitch(0, TOP_OCTAVE), at: 0.1, seconds: 0.72, gain: 0.12, timbre: "bell" },
    ]
  }

  /** Down a step and settled. Low, warm, short. Nothing here is a buzzer. */
  private sink(): readonly Voice[] {
    const mode = modeOf(this.scape)
    this.degree = 0
    this.sinceRest = 0
    return [
      { hz: this.pitch(1, 1), at: 0, seconds: 0.4, gain: 0.075, timbre: "bloom" },
      { hz: this.pitch(0, 1), at: 0.11, seconds: 0.62, gain: 0.085, timbre: "bloom" },
      { hz: this.pitch(mode.rest[1] ?? 2, 0), at: 0.11, seconds: 0.62, gain: 0.05, timbre: "bloom" },
    ]
  }

  /** The one gesture allowed to be big: the mode's own chord, climbing. */
  private flourish(): readonly Voice[] {
    const mode = modeOf(this.scape)
    const middle = mode.rest[1] ?? 2
    // The mode's own chord, climbing through two registers and landing on the
    // tonic at the top.
    const rungs: readonly [number, number][] = [
      ...mode.rest.map((d) => [d, TOP_OCTAVE - 1] as [number, number]),
      [0, TOP_OCTAVE],
      [middle, TOP_OCTAVE],
    ]
    this.degree = 0
    this.sinceRest = 0
    this.phrase = this.nextPhraseLength()
    return rungs.map(([degree, octave], i) => ({
      hz: this.pitch(degree, octave),
      at: i * 0.115,
      seconds: 0.5 + i * 0.14,
      gain: 0.075 + i * 0.012,
      timbre: "bell" as const,
    }))
  }

  /** A shelf of brass going over. Low, brief, and not a note anyone chose. */
  private crumble(): readonly Voice[] {
    return [{ hz: this.pitch(0, 0), at: 0, seconds: 0.34, gain: 0.09, timbre: "rubble" }]
  }

  /** Something was laid out. The tonic, breathed in rather than struck. */
  private bloom(): readonly Voice[] {
    const mode = modeOf(this.scape)
    return [
      { hz: this.pitch(0, 1), at: 0, seconds: 0.9, gain: 0.055, timbre: "bloom" },
      { hz: this.pitch(mode.rest[1] ?? 2, 1), at: 0.04, seconds: 0.8, gain: 0.04, timbre: "bloom" },
    ]
  }

  // ── degrees to hertz ──────────────────────────────────────────────────────

  /**
   * A signed degree in a register, as a frequency inside the melodic range.
   *
   * The one place cents become hertz, so the claim "everything is in tune with
   * the drone" is a claim about four lines rather than about the whole file.
   *
   * **The degree is folded into its band, and the octave it walked through is
   * dropped.** A band is one octave wide and the bands are what carry the
   * game's own meaning — how heavy the thing the child did was — so a walker
   * that had wandered up a degree too far must not be allowed to spill into the
   * band above and sound like a heavier action than it was. What is lost is
   * nothing: the walk's contour is still there, it simply wraps at the octave,
   * which is what a harp does when a run reaches the end of the strings.
   */
  private pitch(degree: number, octave: number): number {
    const mode = modeOf(this.scape)
    const size = mode.degrees.length
    const within = mode.degrees[degree - octaveOf(degree, size) * size] ?? 0
    return foldIntoRange(
      hz(this.scape.rootHz, within + octave * 1200),
      MELODY_MIN_HZ,
      MELODY_MAX_HZ,
    )
  }
}

/** Which octave a signed degree index falls in. Floors toward negative infinity. */
function octaveOf(degree: number, size: number): number {
  if (size <= 0) return 0
  return Math.floor(degree / size)
}

function clamp01(v: number): number {
  if (!Number.isFinite(v)) return 0
  return Math.min(1, Math.max(0, v))
}
