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

const cycleIds = CYCLE_CATALOG.map((c) => c.id)

/** loadCycle — set up a long world cycle (tala) in one move. */
export const loadCycleAction: ModuleAction = {
  name: "loadCycle",
  describe:
    "Load a world rhythmic cycle (Indian tala, Balkan aksak, clave …): sets the loop length and a fitting meter together.",
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
    if (!cycle) return { commands: [], summary: `Unknown cycle "${id}"` }
    const plan = planForCycle(cycle)
    const commands: Command[] = [
      { t: "setMeter", tick: 0, sig: plan.sig },
      { t: "setLoopLength", ticks: plan.loopTicks },
    ]
    return {
      commands: [{ t: "batch", commands, label: `Load ${cycle.name}` }],
      summary: `${cycle.name} · ${plan.beats} beats · ${formatMeter(plan.sig)}`,
    }
  },
}

/** customCycle — set up an arbitrary N-beat cycle. */
export const customCycleAction: ModuleAction = {
  name: "customCycle",
  describe: "Set up a custom N-beat cycle (1..128) with a fitting meter.",
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
      summary: `${plan.beats}-beat cycle · ${formatMeter(plan.sig)}`,
    }
  },
}

/** setLoopBeats — set the loop length directly in beats of the current meter. */
export const setLoopBeatsAction: ModuleAction = {
  name: "setLoopBeats",
  describe: "Set the loop length in beats (up to 128) at the current meter.",
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
      summary: `Loop ${beats} beats`,
    }
  },
}

/** setMeterAction — set the song's initial meter. */
export const setMeterAction: ModuleAction = {
  name: "setMeter",
  describe: "Set the time signature (numerator 1..32, denominator 1/2/4/8/16).",
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
      summary: `Meter ${formatMeter(sig)}`,
    }
  },
}

/** setTempoAction — set the global BPM. */
export const setTempoAction: ModuleAction = {
  name: "setTempo",
  describe: "Set the global tempo in beats per minute (20..300).",
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
  describe: "Set the swing amount (0 = straight, ~0.66 = heavy shuffle).",
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
      summary: amount <= 0 ? "Straight" : `Swing ${Math.round(amount * 100)}%`,
    }
  },
}

/** describeSong — read-only: report the current song setup (no commands). */
export const describeSongAction: ModuleAction = {
  name: "describeSong",
  describe: "Report the current song setup (loop, meter, tempo).",
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
