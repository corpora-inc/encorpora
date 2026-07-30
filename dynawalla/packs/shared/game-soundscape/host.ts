/**
 * The soundscape the app is in, as a fact a pack is told rather than one it
 * invents.
 *
 * **Why this is not a per-pack decision.** A child leaves THE STEELYARD and
 * opens THE LATTICE. If each pack rolled its own key, the bazaar would change
 * key at every doorway — which is not a soundscape, it is twenty-eight
 * ringtones. One mode, one root, one seed, published by the host and read by
 * whichever pack is open, is what makes the whole app sound like one place.
 * Cross-pack state cannot come from a pack: a pack frame is opaque-origin and
 * sandboxed, its `localStorage` is not the app's, and it can see nothing of the
 * pack the child was in a minute ago. It has to come from the other end of the
 * port.
 *
 * **Why `null` is the default, and why that is the whole ship-safety story.**
 * Until a host publishes a soundscape, `currentSoundscape()` is `null` and a
 * game keeps whatever sound it already had. No host publishes one today, so
 * this module changes nothing audible in production the day it lands. A pack's
 * dev harness publishes one, which is where the idea can be heard. Turning it
 * on for real is one line in the host, deliberately not taken in the change
 * that introduces this.
 *
 * Shaped exactly like `game-audio/sound.ts`, on purpose: `game-host` already
 * knows how to publish that one on every `settings` event, and a second thing
 * with the same shape is a line rather than a mechanism.
 */

import { parseSoundscape, type Soundscape } from "./soundscape.ts"

let current: Soundscape | null = null

type Sink = (scape: Soundscape | null) => void

const sinks = new Set<Sink>()

/**
 * Publish the app's soundscape.
 *
 * Takes `unknown` because the value comes off a `MessagePort`: it is whatever a
 * host of some version put there. Anything that is not a soundscape — including
 * `undefined`, which is what a host too old to send one sends — clears it, and
 * clearing it means every game goes back to its own sounds rather than to
 * silence.
 */
export function setHostSoundscape(value: unknown): void {
  const next = parseSoundscape(value)
  if (same(next, current)) return
  current = next
  // A copy, so a sink that unsubscribes from inside the callback cannot mutate
  // the set being iterated.
  for (const sink of [...sinks]) {
    try {
      sink(next)
    } catch (error) {
      // Loud. A game that could not take the new soundscape is a game playing
      // in the wrong key over the app's drone, which is worse than no drone.
      console.error("[game-soundscape] a listener refused the app's soundscape", error)
    }
  }
}

/** The soundscape right now, or `null` when no host has published one. */
export function currentSoundscape(): Soundscape | null {
  return current
}

/**
 * Follow the soundscape. Returns an unsubscribe; call it when the graph the
 * closure retunes is torn down.
 */
export function onSoundscape(sink: Sink): () => void {
  sinks.add(sink)
  return () => {
    sinks.delete(sink)
  }
}

/**
 * Forget the published soundscape and every subscriber.
 *
 * For tests. Module state that survives between test files is how a suite
 * starts passing for the wrong reason.
 */
export function resetHostSoundscape(): void {
  current = null
  sinks.clear()
}

function same(a: Soundscape | null, b: Soundscape | null): boolean {
  if (a === null || b === null) return a === b
  return a.modeId === b.modeId && a.rootHz === b.rootHz && a.seed === b.seed && a.tension === b.tension
}
