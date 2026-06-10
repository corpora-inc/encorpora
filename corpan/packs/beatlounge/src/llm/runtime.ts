/**
 * beatlounge — the LLM grid runtime: an utterance → a legal command list.
 *
 * Pipeline (every step noisy-not-silent, every exit yields a result):
 *
 *   utterance
 *     → buildSystemPrompt(grid) + user turn
 *     → hostApi.llm.chat (temp ~0.3, stop ["<</tool>>"], watchdog)
 *       → interpretReply (parse → validate)
 *         → [on fail] one repair retry
 *           → [still fail / no host / stall] keywordRoute
 *     → resolve sentinels (relative tempo)
 *     → spec.build(args, doc, rng) → { commands, summary }
 *
 * Returns the interpreted ToolCall + summary + commands + the `source` that
 * produced it (model / repair / keyword / keyword-no-llm) so the UI can be
 * honest about what happened. NEVER throws; the catch-all keyword route makes a
 * non-empty utterance ALWAYS produce commands.
 */

import type { Command } from "../model/command"
import type { BeatloungeDoc } from "../model/document"
import type { HostApi, LlmChatHandle } from "../sdk/types"
import type { BeatloungeStore } from "../store/store"
import {
  buildRepairMessage,
  buildSystemPrompt,
  interpretReply,
  TOOL_CLOSE,
  type ToolCall,
} from "./protocol"
import { keywordRoute, TEMPO_BUMP, TEMPO_DROP } from "./keywordFallback"
import { TOOL_BY_NAME } from "./tools"

const LOG = "[bl/llm]"

/** Where the interpreted call came from — surfaced for an honest UI. */
export type ResultSource = "model" | "model-repair" | "keyword" | "keyword-no-llm"

export interface GridRunResult {
  utterance: string
  call: ToolCall
  commands: Command[]
  summary: string
  source: ResultSource
  /** Diagnostic note when we fell back (else undefined). */
  note?: string
}

export interface LlmGridRuntime {
  /** Interpret an utterance into a command list. `seed` makes stochastic tools
   *  reproducible (reroll = a fresh seed). Never throws. */
  run(utterance: string, opts?: { seed?: number }): Promise<GridRunResult>
  /** True if the host exposes an LLM that reports loaded. Async (status call). */
  llmAvailable(): Promise<boolean>
}

export interface LlmGridRuntimeDeps {
  hostApi: HostApi
  store: BeatloungeStore
  /** Override the watchdog window (ms). Default 12000. */
  watchdogMs?: number
  /** Override chat options (temperature, etc.). */
  chatOptions?: Partial<Parameters<NonNullable<HostApi["llm"]>["chat"]>[0]["options"]>
}

/** mulberry32 (same family as runAction) so reroll is reproducible. */
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

/** Resolve keyword sentinels (relative tempo) against the live doc. */
const resolveSentinels = (call: ToolCall, doc: BeatloungeDoc): ToolCall => {
  if (call.name === "setTempo") {
    const bpm = Number(call.args.bpm)
    if (bpm === TEMPO_BUMP) return { ...call, args: { ...call.args, bpm: doc.bpm + 12 } }
    if (bpm === TEMPO_DROP) return { ...call, args: { ...call.args, bpm: doc.bpm - 12 } }
  }
  return call
}

/** Build the final result from a resolved call (shared by every exit path). */
const finalize = (
  utterance: string,
  call: ToolCall,
  doc: BeatloungeDoc,
  rng: () => number,
  source: ResultSource,
  note?: string,
): GridRunResult => {
  const resolved = resolveSentinels(call, doc)
  const spec = TOOL_BY_NAME[resolved.name]
  if (!spec) {
    // Should be impossible (validate rejects unknown tools, keyword emits known
    // names) — but never throw; degrade to a harmless density nudge.
    console.error(`${LOG} finalize got unknown tool "${resolved.name}" — nudging.`)
    const fb = TOOL_BY_NAME.density
    const built = fb.build({ dir: "more", drum: "hat" }, doc, rng)
    return { utterance, call: { name: "density", args: { dir: "more", drum: "hat" } }, ...built, source: "keyword", note: "unknown tool" }
  }
  const built = spec.build(resolved.args, doc, rng)
  return { utterance, call: resolved, commands: built.commands, summary: built.summary, source, note }
}

/**
 * One streamed model turn with a watchdog. Resolves to the full text, or null on
 * error / stall / no-host. Streams with `stop: [TOOL_CLOSE]` so the model can't
 * run past its single tool call (the proven corpan-city pattern).
 */
const streamOnce = (
  hostApi: HostApi,
  messages: { role: "system" | "user" | "assistant"; content: string }[],
  watchdogMs: number,
  chatOptions: Record<string, unknown> | undefined,
): Promise<string | null> =>
  new Promise<string | null>((resolve) => {
    if (!hostApi.llm) {
      resolve(null)
      return
    }
    let settled = false
    let handle: LlmChatHandle | null = null
    let watchdog: ReturnType<typeof setTimeout> | null = null
    let acc = ""
    const finish = (out: string | null) => {
      if (settled) return
      settled = true
      if (watchdog) clearTimeout(watchdog)
      watchdog = null
      resolve(out)
    }
    watchdog = setTimeout(() => {
      if (settled) return
      console.error(`${LOG} watchdog: no token/done/error in ${watchdogMs}ms — falling back.`)
      try {
        void handle?.cancel?.()
      } catch (e) {
        console.error(`${LOG} watchdog cancel threw:`, e)
      }
      finish(acc.trim() ? acc : null)
    }, watchdogMs)

    void hostApi.llm
      .chat(
        {
          messages,
          options: {
            temperature: 0.3,
            topP: 0.9,
            repeatPenalty: 1.1,
            maxTokens: 120,
            stop: [TOOL_CLOSE],
            ...chatOptions,
          },
        },
        {
          onToken: (tk) => {
            acc += tk
            // First real token → cancel the watchdog (never cut off a live stream).
            if (watchdog) {
              clearTimeout(watchdog)
              watchdog = null
            }
          },
          onDone: (full) => finish((full || acc).trim() || null),
          onError: (err) => {
            console.error(`${LOG} chat error:`, err)
            finish(acc.trim() ? acc : null)
          },
        },
      )
      .then((h) => {
        handle = h
      })
      .catch((e) => {
        console.error(`${LOG} chat failed to start:`, e)
        finish(null)
      })
  })

export const createLlmGridRuntime = (deps: LlmGridRuntimeDeps): LlmGridRuntime => {
  const { hostApi, store } = deps
  const watchdogMs = deps.watchdogMs ?? 12000
  const chatOptions = deps.chatOptions as Record<string, unknown> | undefined

  const doc = () => store.vanilla.getState().doc

  return {
    async llmAvailable() {
      if (!hostApi.llm) return false
      try {
        const status = await hostApi.llm.status()
        return Boolean(status.loaded)
      } catch (e) {
        console.error(`${LOG} llm.status() threw:`, e)
        return false
      }
    },

    async run(utterance, opts) {
      const rng = mulberry32(opts?.seed ?? Date.now())
      const text = utterance.trim()
      const current = doc()

      // Empty utterance: nothing to do (the bar guards this, but be safe).
      if (!text) {
        return { utterance, call: { name: "density", args: {} }, commands: [], summary: "Say what you'd like to change", source: "keyword", note: "empty" }
      }

      // No host LLM → straight to the deterministic router.
      if (!hostApi.llm) {
        const call = keywordRoute(text) ?? { name: "density", args: { dir: "more", drum: "hat" } }
        return finalize(text, call, current, rng, "keyword-no-llm", "no host LLM")
      }

      const system = buildSystemPrompt(current)
      const messages = [
        { role: "system" as const, content: system },
        { role: "user" as const, content: text },
      ]

      // --- attempt 1: model ---
      const first = await streamOnce(hostApi, messages, watchdogMs, chatOptions)
      if (first) {
        const interp = interpretReply(first)
        if (interp.ok) return finalize(text, interp.call, doc(), rng, "model")
        console.warn(`${LOG} first reply unusable (${interp.reason}); retrying once.`)
        // --- attempt 2: one repair retry ---
        const repaired = await streamOnce(
          hostApi,
          [...messages, { role: "assistant" as const, content: first }, { role: "user" as const, content: buildRepairMessage(first, interp.reason) }],
          watchdogMs,
          chatOptions,
        )
        if (repaired) {
          const interp2 = interpretReply(repaired)
          if (interp2.ok) return finalize(text, interp2.call, doc(), rng, "model-repair")
          console.warn(`${LOG} repair reply still unusable (${interp2.reason}); keyword fallback.`)
        } else {
          console.warn(`${LOG} repair attempt produced nothing; keyword fallback.`)
        }
      } else {
        console.warn(`${LOG} model produced nothing; keyword fallback.`)
      }

      // --- fallback: deterministic keyword route (always yields a call) ---
      const call = keywordRoute(text) ?? { name: "density", args: { dir: "more", drum: "hat" } }
      return finalize(text, call, doc(), rng, "keyword", "model unusable")
    },
  }
}
