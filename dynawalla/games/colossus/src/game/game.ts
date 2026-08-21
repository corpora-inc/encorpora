// COLOSSUS — the rules, with no canvas anywhere near them.
//
// One verb: STRIKE.
//
//   * A keystone hangs over the tower carrying a sum: `47 + 25`.
//   * Every floor of the tower carries a number.
//   * Tap floors to take hold of them. The fist reads back what you are
//     holding as an expression — `8 × 9` — and never as a total. The child
//     multiplies; the game does not do it for them.
//   * STRIKE. If what you are holding multiplies to the keystone, those floors
//     blow out, everything above falls into the hole, and the keystone's own
//     decoys crumble with it.
//   * If it does not, **the tower gets taller.** Fresh slabs thud down on the
//     top and the keystone rides up out of reach. No buzzer, no lost life, no
//     red X. More building.
//
// Taking hold of a floor is free and reversible, so exploring a factorisation
// costs nothing. STRIKE is the assertion, and it is the only thing reported.
// Flail at it and the tower grows faster than you can bring it down, which is
// a thing a child can see from across a room.
//
// **What crosses to the host.** The product of what was held, as a string. That
// is a value the host can judge exactly against its canonical answer, and when
// it is wrong it is usually wrong in a way the host recognises: the decoy slabs
// are the mal-rule outputs, so punching one reports the misconception itself.

import type { Host, Question } from "../contract.ts"
import { Rng } from "../core/rng.ts"
import { productOf, slabsFor } from "./factor.ts"
import {
  FLOOR_BUDGET,
  GROWTH,
  MAX_FLOORS,
  MAX_KEYSTONES,
  MIN_KEYSTONES,
  answerOf,
  floorsFor,
  isUsable,
  rubble,
  slabCount,
  standingSolution,
  type Floor,
} from "./tower.ts"

export type GameEvent =
  | { kind: "hold"; floor: Floor }
  | { kind: "release"; floor: Floor }
  | { kind: "clear"; removed: readonly Floor[]; product: number; keystone: Question }
  | { kind: "grow"; added: readonly Floor[]; product: number; keystone: Question; capped: boolean }
  | { kind: "keystone"; question: Question }
  | { kind: "level"; level: number; toppled: boolean; cleared: number }
  | { kind: "stalled" }

export type Tally = {
  /** Keystones brought down. */
  cleared: number
  /** Keystones that got away. */
  missed: number
  /** Towers put on the ground. */
  toppled: number
}

/** How many draws we are willing to make to find one question we can build with. */
const DRAW_ATTEMPTS = 8

export class Game {
  private readonly host: Host
  private readonly rng: Rng
  private id = 1

  private queue: Question[] = []
  private cursor = 0
  private levelNo = 1
  /** Keystones brought down in the tower currently standing. */
  private clearedHere = 0

  private tower: Floor[] = []
  private held = new Set<number>()

  /** Wall-clock mark for the current keystone, shifted forward across a pause. */
  private askedAt = 0
  private paused = false
  private pausedAt = 0

  /** Nothing the host serves can be built with. Loud, and drawn on the surface. */
  private stalledFlag = false

  readonly tally: Tally = { cleared: 0, missed: 0, toppled: 0 }

  constructor(host: Host, rng: Rng, now: number) {
    this.host = host
    this.rng = rng
    this.askedAt = now
  }

  /** Build the first tower. Separate from the constructor so events can be seen. */
  begin(now: number): GameEvent[] {
    return this.buildLevel(now)
  }

  get floors(): readonly Floor[] {
    return this.tower
  }

  get height(): number {
    return this.tower.length
  }

  get level(): number {
    return this.levelNo
  }

  get stalled(): boolean {
    return this.stalledFlag
  }

  /** Keystones answered so far in this tower, right or wrong. */
  get progress(): { done: number; total: number } {
    return { done: this.cursor, total: this.queue.length }
  }

  get keystone(): Question | null {
    return this.queue[this.cursor] ?? null
  }

  get isPaused(): boolean {
    return this.paused
  }

  get holding(): readonly number[] {
    return [...this.held]
  }

  /** The values in the fist, in tower order, so the fist reads bottom-up. */
  heldValues(): number[] {
    return this.tower.filter((f) => this.held.has(f.id)).map((f) => f.value)
  }

  isHeld(id: number): boolean {
    return this.held.has(id)
  }

  /**
   * Take hold of a floor, or let it go.
   *
   * Inert while paused. The host can put a sheet over a still-mounted pack, and
   * a touch that lands behind it is not a thing the child did.
   */
  toggle(id: number): GameEvent[] {
    if (this.paused || this.stalledFlag) return []
    const floor = this.tower.find((f) => f.id === id)
    if (!floor) return []
    if (this.held.delete(id)) return [{ kind: "release", floor }]
    this.held.add(id)
    return [{ kind: "hold", floor }]
  }

  /** Let go of everything. Free, and never reported. */
  releaseAll(): void {
    if (this.paused) return
    this.held.clear()
  }

  /**
   * STRIKE.
   *
   * An empty fist is not an assertion: it does nothing, reports nothing and
   * costs nothing. Everything else is reported, and the tower answers.
   */
  strike(now: number): GameEvent[] {
    if (this.paused || this.stalledFlag) return []
    const keystone = this.keystone
    if (!keystone) return []
    const values = this.heldValues()
    if (values.length === 0) return []

    const product = productOf(values)
    const target = answerOf(keystone)
    const right = product === target
    const ms = Math.max(0, now - this.askedAt)

    // The host judges. What goes across is the value the child asserted — and
    // when they punched a decoy that value is the mal-rule output itself.
    this.host.report({
      questionId: keystone.id,
      correct: right,
      ms,
      answered: String(product),
    })

    const events: GameEvent[] = right
      ? this.collapse(keystone, product)
      : this.grow(keystone, product)

    this.held.clear()
    this.cursor += 1
    events.push(...this.afterKeystone(now))
    return events
  }

  /** The host put a sheet over us. Stop the clock; stop taking input. */
  pause(now: number): void {
    if (this.paused) return
    this.paused = true
    this.pausedAt = now
  }

  /**
   * The sheet came off. Shift the keystone's wall-clock mark forward by the
   * span the child was not here for, so the latency reported is time they
   * actually spent looking at the tower.
   */
  resume(now: number): void {
    if (!this.paused) return
    this.paused = false
    this.askedAt += Math.max(0, now - this.pausedAt)
  }

  // ── internals ─────────────────────────────────────────────────────────────

  private collapse(keystone: Question, product: number): GameEvent[] {
    const doomed = new Set<number>(this.held)
    for (const floor of this.tower) {
      // The keystone's own stones go with it: the floors that made its answer
      // and the slabs that carried its lies. That is the big collapse, and it
      // is what makes the tower a countdown rather than a scoreboard.
      if (floor.owner === this.cursor) doomed.add(floor.id)
    }
    const removed = this.tower.filter((f) => doomed.has(f.id))
    this.tower = this.tower.filter((f) => !doomed.has(f.id))
    this.tally.cleared += 1
    this.clearedHere += 1
    return [{ kind: "clear", removed, product, keystone }]
  }

  private grow(keystone: Question, product: number): GameEvent[] {
    // The keystone's stones stay standing and go cold. They belong to nobody
    // now, so nothing will ever carry them out for free.
    for (const floor of this.tower) {
      if (floor.owner === this.cursor) {
        floor.owner = -1
        floor.kind = "rubble"
      }
    }
    const room = Math.max(0, MAX_FLOORS - this.tower.length)
    const added = rubble(Math.min(GROWTH, room), this.rng, () => this.id++)
    this.tower.push(...added)
    this.tally.missed += 1
    return [{ kind: "grow", added, product, keystone, capped: added.length < GROWTH }]
  }

  /** Move to the next keystone, or wrap the level up and raise the next tower. */
  private afterKeystone(now: number): GameEvent[] {
    if (this.cursor < this.queue.length) {
      this.askedAt = now
      const events: GameEvent[] = []
      this.replant()
      const next = this.keystone
      if (next) events.push({ kind: "keystone", question: next })
      return events
    }

    const toppled = this.tower.length === 0
    if (toppled) this.tally.toppled += 1
    const cleared = this.clearedHere
    const events: GameEvent[] = [{ kind: "level", level: this.levelNo, toppled, cleared }]

    // A tower the child brought keystones down on is a stopping point they
    // reached. A tower left standing is not a failure in this game — there is
    // no failure state — but it is not an achievement either, so the sheet the
    // host may raise here waits for a level with at least one clear in it.
    if (cleared > 0) this.host.transition?.("level", toppled ? "toppled" : "level")

    this.levelNo += 1
    events.push(...this.buildLevel(now))
    return events
  }

  /**
   * Raise the next tower.
   *
   * Keystones are taken until the building is about `FLOOR_BUDGET` floors tall,
   * not until a fixed count is reached: a keystone whose answer is cut into
   * three slabs is more building than one cut into a single slab, and a tower
   * a child cannot reach the top of is a worse tower whichever tier built it.
   */
  private buildLevel(now: number): GameEvent[] {
    this.clearedHere = 0
    const questions: Question[] = []
    const floors: Floor[] = []

    while (questions.length < MAX_KEYSTONES) {
      if (questions.length >= MIN_KEYSTONES && floors.length >= FLOOR_BUDGET) break
      const question = this.drawOne()
      if (!question) break
      const want = slabCount(question.difficulty, this.levelNo, questions.length)
      floors.push(...floorsFor(question, questions.length, want, this.rng, () => this.id++))
      questions.push(question)
    }

    if (questions.length === 0) {
      this.stalledFlag = true
      console.error("[colossus] the host served nothing this game can build a tower from")
      return [{ kind: "stalled" }]
    }

    // Shuffled through the whole height, so the answer to the third keystone is
    // not standing in a neat band above the answer to the second.
    this.rng.shuffle(floors)
    this.queue = questions
    this.tower = floors
    this.cursor = 0
    this.held.clear()
    this.askedAt = now
    const first = this.keystone
    return first ? [{ kind: "keystone", question: first }] : []
  }

  /**
   * Re-plant the current keystone's answer if it is no longer standing.
   *
   * A child who makes 72 out of an 8 from this keystone and a 9 borrowed from a
   * later one is entirely right, and the later keystone must not be left
   * unanswerable for it. The stones come back; the tower is a little taller for
   * it, which is honest — that answer was spent.
   */
  private replant(): void {
    const question = this.keystone
    if (!question) return
    const standing = standingSolution(this.tower, this.cursor)
    if (standing.product === answerOf(question)) return

    const stale = new Set(standing.ids)
    this.tower = this.tower.filter((f) => !stale.has(f.id))
    const want = slabCount(question.difficulty, this.levelNo, this.cursor)
    const values = slabsFor(answerOf(question), want, this.rng)
    const fresh: Floor[] = values.map((value) => ({
      id: this.id++,
      value,
      owner: this.cursor,
      kind: "solution" as const,
    }))
    // Slotted through the height rather than dropped on the top: a keystone's
    // answer must never be the three slabs that just appeared.
    for (const floor of fresh) {
      const at = this.rng.int(0, this.tower.length)
      this.tower.splice(at, 0, floor)
    }
  }

  /**
   * One keystone this game can actually build with: an exact positive integer
   * answer. A decimal cannot be a product of slabs, and rounding one would
   * report a value the child never asserted, so it is dropped rather than bent.
   */
  private drawOne(): Question | null {
    for (let i = 0; i < DRAW_ATTEMPTS; i++) {
      const question = this.host.next()
      if (isUsable(question)) return question
    }
    console.warn("[colossus] the host served nothing buildable in eight draws")
    return null
  }
}

/** Exposed for the tests and the HUD; the engine owns the numbers. */
export { GROWTH, MAX_FLOORS, MAX_KEYSTONES, MIN_KEYSTONES }
