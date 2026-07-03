// journey-sim synthetic learner (engine.md §7.1). Ground-truth memory is
// deliberately NOT FSRS: power-law forgetting over a hidden strength S*,
// with exposure-spacing growth. Deterministic per (runSeed, persona, index).

import { createRng, fnv1a32, type Rng } from "../../src/journey/engine/rng.ts"
import type { ActivityResult, CourseGraph, EngineCard } from "../../src/journey/engine/types.ts"

export interface Persona {
  id: string
  aMu: number
  /** Attends on this (day, rng) → bool. */
  attends: (day: number, rng: Rng) => boolean
  sessionMinutes: number
  sessionsPerDay: number
  guessy?: boolean
  hintProb?: number
  /** Pre-known item prefix count (placed-intermediate). */
  priorKnownItems?: number
  /** Accept jump-checkpoint offers (daily-fast / placed-intermediate). */
  takesJumps?: boolean
  notes: string
}

export const PERSONAS: Persona[] = [
  { id: "daily-median", aMu: 0.0, attends: () => true, sessionMinutes: 15, sessionsPerDay: 1, notes: "the reference curve" },
  { id: "daily-fast", aMu: 1.0, attends: () => true, sessionMinutes: 15, sessionsPerDay: 1, takesJumps: true, notes: "cruise/Jump exerciser" },
  { id: "slow-struggler", aMu: -1.0, attends: (day) => day % 7 !== 6, sessionMinutes: 12, sessionsPerDay: 1, notes: "struggle/scaffold/demotion" },
  { id: "weekend-binger", aMu: 0.0, attends: (day) => day % 7 === 5 || day % 7 === 6, sessionMinutes: 60, sessionsPerDay: 1, notes: "backlog/debt-brake" },
  { id: "lapser", aMu: 0.0, attends: (day, rng) => (day >= 60 && day < 81 ? false : rng.next() < 0.5), sessionMinutes: 15, sessionsPerDay: 1, notes: "due-avalanche (forced 21d gap at day 60)" },
  { id: "placed-intermediate", aMu: 0.5, attends: () => true, sessionMinutes: 15, sessionsPerDay: 1, priorKnownItems: 800, takesJumps: true, notes: "placement + TRICKLE" },
  { id: "kid-guesser", aMu: -0.5, attends: () => true, sessionMinutes: 8, sessionsPerDay: 1, guessy: true, hintProb: 0.25, notes: "MC-cap/form-gate" },
]

interface ItemMemory {
  sStar: number // true strength, days
  lastDay: number
  bStar: number
}

export class Learner {
  readonly a: number
  readonly rng: Rng
  readonly persona: Persona
  readonly graph: CourseGraph
  private memory = new Map<string, ItemMemory>()
  private bStarNoise = new Map<string, number>()

  constructor(persona: Persona, graph: CourseGraph, seed: number) {
    this.persona = persona
    this.graph = graph
    this.rng = createRng(seed)
    this.a = this.rng.gauss(persona.aMu, 0.5)
    if (persona.priorKnownItems) {
      const ids = Object.keys(graph.items).sort(
        (x, y) => graph.items[x].introOrder - graph.items[y].introOrder,
      )
      for (const itemId of ids.slice(0, persona.priorKnownItems)) {
        this.memory.set(itemId, {
          sStar: 60 + this.rng.next() * 120,
          lastDay: -30,
          bStar: this.bStar(itemId),
        })
      }
    }
  }

  private bStar(itemId: string): number {
    let noise = this.bStarNoise.get(itemId)
    if (noise === undefined) {
      // stable per (learner, item): author-assigned b is noisy (§8.1)
      const local = createRng(fnv1a32(itemId) ^ Math.floor(this.a * 1e6))
      noise = local.gauss(0, 0.4)
      this.bStarNoise.set(itemId, noise)
    }
    return (this.graph.items[itemId]?.b ?? 0) + noise
  }

  private sigmoid(x: number): number {
    return 1 / (1 + Math.exp(-x))
  }

  /** P(recall now) for one item. */
  recallP(itemId: string, day: number): number {
    const mem = this.memory.get(itemId)
    if (!mem) return this.sigmoid(this.a - this.bStar(itemId)) * 0.15 // unseen: mostly unknown
    const dt = Math.max(0, day - mem.lastDay)
    return this.sigmoid(this.a - mem.bStar) * Math.pow(1 + dt / Math.max(0.25, mem.sStar), -0.35)
  }

  /** Register an unscored exposure (intro card / re-teach). */
  expose(itemId: string, day: number): void {
    const mem = this.memory.get(itemId)
    if (!mem) {
      const bStar = this.bStar(itemId)
      const s0 = Math.min(10, Math.max(0.4, Math.pow(2, this.a - bStar))) // S0*(a−b*), §7.1
      this.memory.set(itemId, { sStar: s0, lastDay: day, bStar })
    } else {
      mem.lastDay = day
    }
  }

  private applyOutcome(itemId: string, day: number, success: boolean): void {
    const mem = this.memory.get(itemId)
    if (!mem) {
      this.expose(itemId, day)
      if (!success) {
        const m = this.memory.get(itemId)!
        m.sStar = Math.max(m.sStar * 0.3, 0.5)
      }
      return
    }
    const dt = Math.max(0, day - mem.lastDay)
    if (success) {
      const nearForgetting = Math.min(1, dt / Math.max(0.5, mem.sStar))
      mem.sStar *= 1.6 + nearForgetting // 1.6–2.6, larger near forgetting
    } else {
      mem.sStar = Math.max(mem.sStar * 0.3, 0.5)
    }
    mem.lastDay = day
  }

  /** Answer one EngineCard → ActivityResult. */
  answer(card: EngineCard, day: number): ActivityResult {
    const form = card.meta.form
    const isIntro = card.spec.params?.intro === true
    const perItem: ActivityResult["perItem"] = []
    let scoreSum = 0
    let durationMs = 800

    for (const ref of card.spec.itemRefs) {
      const itemId = `${ref.kind}:${ref.source}:${ref.id}`
      if (isIntro || card.meta.checkpoint?.passScore === 0) {
        this.expose(itemId, day)
        perItem.push({ itemRef: ref, outcome: "pass", latencyMs: 2000 })
        scoreSum += 1
        durationMs += 2000
        continue
      }
      // scaffold = re-teach (example + recognition): the shown example
      // refreshes memory before the answer, like the card face does
      if (card.meta.pool === "scaffold") this.expose(itemId, day)
      let p = this.recallP(itemId, day)
      if (form === 0) p = 0.25 + 0.75 * p // recognition guess floor
      if (form === 2) p *= 0.85 // production is harder
      if (this.persona.guessy && form === 0) p = Math.min(1, p + 0.1)
      const success = this.rng.next() < p
      this.applyOutcome(itemId, day, success)
      const median = 2500 + form * 2500
      const latencyMs = Math.max(
        400,
        Math.round(median * (2 - p) * Math.exp(this.rng.gauss(0, 0.35))),
      )
      const hintsUsed =
        !success && this.rng.next() < (this.persona.hintProb ?? 0.05) ? 1 : 0
      perItem.push({
        itemRef: ref,
        outcome: success ? "pass" : "fail",
        latencyMs,
        hintsUsed,
      })
      scoreSum += success ? 1 : 0
      durationMs += latencyMs
    }

    const n = Math.max(1, card.spec.itemRefs.length)
    return {
      specId: card.spec.specId,
      score: scoreSum / n,
      perItem,
      durationMs,
    }
  }
}
