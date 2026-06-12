/**
 * beatlounge — mixer module actions. LLM-callable console moves that also back
 * console buttons. Pure + React-free for unit testing.
 */

import type { ActionResult, ModuleAction } from "../../contracts/module"
import type { Command } from "../../model/command"

/** unsoloAll — drop every solo (escape "why is everything muted?"). */
export const unsoloAllAction: ModuleAction = {
  name: "unsoloAll",
  describe: "Clear solo on every track.",
  params: {},
  impact: "tweak",
  run(ctx): ActionResult {
    const commands: Command[] = ctx.doc.tracks
      .filter((t) => t.solo)
      .map((t) => ({ t: "setTrackProp", trackId: t.id, prop: "solo", value: false }))
    if (commands.length === 0) return { commands: [], summary: "No solos" }
    return {
      commands: commands.length === 1 ? commands : [{ t: "batch", commands, label: "Unsolo all" }],
      summary: `Cleared ${commands.length} solo${commands.length === 1 ? "" : "s"}`,
    }
  },
}

/** unmuteAll — un-mute every track. */
export const unmuteAllAction: ModuleAction = {
  name: "unmuteAll",
  describe: "Un-mute every track.",
  params: {},
  impact: "tweak",
  run(ctx): ActionResult {
    const commands: Command[] = ctx.doc.tracks
      .filter((t) => t.mute)
      .map((t) => ({ t: "setTrackProp", trackId: t.id, prop: "mute", value: false }))
    if (commands.length === 0) return { commands: [], summary: "Nothing muted" }
    return {
      commands: commands.length === 1 ? commands : [{ t: "batch", commands, label: "Unmute all" }],
      summary: `Un-muted ${commands.length}`,
    }
  },
}

export const mixerActions: ReadonlyArray<ModuleAction> = [unsoloAllAction, unmuteAllAction]
