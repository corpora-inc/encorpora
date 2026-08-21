// src/store/stt.ts — the `corpan-stt-v1` zustand store: THE single source of
// truth for the on-device Whisper model + mic state (WS-B / R5).
//
// Why this exists: before this store, journey pronunciation, the pronounce
// capability, and the parlometron pack each kept their own idea of "which model
// is usable" and "has the mic been primed". They disagreed — most damagingly,
// journey's warm-up called `stt.prepare()` with NO model, which the native
// default resolves to ggml-tiny.bin and (when a bigger model was resident)
// UNLOADED the good model then reported MODEL_NOT_INSTALLED. That recurrence is
// killed by routing every warm-up through `ensurePrepared`, which ALWAYS
// resolves a concrete installed folder first and never issues a bare prepare().
//
// Persisted: the user's preferred model folder (migrated from parlometron), the
// one-time mic-priming timestamp, and whether the mic permission was granted.
// Ephemeral (re-probed each launch): installed folders, readiness, the active
// (prepared) folder, and the engine load state.

import { create } from "zustand"
import { persist, createJSONStorage } from "zustand/middleware"
import type { CapabilitySttApi } from "@shared/capabilities/core"
import { formatErr } from "@shared/capabilities/core"
// Deep import (not the pronounce index) so this store carries no DOM/CSS side of
// the capability — keeps it loadable under the app's node test runner.
import { prepareWithMemoryRetry } from "@shared/capabilities/pronounce/src/recorder"
import {
  modelById,
  modelByFolder,
} from "@shared/capabilities/pronounce/src/modelRegistry"
import {
  pickBestFolder,
  probeInstalledFolders,
} from "@shared/capabilities/pronounce/src/modelPick"

/** Whisper readiness on this device (mirrors the runtime's SttReadiness plus an
 *  `unknown` pre-probe state). */
export type SttStoreReadiness = "unknown" | "unsupported" | "modelMissing" | "installed"
export type SttEngineState = "idle" | "loading" | "ready" | "error"

/** Parlometron persists its solo picker under this key; we migrate its `mode`
 *  (a model id) into `preferredModelFolder` so a model the user chose in the
 *  pack is honoured by journey too. We NEVER write this key. */
const PARLOMETRON_KEY = "corpan-pronunciation-coach:v2"

const readParlometronMode = (): string | null => {
  if (typeof localStorage === "undefined") return null
  try {
    const raw = localStorage.getItem(PARLOMETRON_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as { mode?: unknown }
    return typeof parsed.mode === "string" ? parsed.mode : null
  } catch (err) {
    console.warn("[stt-store] parlometron parse failed:", err)
    return null
  }
}

const parlometronStateExists = (): boolean => {
  if (typeof localStorage === "undefined") return false
  try {
    return localStorage.getItem(PARLOMETRON_KEY) != null
  } catch {
    return false
  }
}

const TINY_FOLDER = "ggml-tiny.bin"

const prepareTimeoutFor = (folder: string): number =>
  (modelByFolder(folder)?.approxSizeMB ?? 0) >= 1000 ? 180_000 : 60_000

export interface SttStoreState {
  // -- persisted -----------------------------------------------------------
  /** The model folder the user prefers (migrated from parlometron's `mode`).
   *  `resolveModelFolder` honours it when it is actually installed. */
  preferredModelFolder: string | null
  /** ISO timestamp of when the mic-priming card was first shown — null until
   *  it has been shown. Used to guarantee the card shows AT MOST ONCE (R2). */
  micIntroShownAt: string | null
  /** True once a mic session started successfully (permission granted). */
  micPermissionGranted: boolean

  // -- ephemeral (re-probed per launch) ------------------------------------
  installedFolders: string[]
  readiness: SttStoreReadiness
  /** The folder actually prepared/loaded for scoring this session. */
  activeModelFolder: string | null
  engineState: SttEngineState
  engineError: string | null

  // -- actions -------------------------------------------------------------
  /** THE one probe: refresh installed folders + readiness off the live stt
   *  seam. Also seeds `micIntroShownAt` for existing users who already have a
   *  real (non-tiny) model installed, so they never see the priming card. */
  refreshInstalled: (stt: CapabilitySttApi | undefined | null) => Promise<void>
  /** preferred-if-installed → loaded-if-installed → largest installed → null. */
  resolveModelFolder: () => string | null
  /** Single-flight: resolve a concrete installed folder and prepare it with the
   *  memory-retry loop. NEVER issues a bare `prepare()`; NEVER triggers a
   *  download. No usable model → no-op (the caller degrades / offers install). */
  ensurePrepared: (stt: CapabilitySttApi | undefined | null) => Promise<void>
  setPreferredModel: (folder: string | null) => void
  noteMicIntroShown: () => void
  noteMicGranted: () => void
  noteMicDenied: () => void
  /** Record that `folder` is now the loaded/active model (engine ready). */
  noteEngineLoaded: (folder: string) => void
  /** Re-read the parlometron preference so a pack-side model switch propagates
   *  into journey. Called at each journey session build. */
  syncPreferredFromParlometron: () => void
}

// Single-flight guard for ensurePrepared — a module-level (store is a
// singleton), so overlapping warm-ups share one in-flight prepare.
let ensureInFlight: Promise<void> | null = null

export const useSttStore = create<SttStoreState>()(
  persist(
    (set, get) => ({
      preferredModelFolder: null,
      micIntroShownAt: null,
      micPermissionGranted: false,

      installedFolders: [],
      readiness: "unknown",
      activeModelFolder: null,
      engineState: "idle",
      engineError: null,

      refreshInstalled: async (stt) => {
        if (!stt) {
          set({ readiness: "unsupported", installedFolders: [] })
          return
        }
        let supported = true
        try {
          supported = await stt.isAvailable()
        } catch {
          // Transient bridge hiccup — assume supported, let the model probe
          // decide (a throw here is not a definitive "no").
          supported = true
        }
        if (!supported) {
          set({ readiness: "unsupported", installedFolders: [] })
          return
        }
        const { installed, loaded } = await probeInstalledFolders(stt)
        const patch: Partial<SttStoreState> = {
          installedFolders: installed,
          readiness: installed.length > 0 ? "installed" : "modelMissing",
        }
        if (loaded) patch.activeModelFolder = loaded
        // Existing users who already installed a real (non-tiny) model have
        // clearly used pronunciation before — never prime them (R2).
        if (
          get().micIntroShownAt == null &&
          installed.some((f) => f !== TINY_FOLDER)
        ) {
          patch.micIntroShownAt = new Date().toISOString()
        }
        set(patch)
      },

      resolveModelFolder: () => {
        const s = get()
        return pickBestFolder(
          s.installedFolders,
          s.activeModelFolder,
          s.preferredModelFolder,
        )
      },

      ensurePrepared: async (stt) => {
        if (!stt) return
        if (ensureInFlight) return ensureInFlight
        ensureInFlight = (async () => {
          // Make sure we know what's installed before resolving a folder.
          if (get().readiness === "unknown" || get().installedFolders.length === 0) {
            await get().refreshInstalled(stt).catch(() => {})
          }
          const folder = get().resolveModelFolder()
          if (!folder) {
            // Nothing usable installed — do NOT download, do NOT bare-prepare.
            set({ engineState: "idle" })
            return
          }
          if (get().activeModelFolder === folder && get().engineState === "ready") {
            return // already prepared this exact folder
          }
          set({ engineState: "loading", engineError: null })
          try {
            await prepareWithMemoryRetry(stt, folder, {
              timeoutMs: prepareTimeoutFor(folder),
              label: `Loading ${modelByFolder(folder)?.label ?? "model"} model`,
            })
            set({
              activeModelFolder: folder,
              engineState: "ready",
              engineError: null,
            })
          } catch (err) {
            console.error("[stt-store] ensurePrepared failed:", err)
            set({ engineState: "error", engineError: formatErr(err) })
          }
        })().finally(() => {
          ensureInFlight = null
        })
        return ensureInFlight
      },

      setPreferredModel: (folder) => set({ preferredModelFolder: folder }),

      noteMicIntroShown: () => {
        if (get().micIntroShownAt != null) return
        set({ micIntroShownAt: new Date().toISOString() })
      },

      noteMicGranted: () => {
        if (!get().micPermissionGranted) set({ micPermissionGranted: true })
      },

      noteMicDenied: () => {
        if (get().micPermissionGranted) set({ micPermissionGranted: false })
      },

      noteEngineLoaded: (folder) =>
        set({
          activeModelFolder: folder,
          engineState: "ready",
          engineError: null,
        }),

      syncPreferredFromParlometron: () => {
        const mode = readParlometronMode()
        if (!mode) return
        const folder = modelById(mode)?.folder
        if (folder && folder !== get().preferredModelFolder) {
          set({ preferredModelFolder: folder })
        }
      },
    }),
    {
      name: "corpan-stt-v1",
      version: 1,
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({
        preferredModelFolder: s.preferredModelFolder,
        micIntroShownAt: s.micIntroShownAt,
        micPermissionGranted: s.micPermissionGranted,
      }),
    },
  ),
)

// One-time migration from parlometron's localStorage, run right after the
// (synchronous, localStorage-backed) store hydrates. Existing pronunciation
// users keep their model preference and never see the priming card.
if (typeof localStorage !== "undefined") {
  try {
    const st = useSttStore.getState()
    const patch: Partial<SttStoreState> = {}
    if (!st.preferredModelFolder) {
      const mode = readParlometronMode()
      const folder = mode ? modelById(mode)?.folder : undefined
      if (folder) patch.preferredModelFolder = folder
    }
    // Seed the priming timestamp if the user has clearly used pronunciation
    // before (a parlometron state exists) — they don't need the intro (R2).
    if (st.micIntroShownAt == null && parlometronStateExists()) {
      patch.micIntroShownAt = new Date().toISOString()
    }
    if (Object.keys(patch).length > 0) useSttStore.setState(patch)
  } catch (err) {
    console.warn("[stt-store] parlometron migration failed:", err)
  }
}
