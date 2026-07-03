// The capability-module contract (capability-modules.md §2).
//
// A capability module is the reusable guts of an experience — mounted
// in-process by the owning pack, Journey cards, and pop-in sheets:
//
//   mount(container, hostApi, spec) → { result, pause, resume, dispose }
//
// Same ABI direction as everything else (D2), zero pack-mount cost.
import type { ActivitySpec, ActivityResult, ModelNeed } from "./activity"
import type { CapabilityHostApi } from "./hostSlice"

export interface CapabilityHandle {
  /**
   * Settles EXACTLY ONCE with the run's result. NEVER rejects (runChallenge
   * precedent, corpan-city registry.ts): internal errors resolve
   * `{ abandoned: true, score: 0, detail: { ... } }`.
   */
  result: Promise<ActivityResult>
  /**
   * Freeze the run: stop timers, pause audio, cancel any in-flight recording
   * session (mic released). Idempotent. Wired by hosts to `corpan:host-pause`
   * and by Journey to card-offscreen.
   */
  pause(): void
  /** Undo pause. Idempotent. Does not replay lost stimulus automatically. */
  resume(): void
  /**
   * Tear down DOM, listeners, audio, STT sessions (MUST call `stt.releaseAudio`
   * if a session was opened — iOS mic-indicator rule, hostApi.ts contract).
   * If `result` has not settled, it settles first with `abandoned: true`.
   * Idempotent; safe to call after settle.
   */
  dispose(): void
}

export type CapabilityMount = (
  container: HTMLElement,
  hostApi: CapabilityHostApi,
  spec: ActivitySpec,
) => CapabilityHandle

export type CapabilityAvailability =
  | { state: "ready" }
  /** Runnable after a download the user must approve. */
  | { state: "needs-model"; model: ModelNeed; sizeMB?: number }
  | { state: "needs-content"; kind: "narration" | "data-pack"; packId: string; sizeMB?: number }
  /** Never runnable here (platform / permanently missing host seam). */
  | { state: "unavailable"; reason: string }

export interface CapabilityMeta {
  /** `cap-<name>`, matches ActivitySpec.activityType. */
  id: string
  /** Semver of the module's OWN contract (params/detail shape). */
  version: string
  modelNeeds: ModelNeed[]
  /** The CSS class prefix this module owns (§2.4), e.g. "capPron". */
  cssPrefix: string
  /** Optional HostApi members the module uses (feature-detects all of them). */
  usesHostApis: string[]
}

export interface CapabilityModule {
  meta: CapabilityMeta
  mount: CapabilityMount
  /**
   * Cheap, side-effect-free probe: can this spec run right now on this host?
   * MUST NOT download anything or load models (parlometron rule: prepare() is
   * local-only).
   */
  checkAvailability(
    hostApi: CapabilityHostApi,
    spec?: ActivitySpec,
  ): Promise<CapabilityAvailability>
}
