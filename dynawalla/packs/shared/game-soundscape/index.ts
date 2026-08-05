/**
 * A generative soundscape every Dynawalla game can play in.
 *
 * The founder's brief, and the thing this exists to make true: *"right now
 * [THE STEELYARD has] the same sound for every +1/−1 … it would be way cooler
 * if it randomly played a melody based on the randomly chosen soundscape for
 * any given moment … so we are in a certain maqam in a certain root note, then
 * the little sound effects play a nice little song."*
 *
 * Seven files, and no Web Audio in any of them:
 *
 *   `pitch`      cents, and the two conversions everything is built from.
 *   `modes`      38 modes — Western, Hindustani thaats, Arabic maqamat —
 *                as exact cents above the tonic, ported from beatlounge.
 *   `rng`        a seeded stream, so "random" is a thing a test can assert.
 *   `soundscape` mode + root + seed + tension, small enough to sit on the wire.
 *   `melody`     the walker: gestures in, in-tune voices out.
 *   `groove`     the same soundscape read as TIME: a probability matrix over
 *                the bar, whose two inputs are the mode and the density.
 *   `evolve`     that matrix, alive: a slow tethered walk over the bar, steered
 *                by whether the child was right, so the groove drifts somewhere
 *                new over minutes instead of repeating a fixed shape.
 *   `host`       the soundscape the app is in, published by the host.
 *
 * Usage, in a game:
 *
 *     import { Melody, currentSoundscape, pickSoundscape }
 *       from "../../../packs/shared/game-soundscape/index.ts"
 *
 *     const melody = new Melody(currentSoundscape() ?? pickSoundscape(seed))
 *     for (const v of melody.emit({ kind: "step", direction: 1, weight: 0 })) {
 *       play(v)   // the game owns the synthesis; this module owns the music
 *     }
 *
 * The game never names a frequency. That is the rule, and it is what keeps
 * every sound in the pack in tune with the drone and with every other pack.
 */
export { CENTS_PER_OCTAVE, centsBetween, centsToRatio, foldIntoRange, hz } from "./pitch.ts"
export {
  BARS_PER_MUTATION,
  Groove,
  ROOM_HALF_LIFE_BARS,
  SEED_HALF_LIFE_BARS,
} from "./evolve.ts"
export {
  MAX_OPENNESS,
  MIN_AFFINITY,
  divOfBeat,
  expectedNotes,
  grooveMatrix,
  grooveSlotBeats,
  leanAffinity,
  metreWeight,
  modeAffinity,
  type GrooveBias,
  type GrooveSlot,
  type GrooveSpec,
} from "./groove.ts"
export { MODES, MODE_IDS, modeById, type Mode, type ModeFamily } from "./modes.ts"
export { Rng } from "./rng.ts"
export {
  CALM,
  ROOT_MAX_HZ,
  ROOT_MIN_HZ,
  modeOf,
  parseSoundscape,
  pickSoundscape,
  withTension,
  type Soundscape,
} from "./soundscape.ts"
export {
  MELODY_MAX_HZ,
  MELODY_MIN_HZ,
  MELODY_PEAK,
  Melody,
  TENSION_STEP,
  type Gesture,
  type Timbre,
  type Voice,
} from "./melody.ts"
export {
  currentSoundscape,
  onSoundscape,
  resetHostSoundscape,
  setHostSoundscape,
} from "./host.ts"
