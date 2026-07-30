/**
 * What "the soundscape right now" is: four numbers, and where they come from.
 *
 * A soundscape is a mode, a root, a seed and a tension. That is the whole of
 * it, and its smallness is the design — it is small enough to sit on the
 * host↔pack wire beside `locale` and `reducedMotion`, which is what lets the
 * bazaar be in one key at a time across every pack a child walks between.
 *
 * **Why the root is in Hz and not a note name.** A note name has to be resolved
 * against a reference pitch and a spelling convention before it is a frequency,
 * and both of those are decisions no pack should be making. A number in Hz is
 * already the thing the oscillator wants. It also lets the root be *slightly*
 * off a piano key on purpose, which is how a drone stops sounding like a
 * synthesiser preset.
 *
 * **Why tension is a scalar and not a name.** The game says `moreTension`; the
 * soundscape decides what that costs. Naming the states ("calm", "urgent")
 * would put a vocabulary of moods in every game, and the next game would want a
 * mood the vocabulary does not have. One number in 0..1, moved by named
 * gestures, read by the melody walker and the bed.
 */

import { MODES, modeById, type Mode } from "./modes.ts"
import { Rng } from "./rng.ts"

export type Soundscape = {
  readonly modeId: string
  /**
   * The tonic, in Hz, and the pitch the drone sits on.
   *
   * Low on purpose: `ROOT_MIN_HZ`..`ROOT_MAX_HZ` is Bb2 to Eb3. The melody
   * lives between half this and eight times it, so the very top of everything
   * the system can produce is 1244 Hz and the ordinary note is far below that —
   * rather than through the 2–5 kHz band the ear is most sensitive in, which is
   * the band the founder is describing when he says the fleet's effects are
   * abrasive.
   */
  readonly rootHz: number
  /** Drives every stochastic choice made from this soundscape. */
  readonly seed: number
  /** 0 = as calm as this mode gets. 1 = as wound-up as it gets. */
  readonly tension: number
}

/**
 * The lowest and highest tonic a soundscape may sit on. Bb2 and Eb3.
 *
 * A narrow band, and narrow on purpose. The melody's brightest register is the
 * root times four to times eight (see `melody.ts`), so the top of the root band
 * multiplied by eight is the highest note the whole system can produce — 1244
 * Hz here. Widening the roots by a fourth would put that at 1600, which is
 * inside the band the ear is most sensitive in and the band the founder is
 * calling abrasive. The ceiling on the music is set by choosing the roots, and
 * it is set here rather than by clamping later.
 */
export const ROOT_MIN_HZ = 116.5
export const ROOT_MAX_HZ = 156

/**
 * The roots to choose between.
 *
 * Twelve-tone-equal-tempered pitches, and then deliberately detuned by up to
 * six cents when one is chosen (see `pickSoundscape`). Six cents is under the
 * threshold at which a listener hears "out of tune" and well over the threshold
 * at which two sessions sound like the same session.
 */
const ROOTS: readonly number[] = [116.54, 123.47, 130.81, 138.59, 146.83, 155.56]

/** How far a chosen root may be nudged off the grid, in cents. */
const ROOT_DETUNE_CENTS = 6

/** Where tension starts, for a soundscape nobody has said anything about yet. */
export const CALM = 0.2

/**
 * Choose a soundscape from a seed.
 *
 * Deterministic, so a session can be replayed and a bug can be reported. The
 * seed is the only input: the same seed is the same mode, the same root and the
 * same melody, on every device, forever.
 */
export function pickSoundscape(seed: number, tension: number = CALM): Soundscape {
  const rng = new Rng(seed)
  const mode = MODES[rng.int(MODES.length)] ?? MODES[0]
  const base = ROOTS[rng.int(ROOTS.length)] ?? ROOTS[0] ?? 130.81
  const detune = (rng.next() * 2 - 1) * ROOT_DETUNE_CENTS
  return {
    modeId: mode?.id ?? "western.dorian",
    rootHz: base * Math.pow(2, detune / 1200),
    seed: seed >>> 0,
    tension: clamp01(tension),
  }
}

/** The mode this soundscape is in, or Dorian if the id is not one we know. */
export function modeOf(scape: Soundscape): Mode {
  const mode = modeById(scape.modeId)
  if (mode) return mode
  // Loud, never silent: an unknown mode id means the host and the pack disagree
  // about the corpus, which is a version skew a developer must see. The game
  // still plays, in a mode that exists, because a silent game is worse.
  console.warn(`[game-soundscape] unknown mode ${scape.modeId}; falling back`)
  return modeById("western.dorian") ?? (MODES[0] as Mode)
}

/** The same soundscape, wound up or let down. */
export function withTension(scape: Soundscape, tension: number): Soundscape {
  return { ...scape, tension: clamp01(tension) }
}

/**
 * A soundscape as it arrives from the host, validated.
 *
 * Everything crossing the port is attacker-controlled — a pack cannot be
 * attacked by the host it is running inside, but a pack CAN be handed a
 * malformed object by a host version it was not built against, and the failure
 * mode of an unchecked one is a `NaN` frequency, which in Web Audio is a node
 * that throws on `start()` and a game with no sound and no explanation.
 *
 * Returns `null` for anything that is not a soundscape, including `undefined` —
 * which is what a host too old to send one sends, and is not an error.
 */
export function parseSoundscape(value: unknown): Soundscape | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return null
  const raw = value as Record<string, unknown>
  const modeId = raw["modeId"]
  const rootHz = raw["rootHz"]
  const seed = raw["seed"]
  const tension = raw["tension"]
  if (typeof modeId !== "string" || modeById(modeId) === null) return null
  if (typeof rootHz !== "number" || !Number.isFinite(rootHz)) return null
  if (rootHz < ROOT_MIN_HZ / 2 || rootHz > ROOT_MAX_HZ * 2) return null
  if (typeof seed !== "number" || !Number.isFinite(seed)) return null
  return {
    modeId,
    rootHz,
    seed: Math.floor(seed) >>> 0,
    tension: typeof tension === "number" && Number.isFinite(tension) ? clamp01(tension) : CALM,
  }
}

function clamp01(v: number): number {
  if (!Number.isFinite(v)) return 0
  return Math.min(1, Math.max(0, v))
}
