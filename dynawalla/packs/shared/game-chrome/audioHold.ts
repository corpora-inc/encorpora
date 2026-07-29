/**
 * Silence, held. Every `AudioContext` a pack ever makes, stopped together.
 *
 * **Why this exists.** The report was: "All games should pause while reading the
 * instructions .. I can hear counterweight playing in the background while I'm
 * reading the instructions ... stressing me out even more .. it's so stressful I
 * don't even want to QA it."
 *
 * A child opens the rules BECAUSE they are overwhelmed. That is the single worst
 * moment in the whole product for the game to keep shouting at them.
 *
 * **Why it is here and not in the games.** Pausing had already been fixed per
 * game — #642 for VOLTA and MOSAIC, then trebuchet, coil, foundry and guilty
 * one at a time — and eleven of the twenty-seven still had no gating at all.
 * Every per-game fix is a fix the twenty-eighth pack will not get. So the hold
 * lives at the seam every game already goes through, and a game gets it by
 * existing rather than by remembering.
 *
 * **How it reaches a game that never calls us.** Every one of the twenty-seven
 * audio modules resolves its constructor lazily, inside the method that makes
 * the context:
 *
 *     const Ctx = globalThis.AudioContext ?? globalThis.webkitAudioContext
 *     const ctx = new Ctx()
 *
 * — none of them cache it at module scope. So replacing that global with a
 * `Proxy` whose `construct` trap registers the instance catches all of them,
 * with no import and no line of wiring on their side. The proxy forwards
 * everything else, so `instanceof`, statics and the prototype are unchanged.
 *
 * **Holding, not stopping once.** A single `suspend()` on open would be undone
 * by the game itself: every pack calls `audio.resume()` on any gesture, because
 * Web Audio needs one, and taps still reach some games from behind the scrim.
 * So while the hold is on, a context's own `resume()` records the intent and
 * returns — it does not restart the sound. The intent is honoured on release,
 * which is why a game that asked for sound during the read is not left mute
 * afterwards.
 *
 * **What a game that was already silent gets.** Nothing. Whether a context is
 * resumed on release is decided by whether the GAME wanted it running, never by
 * whether we suspended it, so a game paused by its own pause screen, by a phone
 * call, or by the host putting a sheet over the frame comes back exactly as it
 * was.
 *
 * **What suspend does to a note in flight.** It freezes the graph: the context
 * clock stops, so an oscillator holds where it is and every scheduled envelope
 * point holds with it. On resume the note continues from that instant rather
 * than jumping — nothing is skipped forward. Two honest costs. The cut is a
 * discontinuity, so a loud sustained voice can click going down; and a game
 * whose simulation keeps running while the manual is up will schedule new
 * sounds against a frozen `currentTime`, which then all land in the same
 * instant when the clock starts again. That second one is a real argument for
 * `onOpen` in the games that make sound without input — it is not an argument
 * for leaving the sound on.
 */

type Held = {
  ctx: AudioContext
  /** Bound before we shadow them, so the shadows can still reach the real ones. */
  nativeResume: () => Promise<void>
  nativeSuspend: () => Promise<void>
  /** Does the GAME want sound? Not "did we suspend it" — that is a different question. */
  wanted: boolean
  /**
   * Serialises this context's suspend/resume calls.
   *
   * `suspend()` and `resume()` are promises and a child can open and close the
   * sheet faster than either settles. Firing them in parallel lets a resume
   * that was issued second complete first, leaving a game that is being played
   * with its sound off — the failure that is worse than the one being fixed.
   */
  tail: Promise<void>
}

const held: Held[] = []
/** Proxies we made, so installing twice does not wrap a wrapper. */
const wrappers = new WeakSet<object>()
let depth = 0

const run = (rec: Held, op: () => Promise<void>): Promise<void> => {
  rec.tail = rec.tail.then(op).catch((error: unknown) => {
    // Loud, never silent. A hold that failed means either a game shouting over
    // the manual or a game that came back mute, and both are worth a line in
    // the console.
    console.warn("[game-chrome] audio hold could not change state", error)
  })
  return rec.tail
}

function register(ctx: AudioContext): void {
  if (held.some((r) => r.ctx === ctx)) return
  const rec: Held = {
    ctx,
    nativeResume: ctx.resume.bind(ctx),
    nativeSuspend: ctx.suspend.bind(ctx),
    wanted: ctx.state === "running",
    tail: Promise.resolve(),
  }
  held.push(rec)

  // Own properties shadowing the prototype's. Plain assignment, the same idiom
  // the games' own code uses — no `defineProperty`, no descriptor games.
  ctx.resume = (): Promise<void> => {
    rec.wanted = true
    if (depth > 0) return Promise.resolve()
    return run(rec, rec.nativeResume)
  }
  ctx.suspend = (): Promise<void> => {
    rec.wanted = false
    if (depth > 0) return Promise.resolve()
    return run(rec, rec.nativeSuspend)
  }
  // Forgetting a closed context is not tidiness. `resume()` on a closed context
  // rejects, and a pack torn down mid-read would take an unhandled rejection
  // with it on the way out of the game.
  const nativeClose = ctx.close.bind(ctx)
  ctx.close = (): Promise<void> => {
    const at = held.indexOf(rec)
    if (at >= 0) held.splice(at, 1)
    return nativeClose()
  }

  // Born during a read. The first gesture in a game is often the tap that opens
  // the rules, so the context may not exist until after the sheet is up.
  if (depth > 0 && ctx.state === "running") run(rec, rec.nativeSuspend)
}

function wrap(Ctor: unknown): unknown {
  if (typeof Ctor !== "function") return Ctor
  if (wrappers.has(Ctor)) return Ctor
  const proxy = new Proxy(Ctor as new (...args: never[]) => AudioContext, {
    construct(target, args, newTarget): object {
      const ctx = Reflect.construct(target, args, newTarget) as AudioContext
      try {
        register(ctx)
      } catch (error) {
        console.warn("[game-chrome] could not hold this audio context", error)
      }
      return ctx
    },
  })
  wrappers.add(proxy)
  return proxy
}

/**
 * Wrap the audio constructors so every context a game makes is holdable.
 *
 * Idempotent, and safe where there is no Web Audio at all — a headless test rig
 * or a WebView with the API switched off simply has nothing to wrap.
 *
 * Both names are wrapped. `rhythm` reads `webkitAudioContext ?? AudioContext`
 * and everyone else reads them the other way round, so wrapping one of the two
 * would hold twenty-six games and not the twenty-seventh.
 */
export function installAudioHold(): void {
  const g = globalThis as Record<string, unknown>
  for (const name of ["AudioContext", "webkitAudioContext"]) {
    const Ctor = g[name]
    if (typeof Ctor !== "function") continue
    const wrapped = wrap(Ctor)
    if (wrapped === Ctor) continue
    try {
      g[name] = wrapped
    } catch (error) {
      // Loud, never silent: from here the manual cannot silence this game and
      // that is exactly the defect this module exists to close.
      console.warn(`[game-chrome] ${name} could not be wrapped; the manual will not mute audio`, error)
    }
  }
}

// As early as the module graph allows. Every game imports the manual, and every
// game builds its context lazily on first sound, so in practice the wrap is in
// place long before the first `new AudioContext()`. `createInstructions` calls
// this again at mount, which is what covers a bundle that evaluates a game's
// audio module first.
installAudioHold()

/** Silence everything, and keep it silent until the matching `releaseAudio()`. */
export function holdAudio(): void {
  depth += 1
  if (depth > 1) return
  for (const rec of held) {
    rec.wanted = rec.ctx.state === "running"
    if (rec.wanted) run(rec, rec.nativeSuspend)
  }
}

/** Give back exactly the sound the game had, and nothing it did not. */
export function releaseAudio(): void {
  if (depth === 0) return
  depth -= 1
  if (depth > 0) return
  for (const rec of held) {
    if (rec.wanted) run(rec, rec.nativeResume)
  }
}

/** True while the manual — or anything else — is holding the sound down. */
export function isAudioHeld(): boolean {
  return depth > 0
}

/**
 * Drop every registered context and clear the hold.
 *
 * For tests only: the registry is process-global, so one test's context would
 * otherwise be suspended by the next test's manual.
 */
export function forgetAudioContexts(): void {
  held.length = 0
  depth = 0
}
