// The key the whole bazaar is in.
//
// `packs/shared/game-soundscape` knows what a mode is, what a root is and how a
// `+1` becomes a note. It does not know *which* mode the app is in right now,
// and it deliberately cannot: a pack frame is opaque-origin, its storage is not
// the app's, and it can see nothing of the pack a child was in a minute ago. So
// if each pack chose its own key the bazaar would change key at every doorway —
// which is not a soundscape, it is twenty-eight ringtones. This module is the
// other end of that: **one key at a time, for the whole app**, handed to
// whichever pack is open on the `settings` channel that already carries `sound`
// and `safeArea`.
//
// ── The rotation policy, and why it is this one ──────────────────────────────
//
// Three things the founder asked for at once — "we don't want it stale and
// repetitive", "not too loud", "chill (usually)" — and one from the design:
// a soundscape is *"a slow-moving fact about the app"*. They pull against each
// other, and the resolution is a clock plus a rule about when the clock is
// allowed to be read.
//
//   1. **A fresh key every launch.** `launchSeed` is drawn once per process.
//      Opening the app tomorrow is a different mode on a different root even if
//      yesterday's sitting lasted ninety seconds, so the least-engaged child
//      still gets variety.
//   2. **A new key every `ROTATION_MS` after that.** Eight minutes. Long enough
//      that a whole run at one game sits inside one key; short enough that a
//      long afternoon hears five or six of them.
//   3. **The key cannot move while a pack owns it.** A key change *underneath* a
//      child — mid-question, because a timer went off — is the jarring thing,
//      and it is worse than repetition: the drone would slide and the plate a
//      child is holding would answer in a different mode than it did a second
//      ago. So the app changes key while a child is walking between games, and
//      never while they are in one. A forty-minute session at a single pack
//      therefore stays in one key on purpose; the walker is what keeps that
//      from being the same ding twice, and stage 2's `levelComplete` feedback
//      is the designed place for a mid-session change.
//
//      This is an invariant of THIS module and not a convention the caller has
//      to keep, which matters: `packSettings` re-runs on every settings change
//      — a parent moving the text size slider — so "the host remembered to pin
//      it in `useState`" is one refactor away from a key that rotates under a
//      playing child, and nothing would fail. `soundscapeForPack` takes the id
//      of the pack asking and hands the *same* key back to the pack that
//      already has it, whatever the clock says and however often it is called.
//      Rotation is what happens when a DIFFERENT pack asks, or when the one
//      that owned it has left.
//   4. **Never the same mode twice running.** A uniform draw from 38 modes
//      repeats about one doorway in 38, and a repeat is exactly the "stale and
//      repetitive" the brief names. Re-drawing costs one comparison.
//
// Everything here is derived from two integers — the launch seed and an epoch
// counter — so a session is replayable: `resetAppSoundscape(7)` gives the same
// sequence of keys on every device, forever, which is what makes "hijaz sounded
// wrong on the thousands plate" a bug report rather than a memory.
//
// ── What is deliberately NOT here ───────────────────────────────────────────
//
// No synthesis, no ambient bed, no `AudioContext`. The host owning a continuous
// bed is the next piece of work (stage 3 of the design), and it needs the
// ceiling fix in `packs/services.ts` that lands beside this. What travels to a
// pack is four numbers, and both ends turn the same four numbers into the same
// pitches with the same pure module. That is the whole trick.

import {
  CALM,
  pickSoundscape,
  type Soundscape,
} from "../../../packs/shared/game-soundscape/index.ts"

/**
 * The one type the rest of the host needs from the shared corpus.
 *
 * Re-exported here so that `app/soundscape.ts` is the single door onto
 * `packs/shared/game-soundscape` — `boundary.test.ts` holds it to exactly that,
 * the same way `packs/curriculum.ts` is the single door onto the curriculum.
 */
export type { Soundscape }

/**
 * How long one key lasts before the app is willing to draw another.
 *
 * Eight minutes, and it is a *minimum*, not a schedule: the change only lands
 * at the next doorway, so the real interval is "at least this long, and then
 * whenever the child next walks between games".
 */
export const ROTATION_MS = 8 * 60 * 1000

/**
 * How many times a draw may be rejected for repeating the previous mode.
 *
 * Bounded rather than a `while`: `pickSoundscape` is deterministic, so a corpus
 * that ever shrank to one mode would otherwise be an infinite loop in the
 * launch path. Eight attempts against 38 modes fails with probability under
 * 1e-12, and the fallback is a repeat rather than a hang.
 */
const MAX_REDRAWS = 8

/** What the app is currently in, and since when. `null` before the first doorway. */
type Held = {
  readonly scape: Soundscape
  /** The wall clock at the doorway that drew it. */
  readonly since: number
  /** How many keys this launch has been through. Purely so the draw is replayable. */
  readonly epoch: number
}

let launchSeed = drawLaunchSeed()
let held: Held | null = null

/**
 * The pack that currently owns the key, or `null` when nothing is on the stage.
 *
 * The whole of the "it does not move under a child" guarantee. A pack id rather
 * than a boolean because the two moments overlap: React renders the incoming
 * pack before it runs the outgoing one's cleanup, so a counter would still be
 * held by the pack being torn down and the doorway would never rotate.
 */
let owner: string | null = null

/**
 * A seed for one key, from the launch seed, the epoch and the re-draw attempt.
 *
 * Exported because it is the part worth asserting: two adjacent epochs must not
 * give correlated soundscapes, and two launches must not give the same
 * sequence. Both are properties of this function and of nothing else.
 *
 * The constants are the usual mixing primes — 2^32/phi and one of murmur3's —
 * and the `+ 1` on each term is what stops epoch 0 attempt 0 from mixing in
 * zero and handing the launch seed straight through.
 */
export function epochSeed(launch: number, epoch: number, attempt = 0): number {
  const mixed = (launch ^ Math.imul(epoch + 1, 0x9e3779b1)) >>> 0
  return (mixed ^ Math.imul(attempt + 1, 0x85ebca6b)) >>> 0
}

/**
 * A launch seed.
 *
 * `crypto` where there is one, because `Math.random()` in a WebView that has
 * just been restored from a snapshot has been observed to hand out the same
 * first value — which would be an app that opens in the same key every morning.
 */
function drawLaunchSeed(): number {
  const source = globalThis.crypto
  if (source && typeof source.getRandomValues === "function") {
    return (source.getRandomValues(new Uint32Array(1))[0] ?? 0) >>> 0
  }
  return Math.floor(Math.random() * 0x1_0000_0000) >>> 0
}

/** One key, avoiding the mode the app is already in. */
function draw(epoch: number, avoid: string | null): Soundscape {
  for (let attempt = 0; attempt < MAX_REDRAWS; attempt++) {
    const scape = pickSoundscape(epochSeed(launchSeed, epoch, attempt), CALM)
    if (scape.modeId !== avoid) return scape
  }
  return pickSoundscape(epochSeed(launchSeed, epoch, MAX_REDRAWS), CALM)
}

/**
 * The key to play a pack in.
 *
 * The ONLY function in the host that reads a clock about music, and the only
 * one that can change the app's key. Two rules, and between them they are the
 * whole policy:
 *
 *   * **The pack that owns the key gets it back.** Ask again — from a settings
 *     push, from a re-render, from React's double-invoked initialiser — and the
 *     answer is the same four numbers, ten rotation windows later or not.
 *   * **Anyone else rotates it if it is due.** Two packs opened a minute apart
 *     are the same key, or the bazaar changes key at every doorway again with a
 *     slower rhythm; two opened nine minutes apart are not.
 *
 * A clock that has gone backwards — a device whose time was corrected, or a
 * WebView restored from a snapshot — rotates once and then settles, rather than
 * pinning the app in one key until the wall clock catches up. A clock that is
 * not a number at all does not move the key, because a guard that pinned
 * `since` at zero would rotate at every doorway forever afterwards.
 */
export function soundscapeForPack(packId: string, now: number): Soundscape {
  const previous = held
  if (previous !== null && owner === packId) return previous.scape
  const at = Number.isFinite(now) ? now : (previous?.since ?? 0)
  if (previous !== null) {
    const elapsed = at - previous.since
    if (elapsed >= 0 && elapsed < ROTATION_MS) {
      owner = packId
      return previous.scape
    }
  }
  const epoch = previous === null ? 0 : previous.epoch + 1
  const scape = draw(epoch, previous?.scape.modeId ?? null)
  held = { scape, since: at, epoch }
  owner = packId
  return scape
}

/**
 * This pack is on the stage and the key is its until it leaves.
 *
 * Called from an effect rather than during render, so that React's development
 * double-invoke — mount, tear down, mount again — ends with the ownership it
 * started with instead of with nobody holding the key.
 */
export function claimSoundscape(packId: string): void {
  owner = packId
}

/** This pack has left the stage. The next doorway may rotate. */
export function releaseSoundscape(packId: string): void {
  if (owner === packId) owner = null
}

/**
 * Forget the current key and start a new launch.
 *
 * For tests, and for the same reason `resetHostSoundscape` exists on the pack
 * side: module state that survives between test files is how a suite starts
 * passing for the wrong reason. Passing a seed makes the whole sequence of keys
 * deterministic.
 */
export function resetAppSoundscape(seed?: number): void {
  launchSeed = typeof seed === "number" && Number.isFinite(seed) ? seed >>> 0 : drawLaunchSeed()
  held = null
  owner = null
}
