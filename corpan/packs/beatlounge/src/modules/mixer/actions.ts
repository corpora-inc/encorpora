/**
 * beatlounge — mixer module actions. LLM-callable console moves that also back
 * console buttons. Pure + React-free for unit testing.
 */

import type { ActionResult, ModuleAction } from "../../contracts/module"
import type { Command } from "../../model/command"
import { ct } from "../../i18n/strings"

/** unsoloAll — drop every solo (escape "why is everything muted?"). */
export const unsoloAllAction: ModuleAction = {
  name: "unsoloAll",
  describe: ct("mixer.action.unsoloAll.describe"),
  params: {},
  impact: "tweak",
  run(ctx): ActionResult {
    const commands: Command[] = ctx.doc.tracks
      .filter((t) => t.solo)
      .map((t) => ({ t: "setTrackProp", trackId: t.id, prop: "solo", value: false }))
    if (commands.length === 0) return { commands: [], summary: ct("mixer.noSolos") }
    return {
      commands: commands.length === 1 ? commands : [{ t: "batch", commands, label: ct("mixer.unsoloAll") }],
      summary: ct("mixer.clearedSolos", { n: String(commands.length) }),
    }
  },
}

/** unmuteAll — un-mute every track. */
export const unmuteAllAction: ModuleAction = {
  name: "unmuteAll",
  describe: ct("mixer.action.unmuteAll.describe"),
  params: {},
  impact: "tweak",
  run(ctx): ActionResult {
    const commands: Command[] = ctx.doc.tracks
      .filter((t) => t.mute)
      .map((t) => ({ t: "setTrackProp", trackId: t.id, prop: "mute", value: false }))
    if (commands.length === 0) return { commands: [], summary: ct("mixer.nothingMuted") }
    return {
      commands: commands.length === 1 ? commands : [{ t: "batch", commands, label: ct("mixer.unmuteAll") }],
      summary: ct("mixer.unmuted", { n: String(commands.length) }),
    }
  },
}

export const mixerActions: ReadonlyArray<ModuleAction> = [unsoloAllAction, unmuteAllAction]
