// What the weigh-house says to the soundscape.
//
// The whole of THE STEELYARD's musical vocabulary is in this file, and it is
// eight lines of it, because a game is not allowed to pick pitches. It says
// *what happened* — a weight went on, a weight came off, how heavy it was —
// and `packs/shared/game-soundscape` decides what that sounds like in whatever
// mode and root the app is currently in.
//
// Kept out of `audio.ts` on purpose: `audio.ts` needs an `AudioContext` and
// therefore a browser, and this is the part worth asserting. `tune.test.ts`
// plays a whole round through it in Node with no device.

import type { Gesture } from "../../../packs/shared/game-soundscape/index.ts"
import { PLACES, type Place, type Strike } from "./game/places.ts"

/**
 * How heavy each pillar of the rack is, 0..1.
 *
 * The soundscape spends this on register, so the ones plate stays a bright tick
 * and the thousands plate stays a low clang — the game's "place value is a
 * thing you can hear" property, kept exactly and made musical. Derived from
 * `PLACES` rather than written out, so a rack that grows a ten-thousands pillar
 * cannot silently leave it at the wrong weight.
 */
export const PLACE_WEIGHT: Readonly<Record<Place, number>> = Object.fromEntries(
  // `PLACES` is heaviest-first, so the first entry is weight 1.
  PLACES.map((place, i) => [place, 1 - i / Math.max(1, PLACES.length - 1)]),
) as Record<Place, number>

/**
 * A blow on the rack, as something the soundscape can sing.
 *
 * **The direction is the interesting half.** Hanging brass ascends the mode and
 * taking it off descends it, so `+1` and `−1` are not two arbitrary noises —
 * they are opposite motions in the same scale, which is the closest a pitch
 * collection gets to having a grammar. A child walking a pan up to its answer
 * and then trimming it back down hears the trim as a return, not as more of the
 * same.
 */
export function gestureForStrike(strike: Strike): Gesture {
  return {
    kind: "step",
    direction: strike.dir,
    weight: PLACE_WEIGHT[strike.place],
  }
}
