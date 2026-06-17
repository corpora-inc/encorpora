/**
 * beatlounge — run a ModuleAction through the store as ONE undo step.
 *
 * An action returns `{ commands, summary }`; we wrap multiple commands in a
 * `batch` so the whole mutation is a single, exact undo. A deterministic RNG is
 * seeded per call so stochastic actions are reproducible (reroll = new seed).
 * Returns the ActionResult so callers can toast the summary / offer undo.
 */

import type { ActionResult, ModuleAction } from "../contracts/module"
import type { Command } from "../model/command"
import type { BeatloungeDoc, Id } from "../model/document"
import type { BeatloungeStore } from "../store/store"

/** mulberry32: a tiny deterministic PRNG seeded by an integer. */
const mulberry32 = (seed: number): (() => number) => {
  let a = seed >>> 0
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export interface RunActionOpts {
  doc: BeatloungeDoc
  targetTrackId?: Id
  /** Seed for the action's RNG; omit for a fresh one (Date.now). */
  seed?: number
}

export const runAction = (
  store: BeatloungeStore,
  action: ModuleAction,
  opts: RunActionOpts
): ActionResult => {
  const rng = mulberry32(opts.seed ?? Date.now())
  const result = action.run({ doc: opts.doc, targetTrackId: opts.targetTrackId, rng }, {})
  applyCommands(store, result.commands, action.name)
  return result
}

/** Apply a command list atomically (single undo step) when there's >1. */
export const applyCommands = (
  store: BeatloungeStore,
  commands: Command[],
  label?: string
): void => {
  if (commands.length === 0) return
  if (commands.length === 1) {
    store.dispatch(commands[0])
    return
  }
  store.dispatch({ t: "batch", commands, label })
}
