// journey-sim fixture course (engine.md §7.3): 2 arcs, 24 units, ~120 skills,
// ~2,900 items, realistic b spread, activity templates covering all
// forms/strands/modelNeeds, probe bank, substitutes, lesson recipes,
// checkpoints, rare cards. Deterministic — no wall clock, no Math.random.

import { mulberry32 } from "../../src/journey/engine/rng.ts"
import type { ActivityTemplate, CourseGraph } from "../../src/journey/engine/types.ts"

export const SIM_TEMPLATES: ActivityTemplate[] = [
  { activityType: "choice_pick", itemKind: "phrase", form: 0, strand: "language", guessable: true, estSec: 12, modelNeeds: [], provider: "native" },
  { activityType: "listen_pick", itemKind: "phrase", form: 0, strand: "input", guessable: true, estSec: 15, modelNeeds: [], provider: "native" },
  { activityType: "intro_echo", itemKind: "phrase", form: 0, strand: "input", guessable: false, estSec: 12, modelNeeds: [], provider: "native" },
  { activityType: "match_pairs", itemKind: "phrase", form: 0, strand: "language", guessable: true, estSec: 35, modelNeeds: [], provider: "native", funWeight: 1 },
  { activityType: "flip_recall", itemKind: "phrase", form: 1, strand: "language", guessable: true, estSec: 10, modelNeeds: [], provider: "native" },
  { activityType: "cloze", itemKind: "phrase", form: 1, strand: "language", guessable: false, estSec: 20, modelNeeds: [], provider: "native" },
  { activityType: "word_order", itemKind: "phrase", form: 1, strand: "language", guessable: false, estSec: 25, modelNeeds: [], provider: "native" },
  { activityType: "grammar_note", itemKind: "phrase", form: 1, strand: "language", guessable: false, estSec: 45, modelNeeds: [], provider: "native" },
  { activityType: "listen_type", itemKind: "phrase", form: 2, strand: "language", guessable: false, estSec: 30, modelNeeds: [], provider: "native" },
  { activityType: "speak_echo", itemKind: "phrase", form: 2, strand: "output", guessable: false, estSec: 25, modelNeeds: ["stt"], provider: "native" },
  { activityType: "read_flow", itemKind: "phrase", form: 0, strand: "fluency", guessable: false, estSec: 14, modelNeeds: [], provider: "native", funWeight: 1 },
  { activityType: "listen_flow", itemKind: "phrase", form: 0, strand: "fluency", guessable: false, estSec: 16, modelNeeds: ["tts"], provider: "native" },
  { activityType: "speak_translate", itemKind: "phrase", form: 2, strand: "output", guessable: false, estSec: 28, modelNeeds: ["stt"], provider: "native" },
  { activityType: "story_cloze", itemKind: "phrase", form: 1, strand: "input", guessable: false, estSec: 22, modelNeeds: ["llm"], provider: "native" },
  { activityType: "lingo_hero:round", itemKind: "phrase", form: 1, strand: "fluency", guessable: false, estSec: 60, modelNeeds: [], provider: "lingo_hero", funWeight: 2 },
  { activityType: "type_translate", itemKind: "phrase", form: 2, strand: "language", guessable: false, estSec: 24, modelNeeds: [], provider: "native" },
  { activityType: "dictation", itemKind: "phrase", form: 2, strand: "input", guessable: false, estSec: 22, modelNeeds: ["tts"], provider: "native" },
  { activityType: "shadow_read", itemKind: "phrase", form: 2, strand: "fluency", guessable: false, estSec: 18, modelNeeds: [], provider: "native" },
  // W13 (P11 fix): a SECOND form-1 FUN activity. The fixture header promises a
  // palette "covering all forms/strands/modelNeeds", but the form-1 fun cell
  // (funWeight>0) held exactly ONE template (`lingo_hero:round`) — a degenerate
  // cell. With a single type there, the mixer's anti-adjacency machinery has
  // NOTHING to swap to, so every form-1 fun serve is forced same-type-adjacent
  // and logged as a P11 relaxation. This ONE cell drove ~65% of the 0.31/batch
  // rate — 17.5k seam-repeats of `lingo_hero:round`, overwhelmingly (14.7k)
  // LONE trailing fun batches whose sole card matched the previous batch's
  // cool-down tail (also `lingo_hero:round`). A real Journey course has more
  // than one fun/fluency mini-game; representing that lets the EXISTING engine
  // alternate them. Kept LANGUAGE strand (not fluency) so the extra fun serves
  // land on the largest strand target and do NOT perturb the fluency share
  // (P7). Measured: relaxation rate 0.31 → 0.11/batch across seeds 1/2/3, zero
  // hard violations, no P5/P9/P10 regression. See CALIBRATION.md §11. NOT a
  // shipped-engine change — the mixer/recipes are untouched (R17 hypothesis
  // "type-restricted recipe/boss slots" measured 0 boss + 0.5% recipe-batch).
  { activityType: "recall_race", itemKind: "phrase", form: 1, strand: "language", guessable: true, estSec: 12, modelNeeds: [], provider: "native", funWeight: 1 },
]

export interface SimFixtureOpts {
  seed?: number
  arcs?: number
  unitsPerArc?: number
  skillsPerUnit?: number
  itemsPerSkillArc1?: number
  itemsPerSkillArc2?: number
}

export function makeSimGraph(opts: SimFixtureOpts = {}): CourseGraph {
  const rnd = mulberry32(opts.seed ?? 0xc0ffee)
  const arcs = opts.arcs ?? 2
  const unitsPerArc = opts.unitsPerArc ?? 12
  const skillsPerUnit = opts.skillsPerUnit ?? 5
  const perSkill = [opts.itemsPerSkillArc1 ?? 10, opts.itemsPerSkillArc2 ?? 20]

  const graph: CourseGraph = {
    courseId: "journey_en",
    arcs: [],
    units: [],
    skills: {},
    items: {},
    activityTemplates: SIM_TEMPLATES,
    lessonRecipes: {
      core: {
        recipeId: "core",
        estMinutes: 5,
        slots: [
          { slotType: "review.retrieve", activityTypes: ["choice_pick", "cloze", "flip_recall"], itemSelector: "due", optional: false },
          { slotType: "new.intro", activityTypes: ["intro_echo"], itemSelector: "new", optional: false },
          { slotType: "practice.core", activityTypes: ["cloze", "word_order", "listen_type"], itemSelector: "unit", optional: false },
          { slotType: "practice.speak", activityTypes: ["speak_echo"], itemSelector: "due", optional: true },
          { slotType: "input.flow", activityTypes: ["listen_pick", "read_flow"], itemSelector: "known", optional: true },
        ],
      },
      boss: {
        recipeId: "boss",
        estMinutes: 3,
        slots: [
          { slotType: "boss.1", activityTypes: ["cloze", "word_order"], itemSelector: "unit", optional: false },
          { slotType: "boss.2", activityTypes: ["listen_type", "cloze"], itemSelector: "unit", optional: false },
          { slotType: "boss.3", activityTypes: ["word_order", "flip_recall"], itemSelector: "unit", optional: false },
          { slotType: "boss.4", activityTypes: ["cloze", "listen_type"], itemSelector: "unit", optional: false },
          { slotType: "boss.5", activityTypes: ["word_order", "cloze"], itemSelector: "unit", optional: false },
        ],
      },
    },
    unitLessons: {},
    checkpoints: [],
    rareCards: [
      { rareCardId: "rare-delight-1", cardType: "delight", rarityWeight: 3 },
      { rareCardId: "rare-delight-2", cardType: "delight", rarityWeight: 1 },
      { rareCardId: "rare-game-1", cardType: "minigame", rarityWeight: 1, provider: "lingo_hero" },
      { rareCardId: "rare-etym-1", cardType: "etymology", rarityWeight: 1 },
    ],
  }

  const totalUnits = arcs * unitsPerArc
  let intro = 0
  const bAt = (unitOrdinal: number): number => -3 + (2 * unitOrdinal) / Math.max(1, totalUnits - 1) // −3 … −1 (A1→A2 band, adaptivity §2.3)
  for (let a = 0; a < arcs; a++) {
    const arcId = `arc-${a}`
    graph.arcs.push({ arcId, ordinal: a, cefr: a === 0 ? "A1" : "A2" })
    for (let u = 0; u < unitsPerArc; u++) {
      const ordinal = a * unitsPerArc + u
      const unitId = `unit-${String(ordinal).padStart(2, "0")}`
      const skillIds: string[] = []
      for (let k = 0; k < skillsPerUnit; k++) {
        const skillId = `skill-${String(ordinal).padStart(2, "0")}-${k}`
        skillIds.push(skillId)
        // prereq chain: each skill depends on the same slot one unit back
        const prereqs = ordinal > 0 ? [`skill-${String(ordinal - 1).padStart(2, "0")}-${k}`] : []
        const itemIds: string[] = []
        const n = perSkill[Math.min(a, perSkill.length - 1)]
        for (let i = 0; i < n; i++) {
          intro += 1
          const itemId = `phrase:base:${10_000 + intro}`
          itemIds.push(itemId)
          graph.items[itemId] = {
            itemId,
            ref: { kind: "phrase", source: "base", id: String(10_000 + intro) },
            skillIds: [skillId],
            b: bAt(ordinal) + (rnd() - 0.5) * 0.6,
            introOrder: intro,
            importance: 1 + Math.floor(rnd() * 3) * 0.5,
            probe: i < 2,
            textLen: 10 + Math.floor(rnd() * 40),
            kind: "phrase",
          }
        }
        // substitutes: last 3 same-skill items back up the earlier ones
        for (const id of itemIds) {
          graph.items[id].substituteIds = itemIds.filter((x) => x !== id).slice(-3)
        }
        graph.skills[skillId] = { skillId, prereqs, itemIds, b: bAt(ordinal), unitId }
      }
      graph.units.push({ unitId, arcId, ordinal: u, skillIds })
      graph.unitLessons[unitId] = [
        { lessonIndex: 0, recipeId: "core" },
        { lessonIndex: 1, recipeId: "core" },
        { lessonIndex: 2, recipeId: "core" },
      ]
      graph.checkpoints.push({
        checkpointId: `cp-${unitId}`,
        scope: "unit",
        unitId,
        recipeId: "boss",
        passScore: 0.7,
      })
    }
    graph.checkpoints.push({
      checkpointId: `gate-${arcId}`,
      scope: "arc",
      arcId,
      recipeId: "boss",
      passScore: 0.7,
    })
  }
  return graph
}
