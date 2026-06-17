/**
 * beatlounge — Song Setup module actions. LLM-callable global moves: set the
 * loop length, the meter, the tempo, the swing, and (the delight) load a named
 * world cycle (tala). Pure + React-free so they unit-test and so the command
 * bus can index them across all modules.
 *
 * Each returns the commands the bus applies in one undo step + a human summary.
 * Loading a cycle is a single batch: setMeter + setLoopLength together.
 */

import type { ActionContext, ActionResult, ModuleAction } from "../../contracts/module"
import type { Command } from "../../model/command"
import {
  CYCLE_CATALOG,
  beatsToTicks,
  clampNumerator,
  customCycle,
  findCycle,
  formatMeter,
  isMeterDenominator,
  planForCycle,
  summarize,
} from "./songMath"
import { ct } from "../../i18n/strings"

const cycleIds = CYCLE_CATALOG.map((c) => c.id)

/** loadCycle — set up a long world cycle (tala) in one move. */
export const loadCycleAction: ModuleAction = {
  name: "loadCycle",
  describe: ct("song.action.loadCycle.describe"),
  params: {
    cycle: {
      type: "enum",
      options: cycleIds,
      default: "teental",
      describe: "Which named cycle to load (e.g. teental, jhaptal, rupak, ati-31).",
    },
  },
  impact: "mutate",
  run(_ctx, params): ActionResult {
    const id = String(params.cycle ?? "teental")
    const cycle = findCycle(id)
    if (!cycle) return { commands: [], summary: ct("song.unknownCycle", { id }) }
    const plan = planForCycle(cycle)
    const commands: Command[] = [
      { t: "setMeter", tick: 0, sig: plan.sig },
      { t: "setLoopLength", ticks: plan.loopTicks },
    ]
    return {
      commands: [{ t: "batch", commands, label: ct("song.loadCycleLabel", { name: cycle.name }) }],
      summary: ct("song.cycleSummary", {
        name: cycle.name,
        beats: String(plan.beats),
        meter: formatMeter(plan.sig),
      }),
    }
  },
}

/** customCycle — set up an arbitrary N-beat cycle. */
export const customCycleAction: ModuleAction = {
  name: "customCycle",
  describe: ct("song.action.customCycle.describe"),
  params: {
    beats: {
      type: "int",
      min: 1,
      max: 128,
      default: 7,
      unit: "beats",
      describe: "Cycle length in beats.",
    },
  },
  impact: "mutate",
  run(_ctx, params): ActionResult {
    const cycle = customCycle(Number(params.beats ?? 7))
    const plan = planForCycle(cycle)
    const commands: Command[] = [
      { t: "setMeter", tick: 0, sig: plan.sig },
      { t: "setLoopLength", ticks: plan.loopTicks },
    ]
    return {
      commands: [{ t: "batch", commands, label: cycle.name }],
      summary: ct("song.customCycleSummary", {
        beats: String(plan.beats),
        meter: formatMeter(plan.sig),
      }),
    }
  },
}

/** setLoopBeats — set the loop length directly in beats of the current meter. */
export const setLoopBeatsAction: ModuleAction = {
  name: "setLoopBeats",
  describe: ct("song.action.setLoopBeats.describe"),
  params: {
    beats: {
      type: "int",
      min: 1,
      max: 128,
      default: 16,
      unit: "beats",
      describe: "Loop length in beats.",
    },
  },
  impact: "tweak",
  run(ctx, params): ActionResult {
    const sig = ctx.doc.meterMap[0]?.sig ?? { numerator: 4, denominator: 4 }
    const beats = Math.max(1, Math.min(128, Math.round(Number(params.beats ?? 16))))
    const ticks = beatsToTicks(beats, sig)
    return {
      commands: [{ t: "setLoopLength", ticks }],
      summary: ct("song.loopSummary", { beats: String(beats) }),
    }
  },
}

/** setMeterAction — set the song's initial meter. */
export const setMeterAction: ModuleAction = {
  name: "setMeter",
  describe: ct("song.action.setMeter.describe"),
  params: {
    numerator: { type: "int", min: 1, max: 32, default: 4, describe: "Beats per bar." },
    denominator: {
      type: "enum",
      options: ["1", "2", "4", "8", "16"],
      default: "4",
      describe: "Note value of a beat.",
    },
  },
  impact: "tweak",
  run(_ctx, params): ActionResult {
    const numerator = clampNumerator(Number(params.numerator ?? 4))
    const denRaw = Number(params.denominator ?? 4)
    const denominator = isMeterDenominator(denRaw) ? denRaw : 4
    const sig = { numerator, denominator }
    return {
      commands: [{ t: "setMeter", tick: 0, sig }],
      summary: ct("song.meterSummary", { meter: formatMeter(sig) }),
    }
  },
}

/** setTempoAction — set the global BPM. */
export const setTempoAction: ModuleAction = {
  name: "setTempo",
  describe: ct("song.action.setTempo.describe"),
  params: {
    bpm: { type: "int", min: 20, max: 300, default: 96, unit: "bpm", describe: "Tempo." },
  },
  impact: "tweak",
  run(_ctx, params): ActionResult {
    const bpm = Math.max(20, Math.min(300, Math.round(Number(params.bpm ?? 96))))
    return { commands: [{ t: "setTempo", bpm }], summary: `${bpm} bpm` }
  },
}

/** setSwingAction — set the swing amount (0..0.66). */
export const setSwingAction: ModuleAction = {
  name: "setSwing",
  describe: ct("song.action.setSwing.describe"),
  params: {
    amount: {
      type: "number",
      min: 0,
      max: 0.66,
      step: 0.01,
      default: 0,
      describe: "Swing depth.",
    },
  },
  impact: "tweak",
  run(_ctx, params): ActionResult {
    const amount = Math.max(0, Math.min(0.66, Number(params.amount ?? 0)))
    return {
      commands: [{ t: "setSwing", amount }],
      summary:
        amount <= 0
          ? ct("song.straight")
          : ct("song.swingSummary", { pct: String(Math.round(amount * 100)) }),
    }
  },
}

/** describeSong — read-only: report the current song setup (no commands). */
export const describeSongAction: ModuleAction = {
  name: "describeSong",
  describe: ct("song.action.describeSong.describe"),
  params: {},
  impact: "tweak",
  run(ctx: ActionContext): ActionResult {
    const sig = ctx.doc.meterMap[0]?.sig ?? { numerator: 4, denominator: 4 }
    return {
      commands: [],
      summary: summarize({ loopTicks: ctx.doc.loopLengthTicks, sig, bpm: ctx.doc.bpm }),
    }
  },
}

export const songSetupActions: ReadonlyArray<ModuleAction> = [
  loadCycleAction,
  customCycleAction,
  setLoopBeatsAction,
  setMeterAction,
  setTempoAction,
  setSwingAction,
  describeSongAction,
]
