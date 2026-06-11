/**
 * beatlounge — a READ-ONLY view over the ModuleRegistry's actions, shaped for
 * the command bar's browsable "actions picker".
 *
 * The picker is the model-OPTIONAL surface: with zero LLM, a low-power device
 * can still discover and run every module action (denser/sparser, euclid, mood,
 * progression, humanize, make-analog, scatter, …). This helper is pure — it only
 * READS `registry.allActions()` and the frozen `ParamSchema` — so it is fully
 * unit-testable and never mutates the document. Running is the controller's job.
 */

import type { ModuleAction, ModuleId, ModuleRegistry, ParamSchema } from "../../contracts/module"
import type { ResultSource } from "../../llm/runtime"

/** One enumerated action plus the module it belongs to. */
export interface CatalogAction {
  moduleId: ModuleId
  action: ModuleAction
}

/** A grouped bundle the picker renders as one labelled section. */
export interface CatalogGroup {
  /** Group key: the moduleId (group-by-module) or the impact (group-by-impact). */
  key: string
  /** Human label for the section header. */
  label: string
  actions: CatalogAction[]
}

export type GroupBy = "module" | "impact"
export type ImpactFilter = ModuleAction["impact"] | "all"

/** Stable display order so the picker reads gentlest → strongest. */
const IMPACT_ORDER: Record<ModuleAction["impact"], number> = {
  tweak: 0,
  mutate: 1,
  destructive: 2,
}

/** Section labels for impact grouping (minimal, no roadmap copy). */
const IMPACT_LABEL: Record<ModuleAction["impact"], string> = {
  tweak: "Tweaks",
  mutate: "Shapers",
  destructive: "Clears",
}

/** Turn a moduleId ("drum-pads") into a readable section label ("Drum Pads"). */
export const moduleLabel = (id: ModuleId): string =>
  id
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ")

/**
 * Enumerate the registry's actions, optionally filtered by impact, sorted within
 * a group by (impact, then name). Pure — order is deterministic.
 */
export const listCatalogActions = (
  registry: ModuleRegistry,
  filter: ImpactFilter = "all",
): CatalogAction[] => {
  const all = registry.allActions() as CatalogAction[]
  const kept = filter === "all" ? all : all.filter((e) => e.action.impact === filter)
  return [...kept].sort((a, b) => {
    const di = IMPACT_ORDER[a.action.impact] - IMPACT_ORDER[b.action.impact]
    if (di !== 0) return di
    return a.action.name.localeCompare(b.action.name)
  })
}

/**
 * Group the (filtered) catalog for the picker. `module` keeps each module's
 * actions together (modules in registration order); `impact` groups by strength.
 */
export const groupCatalogActions = (
  registry: ModuleRegistry,
  by: GroupBy = "module",
  filter: ImpactFilter = "all",
): CatalogGroup[] => {
  const entries = listCatalogActions(registry, filter)
  const order: string[] = []
  const buckets = new Map<string, CatalogAction[]>()
  for (const e of entries) {
    const key = by === "module" ? e.moduleId : e.action.impact
    if (!buckets.has(key)) {
      buckets.set(key, [])
      order.push(key)
    }
    buckets.get(key)!.push(e)
  }
  // Impact groups read gentlest → strongest; module groups keep registry order.
  const keys =
    by === "impact"
      ? order.slice().sort((a, b) => IMPACT_ORDER[a as ModuleAction["impact"]] - IMPACT_ORDER[b as ModuleAction["impact"]])
      : order
  return keys.map((key) => ({
    key,
    label:
      by === "impact" ? IMPACT_LABEL[key as ModuleAction["impact"]] : moduleLabel(key as ModuleId),
    actions: buckets.get(key)!,
  }))
}

/**
 * The subset of an action's params worth surfacing as quick controls in the
 * picker. We expose number/int/enum/boolean params (those map cleanly to a
 * slider / select / toggle); opaque kinds (track/step/string with no options)
 * fall through to their schema default so the action still runs in one tap.
 */
export interface PickerParam {
  key: string
  schema: ParamSchema
}

const SIMPLE_TYPES: ReadonlySet<ParamSchema["type"]> = new Set([
  "number",
  "int",
  "enum",
  "boolean",
])

export const pickerParams = (action: ModuleAction): PickerParam[] =>
  Object.entries(action.params)
    .filter(([, s]) => SIMPLE_TYPES.has(s.type) || (s.type === "string" && Array.isArray(s.options)))
    .map(([key, schema]) => ({ key, schema }))

/** A sensible default value for a param, honouring its schema. */
export const paramDefault = (schema: ParamSchema): unknown => {
  if (schema.default !== undefined) return schema.default
  switch (schema.type) {
    case "boolean":
      return false
    case "enum":
      return schema.options?.[0]
    case "string":
      return schema.options?.[0] ?? ""
    case "number":
    case "int":
      return schema.min ?? 0
    default:
      return undefined
  }
}

/** Build the full default param object for an action (every declared param). */
export const defaultParams = (action: ModuleAction): Record<string, unknown> => {
  const out: Record<string, unknown> = {}
  for (const [key, schema] of Object.entries(action.params)) {
    const d = paramDefault(schema)
    if (d !== undefined) out[key] = d
  }
  return out
}

/**
 * The honest, dignified label for WHERE a command came from. The runtime's
 * `ResultSource` is the real signal: model paths → "assistant", deterministic
 * keyword/picker paths → "keywords". No fake "AI" when the model isn't loaded.
 */
export const sourceLabel = (source: ResultSource): string => {
  switch (source) {
    case "model":
    case "model-repair":
      return "assistant"
    case "keyword":
    case "keyword-no-llm":
      return "keywords"
    default:
      return ""
  }
}
