// The automata, and their walk down the lattice.
//
// Position is expressed as `(beam, t)` and nothing else: `beam` is an index
// into the lattice's labels and `t` runs 0 at the horizon to 1 at the floor.
// Screen space is the renderer's problem, which is what lets the descent, the
// sideways stepping and the intercept be tested with no canvas at all.
//
// The sideways step is the reason divisibility is a *decision* rather than a
// lookup. An automaton carrying 84 walks the lattice; on a board of 3·4·5·7·9
// it can be taken from four different beams, and the child chooses which — the
// obvious one now, or the tight one worth double if they can get there in time.

export const A_ORDINARY = 0
export const A_CORE = 1
export const A_CANDIDATE = 2

export type Automaton = {
  alive: boolean
  kind: number
  /** The number on the hull. For a CORE this is the answer, and it is hidden. */
  value: number
  /** What is printed on the hull: a numeral, or a CORE's problem. */
  text: string
  /** Lattice column, an index into the beam labels. */
  beam: number
  /** Animated column, eased toward `beam` — the visible slide. */
  slide: number
  /** 0 at the horizon, 1 at the floor. */
  t: number
  /** Turns per second down the lattice. */
  speed: number
  /** Multiplies `speed`. A dissonant strike raises it: a wrong read costs time. */
  urgency: number
  stepIn: number
  stepDir: number
  /** Seconds left of the dissonance ring — visual and audible, never a penalty. */
  ring: number
  /** Candidate bookkeeping. */
  correct: boolean
  /** Serial, so a kill can be matched to the body that produced it. */
  serial: number
  /** Set on a CORE the frame it fractures, so it fractures exactly once. */
  fractured: boolean
  spawnedAt: number
}

const CAP = 40

function blank(): Automaton {
  return {
    alive: false,
    kind: A_ORDINARY,
    value: 0,
    text: "",
    beam: 0,
    slide: 0,
    t: 0,
    speed: 0.1,
    urgency: 1,
    stepIn: 1,
    stepDir: 1,
    ring: 0,
    correct: false,
    serial: 0,
    fractured: false,
    spawnedAt: 0,
  }
}

export class Field {
  readonly bodies: Automaton[] = []
  private serial = 0

  constructor() {
    for (let i = 0; i < CAP; i++) this.bodies.push(blank())
  }

  spawn(): Automaton | null {
    for (const b of this.bodies) {
      if (b.alive) continue
      const s = ++this.serial
      Object.assign(b, blank())
      b.alive = true
      b.serial = s
      return b
    }
    return null
  }

  clear(): void {
    for (const b of this.bodies) b.alive = false
  }

  liveCount(kind?: number): number {
    let n = 0
    for (const b of this.bodies) {
      if (!b.alive) continue
      if (kind !== undefined && b.kind !== kind) continue
      n++
    }
    return n
  }

  /**
   * Advance every automaton. Returns the bodies that reached the floor this
   * step — the caller decides what a breach costs, because a CORE candidate
   * landing is a missed question and an ordinary automaton landing is damage.
   */
  update(dt: number, columns: number, stepSeconds: number, out: Automaton[]): void {
    out.length = 0
    for (const b of this.bodies) {
      if (!b.alive) continue
      if (b.ring > 0) b.ring = Math.max(0, b.ring - dt)
      b.t += b.speed * b.urgency * dt
      // Ease the drawn column toward the logical one. Exponential, so the slide
      // is quick at the start and settles — a step reads as a decision, not a
      // drift.
      b.slide += (b.beam - b.slide) * Math.min(1, dt * 11)
      b.stepIn -= dt
      if (b.stepIn <= 0 && columns > 1) {
        b.stepIn += stepSeconds
        let next = b.beam + b.stepDir
        if (next < 0 || next > columns - 1) {
          b.stepDir = -b.stepDir
          next = b.beam + b.stepDir
        }
        b.beam = Math.max(0, Math.min(columns - 1, next))
      }
      if (b.t >= 1) {
        b.t = 1
        out.push(b)
      }
    }
  }

  /**
   * Bodies a pulse fired up `column` sweeps through as it travels from `fromT`
   * down to `toT` (remember `t` counts *down* the screen, so a rising pulse has
   * `toT < fromT`). Sorted nearest-first, which is the order the pulse meets
   * them and therefore the order they must resolve in.
   */
  sweep(column: number, fromT: number, toT: number, out: Automaton[]): void {
    out.length = 0
    for (const b of this.bodies) {
      if (!b.alive) continue
      // The drawn column is what the child aimed at, so the hit test uses it —
      // an automaton visibly mid-slide is half on each beam and forgiving on
      // both, which is the right way round for a moving target.
      if (Math.abs(b.slide - column) > 0.45) continue
      if (b.t > fromT || b.t < toT) continue
      out.push(b)
    }
    out.sort((x, y) => y.t - x.t)
  }

  /** The automaton a runner on `column` is currently resonating against. */
  target(column: number): Automaton | null {
    let best: Automaton | null = null
    for (const b of this.bodies) {
      if (!b.alive) continue
      if (Math.abs(b.slide - column) > 0.5) continue
      if (best === null || b.t > best.t) best = b
    }
    return best
  }
}
