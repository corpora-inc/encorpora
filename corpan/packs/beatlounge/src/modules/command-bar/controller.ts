/**
 * beatlounge — the command-bar controller (framework-agnostic).
 *
 * Owns the LLM-grid runtime and the PREVIEW lifecycle over the command bus:
 *
 *   submit(utterance)
 *     → runtime.run → { commands, summary, source }
 *     → bus.preview(batch)   (apply transiently — the loop changes live)
 *     → user: Keep | 🎲 Reroll (fresh seed) | Undo
 *        Keep    → handle.keep()      (commits onto the undo stack)
 *        Undo    → handle.rollback()  (discard — "turn over the apple cart")
 *        Reroll  → rollback + re-run with a new seed (stochastic tools vary)
 *
 * The React component subscribes to `state` via `subscribe`. The controller is
 * the testable core; the component is a thin view. Noisy-not-silent throughout.
 */

import type { Command } from "../../model/command"
import type { PreviewHandle } from "../../model/commandBus"
import type { BeatloungeHost, ModuleAction, ModuleId, ModuleRegistry } from "../../contracts/module"
import type { BeatloungeStore } from "../../store/store"
import type { HostApi } from "../../sdk/types"
import { createLlmGridRuntime, type GridRunResult, type LlmGridRuntime } from "../../llm/runtime"
import { defaultParams } from "./actionCatalog"
import { ct } from "../../i18n/strings"

const LOG = "[bl/cmdbar]"
const MAX_RECENT = 6

export type CommandBarPhase = "idle" | "thinking" | "preview"

export interface CommandBarState {
  phase: CommandBarPhase
  /** The last interpreted result while previewing (null when idle). */
  result: GridRunResult | null
  /** Recent utterances (most-recent first) for quick re-run chips. */
  recent: string[]
  /** A transient error/info line (e.g. "nothing to change"). */
  message: string | null
}

export interface CommandBarControllerDeps {
  store: BeatloungeStore
  host: BeatloungeHost
  hostApi: HostApi
  /** Unused today but threaded for future "index module actions as tools". */
  registry?: ModuleRegistry
  /** Inject a runtime in tests; else built from host/store. */
  runtime?: LlmGridRuntime
}

export interface CommandBarController {
  getState(): CommandBarState
  subscribe(cb: (s: CommandBarState) => void): () => void
  /** The module registry to enumerate for the browsable picker (may be absent
   *  on surfaces that weren't given one — the picker hides itself then). */
  registry(): ModuleRegistry | undefined
  /** True if the on-device model is loaded (async status). Drives honest
   *  offline framing — never used to gate the keyword/picker surfaces. */
  llmAvailable(): Promise<boolean>
  /** Run an utterance: interpret → preview. */
  submit(utterance: string): Promise<void>
  /** Commit the live preview onto the undo stack. */
  keep(): void
  /** Discard the live preview (turn over the apple cart). */
  cancel(): void
  /** Re-run the SAME utterance with a fresh seed (stochastic variation). */
  reroll(): Promise<void>
  /**
   * Run a registry action (from the browsable picker) through the SAME preview
   * path the bar uses: one preview batch → Keep / Reroll (stochastic) / Undo.
   * Deterministic-given-seed so reroll is reproducible. Never throws.
   */
  runAction(moduleId: ModuleId, action: ModuleAction, params?: Record<string, unknown>): void
  dispose(): void
}

/** mulberry32 (same family as runAction/runtime) so picker reroll is reproducible. */
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

export const createCommandBarController = (
  deps: CommandBarControllerDeps,
): CommandBarController => {
  const runtime =
    deps.runtime ?? createLlmGridRuntime({ hostApi: deps.hostApi, store: deps.store })

  let state: CommandBarState = { phase: "idle", result: null, recent: [], message: null }
  const subs = new Set<(s: CommandBarState) => void>()
  const emit = () => {
    for (const cb of subs) cb(state)
  }
  const set = (patch: Partial<CommandBarState>) => {
    state = { ...state, ...patch }
    emit()
  }

  /** The live preview handle + the utterance/seed that produced it (for reroll). */
  let preview: PreviewHandle | null = null
  let runToken = 0
  /** Re-run the LAST thing previewed (utterance OR picker action) with a fresh
   *  seed. Set by submit() and runAction(); reroll() simply calls it. */
  let lastRun: ((seed: number) => void | Promise<void>) | null = null

  const rememberRecent = (u: string) => {
    const next = [u, ...state.recent.filter((r) => r !== u)].slice(0, MAX_RECENT)
    set({ recent: next })
  }

  /** Roll back any live preview (idempotent). */
  const dropPreview = () => {
    if (preview) {
      try {
        preview.rollback()
      } catch (e) {
        console.error(`${LOG} preview rollback threw:`, e)
      }
      preview = null
    }
  }

  /** Apply a result's commands as ONE preview batch on the bus. */
  const applyPreview = (result: GridRunResult) => {
    dropPreview()
    if (result.commands.length === 0) {
      set({ phase: "idle", result: null, message: result.summary || ct("cmd.nothingToChange") })
      return
    }
    const cmd: Command =
      result.commands.length === 1
        ? result.commands[0]
        : { t: "batch", commands: result.commands, label: result.summary }
    try {
      preview = deps.host.bus.preview(cmd)
      set({ phase: "preview", result, message: null })
    } catch (e) {
      console.error(`${LOG} bus.preview threw:`, e)
      preview = null
      set({ phase: "idle", result: null, message: ct("cmd.couldNotApply") })
    }
  }

  const runWith = async (utterance: string, seed: number) => {
    const token = ++runToken
    set({ phase: "thinking", message: null })
    let result: GridRunResult
    try {
      result = await runtime.run(utterance, { seed })
    } catch (e) {
      // The runtime is designed never to throw; this is belt-and-braces.
      console.error(`${LOG} runtime.run threw:`, e)
      if (token === runToken) set({ phase: "idle", result: null, message: ct("cmd.somethingWentWrong") })
      return
    }
    if (token !== runToken) return // superseded by a newer submit
    if (result.source !== "model") {
      console.info(`${LOG} interpreted "${utterance}" via ${result.source}${result.note ? ` (${result.note})` : ""}.`)
    }
    applyPreview(result)
  }

  /**
   * Build + preview a registry action's commands as ONE batch. The picker is a
   * deterministic surface, so the source is always "keywords" — honest: no model
   * was involved. Stochastic actions vary by `seed`; reroll re-runs with a fresh
   * one. Mirrors the bar's preview lifecycle exactly (keep / undo / reroll).
   */
  const runActionWith = (moduleId: ModuleId, action: ModuleAction, params: Record<string, unknown>, seed: number) => {
    // Bump the token so any in-flight model run can't clobber this preview.
    runToken++
    const current = deps.store.vanilla.getState().doc
    const rng = mulberry32(seed)
    let built: { commands: Command[]; summary: string }
    try {
      built = action.run({ doc: current, rng }, params)
    } catch (e) {
      console.error(`${LOG} action "${moduleId}.${action.name}" threw:`, e)
      set({ phase: "idle", result: null, message: ct("cmd.couldNotRun") })
      return
    }
    const result: GridRunResult = {
      utterance: action.describe,
      call: { name: action.name, args: params },
      commands: built.commands,
      summary: built.summary,
      source: "keyword",
    }
    applyPreview(result)
  }

  return {
    getState: () => state,
    subscribe(cb) {
      subs.add(cb)
      return () => {
        subs.delete(cb)
      }
    },

    registry: () => deps.registry,
    llmAvailable: () => runtime.llmAvailable(),

    async submit(utterance) {
      const u = utterance.trim()
      if (!u) return
      dropPreview()
      rememberRecent(u)
      lastRun = (seed) => runWith(u, seed)
      await runWith(u, Date.now())
    },

    runAction(moduleId, action, params) {
      dropPreview()
      const args = { ...defaultParams(action), ...(params ?? {}) }
      lastRun = (seed) => runActionWith(moduleId, action, args, seed)
      runActionWith(moduleId, action, args, Date.now())
    },

    keep() {
      if (!preview) return
      const summary = state.result?.summary ?? ct("cmd.applied")
      try {
        preview.keep()
      } catch (e) {
        console.error(`${LOG} preview keep threw:`, e)
      }
      preview = null
      set({ phase: "idle", result: null, message: null })
      deps.host.toast(summary, { undo: () => deps.store.undo() })
    },

    cancel() {
      dropPreview()
      set({ phase: "idle", result: null, message: null })
    },

    async reroll() {
      if (!lastRun) return
      dropPreview()
      await lastRun(Date.now() + Math.floor(Math.random() * 1e6))
    },

    dispose() {
      dropPreview()
      subs.clear()
    },
  }
}
