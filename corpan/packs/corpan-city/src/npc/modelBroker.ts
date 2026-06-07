/**
 * modelBroker — the SINGLE owner of on-device model lifecycle for Corpan City.
 *
 * Enforces the rules in `docs/MODEL_STRATEGY.md §6`:
 *  - Qwen3-4B ("llm-base-qwen3-4b-v1") is the privileged resident; lazy-loaded
 *    on the first `ensureLLM()` and kept hot across NPC turns.
 *  - Idle-unload after ~90–120 s with no NPC interaction (reclaim RAM for the
 *    Babylon world); the next `ensureLLM()` pays the ~2–6 s cold load again.
 *  - Unload immediately on app background / visibility-hidden (a 2.5 GB resident
 *    is prime iOS jetsam bait) and on a memory-pressure warning.
 *  - NEVER two large in-process models hot at once. The broker tracks a single
 *    `inProcessLargeModel ∈ {llm,whisper,none}` slot. Today it OWNS the LLM and
 *    exposes `canLoadWhisper()` / `claimWhisperSlot()` guards the future Whisper
 *    STT path must honor (it must `releaseLLM()` before claiming the slot).
 *
 * If `hostApi.llm` is absent OR the model pack isn't installed, the broker is
 * "unavailable" → the runtime drives the scripted NPC fallback. Every catch logs
 * visibly (project rule: never silently swallow errors).
 */

import type { HostApi } from "./hostTypes"

/** The shared base GGUF, same id tutomaton + every LLM pack reuses on-device. */
export const LLM_MODEL_PACK_ID = "llm-base-qwen3-4b-v1"

const LOG = "[wp/modelBroker]"

export type InProcessLargeModel = "llm" | "whisper" | "none"

/** The state `ensureLLM()` resolves to. `ready:false` ⇒ scripted fallback. */
export type LlmReadyState = {
  ready: boolean
  /** Why it isn't ready (for telemetry/UX). Undefined when ready. */
  reason?: "no-host-llm" | "not-installed" | "load-failed" | "memory" | "busy" | "load-timeout"
  backend?: string | null
}

export type BrokerStatus = {
  /** Whether the LLM is currently resident. */
  llmLoaded: boolean
  /** The single in-process large-model slot. */
  inProcessLargeModel: InProcessLargeModel
  /** Whether a load/unload is in flight. */
  busy: boolean
  /** ms remaining on the idle-unload timer, or null when not armed. */
  idleMsRemaining: number | null
}

export interface ModelBroker {
  /** Lazy-load (or reuse) the resident LLM. Resolves with readiness. */
  ensureLLM(): Promise<LlmReadyState>
  /** Mark the model idle-eligible; (re)arms the idle-unload timer. */
  releaseLLM(): void
  /** Drop the resident model immediately (app background / pressure). */
  onBackground(): void
  status(): BrokerStatus
  /** Cheap probe: is a usable on-device LLM even possible here? */
  llmAvailable(): Promise<boolean>
  /** Guard the future Whisper STT path checks before claiming the in-process slot. */
  canLoadWhisper(): boolean
  /**
   * Claim the in-process large-model slot for Whisper. Throws unless the LLM is
   * already unloaded (the caller MUST `onBackground()`/`releaseLLM()`+await the
   * unload first). Returns a release fn that frees the slot again.
   */
  claimWhisperSlot(): () => void
  /** Tear everything down (cancel timers, unload). */
  dispose(): Promise<void>
}

export function createModelBroker(hostApi: HostApi): ModelBroker {
  let inProcess: InProcessLargeModel = "none"
  let busy = false
  let loadPromise: Promise<LlmReadyState> | null = null
  let idleTimer: ReturnType<typeof setTimeout> | null = null
  let idleDeadline: number | null = null
  let disposed = false
  let backend: string | null = null

  const llm = hostApi.llm

  function clearIdleTimer(): void {
    if (idleTimer !== null) {
      clearTimeout(idleTimer)
      idleTimer = null
    }
    idleDeadline = null
  }

  function armIdleTimer(): void {
    // KEEP QWEN3 HOT (per MODEL_STRATEGY.md): the model stays resident for the
    // whole session. Idle-unloading to reclaim RAM caused `MODEL_NOT_LOADED` (and
    // double-fire on the reload race) when re-engaging an NPC after a pause, and a
    // multi-second mmap reload per conversation is unacceptable. We free the model
    // ONLY on app background (onBackground) / real memory pressure — never on an
    // idle timer. This is intentionally a no-op (kept so callers don't change).
    clearIdleTimer()
  }

  async function unloadLLM(why: string): Promise<void> {
    clearIdleTimer()
    if (!llm || inProcess !== "llm") {
      inProcess = inProcess === "llm" ? "none" : inProcess
      return
    }
    try {
      await llm.unload()
      console.info(`${LOG} unloaded resident LLM (${why}).`)
    } catch (e) {
      // Log loud — a failed unload means we may still be holding ~2.5 GB.
      console.error(`${LOG} unload failed (${why}):`, e)
    } finally {
      inProcess = "none"
      backend = null
    }
  }

  async function llmAvailable(): Promise<boolean> {
    if (!llm) return false
    try {
      // status() may already report it loaded; otherwise the install check.
      const status = await llm.status()
      if (status.loaded && status.modelId === LLM_MODEL_PACK_ID) return true
      return await llm.isInstalled(LLM_MODEL_PACK_ID)
    } catch (e) {
      console.error(`${LOG} llmAvailable probe failed:`, e)
      return false
    }
  }

  /**
   * Race a promise against a timeout, resolving to `fallback` if it doesn't settle
   * in time. Guards against a stuck native invoke (`llm.load`/`status`) hanging the
   * coalesced `loadPromise` FOREVER — which would make every NPC's "…" never clear.
   */
  function withTimeout<T>(p: Promise<T>, ms: number, fallback: T, label: string): Promise<T> {
    return new Promise<T>((resolve) => {
      let done = false
      const t = setTimeout(() => {
        if (done) return
        done = true
        console.error(`${LOG} ${label} timed out after ${ms}ms → ${JSON.stringify(fallback)}`)
        resolve(fallback)
      }, ms)
      p.then(
        (v) => {
          if (done) return
          done = true
          clearTimeout(t)
          resolve(v)
        },
        (e) => {
          if (done) return
          done = true
          clearTimeout(t)
          console.error(`${LOG} ${label} rejected:`, e)
          resolve(fallback)
        },
      )
    })
  }

  async function doEnsure(): Promise<LlmReadyState> {
    if (!llm) {
      return { ready: false, reason: "no-host-llm" }
    }
    // Already resident → just keep it warm.
    if (inProcess === "llm") {
      armIdleTimer()
      return { ready: true, backend }
    }
    if (inProcess === "whisper") {
      // The exclusivity invariant: Whisper holds the slot. The voice path must
      // release it before we can bring the LLM back. Surface, don't force.
      console.warn(`${LOG} ensureLLM blocked — Whisper holds the in-process slot.`)
      return { ready: false, reason: "busy" }
    }
    try {
      const status = await llm.status()
      const alreadyLoaded = status.loaded && status.modelId === LLM_MODEL_PACK_ID
      if (!alreadyLoaded) {
        const installed = await llm.isInstalled(LLM_MODEL_PACK_ID)
        if (!installed) {
          console.warn(`${LOG} model pack "${LLM_MODEL_PACK_ID}" not installed → scripted fallback.`)
          return { ready: false, reason: "not-installed" }
        }
        // Multi-second cold mmap; the UI shows a "thinking" affordance meanwhile.
        await llm.load({ modelPackId: LLM_MODEL_PACK_ID })
      }
      const after = await llm.status().catch(() => null)
      backend = after?.backend ?? status.backend ?? null
      inProcess = "llm"
      armIdleTimer()
      console.info(`${LOG} resident LLM ready (backend=${backend ?? "?"}).`)
      return { ready: true, backend }
    } catch (e) {
      console.error(`${LOG} LLM load failed:`, e)
      // We only reach here from the inProcess === "none" path above (whisper
      // returns early), so a failed load leaves no resident large model.
      inProcess = "none"
      const msg = String((e as { message?: string })?.message ?? e)
      const memory = /memory|jetsam|INSUFFICIENT_MEMORY/i.test(msg)
      return { ready: false, reason: memory ? "memory" : "load-failed" }
    }
  }

  return {
    async ensureLLM(): Promise<LlmReadyState> {
      if (disposed) return { ready: false, reason: "busy" }
      // Coalesce concurrent callers onto one in-flight load.
      if (loadPromise) return loadPromise
      busy = true
      // Hard ceiling on the cold load so a stuck native invoke can't wedge every
      // future NPC turn on a never-settling coalesced promise. 30s is generous for a
      // real multi-GB mmap; past that it's hung → degrade to scripted (and the next
      // open retries, since loadPromise is cleared below).
      loadPromise = withTimeout(
        doEnsure(),
        30000,
        { ready: false, reason: "load-timeout" },
        "ensureLLM",
      ).finally(() => {
        busy = false
        loadPromise = null
      })
      return loadPromise
    },

    releaseLLM(): void {
      // Don't unload now — just become idle-eligible. The timer reclaims it if no
      // further NPC turn re-warms it. This keeps back-to-back conversations fast.
      armIdleTimer()
    },

    onBackground(): void {
      // Aggressive: drop the resident model right away (jetsam bait on iOS bg).
      void unloadLLM("background")
    },

    status(): BrokerStatus {
      return {
        llmLoaded: inProcess === "llm",
        inProcessLargeModel: inProcess,
        busy,
        idleMsRemaining: idleDeadline === null ? null : Math.max(0, idleDeadline - Date.now()),
      }
    },

    llmAvailable,

    canLoadWhisper(): boolean {
      // Whisper is in-process → only when no other large model holds the slot.
      return inProcess === "none"
    },

    claimWhisperSlot(): () => void {
      if (inProcess !== "none") {
        throw new Error(
          `${LOG} cannot claim Whisper slot — "${inProcess}" is resident. ` +
            "Unload the LLM (releaseLLM/onBackground) and await it first.",
        )
      }
      inProcess = "whisper"
      console.info(`${LOG} Whisper claimed the in-process slot.`)
      return () => {
        if (inProcess === "whisper") {
          inProcess = "none"
          console.info(`${LOG} Whisper released the in-process slot.`)
        }
      }
    },

    async dispose(): Promise<void> {
      disposed = true
      clearIdleTimer()
      await unloadLLM("dispose")
    },
  }
}
