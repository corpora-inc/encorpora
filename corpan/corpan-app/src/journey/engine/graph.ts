// journey/engine/graph.ts — CourseGraph read model + derived indexes
// (engine.md §2.6 tail): prereq transitive closure, item→skills / skill→items
// (sorted by introOrder), unit order, the probe bank (validated), and small
// lookup tables the mixer/placement lean on.

import type { CourseGraph, ActivityTemplate } from "./types.ts"

export interface GraphIndex {
  graph: CourseGraph
  /** Units in pack order (as delivered by the loader). */
  units: CourseGraph["units"]
  unitPos: Map<string, number>
  arcById: Map<string, CourseGraph["arcs"][number]>
  /** Transitive prereq closure per skill. */
  prereqClosure: Map<string, Set<string>>
  /** Skills with no prereqs (placement zero-beginner frontier). */
  rootSkills: string[]
  /** Global item order by introOrder. */
  itemsByIntro: string[]
  /** Per-skill item ids sorted by introOrder. */
  skillItems: Map<string, string[]>
  /** Placement probe bank: probe-eligible items (skills with <2 probes are
   *  excluded with a console warning — engine.md §2.6, never a throw). */
  probeBank: { itemId: string; b: number; skillIds: string[] }[]
  /** Max item b in the installed pack — the R10 content ceiling. */
  maxB: number
  /** activityTemplates bucketed by item kind. */
  templatesByKind: Map<string, ActivityTemplate[]>
  /** CEFR stage of a unit (via its arc). */
  stageOfUnit(unitOrdinal: number): CourseGraph["arcs"][number]["cefr"]
  /** Target language for spec minting. Prefers the loader-provided
   *  `graph.targetLang` (pack_meta.target_lang — authoritative, correct
   *  BCP-47 casing, e.g. "pt-BR"); falls back to the underscore-canonical
   *  courseId derivation ("journey_pt_br" → "pt-br") only for fixtures that
   *  omit it (W10 item 15 — the derivation is wrong for pt-BR casing). */
  targetLang: string
}

export function buildGraphIndex(graph: CourseGraph): GraphIndex {
  const unitPos = new Map<string, number>()
  graph.units.forEach((u, i) => unitPos.set(u.unitId, i))
  const arcById = new Map(graph.arcs.map((a) => [a.arcId, a]))

  // prereq transitive closure (DAG; iterative DFS with memo)
  const prereqClosure = new Map<string, Set<string>>()
  const closure = (skillId: string, stack: Set<string>): Set<string> => {
    const memo = prereqClosure.get(skillId)
    if (memo) return memo
    const out = new Set<string>()
    prereqClosure.set(skillId, out) // placed early to break accidental cycles
    if (stack.has(skillId)) return out
    stack.add(skillId)
    for (const p of graph.skills[skillId]?.prereqs ?? []) {
      if (!graph.skills[p]) continue
      out.add(p)
      for (const pp of closure(p, stack)) out.add(pp)
    }
    stack.delete(skillId)
    return out
  }
  for (const skillId of Object.keys(graph.skills)) closure(skillId, new Set())

  const rootSkills = Object.keys(graph.skills).filter(
    (s) => (graph.skills[s].prereqs ?? []).length === 0,
  )

  const itemsByIntro = Object.keys(graph.items).sort(
    (a, b) => graph.items[a].introOrder - graph.items[b].introOrder,
  )

  const skillItems = new Map<string, string[]>()
  for (const [skillId, skill] of Object.entries(graph.skills)) {
    const ids = [...skill.itemIds].sort(
      (a, b) => (graph.items[a]?.introOrder ?? 0) - (graph.items[b]?.introOrder ?? 0),
    )
    skillItems.set(skillId, ids)
  }

  // probe bank with the ≥2-per-declaring-skill validation
  const probesPerSkill = new Map<string, number>()
  for (const item of Object.values(graph.items)) {
    if (!item.probe) continue
    for (const s of item.skillIds) probesPerSkill.set(s, (probesPerSkill.get(s) ?? 0) + 1)
  }
  const excludedSkills = new Set<string>()
  for (const [skillId, n] of probesPerSkill) {
    if (n < 2) {
      excludedSkills.add(skillId)
      console.warn(
        `[journey-engine] skill ${skillId} declares only ${n} placement probe(s); ` +
          "excluded from placement Phase 2 (needs ≥2)",
      )
    }
  }
  const probeBank: GraphIndex["probeBank"] = []
  for (const itemId of itemsByIntro) {
    const item = graph.items[itemId]
    if (!item.probe) continue
    const skillIds = item.skillIds.filter((s) => !excludedSkills.has(s))
    if (skillIds.length === 0 && item.skillIds.length > 0) continue
    probeBank.push({ itemId, b: item.b, skillIds })
  }

  let maxB = Number.NEGATIVE_INFINITY
  for (const item of Object.values(graph.items)) if (item.b > maxB) maxB = item.b
  if (!Number.isFinite(maxB)) maxB = 0

  const templatesByKind = new Map<string, ActivityTemplate[]>()
  for (const t of graph.activityTemplates) {
    const arr = templatesByKind.get(t.itemKind) ?? []
    arr.push(t)
    templatesByKind.set(t.itemKind, arr)
  }

  const targetLang =
    graph.targetLang ?? graph.courseId.replace(/^journey_/, "").replace(/_/g, "-")

  return {
    graph,
    units: graph.units,
    unitPos,
    arcById,
    prereqClosure,
    rootSkills,
    itemsByIntro,
    skillItems,
    probeBank,
    maxB,
    templatesByKind,
    stageOfUnit(unitOrdinal: number) {
      const unit = graph.units[Math.min(Math.max(unitOrdinal, 0), graph.units.length - 1)]
      return arcById.get(unit?.arcId ?? "")?.cefr ?? "A1"
    },
    targetLang,
  }
}
