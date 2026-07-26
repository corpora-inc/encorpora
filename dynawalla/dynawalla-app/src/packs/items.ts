// Where a question comes from, and who says whether it was right.
//
// `bridge.ts` is deliberately ignorant of what an item is; this is the module
// it is ignorant of. Everything here is `@dynawalla/curriculum` — the skill
// graph, the generator families, the executable mal-rules — and nothing here
// does arithmetic of its own. That is the whole point of ADR-0022 read from the
// host's side: the pack draws, the curriculum decides, and a game that wanted
// to be beaten by fiddling with what it renders has nothing to fiddle with.
//
// Three properties, each of them a reason this file exists rather than the
// equivalent living in a pack:
//
//   * **Exact.** Every operand, every answer and every distractor is a
//     `Rational` rendered to a decimal string. No `number` is ever parsed out
//     of one and no float is ever compared.
//   * **Seeded.** An item is a pure function of (profile, pack, sequence). The
//     same learner on the same pack on two devices gets the same ladder.
//   * **Judged here.** `nextItem` does not carry the answer. `judge` records
//     the attempt and *then* returns the canonical value, so `reveal` — which
//     a game that must place the correct target before the child reaches it
//     genuinely needs — is a declared capability rather than a hole.
//
// **What a rung is.** The curriculum ships one generator family so far
// (`gen.arith.column-op`) bound to four active skills at four levels each. The
// rungs are those bindings, sorted by the difficulty the node itself declares,
// and the ladder walks them: a fast correct answer climbs, a wrong one steps
// down. That is not the FSRS scheduler (ADR-0008) — it is the smallest honest
// thing that makes a pack's stream get harder — and it is confined to this file
// so replacing it does not touch the boundary.

import type {
  Item,
  ItemChoice,
  Judgement,
  LearnerSummary,
} from "../../../packs/sdk/src/index.ts"
import type {
  AnswerValue,
  AnyGeneratorFamily,
  Exercise,
  PromptSlot,
  Rational,
  SkillNode,
} from "./curriculum.ts"
import {
  activeNodes,
  familyById,
  FORM_FREE_ENTRY,
  PROMPT_KEY_SUB,
  rational,
  seedFrom,
  createRng,
  SLOT_BOTTOM,
  SLOT_TOP,
} from "./curriculum.ts"

/** U+2212. A hyphen is not a minus sign, and at 40px a child can tell. */
const MINUS = "−"

/** Items kept addressable for `judge` and `reveal`. Oldest evicted first. */
const LEDGER_LIMIT = 512

/** Faster than this and the ladder climbs. Half the slowest node's p50. */
const QUICK_MS = 6_000

/**
 * Options on a closed list: the canonical answer and three wrong ones.
 *
 * Four because that is what a two-by-two grid holds, and a game that draws its
 * options as a grid draws an empty cell for a missing one.
 */
const CHOICE_COUNT = 4

export type Rung = {
  readonly node: SkillNode
  readonly family: AnyGeneratorFamily
  readonly params: unknown
  readonly level: number
}

/**
 * Every (skill, level) the shipped graph can generate, easiest first.
 *
 * Ordered by the node's own declared difficulty for the level, which is a
 * `Rational` — so the sort is exact and does not depend on how two coefficients
 * round. A binding whose family is not registered, or whose parameters do not
 * validate, is dropped rather than throwing: an unusable rung is a curriculum
 * bug, and it must not be a blank screen in a child's game.
 */
export function ladder(nodes: readonly SkillNode[] = activeNodes()): readonly Rung[] {
  const rungs: { rung: Rung; b: Rational }[] = []
  for (const node of nodes) {
    const family = familyById(node.generator.family)
    if (!family) continue
    node.generator.params.forEach((raw, level) => {
      const parsed = family.paramSchema.validate(raw)
      if (!parsed.ok) return
      const own = node.difficulty.levels[level]
      if (own === undefined) return
      rungs.push({
        rung: { node, family, params: parsed.value, level },
        b: rational.add(node.difficulty.b, own),
      })
    })
  }
  rungs.sort((a, b) => rational.cmp(a.b, b.b))
  return rungs.map((entry) => entry.rung)
}

/** The forms a rung may serve. Free entry when it has one: a pack owns its own
    surface, and the column scaffold is a host-drawn worksheet by another name. */
function formsFor(rung: Rung): readonly string[] {
  const declared = rung.node.generator.forms
  return declared.includes(FORM_FREE_ENTRY) ? [FORM_FREE_ENTRY] : declared
}

function slotText(slot: PromptSlot | undefined): string {
  if (slot === undefined) return ""
  if (slot.kind === "number") {
    return rational.toDecimalString(slot.value, slot.decimalPlaces) ?? rational.toString(slot.value)
  }
  if (slot.kind === "count") return String(slot.value)
  return slot.key
}

/** An answer value as a child would write it. Never a float, never rounded. */
export function answerText(value: AnswerValue, decimalPlaces: number): string | null {
  if (value.kind === "integer" || value.kind === "columnAlgorithm") {
    return rational.toDecimalString(value.value, decimalPlaces)
  }
  return null
}

function decimalPlacesOf(exercise: Exercise): number {
  const schema = exercise.schema
  return schema.kind === "integer" || schema.kind === "columnAlgorithm" ? schema.decimalPlaces : 0
}

function digitsOf(exercise: Exercise): number | undefined {
  const schema = exercise.schema
  if (schema.kind === "integer") return schema.digits
  if (schema.kind === "columnAlgorithm") return schema.cols
  return undefined
}

/**
 * The closed list a pack may offer, canonical included, deterministically
 * shuffled.
 *
 * Offered on every item rather than only on a choice-schema one: a tower
 * defence that puts three slabs on a wall needs two wrong answers a child would
 * actually produce, and the mal-rules are the only place those exist. A pack
 * that wants free entry ignores the list; `judge` accepts either the value text
 * or a choice id, so neither presentation changes who decides.
 */
export function choicesFor(exercise: Exercise, places: number): readonly ItemChoice[] {
  const canonical = answerText(exercise.answer.canonical, places)
  if (canonical === null) return []
  const texts: string[] = [canonical]
  for (const distractor of exercise.distractors) {
    const text = answerText(distractor.value, places)
    if (text === null || texts.includes(text)) continue
    texts.push(text)
    if (texts.length === CHOICE_COUNT) break
  }

  // A mal-rule only fires when the item can provoke it, so a clean two-digit
  // sum offers one wrong answer and a three-way choice would be a coin toss.
  // The padding is place-value near-misses — off by one, off by ten — computed
  // in exact rationals like everything else here. They are not diagnoses and
  // are never reported as one; they exist so a closed list is a choice.
  //
  // Four, not three: a game that lays its options out in a grid draws an empty
  // slab for a missing one, and an empty slab is a wrong answer a child cannot
  // read.
  const exact = exercise.answer.canonical
  if (exact.kind === "integer" || exact.kind === "columnAlgorithm") {
    for (const offset of [1n, -1n, 10n, -10n, 100n, -100n, 9n, 11n]) {
      if (texts.length >= CHOICE_COUNT) break
      const shifted = rational.add(exact.value, rational.rational(offset))
      if (rational.sign(shifted) < 0) continue
      const text = rational.toDecimalString(shifted, places)
      if (text === null || texts.includes(text)) continue
      texts.push(text)
    }
  }
  const rng = createRng(seedFrom(exercise.exerciseId, "choices"))
  // Fisher–Yates over the integer stream, so the order is stable per exercise
  // and the right answer is not always the first slab on the wall.
  for (let i = texts.length - 1; i > 0; i--) {
    const j = rng.nextInt(0, i)
    const a = texts[i] as string
    const b = texts[j] as string
    texts[i] = b
    texts[j] = a
  }
  return texts.map((text, index) => ({ id: `c${String(index)}`, text }))
}

type Served = {
  readonly exercise: Exercise
  readonly rung: Rung
  readonly places: number
  readonly choices: readonly ItemChoice[]
  answered: boolean
}

export type ItemServiceDeps = {
  /** Namespaces the seed, so two learners do not share a stream. */
  readonly profileId: string
  /** Recorded against the learner. The host's only inbound write. */
  readonly record: (outcome: { packId: string; correct: boolean }) => void
  readonly rungs?: readonly Rung[]
}

export type ItemService = {
  next(input: { packId: string; skillId?: string }): Item | null
  judge(input: {
    packId: string
    itemId: string
    response: string
    latencyMs: number
  }): Judgement
  reveal(itemId: string): string
  skip(itemId: string): void
  summary(): LearnerSummary
  /** The rung the ladder is standing on. Read by the developer surface. */
  readonly position: () => number
}

/**
 * Everything the bridge's item methods are, as one object.
 *
 * Synchronous: nothing here touches IO. `services.ts` is what wraps it in the
 * promises `HostServices` asks for, which keeps every decision in this file
 * testable in Node with no DOM, no Tauri and no frame.
 */
export function createItemService(deps: ItemServiceDeps): ItemService {
  const rungs = deps.rungs ?? ladder()
  const ledger = new Map<string, Served>()
  const order: string[] = []
  const practised = new Set<string>()
  let position = 0
  let sequence = 0

  const remember = (id: string, served: Served) => {
    ledger.set(id, served)
    order.push(id)
    while (order.length > LEDGER_LIMIT) {
      const evicted = order.shift()
      if (evicted !== undefined) ledger.delete(evicted)
    }
  }

  const rungAt = (index: number): Rung | null => {
    if (rungs.length === 0) return null
    const clamped = Math.max(0, Math.min(rungs.length - 1, index))
    return rungs[clamped] ?? null
  }

  return {
    position: () => position,

    next: ({ packId, skillId }) => {
      // A pack may name a skill it covers. It is a request, not an instruction:
      // an unknown id falls back to the ladder rather than failing, because a
      // pack built against a later curriculum must still be playable.
      const wanted =
        skillId === undefined ? null : (rungs.find((rung) => rung.node.id === skillId) ?? null)
      const rung = wanted ?? rungAt(position)
      if (!rung) return null

      sequence += 1
      const seed = seedFrom(deps.profileId, packId, String(sequence))
      let exercise: Exercise
      try {
        exercise = rung.family.generate({
          skillId: rung.node.id,
          level: rung.level,
          seed,
          params: rung.params,
          forms: formsFor(rung),
        })
      } catch (error) {
        // A generator that cannot draw is a curriculum bug and is loud, but it
        // is not a crash in a child's game: the pack is told there is nothing.
        console.error(`[packs] ${rung.node.id} could not generate`, error)
        return null
      }

      const places = decimalPlacesOf(exercise)
      const choices = choicesFor(exercise, places)
      const id = `${exercise.exerciseId}#${String(sequence)}`
      remember(id, { exercise, rung, places, choices, answered: false })
      practised.add(rung.node.id)

      const top = slotText(exercise.prompt.slots[SLOT_TOP])
      const bottom = slotText(exercise.prompt.slots[SLOT_BOTTOM])
      const subtract = exercise.prompt.key === PROMPT_KEY_SUB
      const digits = digitsOf(exercise)

      return {
        id,
        skillId: rung.node.id,
        level: rung.level,
        form: "binary-op",
        operator: subtract ? "-" : "+",
        operands: [top, bottom],
        prompt: `${top} ${subtract ? MINUS : "+"} ${bottom}`,
        choices,
        answerKind: "integer",
        ...(digits === undefined ? {} : { digits }),
      }
    },

    judge: ({ packId, itemId, response, latencyMs }) => {
      const served = ledger.get(itemId)
      if (!served) throw new RangeError(`no such item: ${itemId}`)

      const canonical = answerText(served.exercise.answer.canonical, served.places) ?? ""
      // A pack may answer with the value or with the id of a choice it drew.
      // Both are the same act; a pack should not have to reformat a slab it
      // was handed to report that a child touched it.
      const chosen = served.choices.find((choice) => choice.id === response)
      const text = chosen?.text ?? response

      let submitted: AnswerValue | null = null
      try {
        submitted = { kind: "integer", value: rational.parseRational(text) }
      } catch {
        // Not a number a child could have written. Wrong, not a crash: a pack
        // is free to report whatever a stray tap produced.
      }

      const verdict =
        submitted === null
          ? ({ correct: false } as const)
          : served.rung.family.check(served.exercise, submitted)

      // Recorded before the canonical value goes back, which is what makes it
      // safe to return one at all: there is no way to read the answer without
      // spending the attempt.
      if (!served.answered) {
        served.answered = true
        deps.record({ packId, correct: verdict.correct })
        // The ladder moves on what actually happened. Up only when it was both
        // right and quick, down on any miss — a child who is guessing does not
        // climb, and a child who is struggling is not held there.
        if (verdict.correct && latencyMs <= QUICK_MS) position = Math.min(rungs.length - 1, position + 1)
        else if (!verdict.correct) position = Math.max(0, position - 1)
      }

      return {
        correct: verdict.correct,
        canonical,
        ...(verdict.correct || verdict.misconception === undefined
          ? {}
          : { diagnosis: verdict.misconception }),
        advance: verdict.correct,
      }
    },

    reveal: (itemId) => {
      const served = ledger.get(itemId)
      if (!served) throw new RangeError(`no such item: ${itemId}`)
      return answerText(served.exercise.answer.canonical, served.places) ?? ""
    },

    skip: (itemId) => {
      const served = ledger.get(itemId)
      if (served) served.answered = true
    },

    summary: () => ({
      skills: rungs
        .map((rung) => rung.node.id)
        .filter((id, index, all) => all.indexOf(id) === index)
        .map((id) => ({ id, level: practised.has(id) ? ("practiced" as const) : ("new" as const) })),
    }),
  }
}
