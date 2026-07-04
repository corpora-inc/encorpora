// Test/sim fixture CourseGraph builder (engine.md §7.3, scaled-down for unit
// tests; scripts/journey-sim generates the big one with the same shape).

import type { CourseGraph, ActivityTemplate, ItemRef } from "../types.ts"

export interface FixtureOpts {
  arcs?: number
  unitsPerArc?: number
  skillsPerUnit?: number
  itemsPerSkill?: number
  /** Chain prereqs unit-to-unit (skill k of unit u requires skill k of u−1). */
  chainUnits?: boolean
  bMin?: number
  bMax?: number
  withLessons?: boolean
  withCheckpoints?: boolean
  passScore?: number
}

export function nativeTemplates(kind: ItemRef["kind"] = "phrase"): ActivityTemplate[] {
  return [
    { activityType: "choice_pick", itemKind: kind, form: 0, strand: "language", guessable: true, estSec: 12, modelNeeds: [], provider: "native" },
    { activityType: "listen_pick", itemKind: kind, form: 0, strand: "input", guessable: true, estSec: 15, modelNeeds: [], provider: "native" },
    { activityType: "intro_echo", itemKind: kind, form: 0, strand: "input", guessable: false, estSec: 12, modelNeeds: [], provider: "native" },
    { activityType: "match_pairs", itemKind: kind, form: 0, strand: "language", guessable: true, estSec: 35, modelNeeds: [], provider: "native", funWeight: 1 },
    { activityType: "flip_recall", itemKind: kind, form: 1, strand: "language", guessable: true, estSec: 10, modelNeeds: [], provider: "native" },
    { activityType: "cloze", itemKind: kind, form: 1, strand: "language", guessable: false, estSec: 20, modelNeeds: [], provider: "native" },
    { activityType: "word_order", itemKind: kind, form: 1, strand: "language", guessable: false, estSec: 25, modelNeeds: [], provider: "native" },
    { activityType: "grammar_note", itemKind: kind, form: 1, strand: "language", guessable: false, estSec: 45, modelNeeds: [], provider: "native" },
    { activityType: "listen_type", itemKind: kind, form: 2, strand: "language", guessable: false, estSec: 30, modelNeeds: [], provider: "native" },
    { activityType: "speak_echo", itemKind: kind, form: 2, strand: "output", guessable: false, estSec: 25, modelNeeds: ["stt"], provider: "native" },
  ]
}

export function makeFixtureGraph(opts: FixtureOpts = {}): CourseGraph {
  const arcs = opts.arcs ?? 2
  const unitsPerArc = opts.unitsPerArc ?? 2
  const skillsPerUnit = opts.skillsPerUnit ?? 2
  const itemsPerSkill = opts.itemsPerSkill ?? 6
  const bMin = opts.bMin ?? -3
  const bMax = opts.bMax ?? 0.5
  const chainUnits = opts.chainUnits ?? true
  const withLessons = opts.withLessons ?? true
  const withCheckpoints = opts.withCheckpoints ?? true
  const passScore = opts.passScore ?? 0.7

  const cefrs = ["A1", "A2", "B1", "B2", "C1", "C2"] as const
  const graph: CourseGraph = {
    courseId: "journey_en",
    arcs: [],
    units: [],
    skills: {},
    items: {},
    activityTemplates: nativeTemplates(),
    lessonRecipes: {},
    unitLessons: {},
    checkpoints: [],
    rareCards: [
      { rareCardId: "rare-delight-1", cardType: "delight", rarityWeight: 3 },
      { rareCardId: "rare-delight-2", cardType: "delight", rarityWeight: 1 },
      { rareCardId: "rare-game-1", cardType: "minigame", rarityWeight: 1, provider: "lingo_hero" },
      { rareCardId: "rare-etym-1", cardType: "etymology", rarityWeight: 1 },
      { rareCardId: "rare-story-1", cardType: "story", rarityWeight: 1, coverageGate: 0.95 },
    ],
  }

  const totalUnits = arcs * unitsPerArc
  const totalItems = totalUnits * skillsPerUnit * itemsPerSkill
  let intro = 0
  for (let a = 0; a < arcs; a++) {
    const arcId = `arc-${a}`
    graph.arcs.push({ arcId, ordinal: a, cefr: cefrs[Math.min(a, cefrs.length - 1)] })
    for (let u = 0; u < unitsPerArc; u++) {
      const ordinal = a * unitsPerArc + u
      const unitId = `unit-${String(ordinal).padStart(2, "0")}`
      const skillIds: string[] = []
      for (let k = 0; k < skillsPerUnit; k++) {
        const skillId = `skill-${String(ordinal).padStart(2, "0")}-${k}`
        skillIds.push(skillId)
        const prereqs: string[] = []
        if (chainUnits && ordinal > 0) {
          prereqs.push(`skill-${String(ordinal - 1).padStart(2, "0")}-${k}`)
        }
        const itemIds: string[] = []
        const skillB = bMin + ((bMax - bMin) * ordinal) / Math.max(1, totalUnits - 1)
        for (let i = 0; i < itemsPerSkill; i++) {
          intro += 1
          const itemId = `phrase:base:${1000 + intro}`
          itemIds.push(itemId)
          const b = bMin + ((bMax - bMin) * (intro - 1)) / Math.max(1, totalItems - 1)
          graph.items[itemId] = {
            itemId,
            ref: { kind: "phrase", source: "base", id: String(1000 + intro) },
            skillIds: [skillId],
            b,
            introOrder: intro,
            importance: 1 + (i % 3) * 0.5,
            probe: i < 2, // ≥2 probes per skill
            substituteIds: undefined,
            textLen: 15 + ((intro * 7) % 30),
            kind: "phrase",
          }
        }
        // substitutes: same-skill alternates in intro order
        for (const id of itemIds) {
          graph.items[id].substituteIds = itemIds.filter((x) => x !== id)
        }
        graph.skills[skillId] = { skillId, prereqs, itemIds, b: skillB, unitId }
      }
      graph.units.push({ unitId, arcId, ordinal: u, skillIds })

      if (withCheckpoints) {
        graph.checkpoints.push({
          checkpointId: `cp-${unitId}`,
          scope: "unit",
          unitId,
          recipeId: "boss",
          passScore,
        })
      }
    }
    if (withCheckpoints) {
      graph.checkpoints.push({
        checkpointId: `gate-${arcId}`,
        scope: "arc",
        arcId,
        recipeId: "boss",
        passScore,
      })
    }
  }

  graph.lessonRecipes.boss = {
    recipeId: "boss",
    estMinutes: 3,
    slots: [
      { slotType: "boss.retrieve", activityTypes: ["cloze", "word_order"], itemSelector: "unit", optional: false },
      { slotType: "boss.retrieve", activityTypes: ["listen_type", "cloze"], itemSelector: "unit", optional: false },
      { slotType: "boss.retrieve", activityTypes: ["word_order", "listen_type"], itemSelector: "unit", optional: false },
      { slotType: "boss.retrieve", activityTypes: ["cloze", "word_order"], itemSelector: "unit", optional: false },
    ],
  }
  if (withLessons) {
    graph.lessonRecipes.core = {
      recipeId: "core",
      estMinutes: 5,
      slots: [
        { slotType: "review.retrieve", activityTypes: ["choice_pick", "cloze"], itemSelector: "due", optional: false },
        { slotType: "new.intro", activityTypes: ["intro_echo"], itemSelector: "new", optional: false },
        { slotType: "practice.core", activityTypes: ["cloze", "word_order"], itemSelector: "unit", optional: false },
        { slotType: "practice.speak", activityTypes: ["speak_echo"], itemSelector: "due", optional: true },
      ],
    }
    for (const unit of graph.units) {
      graph.unitLessons[unit.unitId] = [
        { lessonIndex: 0, recipeId: "core" },
        { lessonIndex: 1, recipeId: "core" },
      ]
    }
  }

  return graph
}
