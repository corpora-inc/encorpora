// Pacing. What descends, how fast, how often it steps sideways, and when the
// next CORE comes.
//
// Two rules from the house experience design shape every number in here:
//
//   * **Escalation is on difficulty, never on run length as a streak.** The
//     pressure curve below is a function of elapsed time and total kills — the
//     size of the run — and of nothing that a single mistake can reset. There is
//     no "don't break it" in this game.
//   * **The field is never empty.** A lattice with nothing on it is a lattice
//     with no mathematics on it, so the floor on live automata rises with the
//     run rather than the ceiling alone.

import { isFieldValue, MAX_BEAM, resonates, validBeamCount } from "./lattice.ts"

export type Pressure = {
  /** 0..1 — the single scalar every other number below is derived from. */
  level: number
  /** Seconds an automaton takes to cross the lattice, top to floor. */
  descentSeconds: number
  /** Seconds between an automaton's sideways steps along the lattice. */
  stepSeconds: number
  /** Seconds between spawns. */
  spawnGap: number
  /** How many automata the director wants alive at once. */
  floorCount: number
  /** Preference, 0..1, for values that only one beam divides. */
  tightness: number
}

const lerp = (a: number, b: number, t: number): number => a + (b - a) * t

export class Director {
  private elapsed = 0
  private kills = 0
  private sinceSpawn = 0
  private sinceCore = 0
  private coresRun = 0

  /** Seconds of play, for the pressure curve. Advanced by the frame loop. */
  advance(dt: number): void {
    this.elapsed += dt
    this.sinceSpawn += dt
    this.sinceCore += dt
  }

  recordKill(): void {
    this.kills++
  }

  get killCount(): number {
    return this.kills
  }

  get coreCount(): number {
    return this.coresRun
  }

  pressure(): Pressure {
    // Ninety seconds to the top of the curve, with kills pulling it forward so
    // a child who is good at this gets there sooner than one who is grinding.
    const byTime = Math.min(1, this.elapsed / 90)
    const byKills = Math.min(1, this.kills / 60)
    const level = Math.min(1, byTime * 0.65 + byKills * 0.45)
    return {
      level,
      // The floor was 13 and that was wrong. A run opens at pressure zero, and
      // at 13 seconds a crossing the first minute of play contained about two
      // curriculum problems — a child's first thirty seconds with this game is
      // exactly when it has to prove it is about arithmetic.
      descentSeconds: lerp(10, 5.8, level),
      stepSeconds: lerp(1.15, 0.62, level),
      spawnGap: lerp(2.0, 0.95, level),
      floorCount: Math.round(lerp(2, 5, level)),
      tightness: lerp(0.15, 0.8, level),
    }
  }

  /** True when it is time to put another ordinary automaton on the lattice. */
  wantsSpawn(live: number): boolean {
    const p = this.pressure()
    if (live < p.floorCount) return true
    return this.sinceSpawn >= p.spawnGap
  }

  noteSpawn(): void {
    this.sinceSpawn = 0
  }

  /**
   * A CORE two seconds after the last one cleared, and never while one is
   * already down.
   *
   * The number that matters here is the DEAD TIME — how long the lattice holds
   * no question at all. It is this gap plus the core's approach to the fracture
   * line, and at the first cadence tried it was eleven seconds, which put one
   * curriculum item in front of a child every twenty-four seconds of play. That
   * is a shooter with some arithmetic in it rather than the other way round.
   *
   * The answering window is deliberately NOT part of the tightening: a child's
   * comprehension time is measured, never rationed. What was cut is the time
   * with nothing to think about. A wave ends the moment it is answered, so
   * reading quickly is what buys the next problem — the pacing rewards fluency
   * instead of running on a fixed clock.
   */
  wantsCore(coreLive: boolean): boolean {
    if (coreLive) return false
    return this.sinceCore >= 2
  }

  noteCore(): void {
    this.sinceCore = 0
    this.coresRun++
  }

  /**
   * A core was wanted and could not be built — the field was full, or eight
   * items in a row had answers no readable lattice can be tuned to. Back off
   * the same four seconds rather than retrying on the very next frame, which
   * would drain the host's item pool at sixty draws a second.
   */
  deferCore(): void {
    this.sinceCore = 0
  }

  reset(): void {
    this.elapsed = 0
    this.kills = 0
    this.sinceSpawn = 0
    this.sinceCore = 0
    this.coresRun = 0
  }
}

/**
 * A value for an ordinary automaton on this lattice.
 *
 * Built as `beam × multiplier`, so it is killable by construction — there is no
 * dodge verb in this game and an unkillable automaton would be a breach the
 * child could do nothing about. `tightness` biases toward values that exactly
 * one beam divides, which is the precision intercept the run escalates into.
 */
export function fieldValue(
  beams: readonly number[],
  tightness: number,
  rand: () => number,
): number {
  if (beams.length === 0) return MAX_BEAM
  const wantTight = rand() < tightness
  let best = 0
  let bestScore = -1
  // A handful of draws, keeping the one that best matches what was asked for.
  // Cheap, allocation-free, and it degrades to "any legal value" rather than
  // looping forever when a lattice has no tight values left in range.
  for (let attempt = 0; attempt < 12; attempt++) {
    const beam = beams[Math.min(beams.length - 1, Math.floor(rand() * beams.length))] as number
    const mult = 2 + Math.floor(rand() * 14)
    const value = beam * mult
    if (!isFieldValue(beams, value)) continue
    const n = validBeamCount(beams, value)
    const score = wantTight ? (n === 1 ? 3 : n === 2 ? 1 : 0) : n >= 2 ? 2 : 1
    if (score > bestScore) {
      bestScore = score
      best = value
    }
    if (bestScore >= 3) break
  }
  if (best === 0) {
    const beam = beams[0] as number
    best = beam * 2
  }
  return best
}

/**
 * The score a kill pays: the tighter the divisor, the more it is worth.
 *
 * This is the pedagogy written into the economy. Killing 84 from beam 2 is the
 * thing anyone can see; killing it from beam 7 is the thing worth learning. So
 * a lone valid beam pays double, and a bigger divisor pays more than a smaller
 * one — the trivial read is always the cheapest one on the board.
 */
export function killScore(beam: number, value: number, validBeams: number): number {
  if (!resonates(beam, value)) return 0
  const base = 8 + beam * 5 + Math.min(40, Math.floor(value / 8))
  const sole = validBeams <= 1 ? 2 : 1
  return base * sole
}
