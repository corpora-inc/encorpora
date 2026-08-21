// Shared scaffolding for the rules tests: a recording host, and two players.
//
// Every test in this package is seeded from a literal. Nothing here reads
// `Math.random`, `Date.now` or `performance.now`, so a run that passes passes
// every time and a run that fails fails every time.

import type { Host } from "../contract.ts"
import { Rng } from "../core/rng.ts"
import { Game } from "../game/game.ts"
import { createStubHost } from "../stubHost.ts"
import { answerOf, standingSolution } from "../game/tower.ts"

export type Report = { questionId: string; correct: boolean; ms: number; answered: string }

export type Rig = {
  host: Host
  game: Game
  reports: Report[]
  transitions: Array<{ kind: string; label?: string }>
  haptics: string[]
}

export function rig(seed = 0xc0105505, opts: { difficulty?: number } = {}): Rig {
  const reports: Report[] = []
  const transitions: Array<{ kind: string; label?: string }> = []
  const haptics: string[] = []
  const host = createStubHost({
    seed,
    reducedMotion: true,
    ...(opts.difficulty === undefined ? {} : { difficulty: opts.difficulty }),
    onReport: (r) => reports.push(r),
    onHaptic: (k) => haptics.push(k),
    onTransition: (kind, label) => transitions.push(label === undefined ? { kind } : { kind, label }),
  })
  const game = new Game(host, new Rng(seed ^ 0x1234), 0)
  game.begin(0)
  return { host, game, reports, transitions, haptics }
}

/** The ids of the floors that are standing as the current keystone's answer. */
export function solutionIds(game: Game): number[] {
  return standingSolution(game.floors, game.progress.done).ids
}

/** A child who works it out: hold the answer, strike once, every time. */
export function playCarefully(game: Game, strikes: number, clock = stepClock()): number[] {
  const heights: number[] = []
  for (let i = 0; i < strikes; i++) {
    if (game.stalled) break
    for (const id of solutionIds(game)) game.toggle(id)
    game.strike(clock())
    heights.push(game.height)
  }
  return heights
}

/**
 * A child who flails: grab whatever is under the thumb and hit STRIKE.
 *
 * Deliberately *not* an empty fist — an empty fist is not an assertion and
 * costs nothing, which is by design. This is the honest model of mashing: a
 * handful of distinct slabs, chosen without thinking, committed immediately.
 *
 * Returns the tower height after each strike, so a whole sitting can be
 * compared rather than one lucky grab.
 */
export function playByMashing(
  game: Game,
  strikes: number,
  rng: Rng,
  clock = stepClock(),
): number[] {
  const heights: number[] = []
  for (let i = 0; i < strikes; i++) {
    if (game.stalled) break
    const floors = game.floors
    if (floors.length === 0) break
    const want = rng.int(1, Math.min(3, floors.length))
    const grabbed = new Set<number>()
    let guard = 0
    while (grabbed.size < want && guard++ < 40) {
      const floor = floors[rng.int(0, floors.length - 1)]
      if (floor) grabbed.add(floor.id)
    }
    for (const id of grabbed) game.toggle(id)
    game.strike(clock())
    heights.push(game.height)
  }
  return heights
}

export function mean(xs: readonly number[]): number {
  return xs.length === 0 ? 0 : xs.reduce((a, b) => a + b, 0) / xs.length
}

/** A wall clock that ticks a fixed amount per call. No real time anywhere. */
export function stepClock(step = 1800): () => number {
  let t = 0
  return () => {
    t += step
    return t
  }
}

export function currentAnswer(game: Game): number {
  const keystone = game.keystone
  return keystone ? answerOf(keystone) : 0
}
