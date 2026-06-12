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

/** vibe — set an agent loose (or "calm" to clear all tweakers). */
export const vibeAction: ModuleAction = {
  name: "vibe",
  describe:
    "Set an autonomous modulation agent loose so the loop evolves itself, or calm it. One of: breathe, drift, chaos, evolve, pulse, calm.",
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
      if (n === 0) return { commands: [], summary: "Already calm" }
      return { commands: [{ t: "clearModulators" }], summary: "Calmed (cleared tweakers)" }
    }
    const name = (AGENT_NAMES.includes(raw as AgentName) ? raw : "evolve") as AgentName
    const cmds = agentCommands(name, ctx.doc)
    return {
      commands: cmds,
      summary: cmds.length ? `${AGENT_META[name].label} — ${cmds.length} tweaker${cmds.length === 1 ? "" : "s"}` : "Nothing to modulate",
    }
  },
}

/** chaos — spawn the chaos agent at a given intensity (scales depth/rate). */
export const chaosAction: ModuleAction = {
  name: "chaos",
  describe: "Spawn fast random tweakers across effects/sends. amount scales the intensity.",
  params: {
    amount: { type: "number", min: 0.25, max: 3, default: 1, describe: "Intensity 0.25–3." },
  },
  impact: "mutate",
  run(ctx: ActionContext, params): ActionResult {
    const amount = Math.max(0.25, Math.min(3, Number(params.amount ?? 1) || 1))
    const cmds = chaosCommands(ctx.doc, amount)
    return { commands: cmds, summary: cmds.length ? `Chaos × ${amount}` : "Nothing to modulate" }
  },
}

/** calm — clear every tweaker (the explicit stop). */
export const calmAction: ModuleAction = {
  name: "calm",
  describe: "Clear every autonomous tweaker — back to a still loop.",
  params: {},
  impact: "mutate",
  run(ctx: ActionContext): ActionResult {
    const n = (ctx.doc.modulators ?? []).length
    if (n === 0) return { commands: [], summary: "Already calm" }
    return { commands: [{ t: "clearModulators" }], summary: `Cleared ${n} tweaker${n === 1 ? "" : "s"}` }
  },
}

export const tweakersActions: ReadonlyArray<ModuleAction> = [
  vibeAction,
  chaosAction,
  calmAction,
]
