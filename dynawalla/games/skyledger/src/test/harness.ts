// A rig for the rules tests: a `Game` wired to the stub host, with every report
// captured and with the truth about each star available to the *test* — never
// to the game's render layer and never to the player.
//
// Everything here is seeded. A test that reaches for `Math.random` is a test
// that fails one run in five on somebody else's machine, and the seed lives in
// the test file so a failure can be reproduced from the failure message alone.

import { Rng } from "../core/rng.ts"
import { Game } from "../game/game.ts"
import { LOGGED_PAST_CALM } from "../game/opening.ts"
import { answerOf, orderOf, stationOf, type Station } from "../game/station.ts"
import type { Star } from "../game/game.ts"
import { createStubHost } from "../stubHost.ts"
import type { Host } from "../contract.ts"

export type Report = { questionId: string; correct: boolean; ms: number; answered: string }

export type Rig = {
  game: Game
  reports: Report[]
  haptics: string[]
  transitions: Array<{ kind: string; label?: string }>
  host: Host
}

/**
 * `experience` defaults to a child who is PAST the calm opening, so every test
 * written before `game/opening.ts` existed keeps asking about the game a
 * practised child actually gets. `opening.test.ts` is the one file that names
 * other values.
 */
export function rig(seed: number, reduced = false, now = 0, experience = LOGGED_PAST_CALM): Rig {
  const reports: Report[] = []
  const haptics: string[] = []
  const transitions: Array<{ kind: string; label?: string }> = []
  const host = createStubHost({
    seed,
    reducedMotion: reduced,
    onReport: (r) => reports.push(r),
    onHaptic: (k) => haptics.push(k),
    onTransition: (kind, label) => transitions.push({ kind, label }),
  })
  const game = new Game(host, new Rng(seed ^ 0x5ec2), now, reduced, experience)
  game.begin(now)
  return { game, reports, haptics, transitions, host }
}

/** The truth about a star. Only a test may ask this. */
export function truthOf(star: Star): { value: number; station: Station; order: number } {
  const value = answerOf(star.item)
  if (value === null) throw new Error(`harness: star ${star.id} has no station`)
  return { value, station: stationOf(value), order: orderOf(value) }
}

/**
 * Turn the rings until they stand at `want`, one detent at a time, the way a
 * child does. Returns how many detents it took.
 */
export function dialTo(game: Game, want: Station): number {
  let turns = 0
  for (let i = 0; i < 40 && game.station.x !== want.x; i++) {
    game.dial("ones", 1)
    turns++
  }
  for (let i = 0; i < 40 && game.station.y !== want.y; i++) {
    game.dial("tens", 1)
    turns++
  }
  if (game.station.x !== want.x || game.station.y !== want.y) {
    throw new Error("harness: the rings would not reach that station")
  }
  return turns
}

/**
 * Run the watch forward to `until`, in steps small enough that stars are
 * released and land on the same schedule they would on a device. Returns
 * `until`, so a test can carry one clock through without keeping two.
 */
export function raise(game: Game, until = 8200): number {
  const STEP = 100
  for (let t = STEP; t <= until; t += STEP) game.tick(STEP, t)
  return until
}

/** Every star currently falling and visible. */
export function falling(game: Game): Star[] {
  return game.stars.filter((s) => s.state === "falling" && s.t > 0)
}

/** Sight a star and dial its true station. Correctness is then one `mark` away. */
export function aimAt(game: Game, star: Star): void {
  game.sight(star.id)
  dialTo(game, truthOf(star).station)
}
