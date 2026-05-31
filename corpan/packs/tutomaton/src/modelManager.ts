/**
 * ModelManager — the on-device base-model lifecycle for Tutomaton.
 *
 * Tutomaton's tutor runs on a shared base GGUF (Qwen3-4B) delivered as a
 * content-pack ZIP and reused by every LLM pack on the device. This manager owns
 * the one-time setup the user sees before chatting:
 *
 *   checking → (ready)                         // already loaded
 *   checking → loading → ready                 // installed, just load it
 *   checking → needs-install → downloading →   // first run: fetch ~2.4 GB
 *               installing → loading → ready
 *   …→ error (with retry)
 *
 * It drives a single `onPhase` callback the UI renders; it never touches the DOM
 * itself. All native access goes through `hostApi.llm` (status/isInstalled/
 * install/load) — never `window.__TAURI__`.
 */

import type { HostApi } from "./languageManager"

/** The shared base model. One entry today; this is the registry to grow. */
export const BASE_MODEL = {
  id: "llm-base-qwen3-4b-v1",
  displayName: "Qwen3 4B",
  quant: "Q4_K_M",
  url: "https://d38iwc9748jekz.cloudfront.net/corpan/llm-packs/llm-base-qwen3-4b-v1-0.1.0-full.zip",
  /** Approx download size for UX copy (actual bytes come from the stream). */
  sizeMb: 2497,
} as const

export type ModelPhase =
  | { kind: "checking" }
  | { kind: "needs-install"; sizeMb: number }
  | { kind: "downloading"; pct: number; downloadedMb: number; totalMb: number }
  | { kind: "installing"; message: string }
  | { kind: "loading" }
  | { kind: "ready"; backend: string }
  | { kind: "error"; message: string; canRetry: boolean }

export type ModelPhaseListener = (phase: ModelPhase) => void

const NO_LLM = "On-device AI isn't available in this version of the app."

export class ModelManager {
  private readonly hostApi: HostApi
  private readonly onPhase: ModelPhaseListener
  private phase: ModelPhase = { kind: "checking" }
  private busy = false

  constructor(hostApi: HostApi, onPhase: ModelPhaseListener) {
    this.hostApi = hostApi
    this.onPhase = onPhase
  }

  current(): ModelPhase {
    return this.phase
  }

  isReady(): boolean {
    return this.phase.kind === "ready"
  }

  private set(phase: ModelPhase): ModelPhase {
    this.phase = phase
    try {
      this.onPhase(phase)
    } catch (e) {
      console.error("[tutomaton/model] onPhase listener threw:", e)
    }
    return phase
  }

  /**
   * Determine current readiness and advance as far as possible WITHOUT a large
   * download: if the model is already installed we load it; if not we stop at
   * `needs-install` and wait for `installAndLoad()` (a user action).
   */
  async check(): Promise<ModelPhase> {
    if (this.busy) return this.phase
    this.busy = true
    try {
      this.set({ kind: "checking" })
      const llm = this.hostApi.llm
      if (!llm) return this.set({ kind: "error", message: NO_LLM, canRetry: false })

      const status = await llm.status()
      if (status.loaded && status.modelId === BASE_MODEL.id) {
        return this.set({ kind: "ready", backend: status.backend || "cpu" })
      }
      const installed = await llm.isInstalled(BASE_MODEL.id)
      if (installed) return await this.loadLoaded()
      return this.set({ kind: "needs-install", sizeMb: BASE_MODEL.sizeMb })
    } catch (e) {
      return this.set({ kind: "error", message: errMsg(e), canRetry: true })
    } finally {
      this.busy = false
    }
  }

  /**
   * User-initiated: download+install the model if needed, then load it. Streams
   * `downloading`/`installing`/`loading` phases and ends at `ready` or `error`.
   */
  async installAndLoad(): Promise<ModelPhase> {
    if (this.busy) return this.phase
    this.busy = true
    try {
      const llm = this.hostApi.llm
      if (!llm) return this.set({ kind: "error", message: NO_LLM, canRetry: false })

      const alreadyInstalled = await llm.isInstalled(BASE_MODEL.id).catch(() => false)
      if (!alreadyInstalled) {
        this.set({ kind: "downloading", pct: 0, downloadedMb: 0, totalMb: BASE_MODEL.sizeMb })
        await llm.install({ packId: BASE_MODEL.id, url: BASE_MODEL.url }, (pr) => {
          if (pr.stage === "downloading" && pr.total > 0) {
            this.set({
              kind: "downloading",
              pct: Math.min(100, Math.round((pr.progress / pr.total) * 100)),
              downloadedMb: Math.round(pr.progress / 1_048_576),
              totalMb: Math.round(pr.total / 1_048_576),
            })
          } else if (
            pr.stage === "verifying" ||
            pr.stage === "extracting" ||
            pr.stage === "finalizing"
          ) {
            this.set({ kind: "installing", message: humanizeStage(pr.stage) })
          }
        })
      }
      return await this.loadLoaded()
    } catch (e) {
      return this.set({ kind: "error", message: errMsg(e), canRetry: true })
    } finally {
      this.busy = false
    }
  }

  /** Load an already-installed model into memory (mmap; a few seconds cold). */
  private async loadLoaded(): Promise<ModelPhase> {
    const llm = this.hostApi.llm!
    this.set({ kind: "loading" })
    await llm.load({ modelPackId: BASE_MODEL.id })
    const status = await llm.status().catch(() => null)
    return this.set({ kind: "ready", backend: status?.backend || "cpu" })
  }
}

function humanizeStage(stage: string): string {
  switch (stage) {
    case "verifying":
      return "Verifying download…"
    case "extracting":
      return "Unpacking the model…"
    case "finalizing":
      return "Finishing up…"
    default:
      return "Installing…"
  }
}

function errMsg(e: unknown): string {
  if (e instanceof Error) return e.message
  if (e && typeof e === "object") {
    const o = e as { message?: string; error?: string; code?: string }
    return o.message ?? o.error ?? o.code ?? String(e)
  }
  return String(e)
}
