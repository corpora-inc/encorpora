/**
 * The app's Sound setting, as a fact every safety bus obeys.
 *
 * **The defect this closes.** Dynawalla's Settings screen has a Sound switch.
 * It is wired to a store, the store is serialised onto the wire as
 * `Settings.sound`, and the host pushes it to a running pack whenever it
 * changes. Then nothing read it. `game-host` consumed `safeArea` and
 * `reducedMotion` off that same object and walked past `sound`; not one of the
 * 27 games read it either — every one of them shipped its own mute button and
 * its own localStorage key. A parent turning Sound off silenced nothing. That
 * is a lie told by a switch, and it is the one control a parent reaches for
 * when a game is too loud.
 *
 * **Why it lives here and not in each game.** Every game's output is required
 * to pass through `createSafetyBus` (see `routing.test.ts`). That is one
 * chokepoint for 27 graphs, so the setting is applied once, here, and no game
 * has to remember anything. A game written next year inherits it by connecting
 * to the bus, which it already has to do.
 *
 * **Why a gain gate and not `AudioContext.suspend()`.** Suspending is the more
 * total-sounding answer and it is the wrong one:
 *
 *  - *It can refuse to come back.* Resuming a context requires user activation
 *    on WebKit. The gesture that flips this setting happens in the app's
 *    document; the pack is a cross-origin iframe and does not receive it. A
 *    context suspended from that gesture may sit suspended until the child next
 *    touches the game — and if the game's own code only calls `resume()` on
 *    start-up, never. A gate stuck shut is the same bug wearing a hat.
 *  - *It is not ours to own.* The host already suspends and resumes for pause,
 *    and the manual-pause work in `game-chrome` will too. Two owners of one
 *    context flag is how "unpause left it silent" gets written.
 *  - *It glitches.* A suspended context stops its clock; every envelope
 *    scheduled against `currentTime` resumes where it left off, which is a
 *    smear rather than silence.
 *
 * A gain node placed after the ceiling has none of those problems, and it is
 * *more* complete than the alternative people reach for first. A game's own
 * mute button typically means "stop making new voices", which leaves the
 * half-second decay of the cue that fired a moment ago ringing out. Muting the
 * bus catches that too: everything already scheduled is upstream of the gate,
 * so it is silenced mid-flight.
 */

/**
 * Whether the app is currently allowing sound.
 *
 * `true` until a host says otherwise. A game opened in the dev harness, or in a
 * browser tab with no host at all, has to make noise — the failure mode of the
 * other default is a silent game and nobody knowing why.
 */
let allowed = true

type Sink = (allowed: boolean) => void

/** Live buses. Each removes itself on `disconnect()`. */
const sinks = new Set<Sink>()

/**
 * Publish the app's Sound setting.
 *
 * `game-host` calls this at attach and again on every `settings` event, which
 * is what makes the switch work *during* a session rather than only at launch.
 *
 * `undefined` and `null` mean allow: a host too old to send the field is not a
 * reason to silence a game.
 */
export function setHostSound(on: boolean | undefined | null): void {
  const next = on !== false
  if (next === allowed) return
  allowed = next
  // A copy, so a sink that disconnects its bus from inside the callback cannot
  // mutate the set being iterated.
  for (const sink of [...sinks]) {
    try {
      sink(next)
    } catch (error) {
      // Loud. A bus that could not be gated is a bus that is still making
      // noise after a parent asked it not to, and that must never be quiet.
      console.error("[game-audio] a bus refused the app's sound setting", error)
    }
  }
}

/** Whether the app is allowing sound right now. */
export function hostSoundAllowed(): boolean {
  return allowed
}

/**
 * Follow the setting. Returns an unsubscribe; call it when the bus is torn
 * down or the closure outlives the graph it was gating.
 */
export function onHostSound(sink: Sink): () => void {
  sinks.add(sink)
  return () => {
    sinks.delete(sink)
  }
}

/**
 * Forget the published setting and every subscriber.
 *
 * For tests. Module state that survives between test files is how a suite
 * starts passing for the wrong reason.
 */
export function resetHostSound(): void {
  allowed = true
  sinks.clear()
}
