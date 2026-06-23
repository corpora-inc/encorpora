/**
 * ModelManager — the on-device base-model lifecycle for Tutomaton.
 *
 * Tutomaton's tutor runs a Qwen3 GGUF (delivered as a content-pack ZIP, reused
 * by every LLM pack on the device). One size does not fit all: the 4B
 * OOM-crashes low-RAM phones, so the manager picks a size to fit the device
 * (see `modelTiering.ts`) — a *recommended* size (biggest that runs safely) the
 * user can override via the picker. It owns the one-time setup before chatting:
 *
 *   checking → (ready)                         // already loaded
 *   checking → loading → ready                 // installed, just load it
 *   checking → needs-install → downloading →   // first run: fetch the model
 *               installing → loading → ready
 *   checking → unsupported                     // no installable size fits today
 *   …→ error (with retry)
 *
 * It drives a single `onPhase` callback the UI renders; it never touches the DOM
 * itself. All native access goes through `hostApi.llm` (status/isInstalled/
 * install/load) — never `window.__TAURI__`.
 */

import type { HostApi } from "./languageManager"
import {
  MODELS,
  modelById,
  recommendedContext,
  selectTier,
  type ModelId,
  type ModelSpec,
  type ModelState,
} from "./modelTiering"

/** Backward-compatible default reference (the historical single base model). */
export const BASE_MODEL = modelById("llm-base-qwen3-4b-v1")

export type ModelPhase =
  | { kind: "checking" }
  | { kind: "needs-install"; modelId: ModelId; displayName: string; sizeMb: number }
  | { kind: "downloading"; pct: number; downloadedMb: number; totalMb: number }
  | { kind: "installing"; message: string }
  | { kind: "loading" }
  | { kind: "ready"; backend: string; modelId: ModelId }
  | { kind: "unsupported"; message: string }
  | { kind: "error"; message: string; canRetry: boolean }

export type ModelPhaseListener = (phase: ModelPhase) => void

/** A device's tiering result + which size is currently chosen. */
export type DeviceTier = {
  totalRamMb: number | null
  recommendedId: ModelId
  chosenId: ModelId
  stateById: Record<ModelId, ModelState>
}

const NO_LLM = "On-device AI isn't available in this version of the app."
const STORAGE_KEY = "tutomaton.modelSize"

export class ModelManager {
  private readonly hostApi: HostApi
  private readonly onPhase: ModelPhaseListener
  private phase: ModelPhase = { kind: "checking" }
  private busy = false
  private tier: DeviceTier | null = null
  private activeId: ModelId | null = null

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

  /** The device tier (null until the first `check()` probes RAM). */
  deviceTier(): DeviceTier | null {
    return this.tier
  }

  /** The catalogue of sizes (smallest→largest) for the picker UI. */
  models(): readonly ModelSpec[] {
    return MODELS
  }

  /** The model currently loaded/ready (null until `ready`). Lets the chat layer
   *  send the non-thinking prefill for hybrid models. */
  activeModel(): ModelSpec | null {
    return this.activeId ? modelById(this.activeId) : null
  }

  /** Which sizes are already downloaded on disk (for the picker UI). */
  async installStates(): Promise<Record<ModelId, boolean>> {
    const llm = this.hostApi.llm
    const out = {} as Record<ModelId, boolean>
    await Promise.all(
      MODELS.map(async (m) => {
        out[m.id] = llm ? await llm.isInstalled(m.id).catch(() => false) : false
      }),
    )
    return out
  }

  /**
   * One-tap "use this size" for the picker: persist the choice, then drive all
   * the way to `ready` — downloading + installing first if the size isn't on
   * disk, otherwise just loading it (which swaps out the current model). A no-op
   * for a disabled size or the already-active one.
   */
  async useModel(id: ModelId): Promise<ModelPhase> {
    const tier = await this.ensureTier()
    if (tier.stateById[id] === "disabled") return this.phase
    if (this.activeId === id && this.phase.kind === "ready") return this.phase
    await this.choose(id) // persists + re-runs check() → ready | needs-install | unsupported
    if (this.phase.kind === "needs-install") return await this.installAndLoad()
    return this.phase
  }

  /**
   * Change the chosen model size (from the picker). Persists the pick and
   * re-runs `check()` so the UI advances to the new size's phase. A no-op if
   * the id is unknown or unchanged.
   */
  async choose(id: ModelId): Promise<ModelPhase> {
    if (!this.tier || this.tier.chosenId === id) return this.phase
    if (!MODELS.some((m) => m.id === id)) return this.phase
    this.tier = { ...this.tier, chosenId: id }
    storeChoice(id)
    return await this.check()
  }

  private set(phase: ModelPhase): ModelPhase {
    this.phase = phase
    this.activeId = phase.kind === "ready" ? phase.modelId : null
    try {
      this.onPhase(phase)
    } catch (e) {
      console.error("[tutomaton/model] onPhase listener threw:", e)
    }
    return phase
  }

  /** Probe device RAM (once) and compute the tier + chosen size. */
  private async ensureTier(): Promise<DeviceTier> {
    if (this.tier) return this.tier
    let totalRamMb: number | null = null
    try {
      const status = await this.hostApi.llm?.status()
      totalRamMb = status?.totalMemoryMb ?? null
    } catch {
      // Can't probe → treat as unknown ("assume capable" in selectTier).
    }
    const { recommendedId, stateById } = selectTier(totalRamMb, { metal: isAppleMetal() })
    const stored = readStoredChoice()
    // Honour a stored pick only if it isn't disabled on this device.
    const chosenId =
      stored && stateById[stored] !== "disabled" ? stored : recommendedId
    this.tier = { totalRamMb, recommendedId, chosenId, stateById }
    return this.tier
  }

  /**
   * The size to actually install/load: the chosen size if it's published and
   * runnable here, else the recommended size, else the largest published size
   * that isn't disabled. `null` when nothing installable fits the device yet
   * (e.g. a small phone before the small GGUFs are published).
   */
  private resolveInstallable(tier: DeviceTier): ModelSpec | null {
    const tryOrder: ModelId[] = [
      tier.chosenId,
      tier.recommendedId,
      ...[...MODELS].reverse().map((m) => m.id), // largest→smallest
    ]
    const seen = new Set<ModelId>()
    for (const id of tryOrder) {
      if (seen.has(id)) continue
      seen.add(id)
      const spec = modelById(id)
      if (!spec.published) continue
      if (tier.stateById[id] === "disabled") continue
      return spec
    }
    return null
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

      const tier = await this.ensureTier()
      const model = this.resolveInstallable(tier)
      if (!model) {
        return this.set({
          kind: "unsupported",
          message: unsupportedMessage(tier),
        })
      }

      const status = await llm.status()
      if (status.loaded && status.modelId === model.id) {
        return this.set({ kind: "ready", backend: status.backend || "cpu", modelId: model.id })
      }
      const installed = await llm.isInstalled(model.id)
      if (installed) return await this.loadInstalled(model, tier)
      return this.set({
        kind: "needs-install",
        modelId: model.id,
        displayName: model.displayName,
        sizeMb: model.sizeMb,
      })
    } catch (e) {
      return this.set({ kind: "error", message: errMsg(e), canRetry: true })
    } finally {
      this.busy = false
    }
  }

  /**
   * User-initiated: download+install the chosen model if needed, then load it.
   * Streams `downloading`/`installing`/`loading` phases and ends at `ready`,
   * `unsupported`, or `error`.
   */
  async installAndLoad(): Promise<ModelPhase> {
    if (this.busy) return this.phase
    this.busy = true
    try {
      const llm = this.hostApi.llm
      if (!llm) return this.set({ kind: "error", message: NO_LLM, canRetry: false })

      const tier = await this.ensureTier()
      const model = this.resolveInstallable(tier)
      if (!model) return this.set({ kind: "unsupported", message: unsupportedMessage(tier) })

      const alreadyInstalled = await llm.isInstalled(model.id).catch(() => false)
      if (!alreadyInstalled) {
        this.set({ kind: "downloading", pct: 0, downloadedMb: 0, totalMb: model.sizeMb })
        await llm.install({ packId: model.id, url: model.url }, (pr) => {
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
      return await this.loadInstalled(model, tier)
    } catch (e) {
      return this.set({ kind: "error", message: errMsg(e), canRetry: true })
    } finally {
      this.busy = false
    }
  }

  /**
   * Free the resident model when the app is backgrounded so a low-RAM device
   * can't OOMKill the whole app under memory pressure. Sets a non-ready phase so
   * the composer disables until `check()` reloads it on resume. No-op if not
   * currently loaded or already busy.
   */
  async unloadForBackground(): Promise<void> {
    if (this.busy || this.phase.kind !== "ready") return
    try {
      await this.hostApi.llm?.unload()
    } catch (e) {
      console.error("[tutomaton/model] background unload failed:", e)
      return
    }
    this.set({ kind: "loading" }) // resume → check() reloads → ready
  }

  /** Load an already-installed model into memory (mmap; a few seconds cold). */
  private async loadInstalled(model: ModelSpec, tier: DeviceTier): Promise<ModelPhase> {
    const llm = this.hostApi.llm!
    this.set({ kind: "loading" })
    await llm.load({
      modelPackId: model.id,
      contextSize: recommendedContext(model.id, tier.totalRamMb),
    })
    const status = await llm.status().catch(() => null)
    return this.set({ kind: "ready", backend: status?.backend || "cpu", modelId: model.id })
  }
}

/** Apple devices get Metal GPU offload, which makes the 4B comfortable lower. */
function isAppleMetal(): boolean {
  try {
    const ua = typeof navigator !== "undefined" ? navigator.userAgent : ""
    return /iPhone|iPad|iPod|Macintosh|Mac OS X/.test(ua)
  } catch {
    return false
  }
}

function unsupportedMessage(tier: DeviceTier): string {
  const ram = tier.totalRamMb ? `${Math.round(tier.totalRamMb / 1024)} GB` : "this device"
  return `The on-device tutor isn't available for ${ram} yet.`
}

function readStoredChoice(): ModelId | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw && MODELS.some((m) => m.id === raw) ? (raw as ModelId) : null
  } catch {
    return null
  }
}

function storeChoice(id: ModelId): void {
  try {
    localStorage.setItem(STORAGE_KEY, id)
  } catch {
    // Storage unavailable → the in-memory tier still reflects the pick.
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
