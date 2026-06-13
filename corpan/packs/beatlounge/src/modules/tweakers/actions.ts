/**
 * beatlounge — tweakers module actions. LLM-callable autonomous-modulation
 * mutations that also back the immersive panel's buttons. Each returns the
 * commands the bus applies in one undo step plus a human summary. No React, so
 * unit-testable. Reuses `modulation/agents.ts` so the UI, the module actions and
 * the LLM tools spawn identical modulators.
 */

import type { ActionContext, ActionResult, ModuleAction } from "../../contracts/module"
import {
  AGENT_NAMES,
  AGENT_META,
  agentCommands,
  chaosCommands,
  type AgentName,
} from "../../modulation/agents"
import { ct } from "../../i18n/strings"

/** vibe — set an agent loose (or "calm" to clear all tweakers). */
export const vibeAction: ModuleAction = {
  name: "vibe",
  describe: ct("tweakers.action.vibe.describe"),
  params: {
    name: {
      type: "enum",
      options: [...AGENT_NAMES, "calm"],
      default: "evolve",
      describe: "Agent vibe, or 'calm' to clear all tweakers.",
    },
  },
  impact: "mutate",
  run(ctx: ActionContext, params): ActionResult {
    const raw = String(params.name ?? "evolve")
    if (raw === "calm") {
      const n = (ctx.doc.modulators ?? []).length
      if (n === 0) return { commands: [], summary: ct("tweakers.alreadyCalm") }
      return { commands: [{ t: "clearModulators" }], summary: ct("tweakers.calmed") }
    }
    const name = (AGENT_NAMES.includes(raw as AgentName) ? raw : "evolve") as AgentName
    const cmds = agentCommands(name, ctx.doc)
    return {
      commands: cmds,
      summary: cmds.length
        ? ct("tweakers.agentSummary", { label: AGENT_META[name].label, n: String(cmds.length) })
        : ct("tweakers.nothingToModulateShort"),
    }
  },
}

/** chaos — spawn the chaos agent at a given intensity (scales depth/rate). */
export const chaosAction: ModuleAction = {
  name: "chaos",
  describe: ct("tweakers.action.chaos.describe"),
  params: {
    amount: { type: "number", min: 0.25, max: 3, default: 1, describe: "Intensity 0.25–3." },
  },
  impact: "mutate",
  run(ctx: ActionContext, params): ActionResult {
    const amount = Math.max(0.25, Math.min(3, Number(params.amount ?? 1) || 1))
    const cmds = chaosCommands(ctx.doc, amount)
    return {
      commands: cmds,
      summary: cmds.length
        ? ct("tweakers.chaosSummary", { amount: String(amount) })
        : ct("tweakers.nothingToModulateShort"),
    }
  },
}

/** calm — clear every tweaker (the explicit stop). */
export const calmAction: ModuleAction = {
  name: "calm",
  describe: ct("tweakers.action.calm.describe"),
  params: {},
  impact: "mutate",
  run(ctx: ActionContext): ActionResult {
    const n = (ctx.doc.modulators ?? []).length
    if (n === 0) return { commands: [], summary: ct("tweakers.alreadyCalm") }
    return { commands: [{ t: "clearModulators" }], summary: ct("tweakers.clearedTweakers", { n: String(n) }) }
  },
}

export const tweakersActions: ReadonlyArray<ModuleAction> = [
  vibeAction,
  chaosAction,
  calmAction,
]
